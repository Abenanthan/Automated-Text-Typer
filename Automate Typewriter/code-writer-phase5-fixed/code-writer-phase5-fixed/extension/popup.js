const code=document.getElementById("code");
const file=document.getElementById("file");
const detectEl=document.getElementById("detect");
const status=document.getElementById("status");

function request(type,payload={}){
  return new Promise(async resolve=>{
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if(!tab?.id){resolve({supported:false,reason:"No active tab."});return;}
    chrome.tabs.sendMessage(tab.id,{type,...payload},r=>{
      if(chrome.runtime.lastError) resolve({supported:false,reason:"Open the local practice IDE and refresh it."});
      else resolve(r||{supported:false,reason:"No response."});
    });
  });
}
async function detect(){
  const r=await request("DETECT");
  detectEl.textContent=r?.supported?`Editor: ${r.type}${r.file?" · File: "+r.file:""}`:(r?.reason||"No supported editor detected.");
}
document.addEventListener("DOMContentLoaded",detect);
document.getElementById("write").onclick=async()=>{
  status.textContent="Writing...";
  const r=await request("WRITE",{file:file.value,code:code.value});
  status.textContent=r?.ok?`Written to ${r.file} using ${r.editor}`:(r?.reason||"Write failed.");
};
document.getElementById("clear").onclick=()=>{code.value="";status.textContent=""};