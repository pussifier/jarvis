const fs=require('node:fs');const cp=require('node:child_process');const path=require('node:path');
for(const name of fs.readdirSync('src'))if(/\.(?:cjs|js)$/.test(name))cp.execFileSync(process.execPath,['--check',path.join('src',name)],{stdio:'inherit'});
for(const file of ['src/index.html','src/style.css','src/icon.png','build/icon.ico','README.md','LICENSE','THIRD-PARTY.md'])if(!fs.statSync(file).size)throw new Error('Missing '+file);
const html=fs.readFileSync('src/index.html','utf8');if(!html.includes("connect-src 'none'")||html.includes('<script>'))throw new Error('Renderer CSP check failed');
const keyPattern=/\b(?:gsk_[A-Za-z0-9_-]{16,}|sk-fish-[A-Za-z0-9_-]{16,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,})\b/g;
for(const dir of ['src','scripts'])for(const file of fs.readdirSync(dir)){const p=path.join(dir,file);if(!fs.statSync(p).isFile()||/\.(png|ico)$/.test(file))continue;if(keyPattern.test(fs.readFileSync(p,'utf8')))throw new Error('Possible embedded key: '+p);keyPattern.lastIndex=0;}
console.log('Syntax, assets, renderer CSP and embedded-key checks passed.');
