'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const invoke=(name,...args)=>ipcRenderer.invoke('jarvis:'+name,...args);
contextBridge.exposeInMainWorld('jarvis',Object.freeze({
  bootstrap:()=>invoke('bootstrap'),send:text=>invoke('send',text),stop:()=>invoke('stop'),
  saveSettings:input=>invoke('settings',input),chooseFolder:kind=>invoke('choose-folder',kind),
  clearChat:()=>invoke('clear-chat'),listMemory:()=>invoke('memory-list'),readMemory:name=>invoke('memory-read',name),
  saveMemory:(name,content)=>invoke('memory-save',name,content),importMemory:()=>invoke('memory-import'),
  openVault:()=>invoke('open-vault'),voice:text=>invoke('voice',text),transcribe:bytes=>invoke('transcribe',bytes),
  models:provider=>invoke('models',provider),exportChat:()=>invoke('export-chat'),
  onEvent:callback=>{const listener=(_event,value)=>callback(value);ipcRenderer.on('jarvis:event',listener);return()=>ipcRenderer.removeListener('jarvis:event',listener);}
}));
