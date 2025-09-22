// app.js - Vocalizer Offline (v3) - Autora: Matilde Pizarro Toro
// - Microanimations: ripple + solfege pop + smooth transitions when change exercise
// - Button micro-sound (short click tone)
// - Improved pitch detection using a YIN implementation (inlined)
// References: pitchfinder (YIN) and yinjs influenced design. See README for citations.

/* ------------------ Helpers ------------------ */
const midiToFreq = midi => 440 * Math.pow(2, (midi - 69) / 12);
const noteNames = ['Do','Do#','Re','Re#','Mi','Fa','Fa#','Sol','Sol#','La','La#','Si'];
function freqToNote(freq){
  if(!freq || freq<=0) return null;
  const midi = 69 + 12 * Math.log2(freq/440);
  const rounded = Math.round(midi);
  const note = noteNames[(rounded+120)%12] || '?';
  const cents = Math.floor((midi - rounded)*100);
  return {name:note, midi:rounded, cents};
}

/* ------------------ DOM ------------------ */
const rangeSelect = document.getElementById('rangeSelect');
const customRangeLabel = document.getElementById('customRangeLabel');
const customRoot = document.getElementById('customRoot');
const exerciseSelect = document.getElementById('exerciseSelect');
const playBtn = document.getElementById('playBtn');
const stopBtn = document.getElementById('stopBtn');
const loopBtn = document.getElementById('loopBtn');
const findRangeBtn = document.getElementById('findRangeBtn');
const recordBtn = document.getElementById('recordBtn');
const downloadRecordingBtn = document.getElementById('downloadRecordingBtn');
const bpmSlider = document.getElementById('bpm');
const bpmVal = document.getElementById('bpmVal');
const viz = document.getElementById('viz');
const canvasCtx = viz.getContext('2d');
const solfegeEl = document.getElementById('solfege');
const detectedNoteEl = document.getElementById('detectedNote');
const detectedFreqEl = document.getElementById('detectedFreq');
const detectedCentsEl = document.getElementById('detectedCents');
const recordingsList = document.getElementById('recordingsList');

bpmSlider.addEventListener('input', ()=> bpmVal.textContent = bpmSlider.value);
rangeSelect.addEventListener('change', ()=> customRangeLabel.style.display = rangeSelect.value==='custom' ? 'inline-block' : 'none');

/* ------------------ Audio ------------------ */
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const master = audioCtx.createGain(); master.gain.value = 0.95; master.connect(audioCtx.destination);

// small click sound for micro-feedback
function buttonClickTone(){
  const now = audioCtx.currentTime;
  const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(1200, now);
  g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.6, now+0.01); g.gain.exponentialRampToValueAtTime(0.0001, now+0.07);
  o.connect(g); g.connect(master); o.start(now); o.stop(now+0.08);
}

// ripple effect handler
function createRipple(ev){
  const btn = ev.currentTarget;
  const rect = btn.getBoundingClientRect();
  const r = document.createElement('span');
  r.className = 'ripple';
  const size = Math.max(rect.width, rect.height) * 0.9;
  r.style.width = r.style.height = size + 'px';
  const x = ev.clientX - rect.left - size/2;
  const y = ev.clientY - rect.top - size/2;
  r.style.left = x + 'px'; r.style.top = y + 'px';
  btn.appendChild(r);
  setTimeout(()=> r.remove(), 650);
  // micro-sound
  try{ buttonClickTone(); }catch(e){}
}

document.querySelectorAll('.btn').forEach(b=>{ b.addEventListener('click', createRipple); });

