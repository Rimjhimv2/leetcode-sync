// popup.js — Popup UI Logic

document.addEventListener("DOMContentLoaded", () => {
  // ── Tab switching ──────────────────────────────────────────────────
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(`panel-${tab.dataset.tab}`).classList.add("active");
    });
  });

  // ── Load saved settings ────────────────────────────────────────────
  chrome.storage.sync.get(["token", "repo", "branch", "folder", "autoSync"], (data) => {
    if (data.token) document.getElementById("inputToken").value = data.token;
    if (data.repo) document.getElementById("inputRepo").value = data.repo;
    document.getElementById("inputBranch").value = data.branch || "main";
    if (data.folder) document.getElementById("inputFolder").value = data.folder;
    document.getElementById("toggleAutoSync").checked = data.autoSync !== false;

    // Check connection status
    if (data.token) checkConnection(data.token);
  });

  // ── Load stats ─────────────────────────────────────────────────────
  loadStats();

  // ── Save button ────────────────────────────────────────────────────
  document.getElementById("btnSave").addEventListener("click", async () => {
    const token = document.getElementById("inputToken").value.trim();
    const repo = document.getElementById("inputRepo").value.trim();
    const branch = document.getElementById("inputBranch").value.trim() || "main";
    const folder = document.getElementById("inputFolder").value.trim();
    const autoSync = document.getElementById("toggleAutoSync").checked;

    hideAlerts();

    if (!token) return showError("Please enter your GitHub token.");
    if (!repo || !repo.includes("/")) return showError("Repo must be in format: username/repo");

    const btn = document.getElementById("btnSave");
    btn.textContent = "Testing connection…";
    btn.disabled = true;

    chrome.runtime.sendMessage({ type: "TEST_CONNECTION", token }, (response) => {
      btn.textContent = "Save & Test Connection";
      btn.disabled = false;

      if (chrome.runtime.lastError || !response?.success) {
        showError(response?.error || "Connection failed. Check your token.");
        setStatus(false);
        return;
      }

      // Save all settings
      chrome.storage.sync.set({ token, repo, branch, folder, autoSync }, () => {
        showSuccess("✓ Connected as @" + response.user.login);
        setStatus(true, response.user);
      });
    });
  });

  // ── Clear data button ──────────────────────────────────────────────
  document.getElementById("btnClear").addEventListener("click", () => {
    if (!confirm("Clear all sync history and stats? Settings will be kept.")) return;
    chrome.storage.local.remove(["stats", "history"], () => {
      loadStats();
    });
  });
});

function checkConnection(token) {
  chrome.runtime.sendMessage({ type: "TEST_CONNECTION", token }, (response) => {
    if (response?.success) {
      setStatus(true, response.user);
    } else {
      setStatus(false);
    }
  });
}

function setStatus(connected, user = null) {
  const dot = document.getElementById("statusDot");
  const chip = document.getElementById("userChip");

  if (connected) {
    dot.classList.add("connected");
    dot.title = user ? `Connected as @${user.login}` : "Connected";
    if (user) {
      chip.classList.add("show");
      document.getElementById("userAvatar").src = user.avatar_url;
      document.getElementById("userLogin").textContent = "@" + user.login;
    }
  } else {
    dot.classList.remove("connected");
    dot.title = "Not connected";
    chip.classList.remove("show");
  }
}

function loadStats() {
  chrome.runtime.sendMessage({ type: "GET_STATS" }, ({ stats, history }) => {
    document.getElementById("statTotal").textContent = stats.total;
    document.getElementById("statEasy").textContent = stats.easy;
    document.getElementById("statMedium").textContent = stats.medium;
    document.getElementById("statHard").textContent = stats.hard;

    // Top language
    const langs = stats.languages || {};
    const topLang = Object.entries(langs).sort((a, b) => b[1] - a[1])[0];
    document.getElementById("statLang").textContent = topLang ? topLang[0] : "—";

    // Difficulty bar
    const total = stats.total || 1;
    const segs = document.querySelectorAll(".diff-bar-seg");
    segs[0].style.width = ((stats.easy / total) * 100).toFixed(1) + "%";
    segs[1].style.width = ((stats.medium / total) * 100).toFixed(1) + "%";
    segs[2].style.width = ((stats.hard / total) * 100).toFixed(1) + "%";

    // History list
    renderHistory(history);
  });
}

function renderHistory(history) {
  const list = document.getElementById("historyList");

  if (!history || history.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="icon">🚀</div>
        <div>No syncs yet.<br/>Solve a problem on LeetCode!</div>
      </div>`;
    return;
  }

  list.innerHTML = history
    .slice(0, 20)
    .map(({ slug, difficulty, language, date }) => {
      const d = new Date(date);
      const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return `
        <div class="history-item">
          <span class="diff-badge ${difficulty}">${difficulty}</span>
          <span class="slug">${slug}</span>
          <span class="lang">${language}</span>
        </div>`;
    })
    .join("");
}

function showSuccess(msg) {
  const el = document.getElementById("alertSuccess");
  el.textContent = msg;
  el.classList.add("show");
  document.getElementById("alertError").classList.remove("show");
}

function showError(msg) {
  const el = document.getElementById("alertError");
  el.textContent = "✗ " + msg;
  el.classList.add("show");
  document.getElementById("alertSuccess").classList.remove("show");
}

function hideAlerts() {
  document.getElementById("alertSuccess").classList.remove("show");
  document.getElementById("alertError").classList.remove("show");
}
