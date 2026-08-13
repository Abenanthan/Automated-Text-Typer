const folder=document.getElementById("folder");
const filesEl=document.getElementById("files");
const write=document.getElementById("write");
const status=document.getElementById("status");
let project=[];

const ignored = /(^|\/)(node_modules|\.git|\.next|dist|build|coverage)(\/|$)/;
folder.addEventListener("change",async()=>{
  project=[];
  filesEl.innerHTML="";
  const selected=[...folder.files].filter(f=>!ignored.test(f.webkitRelativePath));
  for(const f of selected){
    try{
      const content=await f.text();
      const path=f.webkitRelativePath.replace(/^[^/]+\//,"");
      project.push({path,content});
    }catch(e){}
  }
  project.sort((a,b)=>a.path.localeCompare(b.path));
  filesEl.innerHTML=project.map(x=>`<div class="item">${escapeHtml(x.path)}</div>`).join("");
  status.textContent=`${project.length} file(s) ready.`;
  write.disabled=project.length===0;
});
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

write.onclick=async()=>{
  if(!project.length)return;
  status.textContent="Writing project...";
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!tab?.id){status.textContent="No active tab.";return;}
  chrome.tabs.sendMessage(tab.id,{type:"WRITE_PROJECT",project},response=>{
    if(chrome.runtime.lastError){
      status.textContent="Open the local Phase 3 IDE first.";
      return;
    }
    if(response?.ok) status.textContent=`Completed: ${response.done}/${response.total} files`;
    else status.textContent=response?.reason||`Completed: ${response?.done||0}/${response?.total||project.length}`;
  });
};