/* ------------------ Exercises ------------------ */
const EXERCISES = [
  { id:'maj_3tone', nombre:'Escala mayor (3 tonos)', descripcion:'Do Re Mi Re Do', pattern:[0,2,4,2,0], stepDur:0.5 },
  { id:'arp_3tone', nombre:'Arpegio mayor (3 tonos)', descripcion:'Do Mi Sol Mi Do', pattern:[0,4,7,4,0], stepDur:0.5 },
  { id:'scale_5_asc', nombre:'Escala 5 tonos (asc)', descripcion:'Do Re Mi Fa Sol Fa Mi Re Do', pattern:[0,2,4,5,7,5,4,2,0], stepDur:0.45 },
  { id:'scale_5_desc', nombre:'Escala 5 tonos (desc)', descripcion:'Sol Fa Mi Re Do', pattern:[7,5,4,2,0], stepDur:0.5 },
  { id:'mel_5', nombre:'Melodía 5 tonos', descripcion:'Do Mi Re Fa Mi Sol Fa Re Do', pattern:[0,4,2,5,4,7,5,2,0], stepDur:0.45 },
  { id:'maj_arpeggio_1', nombre:'Arpegio mayor 1', descripcion:'Do Mi Sol Do', pattern:[0,4,7,12], stepDur:0.6 },
  { id:'maj_arpeggio_2', nombre:'Arpegio mayor 2', descripcion:'Do Sol Mi Do Sol Mi', pattern:[0,7,4,0,7,4,0], stepDur:0.4 },
  { id:'octave_scale', nombre:'Escala octava completa', descripcion:'Do Re Mi Fa Sol La Si Do — subir y bajar', pattern:[0,2,4,5,7,9,11,12,11,9,7,5,4,2,0], stepDur:0.35 },
  { id:'tonic_dominant', nombre:'Tónica - Dominante', descripcion:'Do Sol Do Sol', pattern:[0,7,0,7], stepDur:0.5 },
  { id:'do_re_do', nombre:'Do Re Do (articulación)', descripcion:'Do Re Do / Do Re Mi Re Do', pattern:[0,2,0,0,2,4,2,0], stepDur:0.35 },
  { id:'do_ti_do', nombre:'Do Si Do (sensible)', descripcion:'Do Si Do / Do Si La Si Do', pattern:[0,-1,0,0,-1,-3,-1,0], stepDur:0.35 },
  { id:'solfege_sequence', nombre:'Secuencia solfeo', descripcion:'Escalonada hasta la octava', pattern:[0,2,0,2,4,0,2,4,5,0,2,4,5,7], stepDur:0.28 },
  { id:'arpeggio_extended', nombre:'Arpegio extendido', descripcion:'Do Mi Sol Do Sol Mi Do', pattern:[0,4,7,12,7,4,0], stepDur:0.45 }
];
EXERCISES.forEach(ex=>{ const o = document.createElement('option'); o.value = ex.id; o.textContent = ex.nombre + ' — ' + ex.descripcion; exerciseSelect.appendChild(o); });

/* ------------------ Synth ------------------ */
function synthTone(freq, when=0, dur=0.5, type='sine'){
  const start = audioCtx.currentTime + when;
  const osc = audioCtx.createOscillator(); const g = audioCtx.createGain();
  osc.type = type; osc.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0.0001, start); g.gain.linearRampToValueAtTime(0.9, start + 0.02); g.gain.linearRampToValueAtTime(0.0001, start + dur);
  osc.connect(g); g.connect(master); osc.start(start); osc.stop(start + dur + 0.02);
}

function intervalToSolfeggio(interval){
  const map = {0:'Do',2:'Re',4:'Mi',5:'Fa',7:'Sol',9:'La',11:'Si',12:'Do'};
  if(interval in map) return map[interval];
  const rounded = Math.round(interval);
  const midi = 60 + rounded;
  return noteNames[(midi+120)%12] || '?';
}

/* ------------------ Play logic + transitions ------------------ */
function showSolfege(text){
  solfegeEl.textContent = text;
  solfegeEl.classList.remove('pop');
  void solfegeEl.offsetWidth;
  solfegeEl.classList.add('pop');
  // subtle background tint change to give transition feel
  document.querySelector('.bigDisplay').style.background = `linear-gradient(90deg,rgba(255,230,245,0.9),rgba(235,225,255,0.9))`;
  setTimeout(()=> document.querySelector('.bigDisplay').style.background = '', 420);
}

function clearSolfege(){ solfegeEl.textContent = '—'; solfegeEl.classList.remove('pop'); }

function playExerciseById(id, rootMidi){
  const ex = EXERCISES.find(e=>e.id===id); if(!ex) return;
  let offset = 0;
  ex.pattern.forEach((interval, idx)=>{
    const freq = midiToFreq(rootMidi + interval);
    const dur = ex.stepDur || 0.45;
    synthTone(freq, offset, dur);
    setTimeout(()=>{ const syll = intervalToSolfeggio(interval); showSolfege(syll); }, Math.max(0,(offset)*1000));
    offset += dur;
  });
  setTimeout(()=> clearSolfege(), offset*1000 + 220);
}

function getRootMidi(){
  if(rangeSelect.value==='soprano') return 64;
  if(rangeSelect.value==='alto') return 57;
  if(rangeSelect.value==='tenor') return 52;
  if(rangeSelect.value==='bass') return 45;
  if(rangeSelect.value==='custom') return Number(customRoot.value) || 60;
  return 60;
}

let playingLoop=false, loopEnabled=false, loopTimer=null;
loopBtn.addEventListener('click', ()=>{ loopEnabled = !loopEnabled; loopBtn.textContent = `Bucle: ${loopEnabled ? 'On' : 'Off'}`; loopBtn.setAttribute('aria-pressed', String(loopEnabled)); });

