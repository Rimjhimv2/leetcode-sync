// content.js — Injected into leetcode.com/problems/*
// Detects successful submissions and triggers sync

(function () {
  "use strict";

  let pollInterval = null;
  const lastSyncedCodeHash = {};

  function init() {
    let lastUrl = location.href;
    new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        onUrlChange();
      }
    }).observe(document.body, { subtree: true, childList: true });
    onUrlChange();
  }

  function onUrlChange() {
    stopPolling();
    if (location.pathname.includes("/problems/")) {
      startPolling();
    }
  }

  function startPolling() {
    if (pollInterval) return;
    pollInterval = setInterval(checkForAcceptedSubmission, 3000);
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  function checkForAcceptedSubmission() {
    const resultEl = document.querySelector('[data-e2e-locator="submission-result"]');
    if (!resultEl) return;
    if (resultEl.textContent.trim() !== "Accepted") return;

    const slugMatch = location.pathname.match(/\/problems\/([^/]+)/);
    if (!slugMatch) return;
    const problemSlug = slugMatch[1];

    // ✅ Get submission ID from URL if available
    const submissionMatch = location.href.match(/\/submissions\/(\d+)/);
    const submissionId = submissionMatch ? submissionMatch[1] : null;

    stopPolling();
    setTimeout(() => extractAndSync(problemSlug, submissionId), 1500);
  }

  async function extractAndSync(problemSlug, submissionId) {
    try {
      const config = await getConfig();
      if (!config.token || !config.repo) {
        showToast("⚠️ LeetSync: GitHub not configured.", "warn");
        startPolling();
        return;
      }
      if (config.autoSync === false) { startPolling(); return; }

      const payload = await extractProblemData(problemSlug, submissionId);
      if (!payload) { startPolling(); return; }

      // ✅ Hash check — block if same code
      const currentHash = simpleHash(payload.code);
      if (lastSyncedCodeHash[problemSlug] === currentHash) {
        console.log("[LeetSync] Code unchanged, skipping.");
        startPolling();
        return;
      }
      lastSyncedCodeHash[problemSlug] = currentHash;

      showToast("🔄 LeetSync: Syncing to GitHub...", "info");

      chrome.runtime.sendMessage({ type: "SYNC_SOLUTION", payload }, (response) => {
        if (chrome.runtime.lastError) { startPolling(); return; }
        if (response?.success) {
          showToast(`✅ LeetSync: Synced!`, "success", response.result?.commitUrl);
        } else {
          showToast(`❌ LeetSync: ${response?.error || "Sync failed"}`, "error");
        }
        startPolling();
      });
    } catch (err) {
      console.error("[LeetSync]", err);
      startPolling();
    }
  }

  async function extractProblemData(problemSlug, submissionId) {
    let problemNumber = "", apiTitle, apiDifficulty, apiTags;
    let apiDescription, apiExamples, apiConstraints;
    let submissionCode = "", submissionLang = "";

    // ✅ FIX 1: Fetch submission details from LeetCode API to get FULL code + language
    if (submissionId) {
      try {
        const res = await fetch("https://leetcode.com/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `query submissionDetails($submissionId: Int!) {
              submissionDetails(submissionId: $submissionId) {
                code
                lang { name verboseName }
              }
            }`,
            variables: { submissionId: parseInt(submissionId) },
          }),
        });
        const data = await res.json();
        const details = data?.data?.submissionDetails;
        if (details) {
          submissionCode = details.code || "";
          submissionLang = details.lang?.verboseName || details.lang?.name || "";
        }
      } catch (e) {
        console.warn("[LeetSync] Submission fetch failed", e);
      }
    }

    // ✅ FIX 2: Fetch problem details including full description
    try {
      const res = await fetch("https://leetcode.com/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `query getQuestion($titleSlug: String!) {
            question(titleSlug: $titleSlug) {
              questionFrontendId
              title
              difficulty
              topicTags { name }
              content
            }
          }`,
          variables: { titleSlug: problemSlug },
        }),
      });
      const data = await res.json();
      const q = data?.data?.question;
      if (q) {
        problemNumber = q.questionFrontendId;
        apiTitle = q.title;
        apiDifficulty = q.difficulty;
        apiTags = q.topicTags.map(t => t.name);
        const parsed = parseQuestionContent(q.content);
        apiDescription = parsed.description;
        apiExamples = parsed.examples;
        apiConstraints = parsed.constraints;
      }
    } catch (e) {
      console.warn("[LeetSync] Problem fetch failed", e);
    }

    // Fallbacks
    const title = apiTitle || slugToTitle(problemSlug);
    const difficulty = apiDifficulty || "Unknown";
    const tags = apiTags || [];

    // ✅ FIX 3: Language — use submission API result, fallback to DOM
    const language = submissionLang || detectLanguageFromDOM();

    // ✅ FIX 4: Code — use submission API (full code), fallback to DOM
    const code = submissionCode || extractCodeFromDOM();

    const numberedSlug = problemNumber ? `${problemNumber}-${problemSlug}` : problemSlug;

    return {
      problemSlug: numberedSlug,
      title, difficulty, language, code, tags,
      problemNumber,
      description: apiDescription || "",
      examples: apiExamples || [],
      constraints: apiConstraints || [],
    };
  }

  function parseQuestionContent(html) {
    if (!html) return { description: "", examples: [], constraints: [] };
    const div = document.createElement("div");
    div.innerHTML = html;
    div.querySelectorAll("sup").forEach(el =>
      el.replaceWith(document.createTextNode(`^${el.textContent}`))
    );
    const lines = (div.innerText || "").split("\n").map(l => l.trim()).filter(Boolean);

    let description = [], examples = [], constraints = [];
    let section = "description", curExample = null;

    for (const line of lines) {
      if (/^Example\s*\d*/i.test(line)) {
        section = "examples";
        curExample = { title: line, lines: [] };
        examples.push(curExample);
      } else if (/^Constraints:/i.test(line)) {
        section = "constraints";
      } else if (/^Follow-up:/i.test(line)) {
        section = "followup";
      } else if (section === "description") {
        description.push(line);
      } else if (section === "examples" && curExample) {
        curExample.lines.push(line);
      } else if (section === "constraints") {
        constraints.push(line);
      }
    }
    return { description: description.join("\n"), examples, constraints };
  }

  function detectLanguageFromDOM() {
    const selectors = [
      '[data-cy="lang-select"] button',
      'button[id*="headlessui-listbox-button"]',
      '.ant-select-selection-item',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el?.textContent?.trim().length < 20) return el.textContent.trim();
    }
    // ✅ "Code | C++" label near submission result
    const langLabel = document.querySelector('[class*="lang"], [class*="language-"]');
    if (langLabel) return langLabel.textContent.trim();

    const match = document.body.innerText.match(
      /Code\s*[|｜]\s*(C\+\+|Python3?|Java(?!Script)|JavaScript|TypeScript|Go|Rust|Swift|Kotlin|Ruby|PHP|C#|C\b|Scala)/
    );
    if (match) return match[1];
    return "C++";
  }

  function extractCodeFromDOM() {
    const monacoLines = document.querySelectorAll(".view-lines .view-line");
    if (monacoLines.length > 0) {
      return Array.from(monacoLines).map(l => l.innerText).join("\n").trim();
    }
    const cmLines = document.querySelectorAll(".CodeMirror-line");
    if (cmLines.length > 0) {
      return Array.from(cmLines).map(l => l.innerText).join("\n").trim();
    }
    return "// Code could not be extracted.";
  }

  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  function slugToTitle(slug) {
    return slug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }

  function getConfig() {
    return new Promise(resolve =>
      chrome.storage.sync.get(["token", "repo", "branch", "folder", "autoSync"], resolve)
    );
  }

  function showToast(message, type = "info", linkUrl = null) {
    const existing = document.getElementById("leetsync-toast");
    if (existing) existing.remove();
    const colors = { info: "#3b82f6", success: "#22c55e", warn: "#f59e0b", error: "#ef4444" };
    const toast = document.createElement("div");
    toast.id = "leetsync-toast";
    toast.style.cssText = `
      position:fixed; bottom:24px; right:24px; z-index:99999;
      background:#1e1e2e; color:#cdd6f4;
      border-left:4px solid ${colors[type]};
      padding:14px 18px; border-radius:8px;
      font-family:'JetBrains Mono',monospace,sans-serif;
      font-size:13px; max-width:340px;
      box-shadow:0 8px 32px rgba(0,0,0,0.5);
      cursor:${linkUrl ? "pointer" : "default"};
      transition:opacity 0.3s ease; opacity:0;
    `;
    toast.textContent = message;
    if (linkUrl) toast.addEventListener("click", () => window.open(linkUrl, "_blank"));
    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = "1"; });
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();