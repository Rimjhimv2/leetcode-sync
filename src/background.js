// background.js — Service Worker
// Handles GitHub API calls and coordinates sync logic

const GITHUB_API = "https://api.github.com";

const recentlySynced = new Set();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SYNC_SOLUTION") {
    const slug = message.payload?.problemSlug;

    if (slug && recentlySynced.has(slug)) {
      sendResponse({ success: false, error: "duplicate" });
      return true;
    }
    if (slug) {
      recentlySynced.add(slug);
      setTimeout(() => recentlySynced.delete(slug), 10000);
    }

    handleSyncSolution(message.payload)
      .then((result) => sendResponse({ success: true, result }))
      .catch((err) => {
        if (slug) recentlySynced.delete(slug);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }

  if (message.type === "TEST_CONNECTION") {
    testGitHubConnection(message.token)
      .then((user) => sendResponse({ success: true, user }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "GET_STATS") {
    getStats().then((stats) => sendResponse(stats));
    return true;
  }
});

async function handleSyncSolution(payload) {
  const { problemSlug, title, difficulty, language } = payload;

  const config = await getConfig();
  if (!config.token || !config.repo) {
    throw new Error("GitHub token or repo not configured.");
  }

  const { token, repo, branch, folder } = config;
  const ext = getFileExtension(language);
  const basePath = folder ? `${folder}/` : "";
  const branchName = branch || "main";
  const cleanSlug = problemSlug.replace(/^\d+-/, ""); // e.g. "two-sum"

  // ✅ Both files go INSIDE the same folder
  // Structure: solutions/1-two-sum/two-sum.cpp
  //            solutions/1-two-sum/README.md
  const folderPath = `${basePath}${problemSlug}`;
  const codeFilePath = `${folderPath}/${cleanSlug}${ext}`;
  const readmeFilePath = `${folderPath}/README.md`;

  const codeContent = buildCodeFileContent(payload);
  const readmeContent = buildReadmeContent(payload);

  // Commit sequentially to avoid race conditions
  const codeResult = await commitFile(
    token, repo, codeFilePath, codeContent, branchName,
    `[LeetSync] ${problemSlug} — ${difficulty}`
  );
  await commitFile(
    token, repo, readmeFilePath, readmeContent, branchName,
    `[LeetSync] ${problemSlug} — README`
  );

  await incrementStats(problemSlug, difficulty, language);

  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon48.png",
    title: "LeetSync ✓",
    message: `"${title}" synced to GitHub!`,
  });

  return { codeFilePath, commitUrl: codeResult.commit?.html_url };
}

async function commitFile(token, repo, filePath, content, branch, message) {
  const encoded = btoa(unescape(encodeURIComponent(content)));

  // Always fetch fresh SHA before committing
  let sha = null;
  try {
    const existing = await githubRequest(
      `/repos/${repo}/contents/${filePath}?ref=${branch}`, token, "GET"
    );
    if (existing?.sha) sha = existing.sha;
  } catch (e) {
    sha = null; // file doesn't exist yet
  }

  const body = {
    message,
    content: encoded,
    branch,
    ...(sha ? { sha } : {}),
  };

  return githubRequest(`/repos/${repo}/contents/${filePath}`, token, "PUT", body);
}

function buildCodeFileContent({ title, problemSlug, difficulty, language, code, tags, problemNumber }) {
  const now = new Date().toISOString().split("T")[0];
  const commentChar = getCommentChar(language);
  const cleanSlug = problemSlug.replace(/^\d+-/, "");
  const tagLine = tags?.length ? `${commentChar} Tags: ${tags.join(", ")}\n` : "";

  return `${commentChar} Problem: ${problemNumber ? `${problemNumber}. ` : ""}${title}
${commentChar} URL: https://leetcode.com/problems/${cleanSlug}/
${commentChar} Difficulty: ${difficulty}
${commentChar} Language: ${language}
${commentChar} Date: ${now}
${tagLine}${commentChar} Synced by LeetSync Chrome Extension

${code}`;
}

