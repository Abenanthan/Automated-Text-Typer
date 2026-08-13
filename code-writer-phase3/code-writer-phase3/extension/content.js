function waitForMonaco(timeout=12000){
  return new Promise(resolve=>{
    const start=Date.now();
    const timer=setInterval(()=>{
      if(document.querySelector(".monaco-editor")){
        clearInterval(timer); resolve(true);
      }else if(Date.now()-start>timeout){
        clearInterval(timer); resolve(false);
      }
    },100);
  });
}
chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  if(message?.type!=="WRITE_PROJECT") return;
  (async()=>{
    if(!(await waitForMonaco())){
      sendResponse({ok:false,reason:"Monaco editor was not found. Refresh the local IDE."});
      return;
    }
    const handler=e=>{
      window.removeEventListener("code-writer:result",handler);
      sendResponse(e.detail||{ok:false,reason:"No result received."});
    };
    window.addEventListener("code-writer:result",handler);
    window.dispatchEvent(new CustomEvent("code-writer:project",{detail:{files:message.project}}));
    setTimeout(()=>{
      window.removeEventListener("code-writer:result",handler);
      sendResponse({ok:false,reason:"Timed out waiting for the project writer."});
    },20000);
  })();
  return true;
});
