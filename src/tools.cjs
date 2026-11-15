'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { string, scopedPath, readText, redact, safeURL, noteName } = require('./core.cjs');

const win = path.win32;
const windows = process.env.SystemRoot || 'C:\\Windows';
const local = process.env.LOCALAPPDATA || win.join(process.env.USERPROFILE || 'C:\\Users\\Default','AppData','Local');
const programs = process.env.ProgramFiles || 'C:\\Program Files';
const programs32 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
// Absolute executables avoid launching a lookalike from the selected workspace or PATH.
const APPS = {
  notepad: [win.join(windows,'System32','notepad.exe')], calculator: [win.join(windows,'System32','calc.exe')],
  explorer: [win.join(windows,'explorer.exe')], paint: [win.join(windows,'System32','mspaint.exe')],
  terminal: [win.join(local,'Microsoft','WindowsApps','wt.exe')],
  edge: [win.join(programs32,'Microsoft','Edge','Application','msedge.exe'),win.join(programs,'Microsoft','Edge','Application','msedge.exe')],
  chrome: [win.join(programs,'Google','Chrome','Application','chrome.exe'),win.join(local,'Google','Chrome','Application','chrome.exe')],
  vscode: [win.join(local,'Programs','Microsoft VS Code','Code.exe'),win.join(programs,'Microsoft VS Code','Code.exe')]
};
const schema = (name, description, properties, required = []) => ({ type:'function', function:{ name, description, parameters:{ type:'object', properties, required, additionalProperties:false } } });
const text = description => ({ type:'string', description });
const TOOLS = [
  schema('list_files', 'List a directory inside the user-selected workspace. Requires approval. Paths are relative to workspace.', {path:text('Directory; use . for workspace root')}, ['path']),
  schema('search_files', 'Search file names recursively inside workspace, without following links. Results include explicit scan limits.', {query:text('Case-insensitive substring in file name')}, ['query']),
  schema('read_file', 'Read a complete UTF-8 text file in workspace, max 60,000 bytes. Never reads a sample.', {path:text('Relative path')}, ['path']),
  schema('write_file', 'Create or replace a text file in an existing workspace folder. Shows exact contents and requires approval. Never use for secret storage.', {path:text('Relative path'),content:text('Full new file content, max 60,000 characters')}, ['path','content']),
  schema('open_app', 'Launch an installed Windows application. Allowed names: notepad, calculator, explorer, paint, terminal, edge, chrome, vscode. Requires approval.', {name:{type:'string',enum:Object.keys(APPS)}}, ['name']),
  schema('open_url', 'Open a specific HTTP(S) URL in default browser, only with explicit approval. External page contents are not automatically read.', {url:text('Full URL')}, ['url']),
  schema('run_powershell', 'Execute a Windows PowerShell command in workspace after showing the exact command and receiving explicit approval. No admin escalation. Use only when direct tools cannot satisfy the request.', {command:text('Exact PowerShell script, max 8,000 characters')}, ['command']),
  schema('memory_list', 'List names of saved memory notes.', {}),
  schema('memory_read', 'Read one saved memory note completely.', {name:text('Note name without .md')}, ['name']),
  schema('memory_save', 'Save or consolidate a useful memory note; plain markdown, never secrets. Profile is included at startup. Other notes can be searched/read. Memory writes are exempt from action confirmation.', {name:text('Note name without .md'),content:text('Complete markdown content')}, ['name','content']),
  schema('system_info', 'Read current system date/time, OS and workspace path. Does not run a command.', {})
];

