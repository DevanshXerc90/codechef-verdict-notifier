console.log("✅ Background script started");

let submissionMap = {}; // To avoid duplicate processing

// Debug: Log all outgoing requests
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    console.log("📡 onBeforeRequest triggered:", details.url);
  },
  { urls: ["<all_urls>"] }
);

// Listen to submission requests using webRequest API
chrome.webRequest.onBeforeSendHeaders.addListener(
  async (details) => {
    const url = details.url;
    console.log("🌐 webRequest triggered with URL:", url);

    // Match URLs like /api/v4/submissions/41025313
    const submissionIdMatch = url.match(/\/api\/v4\/submissions\/(\d+)/);
    if (!submissionIdMatch) {
      console.log("⚠️ Not a submission URL:", url);
      return;
    }

    const submissionId = submissionIdMatch[1];
    console.log("🆔 Found submission ID:", submissionId);

    if (submissionMap[submissionId]) {
      console.log("⏭️ Already processed this submission:", submissionId);
      return;
    }

    // Extract x-csrf-token
    let csrfToken = '';
    for (let header of details.requestHeaders) {
      if (header.name.toLowerCase() === 'x-csrf-token') {
        csrfToken = header.value;
        break;
      }
    }

    if (!csrfToken) {
      console.log("❌ CSRF token not found in headers");
      return;
    }

    console.log("🔐 CSRF token extracted");

    // Save submission info
    submissionMap[submissionId] = {
      csrfToken,
      statusUrl: url,
    };

    // Ask content script for problem info
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
        console.log("❗ No active tab found");
        return;
      }

      const tabId = tabs[0].id;
      console.log("💬 Sending message to content.js for problem info");

      chrome.tabs.sendMessage(
        tabId,
        { action: 'getProblemInfo' },
        (response) => {
          if (chrome.runtime.lastError || !response) {
            console.warn("⚠️ Could not get problem info from content script:", chrome.runtime.lastError);
            return;
          }

          submissionMap[submissionId].problemName = response.problemName;
          submissionMap[submissionId].problemCode = response.problemCode;
          console.log("📦 Got problem info:", response);

          // Begin polling for verdict
          checkSubmissionStatus(submissionId);
        }
      );
    });
  },
  { urls: ['https://www.codechef.com/api/v4/submissions/*'] },
  ['requestHeaders']
);

// Poll CodeChef until verdict is ready
function checkSubmissionStatus(submissionId) {
  const submission = submissionMap[submissionId];
  if (!submission) return;

  const { statusUrl, csrfToken, problemName, problemCode } = submission;
  console.log("📡 Polling submission status:", statusUrl);
  console.log(`🔁 Polling verdict for ${submissionId} (${problemCode})`);

  const xhr = new XMLHttpRequest();
  xhr.open('GET', statusUrl, true);
  xhr.setRequestHeader('x-csrf-token', csrfToken);
  xhr.setRequestHeader('Accept', 'application/json');

  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        try {
          const res = JSON.parse(xhr.responseText);
          const result = res.result?.data?.content;

          console.log("📨 Submission response:", result);

          if (result && result.result_code && result.result_code !== 'waiting') {
            console.log("✅ Verdict received:", result.result_code);
            notifyUser(problemName, problemCode, result.result_code);

            // Optional: Save to popup
            chrome.storage.local.set({
              lastStatus: result.result_code,
              lastProblem: `${problemName} (${problemCode})`
            });
          } else {
            console.log("⏳ Verdict not ready yet, retrying...");
            setTimeout(() => checkSubmissionStatus(submissionId), 5000);
          }
        } catch (e) {
          console.error("❌ Error parsing verdict JSON", e);
        }
      } else {
        console.error("❌ Failed to get submission status:", xhr.status);
      }
    }
  };

  xhr.send();
}

// Notify user via desktop
function notifyUser(problemName, problemCode, verdict) {
  const message = `${problemName} (${problemCode}): ${verdict}`;
  console.log("🔔 Sending notification:", message);

  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon.png',
    title: 'CodeChef Submission Result',
    message,
    priority: 2,
  });
}
