chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "getProblemInfo") {
    const problemName = document.querySelector(".header h1")?.innerText || "";
    const problemCode = window.location.pathname.split("/").pop();

    sendResponse({
      problemName,
      problemCode
    });
  }
});
