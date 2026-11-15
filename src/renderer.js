'use strict';
const $=id=>document.getElementById(id);const api=window.jarvis;
let settings={},history=[],busy=false,currentState='idle',audio=null,audioContext=null,analyser=null,waveform=null,playResolve=null,voiceEpoch=0,recorder=null,stream=null,recordIntent=false,recordTimer=null,recordEpoch=0,voiceOn=true;
const labels={idle:'AWAITING YOUR COMMAND',thinking:'PROCESSING YOUR REQUEST',listening:'LISTENING',transcribing:'TRANSCRIBING',speaking:'VOICE LINK ACTIVE',approval:'AWAITING YOUR APPROVAL'};
function state(value){currentState=value;$('core-state').textContent=labels[value]||value.toUpperCase();$('footer-status').textContent=labels[value]||value.toUpperCase();$('talk').classList.toggle('recording',value==='listening');$('talk').querySelector('span').textContent=value==='listening'?'Release to send':'Hold to talk';}
function notify(text,error=false,target='status'){$(target).textContent=text;$(target).classList.toggle('error',error);}
async function call(method,...args){const result=await api[method](...args);if(!result?.ok)throw Error(result?.error||'The desktop service did not respond.');return result.value;}
function log(message){const list=$('activity');list.querySelector('.activity-empty')?.remove();const li=document.createElement('li');const time=document.createElement('time');time.textContent=new Date().toLocaleTimeString();li.append(time,document.createTextNode(message));list.append(li);list.scrollTop=list.scrollHeight;}
function view(name){document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!=='view-'+name);document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('selected',el.dataset.view===name));if(name==='memory')loadMemory();}
function message(role,text){const el=document.createElement('div');el.className='message '+role;const label=document.createElement('div');label.className='message-label';label.textContent=role==='user'?'YOU':'J.A.R.V.I.S';el.append(label,document.createTextNode(text));if(role==='assistant'){const footer=document.createElement('div');footer.className='message-footer';const play=document.createElement('button');play.textContent='▷ Read aloud';play.onclick=()=>playSpeech(text,true);footer.append(play);el.append(footer);}$('messages').append(el);$('messages').scrollTop=$('messages').scrollHeight;}
function renderHistory(){$('messages').replaceChildren();if(history.length){for(const m of history)message(m.role,m.content);return;}
 const welcome=document.createElement('div');welcome.className='welcome';welcome.innerHTML='<div class="star">✧</div><h3>A thought. A task.<br>A place to begin.</h3><p>I’m JARVIS. Ask me to think something through, remember what matters, or work with your computer.</p><div class="suggestions"><button data-text="Help me plan my day. Ask about my priorities first."><strong>↗ MAKE A PLAN</strong>Find the next useful step</button><button data-text="List the files in my selected workspace."><strong>⌘ MY WORKSPACE</strong>See what we’re working with</button><button data-text="What do you remember about me? Read my saved notes if there are any."><strong>▤ MY MEMORY</strong>Pick up where we left off</button><button data-text="Open Calculator, please."><strong>◈ TAKE AN ACTION</strong>Ask JARVIS to open an app</button></div>';
 welcome.querySelectorAll('[data-text]').forEach(b=>b.onclick=()=>{$('input').value=b.dataset.text;$('input').focus();});$('messages').append(welcome);
}
async function send(){const text=$('input').value.trim();if(!text||busy)return;stopPlayback();if(!settings.hasGroqKey&&settings.provider==='groq'||!settings.hasOpenaiKey&&settings.provider==='openai'){openSettings();notify('Save an AI provider key to start chatting.',true,'settings-status');return;}
 busy=true;$('send').disabled=true;$('input').value='';if(!history.length)$('messages').replaceChildren();history.push({role:'user',content:text});message('user',text);notify('');state('thinking');
 try{await call('send',text);}
 catch(e){notify(e.message,true);log(e.message);}
 finally{busy=false;$('send').disabled=false;if(currentState!=='speaking')state('idle');}
}
function stopPlayback(){voiceEpoch++;if(audio){audio.pause();audio.src='';audio=null;}if(playResolve){playResolve();playResolve=null;}if(analyser){analyser.disconnect();analyser=null;waveform=null;}if(currentState==='speaking')state('idle');}
function speechChunks(text){
 const clean=text.replace(/```[\s\S]*?```/g,' Code is available in the conversation. ').replace(/https?:\/\/\S+/g,'link in the conversation').replace(/[*#`]/g,'');
 const sentences=clean.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)||[clean];const chunks=[];let part='';
 for(const sentence of sentences){if((part+sentence).length>900&&part){chunks.push(part);part='';}if(sentence.length>900){if(part){chunks.push(part);part='';}for(let start=0;start<sentence.length;start+=900)chunks.push(sentence.slice(start,start+900));}else part+=sentence;}
 if(part.trim())chunks.push(part);return chunks.filter(s=>s.trim());
}
async function playSpeech(text,manual=false){if(!voiceOn&&!manual)return;stopPlayback();const epoch=voiceEpoch;const chunks=speechChunks(text);if(!chunks.length)return;
 try{for(const chunk of chunks){if(epoch!==voiceEpoch)return;state('speaking');const bytes=await call('voice',chunk);if(epoch!==voiceEpoch)return;const url=URL.createObjectURL(new Blob([bytes],{type:'audio/mpeg'}));audio=new Audio(url);audio.playbackRate=Number(settings.voiceSpeed)||1;
  try{audioContext??=new AudioContext();await audioContext.resume();const source=audioContext.createMediaElementSource(audio);analyser=audioContext.createAnalyser();analyser.fftSize=128;waveform=new Uint8Array(analyser.frequencyBinCount);source.connect(analyser);analyser.connect(audioContext.destination);}catch{analyser=null;}
  await new Promise((resolve,reject)=>{const current=audio;playResolve=resolve;current.onended=resolve;current.onerror=()=>reject(Error('Windows could not play the generated audio.'));current.play().catch(reject);}).finally(()=>{playResolve=null;URL.revokeObjectURL(url);});
  if(analyser){analyser.disconnect();analyser=null;waveform=null;}
 }
 }catch(e){if(epoch===voiceEpoch){notify(e.message,true,$('settings-dialog').open?'settings-status':'status');log('Voice: '+e.message);}}
 finally{if(epoch===voiceEpoch){audio=null;state(busy?'thinking':'idle');}}
}
function stopRecording(cancel=false){recordIntent=false;clearTimeout(recordTimer);if(cancel)recordEpoch++;if(recorder&&recorder.state==='recording')recorder.stop();stream?.getTracks().forEach(track=>track.stop());stream=null;if(currentState==='listening')state('idle');}
async function startRecording(){if(recordIntent)return;if(busy){await interrupt();return;}stopPlayback();if(!settings.hasGroqKey){openSettings();notify('Save a Groq key to use Whisper microphone input.',true,'settings-status');return;}
 recordIntent=true;const epoch=++recordEpoch;
 try{const media=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});if(!recordIntent||epoch!==recordEpoch){media.getTracks().forEach(t=>t.stop());return;}stream=media;const parts=[];const options=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?{mimeType:'audio/webm;codecs=opus'}:{};const current=new MediaRecorder(media,options);recorder=current;
 current.ondataavailable=e=>{if(e.data.size)parts.push(e.data);};current.onstop=async()=>{media.getTracks().forEach(t=>t.stop());if(epoch!==recordEpoch)return;const blob=new Blob(parts,{type:'audio/webm'});if(blob.size<200){state('idle');return;}
  state('transcribing');notify('Transcribing your voice…');try{const bytes=new Uint8Array(await blob.arrayBuffer());const transcript=await call('transcribe',bytes);if(epoch!==recordEpoch)return;$('input').value=transcript;notify('');state('idle');await send();}catch(e){if(epoch===recordEpoch){notify(e.message,true);state('idle');}}};
 current.onerror=()=>{notify('Microphone recording failed. Check Windows microphone permissions.',true);stopRecording(true);};current.start();state('listening');notify('Release to send · Stop to discard');recordTimer=setTimeout(()=>{stopRecording();notify('Recording stopped at the two-minute limit.');},120000);
 }catch(e){recordIntent=false;notify(e.name==='NotAllowedError'?'Microphone access was denied. Enable microphone access in Windows Settings → Privacy & security → Microphone.':e.message,true);state('idle');}
}
async function interrupt(){stopPlayback();stopRecording(true);await call('stop').catch(e=>notify(e.message,true));state('idle');notify('Stopped. Previously completed actions remain in place.');}
function updateSettings(value){settings=value;voiceOn=!!value.voiceEnabled;$('voice-toggle').textContent=voiceOn?'◖ Voice on':'◖ Voice off';$('voice-toggle').classList.toggle('off',!voiceOn);$('voice-toggle').setAttribute('aria-pressed',String(voiceOn));$('engine').textContent=value.provider==='groq'?'Groq · '+value.model:'OpenAI · '+value.model;$('voice-info').textContent=value.hasFishKey?'Fish Audio':'Add a voice key';$('workspace-path').textContent=value.workspace;$('workspace-path').title=value.workspace;const configured=value.provider==='groq'?value.hasGroqKey:value.hasOpenaiKey;$('connection').classList.toggle('configured',configured);$('connection').lastChild.textContent=configured?'KEY SAVED':'SETUP REQUIRED';$('open-settings').textContent=configured?'Settings ↗':'Configure ↗';}
function openSettings(){
 $('provider').value=settings.provider||'groq';$('model').value=settings.model||'openai/gpt-oss-120b';$('fish-model').value=settings.fishModel||'s2.1-pro-free';$('voice-id').value=settings.voiceId||'612b878b113047d9a770c069c8b4fdfe';$('voice-speed').value=String(settings.voiceSpeed||1);
 for(const [id,key]of [['groq-key','hasGroqKey'],['openai-key','hasOpenaiKey'],['fish-key','hasFishKey']]){$(id).value='';$(id).placeholder=settings[key]?'Saved securely · paste only to replace':'Paste key to save';}
 $('key-status').textContent=`Groq: ${settings.hasGroqKey?'saved':'missing'} · OpenAI: ${settings.hasOpenaiKey?'saved':'optional'}`;$('settings-workspace').textContent=settings.workspace||'';$('settings-vault').textContent=settings.vault||'';$('encryption-info').textContent=settings.encryptionAvailable?'OS encryption available':'Encryption unavailable · keys cannot be saved';notify('',false,'settings-status');if(!$('settings-dialog').open)$('settings-dialog').showModal();
}
async function saveSettings(close=false){const value=await call('saveSettings',{provider:$('provider').value,model:$('model').value,groqKey:$('groq-key').value,openaiKey:$('openai-key').value,fishKey:$('fish-key').value,fishModel:$('fish-model').value,voiceId:$('voice-id').value,voiceSpeed:Number($('voice-speed').value),voiceEnabled:voiceOn});updateSettings(value);for(const id of ['groq-key','openai-key','fish-key'])$(id).value='';notify('Settings saved. Keys remain on this computer.',false,'settings-status');if(close)$('settings-dialog').close();return value;}
async function loadMemory(selected){try{const notes=await call('listMemory');$('memory-count').textContent=notes.length+' saved note'+(notes.length===1?'':'s');const select=$('memory-select');select.replaceChildren(new Option('New note…',''));for(const name of notes)select.add(new Option(name,name));if(selected)select.value=selected;}catch(e){notify(e.message,true,'memory-status');}}
async function chooseFolder(kind){try{const result=await call('chooseFolder',kind);if(result){updateSettings(result.settings);$('settings-workspace').textContent=result.settings.workspace;$('settings-vault').textContent=result.settings.vault;await loadMemory();log(`Selected ${kind}: ${result.settings[kind]}`);}}catch(e){notify(e.message,true,$('settings-dialog').open?'settings-status':'status');}}
api.onEvent(event=>{
 if(event.type==='state'){if(currentState!=='speaking'||event.state!=='idle')state(event.state);}
 if(event.type==='activity')log(event.message);
 if(event.type==='reply'){history.push({role:'assistant',content:event.text});message('assistant',event.text);loadMemory();if(voiceOn)playSpeech(event.text);}
 if(event.type==='hotkey'){if(recordIntent)stopRecording();else if(busy||audio||currentState==='speaking')interrupt();else startRecording();}
});
for(const button of document.querySelectorAll('[data-view]'))button.onclick=()=>view(button.dataset.view);
$('composer').onsubmit=e=>{e.preventDefault();send();};$('input').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}};
$('talk').onpointerdown=e=>{e.preventDefault();$('talk').setPointerCapture(e.pointerId);startRecording();};$('talk').onpointerup=()=>stopRecording();$('talk').onpointercancel=()=>stopRecording(true);$('talk').onkeydown=e=>{if(e.code==='Space'&&!e.repeat){e.preventDefault();startRecording();}};$('talk').onkeyup=e=>{if(e.code==='Space'){e.preventDefault();stopRecording();}};
$('interrupt').onclick=interrupt;$('voice-toggle').onclick=async()=>{voiceOn=!voiceOn;if(!voiceOn)stopPlayback();try{updateSettings(await call('saveSettings',{voiceEnabled:voiceOn}));}catch(e){notify(e.message,true);}};
$('new-chat').onclick=async()=>{try{if(await call('clearChat')){stopPlayback();history=[];renderHistory();notify('');}}catch(e){notify(e.message,true);}};
$('export').onclick=async()=>{try{if(await call('exportChat'))notify('Conversation exported.');}catch(e){notify(e.message,true);}};
$('settings-button').onclick=openSettings;$('open-settings').onclick=openSettings;$('settings-close').onclick=()=>{for(const id of ['groq-key','openai-key','fish-key'])$(id).value='';$('settings-dialog').close();};$('settings-dialog').addEventListener('cancel',()=>{for(const id of ['groq-key','openai-key','fish-key'])$(id).value='';});
$('settings-form').onsubmit=async e=>{e.preventDefault();try{await saveSettings(true);}catch(e){notify(e.message,true,'settings-status');}};
$('provider').onchange=()=>{$('model').value=$('provider').value==='groq'?'openai/gpt-oss-120b':'gpt-4.1-mini';$('model-list').replaceChildren();};
$('check-models').onclick=async()=>{const button=$('check-models');button.disabled=true;try{await saveSettings();const models=await call('models',$('provider').value);$('model-list').replaceChildren(...models.map(id=>new Option(id,id)));notify(`Connected. ${models.length} models available; use the Chat model field to choose.`,false,'settings-status');}catch(e){notify(e.message,true,'settings-status');}finally{button.disabled=false;}};
$('test-voice').onclick=async()=>{try{await saveSettings();await playSpeech('At your service. JARVIS is ready.',true);}catch(e){notify(e.message,true,'settings-status');}};
$('choose-workspace').onclick=()=>chooseFolder('workspace');$('workspace-path').onclick=()=>chooseFolder('workspace');$('choose-vault').onclick=()=>chooseFolder('vault');
$('memory-select').onchange=async()=>{const name=$('memory-select').value;try{$('note-name').value=name;$('note-content').value=name?await call('readMemory',name):'';notify('',false,'memory-status');}catch(e){notify(e.message,true,'memory-status');}};
$('memory-new').onclick=()=>{$('memory-select').value='';$('note-name').value='';$('note-content').value='';$('note-name').focus();};
$('memory-save').onclick=async()=>{try{const name=$('note-name').value.trim();await call('saveMemory',name,$('note-content').value);await loadMemory(name);notify('Saved and verified in your local vault.',false,'memory-status');}catch(e){notify(e.message,true,'memory-status');}};
$('memory-import').onclick=async()=>{try{const result=await call('importMemory');if(result){await loadMemory(result.saved);$('memory-select').dispatchEvent(new Event('change'));}}catch(e){notify(e.message,true,'memory-status');}};
$('vault-open').onclick=async()=>{try{await call('openVault');}catch(e){notify(e.message,true,'memory-status');}};
window.addEventListener('blur',()=>{if(recordIntent)stopRecording(true);});
const canvas=$('orb'),ctx=canvas.getContext('2d'),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function draw(t){const w=700,c=w/2;ctx.clearRect(0,0,w,w);const active=currentState==='speaking',listening=currentState==='listening',amber=currentState==='approval';const color=amber?'255,195,112':listening?'255,184,109':'92,237,236';const time=reduced?0:t/1000;let level=0;if(analyser&&waveform){analyser.getByteFrequencyData(waveform);level=waveform.reduce((a,b)=>a+b,0)/waveform.length/255;}
 const glow=ctx.createRadialGradient(c,c,90,c,c,310);glow.addColorStop(0,`rgba(${color},.015)`);glow.addColorStop(.6,`rgba(${color},.035)`);glow.addColorStop(1,`rgba(${color},0)`);ctx.fillStyle=glow;ctx.fillRect(0,0,w,w);
 function arc(radius,start,end,alpha,width=1){ctx.beginPath();ctx.strokeStyle=`rgba(${color},${alpha})`;ctx.lineWidth=width;ctx.arc(c,c,radius,start,end);ctx.stroke();}
 arc(291,0,Math.PI*2,.13);arc(267,0,Math.PI*2,.11);arc(218,0,Math.PI*2,.25);arc(180,0,Math.PI*2,.15);
 const speed=currentState==='thinking'?time*.55:time*.08;for(let i=0;i<4;i++){const a=speed+i*Math.PI/2;arc(287,a,a+.38,.8,4);arc(245,-speed+i*Math.PI/2,-speed+i*Math.PI/2+.7,.35,2);}
 for(let i=0;i<96;i++){const a=i*Math.PI*2/96;const radius=active?201+level*22:201;ctx.save();ctx.translate(c,c);ctx.rotate(a);ctx.fillStyle=`rgba(${color},${i%4===0?.55:.15})`;ctx.fillRect(radius,0,i%4===0?9:4,2);ctx.restore();}
 const pulse=reduced?0:Math.sin(time*1.6)*1.5;ctx.shadowBlur=active?25+level*35:18;ctx.shadowColor=`rgba(${color},.7)`;arc(155+pulse+level*13,0,Math.PI*2,.8,3);arc(147+pulse,0,Math.PI*2,.2);ctx.shadowBlur=0;
 if(active&&waveform){for(let i=0;i<64;i++){const a=i*Math.PI*2/64;ctx.save();ctx.translate(c,c);ctx.rotate(a);ctx.fillStyle=`rgba(${color},.65)`;ctx.fillRect(225,0,2+waveform[i]/255*33,2);ctx.restore();}}
 requestAnimationFrame(draw);
}requestAnimationFrame(draw);
function clock(){$('clock').textContent=new Date().toLocaleString(undefined,{month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});}clock();setInterval(clock,1000);
(async()=>{try{const boot=await call('bootstrap');updateSettings(boot.settings);history=boot.history;renderHistory();await loadMemory();if(!(settings.provider==='groq'?settings.hasGroqKey:settings.hasOpenaiKey))openSettings();if(boot.platform!=='win32')notify('Development preview: Windows app launches and PowerShell actions require Windows.');}catch(e){notify(e.message,true);}})();
