'use strict';
const {app,BrowserWindow,ipcMain,dialog,safeStorage,shell,net,globalShortcut,session}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {Settings}=require('./settings.cjs');
const {Vault}=require('./vault.cjs');
const {ToolRunner}=require('./tools.cjs');
const {Agent,providerError}=require('./agent.cjs');
const {atomicJSON,redact,readText,noteName,string}=require('./core.cjs');
app.setName('JARVIS');
if(!app.requestSingleInstanceLock())app.exit(0);
let win,settings,vault,tools,agent,history=[],historyFile,voiceController,sttController;
let saves=Promise.resolve();
const entry=pathToFileURL(path.join(__dirname,'index.html')).href;
function emit(event){if(win&&!win.isDestroyed())win.webContents.send('jarvis:event',event);}
async function persistHistory(){const snapshot=history.map(m=>({...m,content:redact(m.content)}));saves=saves.catch(()=>{}).then(()=>atomicJSON(historyFile,snapshot));return saves;}
async function approve({name,details}){
  if(!win||win.isDestroyed())return false;
  emit({type:'state',state:'approval'});
  const answer=await dialog.showMessageBox(win,{type:'question',title:'JARVIS — approve action',message:`Allow ${name.replaceAll('_',' ')}?`,detail:details,buttons:['Cancel','Allow this exact action'],defaultId:0,cancelId:0,noLink:true});
  emit({type:'state',state:'thinking'});return answer.response===1;
}
async function configureRuntime(){
  vault=new Vault(settings.values.vault);await vault.init();
  tools=new ToolRunner({workspace:settings.values.workspace,vault,approve,emit,shellOpen:url=>shell.openExternal(url)});
  agent=new Agent({fetchImpl:(...args)=>net.fetch(...args),settings:()=>settings.values,readSecret:n=>settings.readSecret(n),vault,tools,emit,history,saveHistory:persistHistory});
}
function ipc(name,handler){ipcMain.handle('jarvis:'+name,async(event,...args)=>{
  if(event.sender!==win?.webContents||event.senderFrame!==win.webContents.mainFrame||event.senderFrame.url!==entry)throw new Error('Untrusted IPC sender.');
  try{return {ok:true,value:await handler(...args)};}catch(error){return {ok:false,error:redact(error.message||'Operation failed.')};}
});}
async function speak(text){
  string(text,'Speech text',16000);
  const key=settings.readSecret('fishKey');if(!key)throw new Error('Add your Fish Audio key in Settings to enable this voice.');
  voiceController?.abort();voiceController=new AbortController();
  const cfg=settings.values;
  // Fish API requests are bounded; the UI calls this once per sentence to avoid truncating replies.
  if(text.length>3000)throw new Error('Speech chunk exceeds 3,000 characters. Split it into sentences.');
  const response=await net.fetch('https://api.fish.audio/v1/tts',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',model:cfg.fishModel},body:JSON.stringify({text,reference_id:cfg.voiceId,format:'mp3'}),signal:AbortSignal.any([voiceController.signal,AbortSignal.timeout(60000)])});
  if(!response.ok){if(response.status===401)throw new Error('Fish Audio rejected its key. Update it in Settings.');if(response.status===402)throw new Error('Fish Audio requires available credit.');if(response.status===429)throw new Error('Fish Audio rate limit reached.');throw new Error(`Fish Audio error (${response.status}). Check the voice ID, model and account access.`);}
  const bytes=await response.arrayBuffer();if(bytes.byteLength>12000000)throw new Error('Voice response exceeded the audio limit.');return new Uint8Array(bytes);
}
function registerIPC(){
  ipc('bootstrap',()=>({settings:settings.public(),history,version:app.getVersion(),platform:process.platform,models:[],vaultRoot:vault.root}));
  ipc('send',async input=>{const answer=await agent.send(input);return {text:answer};});
  ipc('stop',()=>{agent.stop();voiceController?.abort();sttController?.abort();return true;});
  ipc('settings',async input=>{if(agent.controller)throw new Error('Stop the active request before changing settings.');const result=await settings.save(input);await vault.checkpoint('Desktop settings updated. Credential values are stored only in the encrypted credential store.');return result;});
  ipc('choose-folder',async kind=>{
    if(agent.controller)throw new Error('Stop the active request first.');
    if(!['workspace','vault'].includes(kind))throw new Error('Invalid folder type.');
    const result=await dialog.showOpenDialog(win,{title:kind==='vault'?'Choose a JARVIS memory vault folder':'Choose the folder JARVIS may work with',properties:['openDirectory','createDirectory']});
    if(result.canceled)return null;
    const selected=await fs.realpath(result.filePaths[0]);
    const root=path.parse(selected).root;
    if(selected.toLowerCase()===root.toLowerCase())throw new Error('Choose a project folder, not the root of a drive.');
    await settings.setFolder(kind,selected);await configureRuntime();return {settings:settings.public(),vaultRoot:vault.root};
  });
  ipc('clear-chat',async()=>{
    if(agent.controller)throw new Error('Stop the active request first.');
    const {response}=await dialog.showMessageBox(win,{type:'question',message:'Clear the conversation history?',detail:'This removes the local conversation archive. Your memory notes and daily checkpoints remain.',buttons:['Cancel','Clear history'],cancelId:0,defaultId:0});
    if(response!==1)return false;history.length=0;await persistHistory();return true;
  });
  ipc('memory-list',()=>vault.list());
  ipc('memory-read',name=>vault.read(noteName(name)));
  ipc('memory-save',async(name,content)=>vault.save(name,content));
  ipc('memory-import',async()=>{
    const result=await dialog.showOpenDialog(win,{title:'Import a complete Markdown memory note',filters:[{name:'Markdown or text',extensions:['md','txt']}],properties:['openFile']});
    if(result.canceled)return null;
    const file=result.filePaths[0];const content=await readText(file,60000);const name=path.basename(file,path.extname(file));noteName(name);
    const existing=(await vault.list()).includes(name);
    if(existing){const r=await dialog.showMessageBox(win,{type:'question',message:`Replace memory note “${name}”?`,detail:'The imported file will replace this note in full.',buttons:['Cancel','Replace'],defaultId:0,cancelId:0});if(r.response!==1)return null;}
    return vault.save(name,content);
  });
  ipc('open-vault',async()=>{const error=await shell.openPath(vault.root);if(error)throw new Error(error);return true;});
  ipc('voice',text=>speak(text));
  ipc('transcribe',async recording=>{
    if(!(recording instanceof Uint8Array)||recording.length<100||recording.length>16000000)throw new Error('Recording must be under 16 MB.');
    const key=settings.readSecret('groqKey');if(!key)throw new Error('Add a Groq key in Settings for microphone transcription.');
    sttController?.abort();sttController=new AbortController();
    const form=new FormData();form.append('file',new Blob([recording],{type:'audio/webm'}),'speech.webm');form.append('model','whisper-large-v3-turbo');form.append('response_format','json');
    const response=await net.fetch('https://api.groq.com/openai/v1/audio/transcriptions',{method:'POST',headers:{Authorization:'Bearer '+key},body:form,signal:AbortSignal.any([sttController.signal,AbortSignal.timeout(60000)])});
    const data=await response.json();if(!response.ok)throw new Error(providerError(response.status,data));return string(data.text,'Transcript',16000);
  });
  ipc('models',async provider=>{
    if(!['groq','openai'].includes(provider))throw new Error('Invalid provider.');
    const key=settings.readSecret(provider==='groq'?'groqKey':'openaiKey');if(!key)throw new Error('Save the provider key first.');
    const response=await net.fetch(provider==='groq'?'https://api.groq.com/openai/v1/models':'https://api.openai.com/v1/models',{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(20000)});
    const data=await response.json();if(!response.ok)throw new Error(providerError(response.status,data));return data.data.map(x=>x.id).sort();
  });
  ipc('export-chat',async()=>{
    const result=await dialog.showSaveDialog(win,{title:'Export conversation',defaultPath:'JARVIS-conversation.md',filters:[{name:'Markdown',extensions:['md']}]});
    if(result.canceled)return false;
    await fs.writeFile(result.filePath,history.map(m=>`## ${m.role==='user'?'You':'JARVIS'}\n\n${redact(m.content)}\n`).join('\n'));return true;
  });
}
app.whenReady().then(async()=>{
  const data=app.getPath('userData');await fs.mkdir(data,{recursive:true});
  settings=new Settings(data,safeStorage);await settings.init();
  if(!settings.values.workspace){const folder=path.join(app.getPath('documents'),'JARVIS Workspace');await fs.mkdir(folder,{recursive:true});await settings.setFolder('workspace',folder);}
  if(!settings.values.vault)await settings.setFolder('vault',path.join(data,'Vault'));
  historyFile=path.join(data,'conversation.json');
  try{const loaded=JSON.parse(await fs.readFile(historyFile,'utf8'));if(!Array.isArray(loaded)||loaded.some(m=>!['user','assistant'].includes(m.role)||typeof m.content!=='string'))throw new Error('Invalid conversation archive.');history=loaded;}catch(e){if(e.code!=='ENOENT')throw new Error('Conversation archive could not be read. Back up and move conversation.json aside before relaunching.');}
  await configureRuntime();
  win=new BrowserWindow({width:1360,height:900,minWidth:900,minHeight:660,backgroundColor:'#071019',title:'JARVIS',autoHideMenuBar:true,icon:path.join(__dirname,'icon.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
  session.defaultSession.setPermissionRequestHandler((contents,permission,callback,details)=>callback(contents===win.webContents&&permission==='media'&&details.mediaTypes?.every(type=>type==='audio')));
  session.defaultSession.setPermissionCheckHandler((contents,permission,origin,details)=>contents===win.webContents&&permission==='media'&&details.mediaType==='audio');
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(event,url)=>{if(url!==entry)event.preventDefault();});
  registerIPC();await win.loadFile(path.join(__dirname,'index.html'));
  globalShortcut.register('CommandOrControl+Shift+Space',()=>{win.show();win.focus();emit({type:'hotkey'});});
  win.on('closed',()=>{agent.stop();voiceController?.abort();sttController?.abort();});
}).catch(error=>{dialog.showErrorBox('JARVIS could not start',redact(error.message));app.quit();});
app.on('window-all-closed',()=>app.quit());
app.on('will-quit',()=>globalShortcut.unregisterAll());
app.on('second-instance',()=>{if(win&&!win.isDestroyed()){if(win.isMinimized())win.restore();win.show();win.focus();}});
