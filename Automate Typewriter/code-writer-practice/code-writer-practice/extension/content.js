function findEditor() {
  return document.querySelector("#editor");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "WRITE_CODE") return;

  const editor = findEditor();
  if (!editor) {
    sendResponse({ok:false});
    return;
  }

  editor.focus();
  editor.value = message.code;
  editor.dispatchEvent(new Event("input", {bubbles:true}));
  editor.dispatchEvent(new Event("change", {bubbles:true}));
  sendResponse({ok:true});
});
