document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["lastStatus", "lastProblem"], (data) => {
    document.getElementById("status").textContent = data.lastStatus || "Idle";
    document.getElementById("problem").textContent = data.lastProblem || "None";
  });
});