playBtn.addEventListener('click', ()=>{
  if(audioCtx.state==='suspended') audioCtx.resume();
  const id = exerciseSelect.value || EXERCISES[0].id; const root = getRootMidi();
  if(loopEnabled){
    if(playingLoop) return;
    playingLoop = true;
    const run = ()=>{ playExerciseById(id, root); loopTimer = setTimeout(()=>{ if(playingLoop) run(); }, 1800); };
    run();
  } else {
    playExerciseById(id, root);
  }
  playBtn.setAttribute('aria-pressed','true');
});
stopBtn.addEventListener('click', ()=>{ playingLoop=false; if(loopTimer) clearTimeout(loopTimer); clearSolfege(); playBtn.setAttribute('aria-pressed','false'); });

/* ------------------ Recording + Find Range + Improved Pitch Detection (YIN) ------------------ */
let mediaStream=null, mediaRecorder=null, recordedChunks=[], lastBlob=null;
async function ensureMic(){ if(mediaStream) return mediaStream; try{ mediaStream = await navigator.mediaDevices.getUserMedia({audio:true}); return mediaStream; }catch(e){ alert('No se pudo acceder al micrófono: '+e.message); throw e; } }

recordBtn.addEventListener('click', async ()=>{
  if(recordBtn.dataset.recording==='true'){ mediaRecorder.stop(); recordBtn.dataset.recording='false'; recordBtn.textContent='Grabar'; return; }
  await ensureMic();
  recordedChunks=[]; mediaRecorder = new MediaRecorder(mediaStream);
  mediaRecorder.ondataavailable = e=>{ if(e.data && e.data.size) recordedChunks.push(e.data); };
  mediaRecorder.onstop = ()=>{
    const blob = new Blob(recordedChunks, {type:'audio/webm'}); lastBlob = blob; const url = URL.createObjectURL(blob); addRecording(url, blob); downloadRecordingBtn.disabled=false;
  };
  mediaRecorder.start(); recordBtn.dataset.recording='true'; recordBtn.textContent='Detener grabación';
});

downloadRecordingBtn.addEventListener('click', ()=>{ if(!lastBlob) return; const a=document.createElement('a'); a.href = URL.createObjectURL(lastBlob); a.download='grabacion.webm'; a.click(); });

function addRecording(url, blob){
  const li = document.createElement('li'); const audio = document.createElement('audio'); audio.controls=true; audio.src=url;
  const dl = document.createElement('button'); dl.textContent='Descargar'; dl.className='btn'; dl.addEventListener('click', ()=>{ const a=document.createElement('a'); a.href=url; a.download='grabacion.webm'; a.click(); });
  li.appendChild(audio); li.appendChild(dl); recordingsList.prepend(li);
}

// Find range (3s recording + YIN analysis)
findRangeBtn.addEventListener('click', async ()=>{
  findRangeBtn.disabled=true;
  try{
    await ensureMic();
    const s = await navigator.mediaDevices.getUserMedia({audio:true});
    const recorder = new MediaRecorder(s); const chunks=[];
    recorder.ondataavailable = e=>{ if(e.data.size) chunks.push(e.data); };
    recorder.onstop = async ()=>{
      const blob = new Blob(chunks, {type:'audio/webm'}); const ab = await blob.arrayBuffer();
      const offline = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1,44100*3,44100);
      const audioBuffer = await offline.decodeAudioData(ab);
      const ch = audioBuffer.getChannelData(0);
      // slide over frames and use YIN to detect frequency, track min and max
      let minF=Number.POSITIVE_INFINITY, maxF=0;
      const frameSize = 2048;
      for(let i=0;i<ch.length-frameSize;i+=frameSize/2){
        const frame = ch.subarray(i, i+frameSize);
        const f = yinDetect(frame, audioBuffer.sampleRate);
        if(f && f>0){ if(f<minF) minF=f; if(f>maxF) maxF=f; }
      }
      if(minF===Number.POSITIVE_INFINITY) alert('No se detectó rango. Intenta cantar cerca del micrófono y con volumen medio.');
      else alert(`Rango aproximado detectado:\\nBaja: ${minF.toFixed(1)} Hz\\nAlta: ${maxF.toFixed(1)} Hz`);
      s.getTracks().forEach(t=>t.stop()); findRangeBtn.disabled=false;
    };
    recorder.start();
    alert('Graba tu nota más baja y más alta durante 3 segundos. Pulsa OK y canta.');
    setTimeout(()=> recorder.stop(), 3000);
  }catch(e){ console.error(e); findRangeBtn.disabled=false; }
});

