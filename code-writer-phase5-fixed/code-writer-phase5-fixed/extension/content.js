function requestPage(type,payload={}){
  return new Promise(resolve=>{
    const requestId=crypto.randomUUID();
    const timer=setTimeout(()=>{
      window.removeEventListener("message",handler);
      resolve({supported:false,reason:"Page adapter did not respond."});
    },8000);
    function handler(event){
      if(event.source!==window) return;
      const m=event.data;
      if(!m || m.source!=="code-writer-page" || m.requestId!==requestId) return;
      clearTimeout(timer);
      window.removeEventListener("message",handler);
      resolve(m.result||{supported:false});
    }
    window.addEventListener("message",handler);
    window.postMessage({source:"code-writer-extension",requestId,type,...payload},"*");
  });
}
function fallbackDetect(){
  if(document.querySelector(".monaco-editor")) return {supported:true,type:"monaco"};
  if(document.querySelector(".CodeMirror")) return {supported:true,type:"codemirror"};
  if(document.querySelector("textarea")) return {supported:true,type:"textarea"};
  return {supported:false};
}
chrome.runtime.onMessage.addListener((m,s,sendResponse)=>{
  if(m.type==="DETECT"){
    requestPage("DETECT").then(r=>{
      if(r.supported) sendResponse(r);
      else sendResponse(fallbackDetect());
    });
    return true;
  }
  if(m.type==="WRITE"){
    requestPage("WRITE",{file:m.file,code:m.code}).then(r=>{
      if(r.ok){sendResponse(r);return;}
      sendResponse({ok:false,reason:r.reason||"Editor detected, but the page adapter could not write to it."});
    });
    return true;
  }
});