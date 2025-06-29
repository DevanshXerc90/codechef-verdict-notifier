let submissionMap = {}; // To avoid duplicate processing

// Listen to submission requests using webRequest API
chrome.webRequest.onBeforeSendHeaders.addListener(
  async (details) => {
    const url = details.url;

    // Match URLs like /api/v4/submissions/41025313
    const submissionIdMatch = url.match(/\/api\/v4\/submissions\/(\d+)/);
    if (!submissionIdMatch) return;

    const submissionId = submissionIdMatch[1];

    // Avoid processing the same submission again
    if (submissionMap[submissionId]) return;

    // Extract x-csrf-token
    let csrfToken = '';
    for (let header of details.requestHeaders) {
      if (header.name.toLowerCase() === 'x-csrf-token') {
        csrfToken = header.value;
        break;
      }
    }

    if (!csrfToken) return;

    // Save basic submission info
    submissionMap[submissionId] = {
      csrfToken,
      statusUrl: url,
    };

    // Get the active tab to message content.js
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) return;

      const tabId = tabs[0].id;

      // Ask content script for problem info
      chrome.tabs.sendMessage(
        tabId,
        { action: 'getProblemInfo' },
        (response) => {
          if (chrome.runtime.lastError || !response) {
            console.warn('Could not get problem info from content script');
            return;
          }

          // Add problem name/code to submission map
          submissionMap[submissionId].problemName = response.problemName;
          submissionMap[submissionId].problemCode = response.problemCode;

          // Begin polling CodeChef for verdict
          checkSubmissionStatus(submissionId);
        }
      );
    });
  },
  { urls: ['https://www.codechef.com/api/v4/submissions/*'] },
  ['requestHeaders']
);

// Task 5: Poll server until verdict is available
function checkSubmissionStatus(submissionId) {
  const submission = submissionMap[submissionId];
  if (!submission) return;

  const { statusUrl, csrfToken, problemName, problemCode } = submission;

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

          if (result && result.result_code && result.result_code !== 'waiting') {
            // Verdict received 🎉
            notifyUser(problemName, problemCode, result.result_code);
          } else {
            // Verdict not ready, retry after delay
            setTimeout(() => checkSubmissionStatus(submissionId), 5000);
          }
        } catch (e) {
          console.error('Error parsing verdict JSON', e);
        }
      } else {
        console.error('Failed to get submission status');
      }
    }
  };

  xhr.send();
}

// Notify user when verdict is ready
function notifyUser(problemName, problemCode, verdict) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon.png', // Make sure to include this in your extension folder
    title: 'CodeChef Submission Result',
    message: `${problemName} (${problemCode}): ${verdict}`,
    priority: 2,
  });
}
