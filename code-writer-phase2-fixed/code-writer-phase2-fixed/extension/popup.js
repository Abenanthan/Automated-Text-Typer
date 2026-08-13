const code = document.getElementById("code");
const file = document.getElementById("file");
const status = document.getElementById("status");

chrome.storage.local.get(["code", "file"], data => {
  if (data.code) code.value = data.code;
  if (data.file) file.value = data.file;
});

document.getElementById("clear").onclick = () => {
  code.value = "";
  status.textContent = "";
};

document.getElementById("write").onclick = async () => {
  const value = code.value;
  const targetFile = file.value;

  await chrome.storage.local.set({code: value, file: targetFile});

  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  if (!tab?.id) {
    status.textContent = "No active tab.";
    return;
  }

  chrome.tabs.sendMessage(tab.id, {
    type: "WRITE_CODE",
    file: targetFile,
    code: value
  }, response => {
    if (chrome.runtime.lastError) {
      status.textContent = "Open the local practice IDE first.";
      return;
    }
    status.textContent = response?.ok
      ? `Written to ${targetFile}`
      : (response?.reason || "Editor not ready.");
  });
};
