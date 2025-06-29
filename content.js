chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getProblemInfo') {
    const problemName = document.querySelector('.breadcrumb li:last-child')?.textContent?.trim();
    const problemCode = window.location.pathname.split('/').pop();

    console.log("📨 Sending problem info:", problemName, problemCode);
    sendResponse({ problemName, problemCode });
  }
});
