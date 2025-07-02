console.log("📦 content.js loaded");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("📥 content.js received message:", request);

  if (request.action === 'getProblemInfo') {
    let problemName = '';
    let problemCode = '';

    try {
      // ✅ Extract from breadcrumb (most accurate)
      const breadcrumbLast = document.querySelector('.breadcrumb li:last-child');
      if (breadcrumbLast) {
        problemName = breadcrumbLast.textContent.trim();
      }

      // ✅ Extract from URL path
      const pathParts = window.location.pathname.split('/');
      for (let i = pathParts.length - 1; i >= 0; i--) {
        const part = pathParts[i];
        if (part && !['problems', 'submit', 'contests'].includes(part.toLowerCase())) {
          problemCode = part;
          break;
        }
      }

      // ⛑️ Fallback to header text if breadcrumb is missing
      if (!problemName) {
        const heading = document.querySelector('h1, h2');
        problemName = heading?.textContent?.trim() || 'Unknown Problem';
      }

      console.log("📨 Sending problem info:", problemName, problemCode);
      sendResponse({ problemName, problemCode });

    } catch (err) {
      console.error("❌ Error in content.js while extracting problem info:", err);
      sendResponse({ problemName: 'Unknown', problemCode: 'Unknown' });
    }

    return true; // Allow async response
  }
});
