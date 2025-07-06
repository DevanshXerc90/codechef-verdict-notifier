console.log("📦 content.js loaded");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("📥 content.js received message:", request);

  if (request.action === 'getProblemInfo') {
    let problemName = '';
    let problemCode = '';

    try {
      
      const breadcrumbLast = document.querySelector('.breadcrumb li:last-child');
      if (breadcrumbLast) {
        problemName = breadcrumbLast.textContent.trim();
      }

      
      const pathParts = window.location.pathname.split('/');
      for (let i = pathParts.length - 1; i >= 0; i--) {
        if (pathParts[i] && !['problems', 'submit'].includes(pathParts[i])) {
          problemCode = pathParts[i];
          break;
        }
      }

      
      if (!problemName) {
        const h1 = document.querySelector('h1') || document.querySelector('h2');
        problemName = h1?.textContent?.trim() || 'Unknown Problem';
      }

      console.log("📨 Sending problem info:", problemName, problemCode);
      sendResponse({ problemName, problemCode });

    } catch (err) {
      console.error("❌ Error in content.js:", err);
      sendResponse({ problemName: 'Unknown', problemCode: 'Unknown' });
    }

    return true; 
  }
});