class ToolRunner {
  constructor({ workspace, vault, approve, emit = () => {}, platform = process.platform, shellOpen, spawnImpl = spawn }) {
    Object.assign(this, { workspace, vault, approve, emit, platform, shellOpen, spawnImpl });
  }
  async run(name, args, signal) {
    const def = TOOLS.find(t => t.function.name === name)?.function.parameters;
    if (!def || !args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Invalid tool call.');
    if (Object.keys(args).some(k => !Object.hasOwn(def.properties, k))) throw new Error('Unknown tool argument.');
    for (const key of def.required) string(args[key], key, key === 'content' ? 60000 : key === 'command' ? 8000 : 2000);
    if (signal?.aborted) throw new Error('Action stopped.');
    const state = message => this.emit({type:'activity',message:redact(message)});
    state(`Requested: ${name}`);
    if (name === 'system_info') return {time:new Date().toISOString(),localTime:new Date().toLocaleString(),platform:this.platform,workspace:this.workspace};
    if (name === 'memory_list') return {notes:await this.vault.list()};
    if (name === 'memory_read') return {name:noteName(args.name),content:redact(await this.vault.read(args.name)),complete:true};
    if (name === 'memory_save') { const r = await this.vault.save(args.name,args.content); state(`Memory saved: ${args.name}`); return r; }
    let resolved, before;
    if (['list_files','read_file','write_file'].includes(name)) resolved = await scopedPath(this.workspace,args.path,{create:name==='write_file'});
    if (name === 'write_file') {
      if (redact(args.content) !== args.content) throw new Error('Do not save API keys in source files. Use encrypted Settings.');
      try { before = await readText(resolved,60000); } catch (e) { if (e.code !== 'ENOENT') throw e; before = null; }
    }
    if (name === 'open_url') args.url = safeURL(args.url);
    if (name === 'open_app' && !Object.hasOwn(APPS,args.name)) throw new Error('That application is not in the supported list.');
    if (['open_app','run_powershell'].includes(name) && this.platform !== 'win32') throw new Error('This action requires Windows.');
    const details = name === 'write_file' ? `File: ${resolved}\n\nCURRENT CONTENTS:\n${before ?? '(new file)'}\n\nNEW CONTENTS:\n${args.content}`
      : name === 'run_powershell' ? `Working folder: ${this.workspace}\n\nExact command:\n${args.command}\n\nThis runs with your Windows user permissions and may affect files outside the workspace. Review every line.`
      : name === 'open_app' ? `Application: ${args.name}\n\nAllowed executable locations (first installed match):\n${APPS[args.name].join('\n')}`
      : resolved ? `Path: ${resolved}` : JSON.stringify(args,null,2);
    const accepted = await this.approve({name,details});
    if (!accepted || signal?.aborted) { state(`Not executed: ${name}`); return {denied:true,message:'The user did not approve this action. Do not retry it or use another tool to do the same thing.'}; }
    let result;
    if (name === 'list_files') {
      const dir = await scopedPath(this.workspace,args.path);
      const entries = await fs.readdir(dir,{withFileTypes:true});
      result = {entries:entries.slice(0,1000).map(e=>({name:e.name,type:e.isSymbolicLink()?'link':e.isDirectory()?'folder':'file'})),total:entries.length,limited:entries.length>1000};
    } else if (name === 'search_files') result = await this.search(args.query,signal);
    else if (name === 'read_file') result = {path:args.path,content:redact(await readText(await scopedPath(this.workspace,args.path),60000)),complete:true};
    else if (name === 'write_file') {
      const currentPath = await scopedPath(this.workspace,args.path,{create:true});
      if (currentPath !== resolved) throw new Error('The file location changed during approval. No write performed.');
      let current = null; try { current = await readText(currentPath,60000); } catch (e) { if(e.code !== 'ENOENT') throw e; }
      if (current !== before) throw new Error('File changed during approval. Ask again with the current contents.');
      await fs.writeFile(currentPath,args.content,{mode:0o600});
      if (await fs.readFile(currentPath,'utf8') !== args.content) throw new Error('Write verification failed.');
      result = {written:args.path,verified:true};
    } else if (name === 'open_app') {
      let program;
      for(const candidate of APPS[args.name]){try{await fs.access(candidate);program=candidate;break;}catch{}}
      if(!program)throw new Error(`${args.name} was not found in its standard Windows install locations.`);
      await new Promise((resolve,reject)=>{const child=this.spawnImpl(program,[],{detached:true,stdio:'ignore',windowsHide:false,cwd:this.workspace});child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});});
      result = {launchRequested:args.name,message:'Windows accepted the launch request. Window visibility has not been verified.'};
    } else if (name === 'open_url') { await this.shellOpen(args.url); result={opened:args.url,message:'Link handed to the default browser; page loading has not been verified.'}; }
    else if (name === 'run_powershell') result = await this.command(args.command,signal);
    await this.vault.checkpoint(`Action ${name} completed${result?.exitCode !== undefined ? ` with exit code ${result.exitCode}` : ''}.`);
    state(`Completed: ${name}`);
    return result;
  }
  async search(query,signal) {
    const matches=[]; let scanned=0,limited=false; const folders=['.'];
    while(folders.length && !limited) {
      if(signal?.aborted) throw new Error('Search stopped.');
      const relative=folders.pop(); const dir=await scopedPath(this.workspace,relative);
      const entries=await fs.readdir(dir,{withFileTypes:true});
      for(const item of entries) {
        if(++scanned>5000 || matches.length>=200) { limited=true;break; }
        const rel=path.join(relative,item.name);
        if(item.isSymbolicLink())continue;
        if(item.name.toLowerCase().includes(query.toLowerCase()))matches.push(rel);
        if(item.isDirectory()&&!['node_modules','.git'].includes(item.name))folders.push(rel);
      }
    }
    return {matches,scanned,limited,excluded:['symbolic links','node_modules','.git'],limitMessage:limited?'Scan stopped at 5,000 entries or 200 matches. Narrow the workspace or query.':null};
  }
  command(command,signal) {
    return new Promise((resolve,reject)=>{
      const encoded=Buffer.from(command,'utf16le').toString('base64');
      const child=this.spawnImpl(win.join(windows,'System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',encoded],{cwd:this.workspace,windowsHide:true,stdio:['ignore','pipe','pipe']});
      let output='',truncated=false,settled=false;
      const collect=data=>{const s=data.toString();if(output.length+s.length>60000)truncated=true;output=(output+s).slice(0,60000);};
      child.stdout.on('data',collect);child.stderr.on('data',collect);
      const kill=()=>{if(this.platform==='win32'){const p=this.spawnImpl(win.join(windows,'System32','taskkill.exe'),['/pid',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});p.on('error',()=>child.kill());}else child.kill();};
      const finish=(err,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);err?reject(err):resolve(value);};
      const abort=()=>{kill();finish(new Error('Command interrupted. It may have made changes before interruption.'));};
      const timer=setTimeout(()=>{kill();finish(new Error('Command exceeded 60 seconds and was stopped. Earlier changes may have occurred.'));},60000);
      signal?.addEventListener('abort',abort,{once:true});
      child.on('error',e=>finish(e));
      child.on('close',exitCode=>finish(null,{exitCode,output:redact(output),truncated}));
      if(signal?.aborted)abort();
    });
  }
}
module.exports = { ToolRunner, TOOLS, APPS };