/* ------------------ YIN algorithm (simplified, JS) ------------------
   Implementation based on the YIN algorithm description. This is an original, compact
   implementation suitable for browser use. For production, consider using a tested library
   such as pitchfinder or yinjs for edge cases and tuning. References: pitchfinder (YIN), yinjs.
----------------------------------------------------------------------- */
function yinDetect(buffer, sampleRate){
  const threshold = 0.10; // default threshold
  const buf = buffer; // Float32Array
  const size = buf.length;
  const yinBuffer = new Float32Array(Math.floor(size/2));
  // 1) difference function
  for(let tau=0; tau<yinBuffer.length; tau++){
    let sum = 0;
    for(let i=0;i<yinBuffer.length;i++){
      const delta = buf[i] - buf[i+tau];
      sum += delta*delta;
    }
    yinBuffer[tau] = sum;
  }
  // 2) cumulative mean normalized difference function
  let runningSum = 0;
  yinBuffer[0] = 1;
  for(let tau=1; tau<yinBuffer.length; tau++){
    runningSum += yinBuffer[tau];
    yinBuffer[tau] = yinBuffer[tau] * tau / runningSum;
  }
  // 3) absolute threshold
  let tauEstimate = -1;
  for(let tau=2; tau<yinBuffer.length; tau++){
    if(yinBuffer[tau] < threshold){
      while(tau+1 < yinBuffer.length && yinBuffer[tau+1] < yinBuffer[tau]) tau++;
      tauEstimate = tau;
      break;
    }
  }
  if(tauEstimate === -1) return -1; // no pitch found
  // 4) parabolic interpolation to fine-tune
  let betterTau;
  if(tauEstimate > 0 && tauEstimate < yinBuffer.length-1){
    const s0 = yinBuffer[tauEstimate-1];
    const s1 = yinBuffer[tauEstimate];
    const s2 = yinBuffer[tauEstimate+1];
    // parabolic interpolation formula
    const shift = (s2 - s0) / (2*(2*s1 - s2 - s0));
    betterTau = tauEstimate + shift;
  } else {
    betterTau = tauEstimate;
  }
  // 5) convert to frequency
  const freq = sampleRate / betterTau;
  if(freq < 50 || freq > 2000) return -1;
  return freq;
}

/* ------------------ Visualizer (mic) using YIN for display ------------------ */
const micAnalyser = audioCtx.createAnalyser(); micAnalyser.fftSize = 2048; let micSource=null;
async function setupMic(){ try{ const s = await navigator.mediaDevices.getUserMedia({audio:true}); if(!micSource){ micSource = audioCtx.createMediaStreamSource(s); micSource.connect(micAnalyser); } return s; }catch(e){ console.warn('Mic no disponible', e); } }

let raf=null;
function draw(){
  const w = viz.width, h = viz.height; canvasCtx.clearRect(0,0,w,h);
  if(micAnalyser){
    const data = new Float32Array(micAnalyser.fftSize); micAnalyser.getFloatTimeDomainData(data);
    // waveform
    canvasCtx.beginPath(); const slice = w/data.length; let x=0;
    for(let i=0;i<data.length;i++){ const v = data[i]*0.5+0.5; const y = v*h; if(i===0) canvasCtx.moveTo(x,y); else canvasCtx.lineTo(x,y); x+=slice; }
    canvasCtx.strokeStyle = '#d18fbf'; canvasCtx.lineWidth = 1.6; canvasCtx.stroke();
    // every few frames run YIN on a short window
    if(window._ctr===undefined) window._ctr=0; window._ctr++;
    if(window._ctr % 8 === 0){
      // use a copy of the time-domain buffer
      const frame = data.slice(0, 2048);
      const f = yinDetect(frame, audioCtx.sampleRate);
      if(f && f>0){
        const note = freqToNote(f);
        detectedNoteEl.textContent = note ? note.name + ' ('+note.midi+')' : '--';
        detectedFreqEl.textContent = f.toFixed(1);
        detectedCentsEl.textContent = note ? note.cents : '--';
      }
    }
  }
  raf = requestAnimationFrame(draw);
}

document.addEventListener('click', ()=>{ if(!micSource) setupMic(); if(audioCtx.state==='suspended') audioCtx.resume(); if(!raf) draw(); }, {once:true});

/* ------------------ Init UI ------------------ */
(function init(){ const dpr = window.devicePixelRatio || 1; viz.width = viz.clientWidth * dpr; viz.height = viz.clientHeight * dpr; canvasCtx.scale(dpr,dpr); bpmVal.textContent = bpmSlider.value; exerciseSelect.value = EXERCISES[0].id; })();
