# 🔄 LeetSync — LeetCode × GitHub Sync

> A Chrome Extension that automatically syncs your accepted LeetCode solutions to GitHub the moment you hit "Accepted" — no manual copying, no forgetting to commit.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)
![Vanilla JS](https://img.shields.io/badge/Vanilla-JS-yellow)
![License](https://img.shields.io/badge/License-MIT-purple)

---

## ✨ Features

- ✅ **Auto-detects** accepted submissions on LeetCode
- 📁 **Organized structure** — each problem gets its own folder
- 📝 **README per problem** — full description, examples & constraints
- 💻 **Full code sync** — fetches complete code via LeetCode API
- 🔁 **Smart duplicate detection** — only syncs when code actually changes
- 📊 **Stats dashboard** — track Easy/Medium/Hard count in popup
- 🔔 **Toast notifications** — in-page confirmation on every sync
- 🌐 **Multi-language support** — C++, Python, Java, JavaScript and more

---

## 📂 GitHub Folder Structure

After syncing, your repo will look like this:

```
your-repo/
  solutions/
    1-two-sum/
      two-sum.cpp          ← Full solution with header comment
      README.md            ← Problem description, examples, constraints
    29-divide-two-integers/
      divide-two-integers.cpp
      README.md
    35-search-insert-position/
      search-insert-position.cpp
      README.md
```

### Sample `.cpp` file:
```cpp
// Problem: 1. Two Sum
// URL: https://leetcode.com/problems/two-sum/
// Difficulty: Easy
// Language: C++
// Date: 2026-03-07
// Tags: Array, Hash Table
// Synced by LeetSync Chrome Extension

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        // your solution here
    }
};
```

### Sample `README.md`:
```markdown
# 1. Two Sum
![Easy](https://img.shields.io/badge/Difficulty-Easy-brightgreen)

**LeetCode:** https://leetcode.com/problems/two-sum/
**Date Solved:** 2026-03-07
**Language:** C++

## Problem Description
Given an array of integers nums and an integer target...

## Examples
Input: nums = [2,7,11,15], target = 9
Output: [0,1]

## Constraints
- 2 <= nums.length <= 10^4
- Only one valid answer exists.

## Topics
`Array` `Hash Table`
```

---

## 🚀 Installation

### Step 1 — Download the extension
Download and unzip the `leetcode-sync` folder.

### Step 2 — Load in Chrome
1. Open Chrome → go to `chrome://extensions`
2. Enable **Developer Mode** (top-right toggle)
3. Click **"Load unpacked"**
4. Select the `leetcode-sync` folder

### Step 3 — Generate GitHub Token
1. Go to **GitHub → Settings → Developer Settings → Personal Access Tokens → Tokens (classic)**
2. Click **"Generate new token (classic)"**
3. Give it a name: `LeetSync`
4. Check the **`repo`** scope ✅
5. Click **"Generate token"** and copy it immediately

### Step 4 — Configure LeetSync
1. Click the **LeetSync icon** in Chrome toolbar
2. Go to **Settings** tab
3. Fill in:
   - **GitHub Token** → paste your token
   - **Repository** → `yourusername/your-repo` (e.g. `Rimjhimv2/dsa-leetcode`)
   - **Branch** → `main`
   - **Folder** → `solutions` (optional)
4. Click **"Save & Test Connection"**

You're all set! 🎉

---

## 🧠 How It Works

```
LeetCode Page          content.js            background.js         GitHub API
     │                     │                      │                     │
     │  Submit solution     │                      │                     │
     │ ─────────────────>   │                      │                     │
     │                      │  Poll every 3s       │                     │
     │                      │  "Accepted?" ✅      │                     │
     │                      │                      │                     │
     │                      │  Fetch code + details│                     │
     │                      │  via LeetCode API    │                     │
     │                      │                      │                     │
     │                      │  Hash check          │                     │
     │                      │  (same code? skip)   │                     │
     │                      │                      │                     │
     │                      │ ── SYNC_SOLUTION ──> │                     │
     │                      │                      │  GET file SHA ───>  │
     │                      │                      │  PUT .cpp file ──>  │
     │                      │                      │  PUT README.md ──>  │
     │                      │                      │ <── committed ───   │
     │                      │ <── success ──────── │                     │
     │   Toast: ✅ Synced!   │                      │                     │
```

---

## ⚙️ Tech Stack

| Technology | Purpose |
|---|---|
| **Chrome Extension Manifest V3** | Extension framework |
| **Vanilla JavaScript** | No dependencies, lightweight |
| **LeetCode GraphQL API** | Fetch problem details + submission code |
| **GitHub Contents REST API** | Create/update files in repo |
| **Chrome Storage API** | Save settings & stats locally |
| **Service Worker** | Background sync processing |

---

## 📁 Project Structure

```
leetcode-sync/
  manifest.json          ← Extension config (permissions, scripts)
  popup.html             ← Extension popup UI
  icons/
    icon16.png
    icon48.png
    icon128.png
  src/
    content.js           ← Injected into LeetCode, detects submissions
    background.js        ← Service worker, handles GitHub API calls
    popup.js             ← Popup UI logic (stats, settings)
```

---

## 🔒 Permissions Used

| Permission | Why |
|---|---|
| `storage` | Save GitHub token and settings |
| `tabs` | Detect LeetCode problem pages |
| `scripting` | Inject content script |
| `notifications` | Show sync confirmation |
| `https://leetcode.com/*` | Read problem data |
| `https://api.github.com/*` | Push files to GitHub |

> **Privacy:** Your GitHub token is stored locally in Chrome's `storage.sync` and is only ever sent to `api.github.com`. Nothing is collected or shared.

---

## 🛠️ Development

### File responsibilities:

**`content.js`** — The "spy" on LeetCode
- Polls every 3 seconds for "Accepted" result
- Detects submission ID from URL
- Fetches full code + language from LeetCode GraphQL API
- Hashes code to detect changes (avoids duplicate syncs)
- Sends data to background.js via `chrome.runtime.sendMessage`

**`background.js`** — The "manager" in the background
- Receives sync requests from content.js
- Builds file paths and content
- Calls GitHub API to commit `.cpp` + `README.md`
- Tracks stats in Chrome local storage

**`popup.js`** — The dashboard
- Shows Easy/Medium/Hard stats
- Shows recent sync history
- Manages GitHub settings

---

## ❓ FAQ

**Q: Will it sync every time I submit?**
A: No — it only syncs when your code actually changes. Same code submitted again = skipped.

**Q: What if I update my solution later?**
A: Just submit the updated code on LeetCode. If it's Accepted and different from last sync, it will sync automatically.

**Q: Does it work with private repos?**
A: Yes! As long as your token has `repo` scope.

**Q: Which LeetCode account does it work with?**
A: Any — it reads from the active LeetCode session in your browser.

---

## 📄 License

MIT License — feel free to use, modify, and share!

---

*Built with ❤️ by [@Rimjhimv](https://github.com/Rimjhimv2)*