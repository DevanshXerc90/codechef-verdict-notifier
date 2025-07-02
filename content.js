chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getProblemInfo') {
    let problemName = '';
    let problemCode = '';

    try {
      // ✅ Try to extract from breadcrumb (most accurate)
      const breadcrumbLast = document.querySelector('.breadcrumb li:last-child');
      if (breadcrumbLast) {
        problemName = breadcrumbLast.textContent.trim();
      }

      // ✅ Try to extract from URL path
      const pathParts = window.location.pathname.split('/');
      // URL like /START193D/problems/RECSQ or /problems/BLOBBYVOLLEY
      for (let i = pathParts.length - 1; i >= 0; i--) {
        if (pathParts[i] && !['problems', 'submit'].includes(pathParts[i])) {
          problemCode = pathParts[i];
          break;
        }
      }

      // ⛑️ Fallback: Use heading if breadcrumb is missing
      if (!problemName) {
        const h1 = document.querySelector('h1') || document.querySelector('h2');
        problemName = h1?.textContent?.trim() || 'Unknown Problem';
      }

      console.log("📨 Sending problem info:", problemName, problemCode);
      sendResponse({ problemName, problemCode });

    } catch (err) {
      console.error("❌ Error in content.js while extracting problem info:", err);
      sendResponse({ problemName: 'Unknown', problemCode: 'Unknown' });
    }

    return true; // Allow async sendResponse
  }
});
