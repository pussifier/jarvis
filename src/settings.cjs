'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {atomicJSON,string}=require('./core.cjs');
const DEFAULTS={provider:'groq',model:'openai/gpt-oss-120b',fishModel:'s2.1-pro-free',voiceId:'612b878b113047d9a770c069c8b4fdfe',voiceEnabled:true,voiceSpeed:1,workspace:'',vault:''};
class Settings {
  constructor(root,safeStorage){this.root=root;this.crypto=safeStorage;this.values={...DEFAULTS};this.secrets={};}
  async init(){
    try{this.values={...DEFAULTS,...JSON.parse(await fs.readFile(path.join(this.root,'settings.json'),'utf8'))};}catch(e){if(e.code!=='ENOENT')throw new Error('Settings could not be read. Restore settings.json from a backup or move it aside.');}
    try{this.secrets=JSON.parse(await fs.readFile(path.join(this.root,'credentials.enc.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw new Error('The encrypted credential store could not be read.');}
  }
  public(){return {...this.values,hasGroqKey:!!this.secrets.groqKey,hasOpenaiKey:!!this.secrets.openaiKey,hasFishKey:!!this.secrets.fishKey,encryptionAvailable:this.crypto.isEncryptionAvailable(),encryptionBackend:this.crypto.getSelectedStorageBackend?.()||'Windows DPAPI / OS encryption'};}
  readSecret(name){
    if(!this.secrets[name])return '';
    if(!this.crypto.isEncryptionAvailable())throw new Error('Operating-system credential encryption is unavailable.');
    try{return this.crypto.decryptString(Buffer.from(this.secrets[name],'base64'));}catch{throw new Error('Credential decryption failed. Re-enter your keys in Settings under this Windows account.');}
  }
  async save(input){
    if(!input||typeof input!=='object')throw new Error('Invalid settings.');
    const next={...this.values};const secrets={...this.secrets};
    if(input.provider!==undefined){if(!['groq','openai'].includes(input.provider))throw new Error('Unsupported provider.');next.provider=input.provider;}
    for(const key of ['model','fishModel','voiceId'])if(input[key]!==undefined)next[key]=string(input[key],key,150).trim();
    if(input.voiceEnabled!==undefined)next.voiceEnabled=!!input.voiceEnabled;
    if(input.voiceSpeed!==undefined){const speed=Number(input.voiceSpeed);if(!Number.isFinite(speed)||speed<0.7||speed>1.5)throw new Error('Voice speed must be 0.7–1.5.');next.voiceSpeed=speed;}
    for(const key of ['groqKey','openaiKey','fishKey'])if(input[key]){
      if(!this.crypto.isEncryptionAvailable()||this.crypto.getSelectedStorageBackend?.()==='basic_text')throw new Error('Secure operating-system encryption is unavailable. No key was saved.');
      const value=string(input[key],key,500).trim();if(/\s/.test(value))throw new Error('Paste just the key, not a curl command.');
      secrets[key]=this.crypto.encryptString(value).toString('base64');
    }
    await atomicJSON(path.join(this.root,'credentials.enc.json'),secrets);
    await atomicJSON(path.join(this.root,'settings.json'),next);
    this.values=next;this.secrets=secrets;return this.public();
  }
  async setFolder(key,value){if(!['workspace','vault'].includes(key))throw new Error('Invalid folder setting.');this.values[key]=value;await atomicJSON(path.join(this.root,'settings.json'),this.values);}
}
module.exports={Settings,DEFAULTS};
