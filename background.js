console.log("✅ Background script started");

let submissionMap = {}; // Stores all submissions

// 📡 Listen for IDE submissions
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const url = details.url;
    console.log("📡 onBeforeRequest triggered:", url);

    const ideMatch = url.match(/\/api\/ide\/submit\?solution_id=(\d+)/);
    if (ideMatch) {
      const submissionId = ideMatch[1];
      console.log("🆕 IDE Submission detected:", submissionId);

      if (submissionMap[submissionId]) return;

      submissionMap[submissionId] = {
        method: 'ide',
        pollUrl: `https://www.codechef.com/error_status_table/${submissionId}/`
      };

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) return;

        chrome.tabs.sendMessage(tabs[0].id, { action: 'getProblemInfo' }, (response) => {
          if (chrome.runtime.lastError || !response) {
            console.warn("⚠️ Could not get problem info for IDE submission");
            return;
          }

          console.log("📦 Got IDE problem info:", response);
          pollIdeSubmissionStatus(submissionId, {
            problemName: response.problemName,
            problemCode: response.problemCode
          });
        });
      });
    }
  },
  { urls: ["<all_urls>"] }
);

// 🌐 Listen for classic /api/v4/submissions/{id}
chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    const url = details.url;
    console.log("🌐 webRequest triggered with URL:", url);

    const match = url.match(/\/api\/v4\/submissions\/(\d+)/);
    if (!match) return;

    const submissionId = match[1];
    console.log("🆔 Classic submission detected:", submissionId);
    if (submissionMap[submissionId]) return;

    let csrfToken = '';
    for (let header of details.requestHeaders) {
      if (header.name.toLowerCase() === 'x-csrf-token') {
        csrfToken = header.value;
        break;
      }
    }

    if (!csrfToken) return;

    submissionMap[submissionId] = {
      method: 'classic',
      csrfToken,
      pollUrl: url
    };

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) return;

      chrome.tabs.sendMessage(tabs[0].id, { action: 'getProblemInfo' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          console.warn("⚠️ Could not get problem info for classic submission");
          return;
        }

        submissionMap[submissionId].problemName = response.problemName;
        submissionMap[submissionId].problemCode = response.problemCode;

        pollClassicSubmissionStatus(submissionId);
      });
    });
  },
  { urls: ['https://www.codechef.com/api/v4/submissions/*'] },
  ['requestHeaders']
);

// 🔁 Poll IDE verdict
function pollIdeSubmissionStatus(solutionId, problemInfo) {
  console.log("🔁 Polling IDE verdict for", solutionId);

  fetch(`https://www.codechef.com/error_status_table/${solutionId}/`)
    .then(res => res.text())
    .then(html => {
      const verdictMatch = html.match(/<td[^>]*class=["']?status[^>]*>(.*?)<\/td>/i);
      const verdictRaw = verdictMatch?.[1]?.replace(/<[^>]*>/g, '').trim();

      console.log("📨 IDE verdict response:", verdictRaw);

      if (verdictRaw && verdictRaw.toLowerCase() !== 'waiting') {
        const name = problemInfo?.problemName || 'Unknown';
        const code = problemInfo?.problemCode || solutionId;
        notifyUser(name, code, verdictRaw);
      } else {
        console.log("⏳ IDE verdict still waiting, retrying...");
        setTimeout(() => pollIdeSubmissionStatus(solutionId, problemInfo), 5000);
      }
    })
    .catch(err => {
      console.error("❌ Error polling IDE submission:", err.message);
    });
}

// 🔁 Poll Classic verdict
function pollClassicSubmissionStatus(submissionId) {
  const { pollUrl, csrfToken, problemName, problemCode } = submissionMap[submissionId];
  console.log(`🔁 Polling classic verdict for ${submissionId}`);

  const xhr = new XMLHttpRequest();
  xhr.open('GET', pollUrl, true);
  xhr.setRequestHeader('x-csrf-token', csrfToken);
  xhr.setRequestHeader('Accept', 'application/json');

  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        try {
          const res = JSON.parse(xhr.responseText);
          const result = res.result?.data?.content;

          if (result && result.result_code && result.result_code.toLowerCase() !== 'waiting') {
            console.log("✅ Classic verdict received:", result.result_code);
            notifyUser(problemName, problemCode, result.result_code);
          } else {
            console.log("⏳ Classic verdict still waiting...");
            setTimeout(() => pollClassicSubmissionStatus(submissionId), 5000);
          }
        } catch (e) {
          console.error("❌ Error parsing classic verdict JSON:", e.message);
        }
      } else {
        console.error("❌ Failed to get classic verdict. HTTP:", xhr.status);
      }
    }
  };

  xhr.send();
}

// 🔔 Notify User
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
