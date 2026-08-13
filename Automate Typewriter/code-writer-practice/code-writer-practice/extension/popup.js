const code = document.getElementById("code");
const status = document.getElementById("status");

chrome.storage.local.get(["code"], data => {
  if (data.code) code.value = data.code;
});

document.getElementById("write").onclick = async () => {
  const value = code.value;
  await chrome.storage.local.set({code: value});

  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  if (!tab?.id) {
    status.textContent = "No active tab.";
    return;
  }

  chrome.tabs.sendMessage(tab.id, {
    type: "WRITE_CODE",
    code: value
  }, response => {
    if (chrome.runtime.lastError) {
      status.textContent = "Open the local practice IDE first.";
      return;
    }
    status.textContent = response?.ok ? "Code written." : "Editor not found.";
  });
};
