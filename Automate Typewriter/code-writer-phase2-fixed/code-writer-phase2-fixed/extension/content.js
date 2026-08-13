function waitForDemo(timeout = 12000) {
  return new Promise(resolve => {
    const start = Date.now();
    const timer = setInterval(() => {
      const editor = document.querySelector(".monaco-editor");
      if (editor) {
        clearInterval(timer);
        resolve(true);
      } else if (Date.now() - start > timeout) {
        clearInterval(timer);
        resolve(false);
      }
    }, 100);
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "WRITE_CODE") return;

  (async () => {
    const ready = await waitForDemo();
    if (!ready) {
      sendResponse({ok:false, reason:"Monaco editor was not found. Refresh the local IDE."});
      return;
    }

    const resultHandler = event => {
      window.removeEventListener("code-writer:result", resultHandler);
      sendResponse(event.detail || {ok:false, reason:"No result received."});
    };

    window.addEventListener("code-writer:result", resultHandler);

    window.dispatchEvent(new CustomEvent("code-writer:set-file", {
      detail: {
        file: message.file,
        code: message.code
      }
    }));

    // Safety timeout.
    setTimeout(() => {
      window.removeEventListener("code-writer:result", resultHandler);
      sendResponse({ok:false, reason:"Timed out waiting for the page editor."});
    }, 12000);
  })();

  return true;
});
