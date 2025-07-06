console.log("✅ Background script started");

let submissionMap = {}; 
const IDE_DELAY = 5000;
const CLASSIC_DELAY = 5000;

/* -------------------------------------------------- */
/* Helper – lookup problem name via CodeChef API      */
/* -------------------------------------------------- */
async function resolveProblemName(code, fallback = 'Unknown Problem') {
  if (!code || /unknown/i.test(code)) return fallback;

  
  const endpoints = [
    `https://www.codechef.com/api/practice/problems/${code}`,
    `https://www.codechef.com/api/contests/PRACTICE/problems/${code}`
  ];

  for (let url of endpoints) {
    try {
      const r = await fetch(url);
      const j = await r.json();
      const name = j?.problemDetails?.problem_name;
      if (name) return name;
    } catch (_) {  }
  }
  return fallback;
}

/* -------------------------------------------------- */
/* 1) Detect IDE submissions                          */
/* -------------------------------------------------- */
chrome.webRequest.onBeforeRequest.addListener(details => {
  const url = details.url;
  const m = url.match(/\/api\/ide\/submit\?solution_id=(\d+)/);
  if (!m) return;

  const id = m[1];
  if (submissionMap[id]) return;
  console.log("🆕 IDE submission:", id);

  submissionMap[id] = { method: 'ide', pollUrl: `https://www.codechef.com/error_status_table/${id}/` };

  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const tabId = tabs[0]?.id;
    if (!tabId) return;

    chrome.tabs.sendMessage(tabId, { action: 'getProblemInfo' }, resp => {
      if (chrome.runtime.lastError || !resp) {
        resp = { problemName: 'Unknown Problem', problemCode: id };
      }
      pollIde(id, resp);
    });
  });
}, { urls: ["<all_urls>"] });

/* -------------------------------------------------- */
/* 2) Detect classic submissions                      */
/* -------------------------------------------------- */
chrome.webRequest.onBeforeSendHeaders.addListener(details => {
  const url = details.url;
  const m = url.match(/\/api\/v4\/submissions\/(\d+)/);
  if (!m) return;

  const id = m[1];
  if (submissionMap[id]) return;
  console.log("🆕 Classic submission:", id);

  const csrf = details.requestHeaders.find(h => h.name.toLowerCase() === 'x-csrf-token')?.value;
  if (!csrf) return;

  submissionMap[id] = { method: 'classic', csrfToken: csrf, pollUrl: url };

  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const tabId = tabs[0]?.id;
    if (!tabId) return;

    chrome.tabs.sendMessage(tabId, { action: 'getProblemInfo' }, resp => {
      if (chrome.runtime.lastError || !resp) resp = { problemName: 'Unknown', problemCode: id };
      submissionMap[id].problemName = resp.problemName;
      submissionMap[id].problemCode  = resp.problemCode;
      pollClassic(id);
    });
  });
}, { urls: ["https://www.codechef.com/api/v4/submissions/*"] }, ["requestHeaders"]);

/* -------------------------------------------------- */
/* 3) Poll IDE verdict                                */
/* -------------------------------------------------- */
function pollIde(id, info) {
  fetch(`https://www.codechef.com/error_status_table/${id}/`)
    .then(r => r.text())
    .then(html => {
      const tds = html.match(/<td[^>]*>(.*?)<\/td>/g);
      const verdict = tds && tds[2] ? tds[2].replace(/<[^>]+>/g,'').trim() : '';
      console.log("📨 IDE verdict:", verdict || 'Waiting');

      if (verdict && !/waiting|queue|undefined/i.test(verdict)) {
        resolveProblemName(info.problemCode, info.problemName).then(name => {
          notifyUser(name, info.problemCode, verdict);
        });
      } else {
        setTimeout(() => pollIde(id, info), IDE_DELAY);
      }
    })
    .catch(err => {
      console.error("❌ IDE poll error:", err);
      setTimeout(() => pollIde(id, info), IDE_DELAY);
    });
}

/* -------------------------------------------------- */
/* 4) Poll Classic verdict                            */
/* -------------------------------------------------- */
function pollClassic(id) {
  const sub = submissionMap[id];
  if (!sub) return;

  const xhr = new XMLHttpRequest();
  xhr.open('GET', sub.pollUrl);
  xhr.setRequestHeader('x-csrf-token', sub.csrfToken);
  xhr.onreadystatechange = () => {
    if (xhr.readyState !== 4) return;
    if (xhr.status !== 200) {
      console.error("❌ HTTP", xhr.status, "retrying");
      return setTimeout(() => pollClassic(id), CLASSIC_DELAY);
    }

    try {
      const j = JSON.parse(xhr.responseText);
      const verdict = j?.result?.data?.content?.result_code;
      console.log("📨 Classic verdict:", verdict || 'Waiting');

      if (verdict && verdict !== 'waiting') {
        resolveProblemName(sub.problemCode, sub.problemName).then(name => {
          notifyUser(name, sub.problemCode, verdict);
        });
      } else {
        setTimeout(() => pollClassic(id), CLASSIC_DELAY);
      }
    } catch (e) {
      console.error("❌ Parse error", e);
      setTimeout(() => pollClassic(id), CLASSIC_DELAY);
    }
  };
  xhr.send();
}

/* -------------------------------------------------- */
/* 5) Desktop notification                            */
/* -------------------------------------------------- */
function notifyUser(problemName, problemCode, verdict) {
  const message = `${problemName} (${problemCode}): ${verdict}`;
  console.log("🔔 Notifying:", message);

  chrome.notifications.create(`cc-${Date.now()}`, {
    type: 'basic',
    iconUrl: 'icons/icon.png',
    title: 'CodeChef Submission Result',
    message,
    priority: 2
  }, nid => {
    if (chrome.runtime.lastError) console.error(chrome.runtime.lastError);
  });
}
