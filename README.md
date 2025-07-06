# CodeChef Verdict Notifier

A Chrome Extension that automatically checks the result of your CodeChef submissions and notifies you when the verdict is available.

## Features

- 📦 Tracks both **classic** and **IDE-style** submissions
- 🔍 Detects the **problem name and code** automatically
- 🔁 Polls CodeChef servers in the background until verdict is ready
- 🔔 Sends a **native desktop notification** with verdict and problem details
- 💡 Works in both **practice** and **live contests**

## Installation

1. Clone this repo.
2. Open Chrome > `chrome://extensions/`
3. Enable Developer Mode.
4. Click "Load unpacked" and select the extension folder.

## Tech Stack

- JavaScript (ES6)
- Chrome Extensions (Manifest V3)
- Service Worker (background script)
- `chrome.webRequest`, `chrome.tabs`, `chrome.notifications` APIs
- HTML parsing + fallbacks
