console.log("✅ Background script started");

let submissionMap = {}; // Stores submissions being tracked

// 🔍 Listen to outgoing requests (IDE-style)
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const url = details.url;
    console.log("📡 onBeforeRequest triggered:", url);

    const ideSubmitMatch = url.match(/\/api\/ide\/submit\?solution_id=(\d+)/);
    if (ideSubmitMatch) {
      const submissionId = ideSubmitMatch[1];
      console.log("🆕 IDE Submission detected:", submissionId);

      if (submissionMap[submissionId]) return;

      submissionMap[submissionId] = {
        method: 'ide',
        pollUrl: `https://www.codechef.com/error_status_table/${submissionId}/`
      };

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) return;
        const tabId = tabs[0].id;

        chrome.tabs.sendMessage(tabId, { action: 'getProblemInfo' }, (response) => {
          if (chrome.runtime.lastError || !response) {
            console.warn("⚠️ Could not get problem info, using fallback values");
            pollIdeSubmissionStatus(submissionId, {
              problemName: 'Unknown Problem',
              problemCode: submissionId
            });
            return;
          }

          console.log("📦 Got IDE problem info:", response);
          pollIdeSubmissionStatus(submissionId, {
            problemName: response.problemName || 'Unknown Problem',
            problemCode: response.problemCode || submissionId
          });
        });
      });
    }
  },
  { urls: ["<all_urls>"] }
);

// 🌐 Classic CodeChef submission (/api/v4/submissions/{id})
chrome.webRequest.onBeforeSendHeaders.addListener(
  async (details) => {
    const url = details.url;
    console.log("🌐 webRequest triggered with URL:", url);

    const submissionIdMatch = url.match(/\/api\/v4\/submissions\/(\d+)/);
    if (!submissionIdMatch) return;

    const submissionId = submissionIdMatch[1];
    console.log("🆔 Classic submission detected:", submissionId);

    if (submissionMap[submissionId]) return;

    // Extract CSRF token
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
      const tabId = tabs[0].id;

      chrome.tabs.sendMessage(tabId, { action: 'getProblemInfo' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          console.warn("⚠️ Could not get problem info:", chrome.runtime.lastError);
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

// 🌀 Poll for verdict in IDE submissions
function pollIdeSubmissionStatus(solutionId, problemInfo) {
  console.log("🔁 Polling IDE verdict for", solutionId);

  fetch(`https://www.codechef.com/error_status_table/${solutionId}/`)
    .then(res => res.text())
    .then(html => {
      // Extract first <td> after <tr> in the table
      const matchAllTds = html.match(/<td[^>]*>(.*?)<\/td>/g);

if (matchAllTds && matchAllTds.length >= 3) {
  // The 3rd <td> (index 2) typically holds the verdict
  let verdictRaw = matchAllTds[2].replace(/<[^>]*>/g, '').trim();
  console.log("📨 IDE verdict response:", verdictRaw);

  if (verdictRaw && !/waiting|undefined/i.test(verdictRaw)) {
    const name = problemInfo?.problemName || 'Unknown';
    const code = problemInfo?.problemCode || solutionId;
    notifyUser(name, code, verdictRaw);
  } else {
    console.log("⏳ IDE verdict still waiting, retrying...");
    setTimeout(() => pollIdeSubmissionStatus(solutionId, problemInfo), 5000);
  }
} else {
  console.warn("❓ Could not extract <td>s or structure changed");
  setTimeout(() => pollIdeSubmissionStatus(solutionId, problemInfo), 5000);
}




      console.log("📨 IDE verdict response:", verdictRaw);

      if (verdictRaw && !/waiting|undefined/i.test(verdictRaw)) {
        const name = problemInfo?.problemName || 'Unknown';
        const code = problemInfo?.problemCode || solutionId;
        notifyUser(name, code, verdictRaw);
      } else {
        console.log("⏳ IDE verdict still waiting, retrying...");
        setTimeout(() => pollIdeSubmissionStatus(solutionId, problemInfo), 5000);
      }
    })
    .catch(err => {
      console.error("❌ Error polling IDE submission:", err);
    });
}


// 🌀 Poll for verdict in classic submissions
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

          if (result && result.result_code && result.result_code !== 'waiting') {
            console.log("✅ Classic verdict received:", result.result_code);
            notifyUser(problemName, problemCode, result.result_code);
          } else {
            console.log("⏳ Classic verdict not ready yet...");
            setTimeout(() => pollClassicSubmissionStatus(submissionId), 5000);
          }
        } catch (e) {
          console.error("❌ Error parsing verdict JSON", e);
        }
      } else {
        console.error("❌ Failed to get classic submission status:", xhr.status);
      }
    }
  };

  xhr.send();
}

// 🔔 Show desktop notification
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