function buildReadmeContent({ title, problemSlug, difficulty, language, tags, description, examples, constraints, problemNumber }) {
  const now = new Date().toISOString().split("T")[0];
  const cleanSlug = problemSlug.replace(/^\d+-/, "");
  const url = `https://leetcode.com/problems/${cleanSlug}/`;

  const diffBadge = {
    Easy: "![Easy](https://img.shields.io/badge/Difficulty-Easy-brightgreen)",
    Medium: "![Medium](https://img.shields.io/badge/Difficulty-Medium-orange)",
    Hard: "![Hard](https://img.shields.io/badge/Difficulty-Hard-red)",
  }[difficulty] || difficulty;

  const tagBadges = (tags || []).map(t => `\`${t}\``).join(" ");

  let examplesSection = "";
  if (examples?.length > 0) {
    examplesSection = `\n## Examples\n\n`;
    examples.forEach(ex => {
      examplesSection += `**${ex.title}**\n\`\`\`\n${ex.lines.join("\n")}\n\`\`\`\n\n`;
    });
  }

  let constraintsSection = "";
  if (constraints?.length > 0) {
    constraintsSection = `\n## Constraints\n\n${constraints.map(c => `- ${c}`).join("\n")}\n`;
  }

  const tagsSection = tags?.length ? `\n## Topics\n\n${tagBadges}\n` : "";

  return `# ${problemNumber ? `${problemNumber}. ` : ""}${title}

${diffBadge}

**LeetCode:** [${url}](${url})
**Date Solved:** ${now}
**Language:** ${language}

## Problem Description

${description || "_Description not available._"}
${examplesSection}${constraintsSection}${tagsSection}
---
*Synced by [LeetSync](https://github.com) Chrome Extension*
`;
}

async function testGitHubConnection(token) {
  const user = await githubRequest("/user", token, "GET");
  return { login: user.login, avatar_url: user.avatar_url };
}

async function githubRequest(path, token, method = "GET", body = null) {
  const url = path.startsWith("http") ? path : `${GITHUB_API}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github.v3+json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API error: ${res.status}`);
  }

  return res.json();
}

function getFileExtension(language) {
  const map = {
    Python: ".py", Python3: ".py",
    JavaScript: ".js", TypeScript: ".ts",
    Java: ".java", "C++": ".cpp", C: ".c",
    "C#": ".cs", Go: ".go", Rust: ".rs",
    Swift: ".swift", Kotlin: ".kt", Ruby: ".rb",
    PHP: ".php", Scala: ".scala", R: ".r",
  };
  return map[language] || ".cpp";
}

function getCommentChar(language) {
  return ["Python", "Python3", "Ruby", "R"].includes(language) ? "#" : "//";
}

async function getConfig() {
  return new Promise(resolve =>
    chrome.storage.sync.get(["token", "repo", "branch", "folder"], resolve)
  );
}

async function incrementStats(slug, difficulty, language) {
  const data = await new Promise(resolve =>
    chrome.storage.local.get(["stats", "history"], resolve)
  );
  const stats = data.stats || { total: 0, easy: 0, medium: 0, hard: 0, languages: {} };
  const history = data.history || [];

  stats.total += 1;
  const diffKey = difficulty.toLowerCase();
  if (stats[diffKey] !== undefined) stats[diffKey] += 1;
  stats.languages[language] = (stats.languages[language] || 0) + 1;

  history.unshift({ slug, difficulty, language, date: new Date().toISOString() });
  if (history.length > 100) history.pop();

  chrome.storage.local.set({ stats, history });
}

async function getStats() {
  return new Promise(resolve => {
    chrome.storage.local.get(["stats", "history"], (data) => {
      resolve({
        stats: data.stats || { total: 0, easy: 0, medium: 0, hard: 0, languages: {} },
        history: data.history || [],
      });
    });
  });
}