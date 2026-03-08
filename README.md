# LeetSync — LeetCode → GitHub Chrome Extension

Automatically sync your accepted LeetCode solutions to a GitHub repository the moment you solve a problem.

## Features

- **Auto-sync on Accept** — detects when your submission is accepted and pushes to GitHub instantly
- **Organized file structure** — solutions sorted by language with a commented header (title, difficulty, date, tags)
- **Stats dashboard** — track Easy / Medium / Hard counts and top language
- **Sync history** — see the last 20 synced problems in the popup
- **Toast notifications** — subtle in-page toast confirming each sync

## File Structure in Your Repo

```
solutions/
  python/
    two-sum.py
    longest-substring-without-repeating-characters.py
  javascript/
    valid-parentheses.js
  cpp/
    reverse-linked-list.cpp
```

Each file includes a header comment:
```python
# Problem: Two Sum
# URL: https://leetcode.com/problems/two-sum/
# Difficulty: Easy
# Language: Python
# Date: 2025-03-07
# Tags: Array, Hash Table
# Synced by LeetSync Chrome Extension

class Solution:
    def twoSum(self, nums, target):
        ...
```

## Installation

### 1. Create a GitHub repo
Create a new repo (e.g. `yourname/leetcode-solutions`). It can be private.

### 2. Generate a GitHub token
1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)**
2. Click **Generate new token**
3. Give it `repo` scope (full control of private repositories)
4. Copy the token — you'll only see it once

### 3. Load the extension in Chrome
1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select this `leetcode-sync` folder

### 4. Configure LeetSync
1. Click the LeetSync icon in your toolbar
2. Go to the **Settings** tab
3. Paste your GitHub token
4. Enter your repo as `username/repo-name`
5. Set the branch (default: `main`) and optional subfolder
6. Click **Save & Test Connection**

You're done! Solve a problem on LeetCode and watch it appear in your repo.

## Manual Sync

If auto-sync is off, you can trigger a sync from the popup manually (coming in v1.1).

## Supported Languages

Python, JavaScript, TypeScript, Java, C++, C, C#, Go, Rust, Swift, Kotlin, Ruby, PHP, Scala, R

## Permissions Used

| Permission | Reason |
|---|---|
| `storage` | Save your GitHub token and settings locally |
| `tabs` | Detect when you're on a LeetCode problem page |
| `scripting` | Inject the submission detector into LeetCode |
| `notifications` | Show sync confirmation notifications |
| `https://leetcode.com/*` | Read problem data and detect submissions |
| `https://api.github.com/*` | Push files to your GitHub repo |

## Privacy

Your GitHub token is stored locally in Chrome's `storage.sync` and never sent anywhere except the official GitHub API (`api.github.com`).
