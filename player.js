/* ---------- icons (inline outline SVG, Lucide-style) ---------- */
const ICON_SVG = {
  'skip-back':    '<polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/>',
  'skip-forward': '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>',
  'play':         '<polygon points="6 3 20 12 6 21 6 3"/>',
  'pause':        '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  'square':       '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  'chevron-right':'<polyline points="9 18 15 12 9 6"/>',
  'chevron-down': '<polyline points="6 9 12 15 18 9"/>',
  'download':     '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  'plus':         '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  'file-plus':    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>',
};
function icon(name){
  return `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_SVG[name]||''}</svg>`;
}

/* ---------- music theory ---------- */
const PC = {C:0,D:2,E:4,F:5,G:7,A:9,B:11};
const LETTERS = ["C","D","E","F","G","A","B"];
const MAJOR = [0,2,4,5,7,9,11];                       // semitone offset of each major-scale degree
const BASE  = ["Do","Re","Mi","Fa","So","La","Ti"];   // diatonic syllables by degree (0=do); "So" (not "Sol")
const RAISED  = {0:"Di",1:"Ri",3:"Fi",4:"Si",5:"Li"}; // chromatic raised, by degree
const LOWERED = {1:"Ra",2:"Me",4:"Se",5:"Le",6:"Te"}; // chromatic lowered, by degree
const CHROM = ["Do","Di","Re","Ri","Mi","Fa","Fi","So","Si","La","Li","Ti"];  // enharmonic fallback
// [display name, pitch class, tonic letter] - letter matters for correct solfège spelling
const KEYS = [["C",0,"C"],["Db",1,"D"],["D",2,"D"],["Eb",3,"E"],["E",4,"E"],["F",5,"F"],
  ["F#",6,"F"],["G",7,"G"],["Ab",8,"A"],["A",9,"A"],["Bb",10,"B"],["B",11,"B"]];
// MusicXML <fifths> -> [tonic pc, tonic letter]
const FIFTHS = {"-7":[11,"C"],"-6":[6,"G"],"-5":[1,"D"],"-4":[8,"A"],"-3":[3,"E"],"-2":[10,"B"],
  "-1":[5,"F"],"0":[0,"C"],"1":[7,"G"],"2":[2,"D"],"3":[9,"A"],"4":[4,"E"],"5":[11,"B"],"6":[6,"F"],"7":[1,"C"]};
// pitch class -> default spelling [step, alter] (used for MIDI, which carries no enharmonic info)
const SHARP_SPELL = [["C",0],["C",1],["D",0],["D",1],["E",0],["F",0],["F",1],["G",0],["G",1],["A",0],["A",1],["B",0]];

const keySel = document.getElementById('key');
KEYS.forEach(([n,pc,l])=>{const o=document.createElement('option');o.value=pc;o.dataset.letter=l;o.textContent=n+" major";if(pc===0)o.selected=true;keySel.appendChild(o);});

let currentTonic = {pc:0, letter:"C"};
function syncTonicFromSel(){ const o=keySel.options[keySel.selectedIndex]; currentTonic={pc:parseInt(o.value), letter:o.dataset.letter}; }
function setKey(pc, letter){
  for(const o of keySel.options){ if(parseInt(o.value)===pc){ o.selected=true; break; } }
  syncTonicFromSel();
  if(letter) currentTonic.letter = letter;  // keep correct spelling for flat keys (e.g. Gb, not F#)
}
syncTonicFromSel();

const KEY_LETTER = {}; KEYS.forEach(([n,pc,l])=> KEY_LETTER[pc] = l);   // pitch class -> major-key letter

// Scale degree (0=do) + chromatic alteration (semitones) of a note relative to a tonic.
function degreeAlt(note, tonic){
  const degree = ((LETTERS.indexOf(note.step) - LETTERS.indexOf(tonic.letter)) % 7 + 7) % 7;
  const naturalPc = (tonic.pc + MAJOR[degree]) % 12;
  let diff = (((note.pc - naturalPc) % 12) + 12) % 12; if(diff > 6) diff -= 12;
  return {degree, diff};
}

// Given a note with a letter (step) + accidental (alter), return its movable-do syllable + degree label.
function analyze(note){
  const t = currentTonic;
  const notePc = note.pc;
  const degree = ((LETTERS.indexOf(note.step) - LETTERS.indexOf(t.letter)) % 7 + 7) % 7;
  const naturalPc = (t.pc + MAJOR[degree]) % 12;
  let diff = (((notePc - naturalPc) % 12) + 12) % 12; if(diff > 6) diff -= 12;  // chromatic alteration in semitones
  let syl;
  if(diff === 0) syl = BASE[degree];
  else if(diff === 1 && RAISED[degree] != null) syl = RAISED[degree];
  else if(diff === -1 && LOWERED[degree] != null) syl = LOWERED[degree];
  else syl = CHROM[(((notePc - t.pc) % 12) + 12) % 12];                          // double accidentals / rare spellings
  const acc = diff > 0 ? '♯'.repeat(diff) : diff < 0 ? '♭'.repeat(-diff) : '';
  return {syl, deg: acc + (degree + 1)};
}

function fromMidi(m){
  const pc = ((m % 12) + 12) % 12, oct = Math.floor(m / 12) - 1;
  const [step, alter] = SHARP_SPELL[pc];
  return {isRest:false, step, alter, oct, pc, midi:m, name: step + (alter>0?'#':'') + oct};
}

/* ---------- state ---------- */
// A track = one voice: {id, label, enabled, solo, notes:[{isRest, step, alter, oct, pc, name, midi, startBeat, durBeat}]}
let tracks = [];
let soloActive = false;
let pieceName = '';   // name of the loaded piece, used to prefix exported files
let lastXML = '';     // raw MusicXML of the loaded piece (for the sheet-music view)
let transposeOffset = 0;   // semitones shifted from the file's original key
let edited = false;        // true once the notes have been edited/built (sheets then come from the serializer, not lastXML)
let editSel = null;        // {trackId, index} of the note selected in the editor
let meterBeats = 4, meterType = 4;   // piece meter (parsed from imports; editable in the editor)

/* ---------- manual entry ---------- */
function parseToken(tok){
  if(/^r(est)?$/i.test(tok)) return {isRest:true, dur:4};
  const m = tok.match(/^([A-Ga-g])([#b]?)(\d)?(?::(\d+))?$/);
  if(!m) return null;
  const step = m[1].toUpperCase();
  const alter = m[2]==='#' ? 1 : m[2]==='b' ? -1 : 0;
  const oct = m[3] ? parseInt(m[3]) : 4;
  const dur = m[4] ? parseInt(m[4]) : 4;
  const acc = alter>0?'#':alter<0?'b':'';
  return {isRest:false, step, alter, oct, pc:((PC[step]+alter)%12+12)%12, name:step+acc+oct, midi:(oct+1)*12+((PC[step]+alter)%12+12)%12, dur};
}

function buildManual(){
  pieceName = ''; lastXML = ''; transposeOffset = 0; edited = false; meterBeats = 4; meterType = 4; resetSheets();
  const toks = document.getElementById('notes').value.trim().split(/[\s,]+/).filter(Boolean);
  let beat = 0; const notes = [];
  toks.forEach(tok=>{
    const n = parseToken(tok); if(!n) return;
    n.startBeat = beat; n.durBeat = 4 / n.dur; beat += n.durBeat;
    notes.push(n);
  });
  tracks = [{id:'t0', label:'Melody', enabled:true, solo:false, notes}];
  soloActive = false;
  render();
  syncEditorView();
  contentChanged();
}

/* ---------- MusicXML (multi-voice) ---------- */
function labelTracks(arr){
  arr.forEach(t=>t.avg = t.cnt ? t.sum/t.cnt : 0);
  arr.sort((a,b)=> b.avg - a.avg);                          // highest average pitch first
  const SATB = ["Soprano","Alto","Tenor","Bass"];
  arr.forEach((t,i)=>{
    t.id = 't'+i;
    t.label = t.name || (arr.length<=4 ? (SATB[i] || ('Voice '+(i+1))) : ('Voice '+(i+1)));
    t.enabled = true; t.solo = false;
  });
  return arr;
}

// Pitched-note count for a track, and which tracks look like OMR slips: very
// short streams sitting alongside substantial ones. This is ADVISORY ONLY -- we
// never drop anything automatically; the editor flags these so the user decides.
function pitchedCount(t){ return (t.notes || []).filter(n=> !n.isRest).length; }
function suspectParts(){
  const counts = tracks.map(pitchedCount);
  const max = Math.max(0, ...counts);
  if(max < 8) return [];                       // nothing substantial yet (e.g. a brand-new piece)
  return tracks.filter(t=> pitchedCount(t) <= 2);
}

function parseParts(doc){
  const parts = [...doc.querySelectorAll('part')];
  const map = new Map();
  let lastDiv = 1;
  parts.forEach((part, pi)=>{
    let divisions = lastDiv, measureStart = 0;
    [...part.querySelectorAll('measure')].forEach(measure=>{
      const d = measure.querySelector('attributes divisions');
      if(d) divisions = parseInt(d.textContent) || divisions;
      let cursor = 0, measureLen = 0; const prev = {};
      [...measure.children].forEach(el=>{
        const tag = el.tagName;
        const dur = parseInt(el.querySelector(':scope > duration')?.textContent || '0') || 0;
        if(tag === 'backup'){ cursor -= dur; }
        else if(tag === 'forward'){ cursor += dur; }
        else if(tag === 'note'){
          const voice = el.querySelector('voice')?.textContent || '1';
          const staff = el.querySelector('staff')?.textContent || '1';
          const isChord = !!el.querySelector('chord');
          const key = pi + '|' + staff + '|' + voice;
          const start = isChord ? (prev[key] ?? cursor) : cursor;
          const startBeat = measureStart + start/divisions, durBeat = dur/divisions;
          let note = null;
          if(el.querySelector('rest')){ note = {isRest:true, startBeat, durBeat}; }
          else {
            const step = el.querySelector('pitch step')?.textContent;
            if(step){
              const oct = parseInt(el.querySelector('pitch octave')?.textContent || '4');
              const alter = parseInt(el.querySelector('pitch alter')?.textContent || '0');
              const pc = ((PC[step]+alter)%12+12)%12;
              note = {isRest:false, step, alter, oct, pc, name:step+(alter>0?'#':alter<0?'b':'')+oct, midi:(oct+1)*12+pc, startBeat, durBeat};
            }
          }
          if(note){
            let t = map.get(key);
            if(!t){ t = {key, notes:[], sum:0, cnt:0}; map.set(key, t); }
            t.notes.push(note);
            if(!note.isRest){ t.sum += note.midi; t.cnt++; }
            prev[key] = start;
          }
          if(!isChord) cursor += dur;
          measureLen = Math.max(measureLen, cursor);
        }
      });
      measureStart += measureLen/divisions;
    });
    lastDiv = divisions;
  });
  return labelTracks([...map.values()].filter(t=>t.cnt > 0));
}

function setTempo(bpm){
  bpm = Math.max(40, Math.min(160, Math.round(bpm)));
  const s = document.getElementById('bpm'); s.value = bpm;
  document.getElementById('bpmval').textContent = bpm;
  return bpm;
}
// Read tempo from MusicXML: prefer <sound tempo>, else <metronome> (converted to quarter-note BPM).
function readTempo(doc){
  const sound = doc.querySelector('sound[tempo]');
  if(sound){ const t = parseFloat(sound.getAttribute('tempo')); if(t > 0) return t; }
  const per = doc.querySelector('metronome per-minute');
  if(per){
    const t = parseFloat(per.textContent);
    const unit = doc.querySelector('metronome beat-unit')?.textContent;
    const mult = {whole:4, half:2, quarter:1, eighth:0.5, '16th':0.25}[unit] ?? 1;
    if(t > 0) return t * mult;
  }
  return null;
}

function loadMusicXMLText(txt, msgEl){
  try{
    const doc = new DOMParser().parseFromString(txt, 'application/xml');
    if(doc.querySelector('parsererror')) throw new Error('invalid XML');
    lastXML = txt; transposeOffset = 0; edited = false; resetSheets();   // keep raw XML for the sheet-music view
    if(!pieceName){ const ti = doc.querySelector('work-title, movement-title'); if(ti && ti.textContent.trim()) pieceName = ti.textContent.trim(); }
    const fifthsEl = doc.querySelector('key fifths');
    if(fifthsEl){ const f = FIFTHS[fifthsEl.textContent.trim()]; if(f) setKey(f[0], f[1]); }
    const tb = parseInt(doc.querySelector('time beats')?.textContent), tt = parseInt(doc.querySelector('time beat-type')?.textContent);
    meterBeats = tb > 0 ? tb : 4; meterType = tt > 0 ? tt : 4;   // piece meter for the serializer
    const tempo = readTempo(doc); const setT = tempo ? setTempo(tempo) : null;
    const built = parseParts(doc);
    if(!built.length) throw new Error('no notes found');
    tracks = built; soloActive = false; render(); syncEditorView(); contentChanged();
    const total = built.reduce((s,t)=> s + t.notes.filter(n=>!n.isRest).length, 0);
    if(msgEl) msgEl.textContent = `Loaded ${built.length} voice(s), ${total} notes${setT ? `, tempo ${setT} bpm` : ''}.`;
    return true;
  }catch(e){ if(msgEl) msgEl.textContent = 'Could not parse: ' + e.message; return false; }
}

async function loadMxl(buf, msgEl){
  const zip = await JSZip.loadAsync(buf);
  let name = Object.keys(zip.files).find(n=> /\.xml$/i.test(n) && !/^META-INF/i.test(n) && !/container\.xml$/i.test(n));
  if(!name){
    const c = zip.file('META-INF/container.xml');
    if(c){ const m = (await c.async('string')).match(/full-path="([^"]+)"/); if(m) name = m[1]; }
  }
  if(!name) throw new Error('no score found inside .mxl');
  loadMusicXMLText(await zip.file(name).async('string'), msgEl);
}

/* ---------- MIDI ---------- */
function loadMidi(buf, msgEl){
  lastXML = ''; transposeOffset = 0; edited = false; meterBeats = 4; meterType = 4; resetSheets();   // MIDI has no original notation; the serializer engraves it
  const MidiCtor = (window.Midi && window.Midi.Midi) ? window.Midi.Midi : window.Midi;
  const midi = new MidiCtor(buf);
  const ppq = midi.header.ppq || 480;
  const out = [];
  midi.tracks.forEach(tr=>{
    if(!tr.notes.length) return;
    let sum = 0;
    const notes = tr.notes.map(n=>{ sum += n.midi; return Object.assign(fromMidi(n.midi), {startBeat:n.ticks/ppq, durBeat:n.durationTicks/ppq}); });
    out.push({notes, sum, cnt:notes.length, name:(tr.name||'').trim() || null});
  });
  if(!out.length) throw new Error('no notes in MIDI');
  const ks = midi.header.keySignatures && midi.header.keySignatures[0];
  if(ks && ks.key){
    const pc = (PC[ks.key[0]] + (ks.key.includes('#')?1:ks.key.includes('b')?-1:0));
    setKey(((pc%12)+12)%12, ks.key[0]);
  }
  if(midi.header.tempos && midi.header.tempos[0] && midi.header.tempos[0].bpm) setTempo(midi.header.tempos[0].bpm);
  tracks = labelTracks(out); soloActive = false; render(); syncEditorView(); contentChanged();
  if(msgEl) msgEl.textContent = `Loaded ${out.length} track(s) from MIDI. (MIDI carries no sharp/flat spelling, so solfège uses sharps; load MusicXML for exact spelling.)`;
}

/* ---------- file dispatch ---------- */
async function loadFile(file, msgEl){
  const ext = file.name.split('.').pop().toLowerCase();
  pieceName = file.name.replace(/\.[^.]+$/, '');   // filename (no extension) -> export prefix
  if(msgEl) msgEl.textContent = 'Loading ' + file.name + '…';
  try{
    if(ext==='xml' || ext==='musicxml') loadMusicXMLText(await file.text(), msgEl);
    else if(ext==='mxl') await loadMxl(await file.arrayBuffer(), msgEl);
    else if(ext==='mid' || ext==='midi') loadMidi(await file.arrayBuffer(), msgEl);
    else throw new Error('unsupported type .' + ext + ', use .musicxml, .mxl, or .mid');
  }catch(e){ if(msgEl) msgEl.textContent = 'Could not load: ' + e.message; }
}

/* ---------- photo OMR (local backend) ---------- */
const API = (location.protocol === 'file:') ? 'http://localhost:8000' : '';
async function transcribePhoto(file, msgEl){
  pieceName = file.name.replace(/\.[^.]+$/, '');
  msgEl.textContent = 'Transcribing ' + file.name + '… (first run downloads OMR models, give it a minute)';
  const fd = new FormData(); fd.append('file', file);
  try{
    const r = await fetch(API + '/transcribe', {method:'POST', body:fd});
    if(!r.ok) throw new Error((await r.text()) || ('HTTP ' + r.status));
    const xml = await r.text();
    document.getElementById('xml').value = xml;
    if(loadMusicXMLText(xml, msgEl)){
      msgEl.textContent = 'Transcribed ✓. Sent to the editor to check.';
      enterReviewMode();   // Phase 5: review/fix before it goes to the player
    }
  }catch(e){
    msgEl.textContent = 'Could not transcribe: ' + e.message + '. Tip: low-resolution screenshots often fail OMR; try a higher-res scan or the source PDF, or build it by hand with Edit → New piece.';
  }
}

/* ---------- render ---------- */
function render(){
  const stave = document.getElementById('stave');
  stave.innerHTML = '';
  const tbar = document.getElementById('transportbar'); if(tbar) tbar.hidden = !tracks.length;
  const tv = document.getElementById('trval'); if(tv) tv.textContent = (transposeOffset>0?'+':'') + transposeOffset;
  const multi = tracks.length > 1;
  tracks.forEach(t=>{
    const muted = soloActive ? !t.solo : !t.enabled;
    const row = document.createElement('div');
    row.className = 'voice' + (muted ? ' muted' : '') + (t.collapsed ? ' collapsed' : '');
    if(t.vol === undefined) t.vol = 1;
    if(!t.view) t.view = 'solfa';
    const head = document.createElement('div'); head.className = 'vhead';
    const caret = document.createElement('button'); caret.className = 'caret';
    caret.innerHTML = icon(t.collapsed ? 'chevron-right' : 'chevron-down');
    caret.title = t.collapsed ? 'Show this part' : 'Hide this part';
    caret.onclick = ()=>{ t.collapsed = !t.collapsed; render(); };
    const vplay = document.createElement('button'); vplay.className = 'vplay partplay'; vplay.dataset.tid = t.id;
    vplay.innerHTML = icon('play'); vplay.title = 'Play this part';
    vplay.onclick = ()=> togglePartPlay(t);
    const lab = document.createElement('span'); lab.className = 'vlabel'; lab.textContent = t.label;
    // per-part Solfa / Sheet toggle - Sheet needs engravable MusicXML for this voice
    const tog = document.createElement('div'); tog.className = 'vbtns';
    const tSolfa = document.createElement('button'); tSolfa.textContent = 'Solfa'; if(t.view !== 'sheet') tSolfa.classList.add('on');
    tSolfa.onclick = ()=>{ t.view = 'solfa'; render(); };
    const tSheet = document.createElement('button'); tSheet.textContent = 'Sheet'; if(t.view === 'sheet') tSheet.classList.add('on');
    if(canSheet(t)){ tSheet.onclick = ()=>{ t.view = 'sheet'; render(); }; }
    else { tSheet.disabled = true; tSheet.style.opacity = '0.4'; tSheet.style.cursor = 'not-allowed'; tSheet.title = 'Sheet needs MusicXML (this part has no engravable notation)'; }
    tog.append(tSolfa, tSheet);
    const btns = document.createElement('div'); btns.className = 'vbtns vactions';
    if(multi){
      const solo = document.createElement('button'); solo.textContent = 'Solo'; if(t.solo) solo.classList.add('on');
      solo.onclick = ()=>{ t.solo = !t.solo; soloActive = tracks.some(x=>x.solo); render(); dirty = true; computeEndBeat(); if(isPlaying) buildPart(); };
      const mute = document.createElement('button'); mute.textContent = 'Mute'; if(!t.enabled) mute.classList.add('on');
      mute.onclick = ()=>{ t.enabled = !t.enabled; render(); dirty = true; computeEndBeat(); if(isPlaying) buildPart(); };
      btns.append(solo, mute);
    }
    const vol = document.createElement('input');
    vol.type='range'; vol.min='0'; vol.max='1'; vol.step='0.01'; vol.value=t.vol; vol.className='vol'; vol.title='Volume';
    vol.oninput = ()=>{ t.vol = parseFloat(vol.value); };   // live (next note onsets pick it up)
    const mp3 = document.createElement('button'); mp3.innerHTML=icon('download')+'MP3'; mp3.title='Download this part as audio (shareable on WhatsApp)';
    mp3.onclick = ()=> exportTrackMp3(t, mp3);
    const png = document.createElement('button'); png.innerHTML=icon('download')+'PNG'; png.title='Download this part’s solfège as an image';
    png.onclick = ()=> exportTrackPng(t);
    btns.append(vol, mp3, png);
    head.append(caret, vplay, lab, tog, btns);
    row.append(head);
    if(t.view === 'sheet' && canSheet(t)){
      // engraved staff for this one part, themed to the page; cached SVG so solo/mute don't re-render OSMD
      const box = document.createElement('div'); box.className = 'voicebox';
      if(t._sheetHTML && t._sheetKey === transposeOffset){ box.innerHTML = t._sheetHTML; }
      // OSMD can't measure a hidden (display:none) container, so it would cache a
      // blank staff. Only render while the player view is on screen; switchTab
      // re-renders these when you come back to it.
      else if(playerVisible()){ box.innerHTML = '<p class="hint" style="margin:4px">Rendering staff…</p>'; renderPartSheet(t, box); }
      else { box.innerHTML = '<p class="hint" style="margin:4px">Staff updates when you open the Player tab.</p>'; }
      row.append(box);
    } else {
      const cells = document.createElement('div'); cells.className = 'stave-row';
      t.notes.forEach((n,i)=>{
        const el = document.createElement('div');
        el.className = 'note' + (n.isRest ? ' rest' : '');
        el.id = t.id + '-' + i;
        if(n.isRest){ el.innerHTML = '<span class="solf">–</span><span class="nm">rest</span>'; }
        else { const a = analyze(n); el.innerHTML = `<span class="solf">${a.syl}</span><span class="nm">${n.name}</span><span class="deg">${a.deg}</span>`; }
        el.title = 'Click to start here';
        el.addEventListener('click', ()=> seek(n.startBeat, true));   // click-to-seek
        cells.append(el);
      });
      row.append(cells);
    }
    stave.append(row);
  });
  updateMasterView();
  updatePlayScope();   // reflect solo/mute/audition in the transport scope label
  repaintPlayhead();   // keep the paused/playing note lit across re-renders (e.g. solfa<->sheet)
}

// Keep the master "Show all parts as" switch honest: highlight Solfa or Sheet
// only when every part is on that view, neither when parts are mixed.
function updateMasterView(){
  const btns = document.querySelectorAll('#masterview button'); if(!btns.length) return;
  const allSheet = tracks.length > 0 && tracks.every(t=> t.view === 'sheet');
  const allSolfa = tracks.length > 0 && tracks.every(t=> (t.view || 'solfa') !== 'sheet');
  btns.forEach(b=> b.classList.toggle('on', (b.dataset.m === 'sheet' && allSheet) || (b.dataset.m === 'solfa' && allSolfa)));
}

// Transpose every note (and the key) by `delta` semitones, re-spelling in the new
// key so solfège is unchanged but the pitches now match (e.g. G -> A is +2).
function transposeBy(delta){
  if(!tracks.length || !delta) return;
  pushUndo();   // transpose is undoable (snapshot taken before pitches are re-spelled)
  const oldTonic = {pc: currentTonic.pc, letter: currentTonic.letter};
  const newPc = ((oldTonic.pc + delta) % 12 + 12) % 12;
  const newLetter = KEY_LETTER[newPc] || oldTonic.letter;
  tracks.forEach(t=> t.notes.forEach(n=>{
    if(n.isRest) return;
    const {degree} = degreeAlt(n, oldTonic);
    const newLet = LETTERS[(LETTERS.indexOf(newLetter) + degree) % 7];
    const newMidi = n.midi + delta;
    const pc = ((newMidi % 12) + 12) % 12;
    let alter = ((pc - PC[newLet]) % 12 + 12) % 12; if(alter > 6) alter -= 12;
    n.step = newLet; n.alter = alter; n.oct = Math.floor(newMidi/12) - 1; n.pc = pc; n.midi = newMidi;
    n.name = newLet + (alter>0 ? '#'.repeat(alter) : alter<0 ? 'b'.repeat(-alter) : '') + n.oct;
  }));
  setKey(newPc, newLetter);
  transposeOffset += delta;
  render();
  retransposeSheets();
  syncEditorView();
  dirty = true; computeEndBeat(); if(isPlaying) buildPart();
}

/* ---------- audio ---------- */
let synth, f1, f2, f3, vibrato, master, ready=false;
let vowel='ahh';
const VOWELS = {
  ahh:{osc:'sawtooth', f:[730,1090,2440], q:[9,11,11]},
  ooh:{osc:'sawtooth', f:[300,870,2240], q:[10,12,12]},
  mmm:{osc:'sine',     f:[260,1200,2200], q:[5,6,6]}
};

/* ---- choir sampler (stretch goal): CC0 samples in samples/choir/ ---- */
let sampler, choirReady=false, choirTried=false, useChoir=false;
const CHOIR_BASE = 'samples/choir/';
// Sparse pitch map - Tone.Sampler pitch-shifts to fill the gaps. Drop these
// (CC0) files into samples/choir/. See samples/README.md.
const CHOIR_URLS = {A3:'A3.mp3', C4:'C4.mp3', 'F#4':'Fs4.mp3', A4:'A4.mp3', C5:'C5.mp3', 'F#5':'Fs5.mp3'};

function initChoir(){
  if(choirTried) return;             // only attempt the network load once
  choirTried = true;
  const msg = document.getElementById('timbremsg');
  msg.textContent = 'Loading choir samples…';
  const out = new Tone.Gain(0.9).connect(master);
  sampler = new Tone.Sampler({
    urls: CHOIR_URLS, baseUrl: CHOIR_BASE,
    onload: ()=>{ choirReady = true; msg.textContent = 'Choir samples loaded ✓'; }
  }).connect(out);
  // If nothing loaded in a few seconds, the files probably aren't there yet.
  setTimeout(()=>{
    if(!choirReady){
      msg.textContent = 'No choir samples found, staying on Formant. Add CC0 files to samples/choir/ (see samples/README.md).';
      useChoir = false;
      document.querySelectorAll('#timbre button').forEach(x=>x.classList.toggle('on', x.dataset.t==='formant'));
    }
  }, 5000);
}

// Which instrument actually sings: sampler only if Choir is on AND samples loaded.
function instrument(){ return (useChoir && choirReady) ? sampler : synth; }

function initAudio(){
  if(ready) return;
  vibrato = new Tone.Vibrato({frequency:5, depth:0.08});
  master = new Tone.Gain(0.5).toDestination();
  vibrato.connect(master);
  const fg = new Tone.Gain(3).connect(vibrato);
  f1 = new Tone.Filter({type:'bandpass', frequency:730, Q:9}).connect(fg);
  f2 = new Tone.Filter({type:'bandpass', frequency:1090, Q:11}).connect(fg);
  f3 = new Tone.Filter({type:'bandpass', frequency:2440, Q:11}).connect(fg);
  const dry = new Tone.Gain(0.05).connect(vibrato);
  synth = new Tone.PolySynth(Tone.Synth).set({
    oscillator:{type:'sawtooth'},
    envelope:{attack:0.07, decay:0.2, sustain:0.85, release:0.4}
  });
  synth.maxPolyphony = 24;          // SATB + sustain overlap
  synth.volume.value = -14;
  synth.connect(f1); synth.connect(f2); synth.connect(f3); synth.connect(dry);
  applyVowel();
  ready = true;
}

function applyVowel(){
  if(!ready) return;
  const v = VOWELS[vowel];
  [f1,f2,f3].forEach((flt,i)=>{ flt.frequency.value = v.f[i]; flt.Q.value = v.q[i]; });
  synth.set({oscillator:{type:v.osc}});
}

/* ---------- transport ----------
   Playback runs on Tone.Transport so we get real play/pause/seek. `bs` is
   seconds-per-beat at the current tempo; positions are tracked in beats. */
let part=null, isPlaying=false, dirty=true, bs=0.5, endBeat=0, rafId=0, isScrubbing=false;
// When set, playback is scoped to these tracks (per-part "play" buttons in the
// editor). Null means the normal solo/mute scope. Exports are unaffected.
let auditionTracks=null;
function activeTracks(){ return auditionTracks || tracks.filter(t=> soloActive ? t.solo : t.enabled); }

function releaseAllInst(){ if(ready) synth.releaseAll(); if(choirReady) sampler.releaseAll(); }

function computeEndBeat(){
  const active = activeTracks();
  endBeat = 0;
  active.forEach(t=> t.notes.forEach(n=> endBeat = Math.max(endBeat, n.startBeat + n.durBeat)));
}

function buildPart(){
  if(part){ part.dispose(); part=null; }
  bs = 60 / parseInt(document.getElementById('bpm').value);
  const active = activeTracks();
  const events = []; endBeat = 0;
  active.forEach(t=> t.notes.forEach(n=>{
    endBeat = Math.max(endBeat, n.startBeat + n.durBeat);
    if(!n.isRest) events.push({time:n.startBeat*bs, note:n.name, dur:Math.max(0.05, n.durBeat*bs*0.95), trackId:t.id});
  }));
  part = new Tone.Part((time, ev)=>{
    const tr = trackById(ev.trackId);
    instrument().triggerAttackRelease(ev.note, ev.dur, time, tr && tr.vol != null ? tr.vol : 1);   // per-part volume = velocity
  }, events);
  part.start(0);
  dirty = false;
}
function ensurePart(){ if(!part || dirty) buildPart(); }
function trackById(id){ return tracks.find(t=> t.id === id); }

// Distinct onset beats across the audible voices - the grid that step ⏮/⏭ moves on.
function onsets(){
  const active = activeTracks();
  const s = new Set();
  active.forEach(t=> t.notes.forEach(n=> s.add(Math.round(n.startBeat*1e4)/1e4)));
  return [...s].sort((a,b)=>a-b);
}

function paintHighlights(beat){
  const on = new Set(activeTracks().map(t=>t.id));
  // solfa cells (player) and editor chips (one element each per note)
  tracks.forEach(t=> t.notes.forEach((n,i)=>{
    const lit = on.has(t.id) && beat >= n.startBeat-1e-6 && beat < n.startBeat+n.durBeat-1e-6;
    const el = document.getElementById(t.id+'-'+i); if(el) el.classList.toggle('active', lit);
    const ec = document.getElementById('ec-'+t.id+'-'+i); if(ec) ec.classList.toggle('eplaying', lit);
  }));
  // engraved noteheads (per-part sheets + full score), tagged with their beat window
  document.querySelectorAll('.sheetnote').forEach(el=>{
    const tid = el.dataset.tid;                       // per-part sheets carry a track id; full score does not
    const audible = !tid || on.has(tid);
    const b0 = parseFloat(el.dataset.b0), b1 = parseFloat(el.dataset.b1);
    el.classList.toggle('playing', audible && beat >= b0-1e-6 && beat < b1-1e-6);
  });
}
// Re-apply the highlight at the current playhead after a re-render (view toggle,
// solo/mute), so the lit note survives switching a part between solfa and sheet
// while playing or paused. At rest (stopped at 0) nothing is forced on.
function repaintPlayhead(){
  if(isPlaying || (window.Tone && Tone.Transport.seconds > 1e-6)) paintHighlights(Tone.Transport.seconds / bs);
}
function updatePos(beat){
  const el=document.getElementById('posdisp'); if(el) el.textContent = 'beat ' + beat.toFixed(1);
  const s=document.getElementById('scrub'); if(s && !isScrubbing) s.value = endBeat > 0 ? Math.min(1, beat/endBeat) : 0;
}
function setPlayUI(p){
  const t=document.getElementById('tplay'); if(t) t.innerHTML = icon(p ? 'pause' : 'play');
  const s=document.getElementById('stopbtn'); if(s){ s.innerHTML = icon(p ? 'square' : 'play') + '<span class="lbl">' + (p ? 'Stop' : 'Sing it') + '</span>'; s.classList.toggle('playing', p); }
  refreshAuditionUI(); updatePlayScope();
}
// Reflect play/stop state on every per-part play button (editor + player rows).
function refreshAuditionUI(){
  document.querySelectorAll('.partplay').forEach(b=>{
    const playing = isPlaying && auditionTracks && auditionTracks[0] && auditionTracks[0].id === b.dataset.tid;
    b.innerHTML = icon(playing ? 'square' : 'play');
    b.title = playing ? 'Stop this part' : 'Play this part';
    b.classList.toggle('on', !!playing);
  });
}
// What the transport's play button will sound, given audition/solo/mute state.
function playScopeLabel(){
  if(!tracks.length) return '';
  if(auditionTracks && auditionTracks.length) return auditionTracks.map(t=> t.label).join(', ');
  const audible = tracks.filter(t=> soloActive ? t.solo : t.enabled);
  if(!audible.length) return 'nothing (all muted)';
  if(audible.length === tracks.length) return tracks.length === 1 ? audible[0].label : 'all parts';
  return audible.map(t=> t.label).join(', ');
}
function updatePlayScope(){
  const el = document.getElementById('playscope'); if(!el) return;
  const s = playScopeLabel();
  el.textContent = s ? 'plays: ' + s : '';
}
// Play just one part from the editor (the player's transport, scoped to it), so
// you can hear a voice without switching to the Player tab.
async function togglePartPlay(track){
  await Tone.start(); initAudio();
  if(isPlaying && auditionTracks && auditionTracks[0] === track){ stopPlayback(); return; }
  stopPlayback();                       // clears any current scope
  auditionTracks = [track]; dirty = true; computeEndBeat();
  Tone.Transport.seconds = 0;
  togglePlay();
}

function tick(){
  if(!isPlaying) return;
  const beat = Tone.Transport.seconds / bs;
  paintHighlights(beat); updatePos(beat); syncSheetCursor(beat);
  if(beat >= endBeat - 1e-3){ stopPlayback(); return; }
  rafId = requestAnimationFrame(tick);
}

async function togglePlay(){
  await Tone.start(); initAudio();
  if(!tracks.length) return;
  if(isPlaying){ Tone.Transport.pause(); releaseAllInst(); isPlaying=false; setPlayUI(false); cancelAnimationFrame(rafId); return; }
  ensurePart();
  if(Tone.Transport.seconds >= endBeat*bs - 1e-3) Tone.Transport.seconds = 0;   // at the end -> restart
  Tone.Transport.start();
  isPlaying=true; setPlayUI(true); tick();
}

function stopPlayback(){
  Tone.Transport.stop(); Tone.Transport.seconds = 0;
  auditionTracks = null; dirty = true;   // leave any per-part audition scope
  releaseAllInst(); isPlaying=false; setPlayUI(false); cancelAnimationFrame(rafId);
  paintHighlights(0); updatePos(0); syncSheetCursor(0);
}

function previewAt(beat){
  const active = activeTracks();
  const inst = instrument();
  active.forEach(t=> t.notes.forEach(n=>{
    if(!n.isRest && Math.abs(n.startBeat-beat) < 1e-3) inst.triggerAttackRelease(n.name, Math.min(0.7, n.durBeat*bs));
  }));
}

// Audition one note (used when you click a note in the editor) so pitches can be
// checked without leaving the Edit tab. The sticky transport bar still plays the
// whole piece on any tab; this is the quick per-note preview. Best-effort: a
// blocked audio context (no gesture yet) just stays silent rather than throwing.
async function auditionNote(n){
  if(!n || n.isRest) return;
  try{
    await Tone.start(); initAudio();
    const spb = 60 / (parseInt(document.getElementById('bpm').value) || 84);
    instrument().triggerAttackRelease(n.name, Math.min(0.9, Math.max(0.25, (n.durBeat || 1) * spb)));
  }catch(_){}
}

async function seek(beat, preview){
  await Tone.start(); initAudio(); ensurePart();
  beat = Math.max(0, Math.min(beat, endBeat));
  Tone.Transport.seconds = beat * bs;
  paintHighlights(beat); updatePos(beat); syncSheetCursor(beat);
  if(!isPlaying && preview) previewAt(beat);
}

async function step(dir){
  const list = onsets(); if(!list.length) return;
  await Tone.start(); initAudio(); ensurePart();
  const cur = Tone.Transport.seconds / bs, tol = 1e-3;
  // Index of the note currently at/just-before the playhead, then move off it.
  let idx = -1;
  for(let i=0; i<list.length; i++){ if(list[i] <= cur + tol) idx = i; else break; }
  let target;
  if(dir > 0) target = list[Math.min(list.length-1, idx+1)];
  else        target = idx > 0 ? list[idx-1] : 0;
  seek(target, true);
}

// Reset the playhead when the music itself changes (new file, edited notes).
function contentChanged(){
  dirty = true; computeEndBeat();
  if(isPlaying) stopPlayback();
  else { Tone.Transport.seconds = 0; updatePos(0); }
  autosave();
}

/* ---------- export ---------- */
function currentKeyName(){ const o = keySel.options[keySel.selectedIndex]; return o ? o.textContent : ''; }
function safeName(s){ return (s || 'part').replace(/[^\w.-]+/g, '_'); }
function exportBase(track){ return pieceName ? pieceName + '-' + track.label : track.label; }
function downloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(()=> URL.revokeObjectURL(url), 1000);
}

// Offline-render a set of parts to a mono AudioBuffer, honouring the current
// timbre (formant vs choir samples) and each part's volume (as velocity).
async function renderTracksToBuffer(trackList){
  const eb = 60 / parseInt(document.getElementById('bpm').value);   // seconds per beat
  let end = 0;
  trackList.forEach(t=> t.notes.forEach(n=> end = Math.max(end, (n.startBeat + n.durBeat) * eb)));
  if(end <= 0) throw new Error('nothing to render');
  const v = VOWELS[vowel], choir = useChoir && choirReady;
  return await Tone.Offline(async ()=>{
    const out = new Tone.Gain(0.5).toDestination();
    let inst;
    if(choir){
      inst = new Tone.Sampler({urls:CHOIR_URLS, baseUrl:CHOIR_BASE}).connect(out);
      await Tone.loaded();   // wait for sample buffers in the offline context
    } else {
      const vib = new Tone.Vibrato({frequency:5, depth:0.08}).connect(out);
      const fg = new Tone.Gain(3).connect(vib);
      const filt = v.f.map((f,i)=> new Tone.Filter({type:'bandpass', frequency:f, Q:v.q[i]}).connect(fg));
      const dry = new Tone.Gain(0.05).connect(vib);
      inst = new Tone.PolySynth(Tone.Synth).set({oscillator:{type:v.osc}, envelope:{attack:0.07, decay:0.2, sustain:0.85, release:0.4}});
      inst.volume.value = -14;
      filt.forEach(f=> inst.connect(f)); inst.connect(dry);
    }
    trackList.forEach(t=>{
      const vel = t.vol != null ? t.vol : 1;
      t.notes.forEach(n=>{ if(!n.isRest) inst.triggerAttackRelease(n.name, Math.max(0.05, n.durBeat*eb*0.95), n.startBeat*eb, vel); });
    });
  }, end + 0.8, 1);   // 1 = mono
}

// One part -> MP3 (small + shareable on WhatsApp).
async function exportTrackMp3(track, btn){
  const original = btn ? btn.innerHTML : '';
  if(!window.lamejs){ alert('MP3 encoder failed to load (check your connection).'); return; }
  if(btn){ btn.textContent = '…'; btn.disabled = true; }
  try{
    const rendered = await renderTracksToBuffer([track]);
    downloadBlob(audioBufferToMp3(rendered.get()), safeName(exportBase(track)) + '.mp3');
  }catch(e){ alert('MP3 export failed: ' + e.message); }
  finally{ if(btn){ btn.innerHTML = original || (icon('download')+'MP3'); btn.disabled = false; } }
}

// All audible parts mixed into one MP3 - "how the whole thing sounds" with the
// current solo/mute, per-part volumes, and timbre.
async function exportMixMp3(btn){
  const original = btn ? btn.innerHTML : '';
  if(!window.lamejs){ alert('MP3 encoder failed to load (check your connection).'); return; }
  const audible = tracks.filter(t=> soloActive ? t.solo : t.enabled);
  if(!audible.length){ alert('No audible parts to mix.'); return; }
  if(btn){ btn.textContent = 'Mixing…'; btn.disabled = true; }
  try{
    const rendered = await renderTracksToBuffer(audible);
    downloadBlob(audioBufferToMp3(rendered.get()), safeName((pieceName ? pieceName + '-' : '') + 'full-mix') + '.mp3');
  }catch(e){ alert('Mix export failed: ' + e.message); }
  finally{ if(btn){ btn.innerHTML = original || (icon('download')+'Full mix (MP3)'); btn.disabled = false; } }
}

function audioBufferToMp3(buffer, kbps){
  kbps = kbps || 128;
  const sr = buffer.sampleRate;
  const enc = new lamejs.Mp3Encoder(1, sr, kbps);   // mono
  const f32 = buffer.getChannelData(0);
  const pcm = new Int16Array(f32.length);
  for(let i=0;i<f32.length;i++){ const s = Math.max(-1, Math.min(1, f32[i])); pcm[i] = s < 0 ? s*0x8000 : s*0x7FFF; }
  const block = 1152, chunks = [];
  for(let i=0;i<pcm.length;i+=block){
    const buf = enc.encodeBuffer(pcm.subarray(i, i+block));
    if(buf.length) chunks.push(new Int8Array(buf));
  }
  const flush = enc.flush();
  if(flush.length) chunks.push(new Int8Array(flush));
  return new Blob(chunks, {type:'audio/mpeg'});
}

// Export every part, one download after another (no zip).
async function exportAllMp3(btn){
  if(!tracks.length) return;
  const orig = btn.innerHTML; btn.disabled = true;
  for(let i=0;i<tracks.length;i++){ btn.textContent = `Rendering ${i+1}/${tracks.length}…`; await exportTrackMp3(tracks[i]); }
  btn.innerHTML = orig; btn.disabled = false;
}
async function exportAllPng(btn){
  if(!tracks.length) return;
  const orig = btn.innerHTML; btn.disabled = true;
  for(let i=0;i<tracks.length;i++){
    btn.textContent = `Saving ${i+1}/${tracks.length}…`;
    exportTrackPng(tracks[i]);
    await new Promise(r=> setTimeout(r, 450));   // let each download register before the next
  }
  btn.innerHTML = orig; btn.disabled = false;
}

// Render one part's solfège (+ note names) to a PNG on a canvas.
function exportTrackPng(track){
  const notes = track.notes;
  const cw=64, ch=82, padX=18, padTop=44, padBot=18, perRow=Math.min(Math.max(notes.length,1), 16);
  const rows = Math.ceil(notes.length / perRow) || 1;
  const W = padX*2 + perRow*cw, H = padTop + rows*ch + padBot;
  const cv = document.createElement('canvas'); cv.width=W; cv.height=H;
  const g = cv.getContext('2d');
  g.fillStyle='#f4efe6'; g.fillRect(0,0,W,H);
  g.fillStyle='#211c16'; g.textAlign='left'; g.font='600 18px Fraunces, Georgia, serif';
  g.fillText(`${track.label} (${currentKeyName()})`, padX, 26);
  g.textAlign='center';
  notes.forEach((n,i)=>{
    const x = padX + (i % perRow)*cw + cw/2, y = padTop + Math.floor(i/perRow)*ch;
    if(n.isRest){
      g.fillStyle='#b3a392'; g.font='600 22px Fraunces, serif'; g.fillText('–', x, y+28);
      g.fillStyle='#736959'; g.font='12px "JetBrains Mono", monospace'; g.fillText('rest', x, y+48);
    } else {
      const a = analyze(n);
      g.fillStyle='#2f6b5f'; g.font='600 22px Fraunces, serif'; g.fillText(a.syl, x, y+28);
      g.fillStyle='#736959'; g.font='12px "JetBrains Mono", monospace'; g.fillText(n.name, x, y+48);
      g.fillStyle='#8c2f2a'; g.font='11px "JetBrains Mono", monospace'; g.fillText('deg ' + a.deg, x, y+64);
    }
  });
  cv.toBlob(b=> downloadBlob(b, safeName(exportBase(track)) + '.png'), 'image/png');
}

/* ---------- sheet music ---------- */
let osmd = null, sheetReady = false, voiceOsmd = [], voiceSheetsReady = false;

// Shared OSMD options - engrave in the page's ink on the paper-coloured boxes
// (set in CSS) so the staves match the rest of the UI instead of black-on-white.
// autoResize is OFF: OSMD's resize-driven redraw silently wipes the highlight
// classes we add to noteheads (and the edit preview already relies on this).
function OSMD_OPTS(extra){ return Object.assign({autoResize:false, backend:'svg', defaultColorMusic:'#211c16'}, extra||{}); }

function applyTransposeTo(inst){
  try{
    if(!inst.TransposeCalculator) inst.TransposeCalculator = new opensheetmusicdisplay.TransposeCalculator();
    inst.Sheet.Transpose = transposeOffset;
    inst.updateGraphic();
  }catch(_){}
}
function updateSheetBadges(){
  const txt = transposeOffset ? `Transposed ${transposeOffset>0?'+':''}${transposeOffset} → sounds in ${currentKeyName().replace(' major','')}` : '';
  const set = (id, ready)=>{ const el=document.getElementById(id); if(!el) return; el.hidden = !(ready && transposeOffset); el.textContent = txt; };
  set('scorebadge', sheetReady); set('voicesbadge', voiceSheetsReady);
}
// Wipe rendered sheets when the music changes (they'd be stale).
function resetSheets(){
  sheetReady = false; voiceSheetsReady = false; voiceOsmd = []; osmd = null;
  const s = document.getElementById('sheet'); if(s) s.innerHTML = '';
  const v = document.getElementById('voicesheets'); if(v) v.innerHTML = '';
  updateSheetBadges();
}

/* ---------- notes -> MusicXML ----------
   Serialise the edited note model back into MusicXML so the engraved sheet
   (and exports) reflect edits. One <part> per voice - no backup/voice juggling.
   Notes are laid into measures of the given meter; anything crossing a barline
   (or not expressible as one notehead) is split into tied notes. */
const XDIV = 768;   // divisions per quarter note (divisible by 2,3,4,6,8,16)
// Standard note values in quarter-beats, with dotted variants, longest first.
const DUR_TABLE = (()=>{
  const base = [['whole',4],['half',2],['quarter',1],['eighth',0.5],['16th',0.25],['32nd',0.125]];
  const out = [];
  base.forEach(([type,q])=>{
    out.push({type, dots:0, ticks:Math.round(q*XDIV)});
    out.push({type, dots:1, ticks:Math.round(q*1.5*XDIV)});
    out.push({type, dots:2, ticks:Math.round(q*1.75*XDIV)});
  });
  return out.sort((a,b)=> b.ticks - a.ticks);
})();
// Break an arbitrary tick length into a list of standard note values (tied/joined).
function decomposeTicks(ticks){
  const out = []; let rem = ticks, guard = 0;
  while(rem >= XDIV/16 && guard++ < 64){
    const fit = DUR_TABLE.find(d=> d.ticks <= rem + 1);
    if(!fit) break;
    out.push(fit); rem -= fit.ticks;
  }
  if(!out.length) out.push(DUR_TABLE.find(d=> d.type==='quarter' && d.dots===0));
  return out;
}
const FIFTHS_BY_KEY = {C:0,G:1,D:2,A:3,E:4,B:5,'F#':6,'C#':7,F:-1,Bb:-2,Eb:-3,Ab:-4,Db:-5,Gb:-6,Cb:-7};
function currentFifths(){ return FIFTHS_BY_KEY[currentKeyName().replace(/\s*major\s*$/i,'').trim()] ?? 0; }

function noteTypeXML(d){ return `<type>${d.type}</type>` + '<dot/>'.repeat(d.dots); }
function pitchXML(n){
  const alt = n.alter ? `<alter>${n.alter}</alter>` : '';
  return `<pitch><step>${n.step}</step>${alt}<octave>${n.oct}</octave></pitch>`;
}

// One part's measures. `events` is the gap-filled, measure-padded note list.
// totalMeasures pads this part to the score-wide length with trailing rest bars,
// so all parts share a measure count (OSMD renders only up to the shortest part,
// which would otherwise truncate the preview/exports to the shortest voice).
function partMeasuresXML(notes, measureTicks, attrsXML, totalMeasures){
  // sort + fill gaps with rests so the timeline is contiguous from 0
  const ev = notes.slice().sort((a,b)=> a.startBeat - b.startBeat);
  const seq = []; let cursor = 0;
  ev.forEach(n=>{
    const start = Math.round(n.startBeat*XDIV), dur = Math.max(1, Math.round(n.durBeat*XDIV));
    if(start > cursor + 1) seq.push({rest:true, start:cursor, ticks:start-cursor});
    seq.push({rest:!!n.isRest, start, ticks:dur, step:n.step, alter:n.alter, oct:n.oct});
    cursor = Math.max(cursor, start + dur);
  });
  if(!seq.length) seq.push({rest:true, start:0, ticks:measureTicks});
  // pad the final measure out to a barline with a rest
  const total = Math.ceil(cursor / measureTicks) * measureTicks || measureTicks;
  if(cursor < total) seq.push({rest:true, start:cursor, ticks:total-cursor});

  const measures = [];               // measures[m] = array of <note> strings
  const put = (m, xml)=>{ (measures[m] = measures[m] || []).push(xml); };
  seq.forEach(e=>{
    // split the event at measure boundaries
    const frags = []; let s = e.start, end = e.start + e.ticks;
    while(s < end){
      const mEnd = (Math.floor(s/measureTicks)+1)*measureTicks;
      const segEnd = Math.min(end, mEnd);
      frags.push({m:Math.floor(s/measureTicks), ticks:segEnd - s});
      s = segEnd;
    }
    // each fragment decomposes into note values; pitched notes tie across all sub-notes
    const subs = [];
    frags.forEach(f=> decomposeTicks(f.ticks).forEach(d=> subs.push({m:f.m, d})));
    subs.forEach((sub,i)=>{
      if(e.rest){
        put(sub.m, `<note><rest/><duration>${sub.d.ticks}</duration><voice>1</voice>${noteTypeXML(sub.d)}</note>`);
      } else {
        const tieStart = i < subs.length-1, tieStop = i > 0;
        const ties = (tieStop?'<tie type="stop"/>':'') + (tieStart?'<tie type="start"/>':'');
        const tied = (tieStop?'<tied type="stop"/>':'') + (tieStart?'<tied type="start"/>':'');
        const notations = tied ? `<notations>${tied}</notations>` : '';
        put(sub.m, `<note>${pitchXML(e)}<duration>${sub.d.ticks}</duration>${ties}<voice>1</voice>${noteTypeXML(sub.d)}${notations}</note>`);
      }
    });
  });
  const count = Math.max(measures.length || 1, totalMeasures || 1);
  let xml = '';
  for(let m=0; m<count; m++){
    const body = (measures[m] || [`<note><rest measure="yes"/><duration>${measureTicks}</duration><voice>1</voice></note>`]).join('');
    xml += `<measure number="${m+1}">${m===0 ? attrsXML : ''}${body}</measure>`;
  }
  return xml;
}

// Build a full <score-partwise> from the current tracks (one part each).
function tracksToMusicXML(opts){
  opts = opts || {};
  const list = (opts.tracks || tracks).filter(t=> t.notes && t.notes.length);
  const beats = opts.beats || 4, beatType = opts.beatType || 4;
  const measureTicks = Math.round(beats * (4/beatType) * XDIV);
  const fifths = opts.fifths != null ? opts.fifths : currentFifths();
  const title = (opts.title != null ? opts.title : pieceName) || 'Untitled';
  const esc = s=> String(s).replace(/[<&>]/g, c=> ({'<':'&lt;','&':'&amp;','>':'&gt;'}[c]));

  // Size the score to the longest voice, so shorter voices get trailing rest bars
  // rather than truncating the whole render to the shortest voice's length.
  let maxTick = 0;
  list.forEach(t=> t.notes.forEach(n=> maxTick = Math.max(maxTick, Math.round((n.startBeat + n.durBeat) * XDIV))));
  const totalMeasures = Math.max(1, Math.ceil(maxTick / measureTicks));

  let partList = '', partsXML = '';
  list.forEach((t,i)=>{
    const id = 'P'+(i+1);
    partList += `<score-part id="${id}"><part-name>${esc(t.label||('Voice '+(i+1)))}</part-name></score-part>`;
    const pitched = t.notes.filter(n=> !n.isRest);
    const avg = pitched.length ? pitched.reduce((s,n)=> s+n.midi, 0)/pitched.length : 71;
    const clef = avg >= 60 ? '<clef><sign>G</sign><line>2</line></clef>' : '<clef><sign>F</sign><line>4</line></clef>';
    const attrs = `<attributes><divisions>${XDIV}</divisions><key><fifths>${fifths}</fifths></key><time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time>${clef}</attributes>`;
    partsXML += `<part id="${id}">${partMeasuresXML(t.notes, measureTicks, attrs, totalMeasures)}</part>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<score-partwise version="3.1"><work><work-title>${esc(title)}</work-title></work><part-list>${partList}</part-list>${partsXML}</score-partwise>`;
}

/* ---------- save score to file (MusicXML / PNG / PDF) ---------- */
function hasMusic(){ return tracks.some(t=> t.notes && t.notes.length); }
function scoreFileBase(){ return safeName(pieceName || 'score'); }

function downloadMusicXML(){
  const msg = document.getElementById('savemsg');
  if(!hasMusic()){ if(msg) msg.textContent = 'Load or create a piece first.'; return; }
  const xml = tracksToMusicXML({beats:meterBeats, beatType:meterType});
  downloadBlob(new Blob([xml], {type:'application/vnd.recordare.musicxml+xml'}), scoreFileBase() + '.musicxml');
  if(msg) msg.textContent = 'Saved MusicXML ✓';
}

// Render the current notes to an offscreen OSMD; returns its container + page SVGs.
async function renderScoreOffscreen(){
  if(!window.opensheetmusicdisplay) throw new Error('Sheet renderer not loaded.');
  if(!hasMusic()) throw new Error('Load or create a piece first.');
  const box = document.createElement('div');
  box.style.cssText = 'position:absolute;left:-10000px;top:0;width:1000px;background:#fff';
  document.body.appendChild(box);
  try{
    const inst = new opensheetmusicdisplay.OpenSheetMusicDisplay(box, {backend:'svg', drawTitle:true, autoResize:false});
    await inst.load(tracksToMusicXML({beats:meterBeats, beatType:meterType}));
    inst.render();
    return {box, svgs:[...box.querySelectorAll('svg')]};
  }catch(e){ box.remove(); throw e; }
}

function svgToImage(svg){
  const w = svg.width.baseVal.value || parseFloat(svg.getAttribute('width')) || svg.clientWidth || 1000;
  const h = svg.height.baseVal.value || parseFloat(svg.getAttribute('height')) || svg.clientHeight || 1000;
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
  return new Promise((res, rej)=>{
    const img = new Image();
    img.onload = ()=> res({img, w, h});
    img.onerror = ()=> rej(new Error('Could not rasterise the score.'));
    img.src = url;
  });
}

// Stack all page SVGs into one PNG canvas on the paper colour.
async function scoreToCanvas(svgs, scale){
  scale = scale || 2;
  const imgs = []; for(const s of svgs) imgs.push(await svgToImage(s));
  const pad = 16;
  const W = Math.max(...imgs.map(i=> i.w)) + pad*2;
  const H = imgs.reduce((s,i)=> s + i.h, 0) + pad*2;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(W*scale); cv.height = Math.ceil(H*scale);
  const g = cv.getContext('2d');
  g.fillStyle = '#f4efe6'; g.fillRect(0,0,cv.width,cv.height);   // page colour, full pixels
  g.scale(scale, scale);
  let y = pad; for(const i of imgs){ g.drawImage(i.img, pad, y, i.w, i.h); y += i.h; }
  return cv;
}

async function downloadScorePNG(){
  const msg = document.getElementById('savemsg'); if(msg) msg.textContent = 'Rendering PNG…';
  let ctx;
  try{
    ctx = await renderScoreOffscreen();
    const cv = await scoreToCanvas(ctx.svgs, 2);
    await new Promise(r=> cv.toBlob(b=>{ downloadBlob(b, scoreFileBase()+'.png'); r(); }, 'image/png'));
    if(msg) msg.textContent = 'Saved PNG ✓';
  }catch(e){ if(msg) msg.textContent = 'PNG export failed: ' + e.message; }
  finally{ if(ctx) ctx.box.remove(); }
}

async function downloadScorePDF(){
  const msg = document.getElementById('savemsg');
  const JS = window.jspdf && window.jspdf.jsPDF;
  if(!JS){ if(msg) msg.textContent = 'PDF library not loaded (check your connection).'; return; }
  if(msg) msg.textContent = 'Rendering PDF…';
  let ctx;
  try{
    ctx = await renderScoreOffscreen();
    const cv = await scoreToCanvas(ctx.svgs, 2);
    const data = cv.toDataURL('image/png');
    const pdf = new JS({orientation:'portrait', unit:'pt', format:'a4'});
    const margin = 24;
    const pw = pdf.internal.pageSize.getWidth() - margin*2;
    const ph = pdf.internal.pageSize.getHeight() - margin*2;
    const fullH = pw * cv.height / cv.width;       // image height scaled to page width
    let page = 0;
    for(let y=0; y < fullH - 1; y += ph){
      if(page>0) pdf.addPage();
      pdf.addImage(data, 'PNG', margin, margin - y, pw, fullH);   // each page shows its slice
      page++;
    }
    pdf.save(scoreFileBase()+'.pdf');
    if(msg) msg.textContent = 'Saved PDF ✓';
  }catch(e){ if(msg) msg.textContent = 'PDF export failed: ' + e.message; }
  finally{ if(ctx) ctx.box.remove(); }
}

// MusicXML for the whole score / one part: the untouched import while unedited
// (best fidelity, matches the user's PDF), otherwise our serialised note model.
// The serializer bakes the current (already-transposed) pitches in, so OSMD's
// transpose must be applied ONLY when rendering the original import.
let showDynamics = true;   // user toggle: show/hide dynamic markings (p, f, sf, cresc) on the sheets
// Remove <direction> elements (dynamics, wedges, tempo words) from a score.
function stripDynamics(xml){
  try{
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if(doc.querySelector('parsererror')) return xml;
    doc.querySelectorAll('direction').forEach(d=> d.remove());
    return new XMLSerializer().serializeToString(doc);
  }catch(_){ return xml; }
}
function maybeStrip(xml){ return showDynamics ? xml : stripDynamics(xml); }
function scoreFromOriginal(){ return !!(lastXML && !edited); }
function partFromOriginal(track){ return !!(track.key && lastXML && !edited); }
function scoreXML(){ return maybeStrip(scoreFromOriginal() ? lastXML : tracksToMusicXML({beats:meterBeats, beatType:meterType})); }
function partXML(track){ return maybeStrip(partFromOriginal(track) ? buildVoiceXML(track) : tracksToMusicXML({tracks:[track], beats:meterBeats, beatType:meterType})); }
// Edits invalidate every rendered sheet so they re-render from the new notes.
function invalidateSheets(){ tracks.forEach(t=>{ delete t._sheetHTML; delete t._sheetKey; }); osmd = null; sheetReady = false; }

async function renderScore(){
  const msg = document.getElementById('sheetmsg');
  if(!hasMusic()){ msg.textContent = 'Load or create a piece first.'; return; }
  if(!window.opensheetmusicdisplay){ msg.textContent = 'Sheet renderer failed to load (check your connection).'; return; }
  msg.textContent = 'Rendering…';
  try{
    if(!osmd) osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay('sheet', OSMD_OPTS({drawTitle:true, followCursor:false, cursorsOptions:[{type:0, color:'#8c2f2a', alpha:0.3, follow:true}]}));
    await osmd.load(scoreXML());
    if(scoreFromOriginal() && transposeOffset) applyTransposeTo(osmd);   // serializer already carries the transpose
    osmd.render();
    tagSheetNotes(osmd);   // mark noteheads so playback highlights the whole sounding chord
    try{ osmd.cursor.show(); osmd.cursor.reset(); }catch(_){}
    sheetReady = true; updateSheetBadges();
    msg.textContent = 'Rendered ✓';
  }catch(e){ sheetReady = false; msg.textContent = 'Could not render: ' + e.message; }
}

// Build a single-voice MusicXML by keeping only one (part, staff, voice) from the
// original import. Faithful: chords, dynamics, and the source staff are preserved.
function buildVoiceXML(track){
  const doc = new DOMParser().parseFromString(lastXML, 'application/xml');
  const [pi, staff, voice] = track.key.split('|');
  const parts = [...doc.querySelectorAll('part')];
  parts.forEach((p,i)=>{ if(i !== +pi) p.remove(); });
  const kept = parts[+pi];
  const keptId = kept ? kept.getAttribute('id') : null;
  const pl = doc.querySelector('part-list');
  if(pl && keptId) [...pl.querySelectorAll('score-part')].forEach(sp=>{ if(sp.getAttribute('id') !== keptId) sp.remove(); });
  if(kept) [...kept.querySelectorAll('measure')].forEach(m=>{
    [...m.children].forEach(el=>{
      const tag = el.tagName;
      if(tag === 'note'){
        const v = el.querySelector('voice')?.textContent || '1';
        const st = el.querySelector('staff')?.textContent || '1';
        if(v !== voice || st !== staff) el.remove();
      } else if(tag === 'backup' || tag === 'forward'){ el.remove(); }
    });
  });
  return new XMLSerializer().serializeToString(doc);
}

// A part can show an engraved staff as long as it has notes to engrave
// (the serializer can engrave imported, typed, or MIDI parts alike).
function canSheet(track){ return !!(window.opensheetmusicdisplay && track.notes && track.notes.some(n=> !n.isRest)); }

// Tag each pitched notehead's SVG group with its beat window (and optionally a
// track id) so playback can light it up the way the solfa cells do. Beats are in
// quarter-note units to match our note model. Rests are skipped (no Pitch).
// trackId: a fixed id for every note (per-part sheets). byIndex: derive the id
// from the staff index = track order (the multi-part preview, one part per track).
function tagSheetNotes(inst, trackId, byIndex){
  try{
    inst.GraphicSheet.MeasureList.forEach(row=> row.forEach((gm, idx)=>{
      if(!gm) return;
      const tid = trackId || (byIndex && tracks[idx] ? tracks[idx].id : null);
      gm.staffEntries.forEach(se=> se.graphicalVoiceEntries.forEach(gve=> gve.notes.forEach(gn=>{
        const sn = gn.sourceNote; if(!sn || !sn.Pitch) return;
        const b0 = sn.getAbsoluteTimestamp().RealValue * 4;
        const len = (sn.Length ? sn.Length.RealValue : 0) * 4;
        const el = gn.getSVGGElement && gn.getSVGGElement();
        if(!el) return;
        el.classList.add('sheetnote');
        el.dataset.b0 = b0.toFixed(4);
        el.dataset.b1 = (b0 + len).toFixed(4);
        if(tid) el.dataset.tid = tid;
      })));
    }));
  }catch(_){}
}

// Render one part's staff into `box` (themed to the page) and cache the SVG so
// later re-renders (solo/mute/collapse) reuse it instead of re-running OSMD.
async function renderPartSheet(track, box){
  try{
    const inst = new opensheetmusicdisplay.OpenSheetMusicDisplay(box, OSMD_OPTS({drawTitle:false, followCursor:false}));
    await inst.load(partXML(track));
    if(partFromOriginal(track) && transposeOffset) applyTransposeTo(inst);   // serializer already carries the transpose
    box.querySelectorAll('p').forEach(p=> p.remove());   // OSMD draws alongside, not over, the "Rendering staff…" placeholder; drop it
    inst.render();
    tagSheetNotes(inst, track.id);   // mark noteheads so playback can highlight them
    track._sheetHTML = box.innerHTML; track._sheetKey = transposeOffset;   // cache keyed by transpose (data-attrs ride along)
    repaintPlayhead();   // re-light the current note now that this staff exists (async render)
  }catch(e){ box.innerHTML = '<p class="hint" style="margin:4px">Could not engrave this part.</p>'; }
}

// Toggle the dynamic markings (p, f, sf, cresc) on the engraved sheets. Re-renders
// per-part sheets and the full score (if shown) from the stripped/unstripped XML.
function setDynamics(show){
  showDynamics = show;
  document.querySelectorAll('#dynToggle button').forEach(b=> b.classList.toggle('on', (b.dataset.dyn === 'show') === show));
  const wasScore = sheetReady;
  invalidateSheets();
  render();
  if(wasScore) renderScore();
  autosave();
}

// Master switch: flip every part to solfa or sheet at once (sheet-incapable
// parts fall back to solfa automatically in render()).
function setAllPartView(mode){
  tracks.forEach(t=> t.view = mode);
  document.querySelectorAll('#masterview button').forEach(b=> b.classList.toggle('on', b.dataset.m === mode));
  render();
}

// Re-render any showing full score after a transpose. renderScore() reloads from
// the correct source and only applies OSMD transpose for the original import, so
// it handles both paths without double-transposing. Per-part sheets refresh via
// render() (their cache is keyed by transposeOffset).
function retransposeSheets(){
  if(sheetReady) renderScore();
  updateSheetBadges();
}

// Move the sheet cursor to the note actually sounding at `beat` (best-effort,
// guarded). It must sit on the note whose window contains `beat` (onset <= beat
// < next onset), matching the audio + notehead highlight. Advancing while the
// CURRENT onset < beat overshoots by one during a note's sustain, so we peek the
// NEXT onset (via a cloned iterator) and only step when it is still <= beat.
function syncSheetCursor(beat){
  if(!sheetReady || !osmd || !osmd.cursor) return;
  try{
    const cur = osmd.cursor;
    const tsBeat = (it)=>{
      if(!it || it.EndReached || !it.currentTimeStamp) return Infinity;
      return it.currentTimeStamp.RealValue * 4;   // whole-note fraction -> quarter-note beats
    };
    if(tsBeat(cur.iterator) > beat + 1e-3) cur.reset();   // seeked backwards -> start over
    let guard = 0;
    while(guard++ < 20000){
      const peek = cur.iterator.clone(); peek.moveToNext();
      if(tsBeat(peek) <= beat + 1e-3) cur.next(); else break;   // next note has started -> advance
    }
    cur.update();
  }catch(_){}
}

/* ---------- editor ----------
   The editor mutates `tracks` directly (the single source of truth). Each part
   is treated as monophonic: start beats are recomputed sequentially from
   durations, so insert/delete/duration edits just reflow the part. */
const PITCH_LETTERS = ['C','D','E','F','G','A','B'];
const ACCIDENTALS = [[0,'♮'],[1,'♯'],[2,'♯♯'],[-1,'♭'],[-2,'♭♭']];
const EDIT_DURS = [['whole',4],['dotted half',3],['half',2],['dotted quarter',1.5],['quarter',1],['dotted eighth',0.75],['eighth',0.5],['16th',0.25]];
const DUR_ABBR = {4:'w',3:'h.',2:'h',1.5:'q.',1:'q',0.75:'e.',0.5:'e',0.25:'s'};
function durAbbr(d){ return DUR_ABBR[d] || (d+'b'); }

let editOsmd = null, editPreviewTimer = 0, undoStack = [];
// Capture key + transpose too, so undoing a transpose restores both the notes
// (snapshot is taken before they are re-spelled) and the key/offset.
function snapshot(){ return JSON.stringify({tracks, meterBeats, meterType, pieceName, transposeOffset, tonicPc: currentTonic.pc, tonicLetter: currentTonic.letter}); }
function pushUndo(){ undoStack.push(snapshot()); if(undoStack.length > 80) undoStack.shift(); }
function undo(){
  if(!undoStack.length) return;
  const s = JSON.parse(undoStack.pop());
  tracks = s.tracks; meterBeats = s.meterBeats; meterType = s.meterType; pieceName = s.pieceName;
  if(s.transposeOffset != null) transposeOffset = s.transposeOffset;
  if(s.tonicPc != null) setKey(s.tonicPc, s.tonicLetter);
  editSel = null; afterEdit(false); updateSheetBadges();
}

function recomputeNote(n){
  if(n.isRest) return;
  n.pc = ((PC[n.step] + (n.alter||0)) % 12 + 12) % 12;
  n.midi = (n.oct + 1) * 12 + n.pc;
  n.name = n.step + (n.alter > 0 ? '#'.repeat(n.alter) : n.alter < 0 ? 'b'.repeat(-n.alter) : '') + n.oct;
}
// Beats per bar in quarter-note units (matches the serializer's measureTicks).
function barBeats(){ return (meterBeats || 4) * (4 / (meterType || 4)); }
// Recompute sequential start beats + pitch fields (each part is monophonic here).
// A note is also clamped so it never overruns its bar: the engraver already caps
// the notehead to the barline, so the model (which drives the solfa duration
// letter AND the audio) must agree, otherwise a too-long note sounds/labels as
// the value you typed while the staff shows the shorter, bar-fitting one.
function reflowTrack(t){
  const bb = barBeats();
  let cur = 0;
  (t.notes || []).forEach(n=>{
    n.startBeat = cur;
    if(bb > 0){
      let posInBar = cur % bb;
      if(posInBar < 1e-6 || bb - posInBar < 1e-6) posInBar = 0;   // sitting on a barline -> whole bar free
      const remaining = bb - posInBar;
      if(n.durBeat > remaining + 1e-6) n.durBeat = remaining;     // never cross the barline
    }
    cur += n.durBeat;
    recomputeNote(n);
  });
}
function defaultNote(prev){
  if(prev && !prev.isRest) return {isRest:false, step:prev.step, alter:prev.alter||0, oct:prev.oct, durBeat:prev.durBeat};
  return {isRest:false, step:'C', alter:0, oct:5, durBeat:1};
}

// After any edit: reflow, invalidate sheets, refresh player + editor + preview, re-sync playback.
function afterEdit(markEdited){
  if(markEdited !== false) edited = true;
  tracks.forEach(reflowTrack);
  invalidateSheets();
  render();
  renderEditor();
  scheduleEditPreview();
  contentChanged();
}

function selectedTrack(){ return editSel ? tracks.find(t=> t.id === editSel.trackId) : null; }
function selectedNote(){ const t = selectedTrack(); return (t && editSel && t.notes[editSel.index]) || null; }

function renderEditor(){
  const wrap = document.getElementById('editparts'); if(!wrap) return;
  const tEl = document.getElementById('edTitle'); if(tEl && document.activeElement !== tEl) tEl.value = pieceName || '';
  document.getElementById('edBeats').value = String(meterBeats);
  document.getElementById('edBeatType').value = String(meterType);
  wrap.innerHTML = '';
  if(!tracks.length){
    wrap.innerHTML = '<p class="hint">Nothing to edit yet. Load a file or type a melody above, or click <b>New piece</b> to start a blank one.</p>';
    return;
  }
  // Flag likely OMR slips (very short parts) so the user can review and remove
  // them by hand. Nothing is ever deleted automatically.
  const suspects = suspectParts();
  const suspectIds = new Set(suspects.map(s=> s.id));
  if(suspects.length){
    const notice = document.createElement('div'); notice.className = 'editnote';
    const span = document.createElement('span');
    span.textContent = `${suspects.length} very short part(s) flagged below, often OMR slips. Check them, then keep or remove (this is undoable).`;
    const btn = document.createElement('button'); btn.className = 'ghost'; btn.textContent = `Remove ${suspects.length} flagged part(s)`;
    btn.onclick = ()=>{ pushUndo(); tracks = tracks.filter(t=> !suspectIds.has(t.id)); if(editSel && suspectIds.has(editSel.trackId)) editSel = null; afterEdit(); };
    notice.append(span, btn);
    wrap.append(notice);
  }
  tracks.forEach(t=>{
    const isSel = !!(editSel && editSel.trackId === t.id);
    const collapsed = !!t.editCollapsed && !isSel;   // never collapse the part you're editing
    const part = document.createElement('div'); part.className = 'epart' + (suspectIds.has(t.id) ? ' suspect' : '') + (collapsed ? ' collapsed' : '');
    const head = document.createElement('div'); head.className = 'epart-head';
    const caret = document.createElement('button'); caret.className = 'ecaret';
    caret.innerHTML = icon(collapsed ? 'chevron-right' : 'chevron-down');
    caret.title = collapsed ? 'Expand this part' : 'Collapse this part';
    caret.onclick = ()=>{ t.editCollapsed = !t.editCollapsed; renderEditor(); };
    const playBtn = document.createElement('button'); playBtn.className = 'epart-play partplay'; playBtn.dataset.tid = t.id;
    playBtn.innerHTML = icon('play'); playBtn.title = 'Play this part';
    playBtn.onclick = ()=> togglePartPlay(t);
    const name = document.createElement('input'); name.type = 'text'; name.value = t.label || ''; name.placeholder = 'Part name'; name.title = 'Rename this part';
    name.oninput = ()=>{ t.label = name.value; render(); scheduleEditPreview(); };
    const pc = pitchedCount(t);
    const count = document.createElement('span'); count.className = 'epart-count' + (suspectIds.has(t.id) ? ' suspect' : '');
    count.textContent = pc === 1 ? '1 note' : pc + ' notes';
    if(suspectIds.has(t.id)) count.title = 'Very short, likely an OMR slip. Keep it or delete it.';
    const del = document.createElement('button'); del.className = 'ghost delpart'; del.textContent = 'Delete part';
    del.onclick = ()=>{ pushUndo(); tracks = tracks.filter(x=> x !== t); if(editSel && editSel.trackId === t.id) editSel = null; afterEdit(); };
    head.append(caret, playBtn, name, count, del);
    part.append(head);
    if(!collapsed){
      const chips = document.createElement('div'); chips.className = 'echips';
      t.notes.forEach((n,i)=>{
        const c = document.createElement('div');
        c.id = 'ec-' + t.id + '-' + i;   // so playback can light the sounding chip
        c.className = 'echip' + (n.isRest ? ' rest' : '') + (isSel && editSel.index === i ? ' sel' : '');
        if(n.isRest) c.innerHTML = `<span class="solf">–</span><span class="nm">rest</span><span class="dur">${durAbbr(n.durBeat)}</span>`;
        else { const a = analyze(n); c.innerHTML = `<span class="solf">${a.syl}</span><span class="nm">${n.name}</span><span class="dur">${durAbbr(n.durBeat)}</span>`; }
        c.onclick = ()=>{ editSel = {trackId:t.id, index:i}; renderEditor(); highlightEditorSelection(); if(!isPlaying) auditionNote(n); };
        chips.append(c);
      });
      const add = document.createElement('div'); add.className = 'echip addchip'; add.textContent = '+'; add.title = 'Add a note to the end of this part';
      add.onclick = ()=>{ pushUndo(); t.notes.push(defaultNote(t.notes[t.notes.length-1])); editSel = {trackId:t.id, index:t.notes.length-1}; afterEdit(); };
      chips.append(add);
      part.append(chips);
      // The note editor lives right under the part that owns the selected note,
      // so you never have to scroll past other parts to change or delete it.
      if(isSel && t.notes[editSel.index]){
        const ne = document.createElement('div'); ne.className = 'noteeditor';
        renderNoteEditor(ne);
        part.append(ne);
      }
    }
    wrap.append(part);
  });
  refreshAuditionUI();   // show the stop icon if a part is currently auditioning
}

// Fill the per-note controls into `panel` (an inline box under the selected part).
function renderNoteEditor(panel){
  const n = selectedNote();
  if(!panel || !n) return;
  const letterOpts = PITCH_LETTERS.map(l=> `<option ${!n.isRest && n.step === l ? 'selected' : ''}>${l}</option>`).join('');
  const accOpts = ACCIDENTALS.map(([v,s])=> `<option value="${v}" ${!n.isRest && (n.alter||0) === v ? 'selected' : ''}>${s}</option>`).join('');
  const durOpts = EDIT_DURS.map(([lab,v])=> `<option value="${v}" ${n.durBeat === v ? 'selected' : ''}>${lab}</option>`).join('');
  panel.innerHTML = `
    <div class="grp"><label>Pitch</label>
      <select id="neStep" ${n.isRest?'disabled':''}>${letterOpts}</select>
      <select id="neAcc" ${n.isRest?'disabled':''}>${accOpts}</select>
      <button class="minibtn" id="neOctDn" ${n.isRest?'disabled':''}>oct −</button>
      <span class="nm" id="neOct">${n.isRest?'–':n.oct}</span>
      <button class="minibtn" id="neOctUp" ${n.isRest?'disabled':''}>oct +</button>
    </div>
    <div class="grp"><label>Duration</label><select id="neDur">${durOpts}</select></div>
    <button class="minibtn" id="neRest">${n.isRest?'Make note':'Make rest'}</button>
    <div class="grp">
      <button class="minibtn" id="neInsBefore">Insert before</button>
      <button class="minibtn" id="neInsAfter">Insert after</button>
      <button class="minibtn" id="neDelete">Delete</button>
    </div>`;
  const t = selectedTrack(), i = editSel.index;
  panel.querySelector('#neStep').onchange = e=>{ pushUndo(); n.step = e.target.value; afterEdit(); };
  panel.querySelector('#neAcc').onchange = e=>{ pushUndo(); n.alter = parseInt(e.target.value); afterEdit(); };
  panel.querySelector('#neOctDn').onclick = ()=>{ pushUndo(); n.oct = Math.max(0, (n.oct||5) - 1); afterEdit(); };
  panel.querySelector('#neOctUp').onclick = ()=>{ pushUndo(); n.oct = Math.min(9, (n.oct||5) + 1); afterEdit(); };
  panel.querySelector('#neDur').onchange = e=>{ pushUndo(); n.durBeat = parseFloat(e.target.value); afterEdit(); };
  panel.querySelector('#neRest').onclick = ()=>{ pushUndo(); if(n.isRest){ n.isRest = false; n.step = n.step||'C'; n.alter = n.alter||0; n.oct = n.oct||5; } else n.isRest = true; afterEdit(); };
  panel.querySelector('#neInsBefore').onclick = ()=>{ pushUndo(); t.notes.splice(i, 0, defaultNote(n)); afterEdit(); };
  panel.querySelector('#neInsAfter').onclick = ()=>{ pushUndo(); t.notes.splice(i+1, 0, defaultNote(n)); editSel = {trackId:t.id, index:i+1}; afterEdit(); };
  panel.querySelector('#neDelete').onclick = ()=>{ pushUndo(); t.notes.splice(i, 1); editSel = t.notes.length ? {trackId:t.id, index:Math.min(i, t.notes.length-1)} : null; afterEdit(); };
}

function scheduleEditPreview(){ clearTimeout(editPreviewTimer); editPreviewTimer = setTimeout(renderEditPreview, 250); autosave(); }
async function renderEditPreview(){
  const box = document.getElementById('editsheet'); if(!box) return;
  if(!window.opensheetmusicdisplay){ box.innerHTML = '<p class="hint" style="margin:6px">Sheet renderer not loaded.</p>'; editOsmd = null; return; }
  if(!hasMusic()){ box.innerHTML = '<p class="hint" style="margin:6px">Add some notes to see the engraved preview.</p>'; editOsmd = null; return; }
  try{
    if(!editOsmd){ box.innerHTML = ''; editOsmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(box, OSMD_OPTS({drawTitle:true, followCursor:false, autoResize:false})); }
    await editOsmd.load(tracksToMusicXML({beats:meterBeats, beatType:meterType}));
    editOsmd.render();
    tagSheetNotes(editOsmd, null, true);   // per-track tags so playback lights the right notes
    highlightEditorSelection();            // re-apply the staff highlight after each render
  }catch(e){ box.innerHTML = '<p class="hint" style="margin:6px">Could not engrave: ' + e.message + '</p>'; editOsmd = null; }
}

function addPart(){
  pushUndo();
  const nums = tracks.map(t=> parseInt((t.id||'t0').slice(1)) || 0);
  const id = 't' + ((nums.length ? Math.max(...nums) : -1) + 1);
  tracks.push({id, label:'Voice ' + (tracks.length+1), enabled:true, solo:false, vol:1, notes:[ defaultNote(null) ]});
  editSel = {trackId:id, index:0};
  afterEdit();
}

// Phase 4: start a blank piece from scratch (one part, one note, ready to build on).
// Start a fresh piece from a list of parts ({label, note?}). The note's pitch
// fields are recomputed by reflow, so specs only need step/alter/oct/durBeat.
function startPiece(partsSpec){
  if(hasMusic() && !confirm('Start a new piece? This clears the current one.')) return;
  pushUndo();
  pieceName = ''; lastXML = ''; transposeOffset = 0; edited = true;
  meterBeats = 4; meterType = 4; setKey(0, 'C');   // sensible defaults: C major, 4/4
  tracks = partsSpec.map((s,i)=> ({id:'t'+i, label:s.label, enabled:true, solo:false, vol:1, notes:[ s.note || defaultNote(null) ]}));
  soloActive = false; editSel = {trackId:'t0', index:0};
  afterEdit();
  switchTab('edit');
  const tEl = document.getElementById('edTitle'); if(tEl){ tEl.value = ''; tEl.focus(); }
}
function newPiece(){ startPiece([{label:'Voice 1'}]); }
// One-click SATB: four empty voices at sensible starting octaves.
function newSATB(){ startPiece([
  {label:'Soprano', note:{isRest:false, step:'C', alter:0, oct:5, durBeat:1}},
  {label:'Alto',    note:{isRest:false, step:'A', alter:0, oct:4, durBeat:1}},
  {label:'Tenor',   note:{isRest:false, step:'E', alter:0, oct:4, durBeat:1}},
  {label:'Bass',    note:{isRest:false, step:'C', alter:0, oct:3, durBeat:1}},
]); }

/* ---------- persistence ----------
   Autosave the working piece to localStorage (so a refresh never loses it), and
   let the user save/open a portable .solfege.json project capturing the full
   editor state (notes + meter + key + tempo + title). */
const SESSION_KEY = 'solfege-player-session';
let autosaveTimer = 0;

function sessionState(){
  return {
    v: 1, tracks, meterBeats, meterType, pieceName, transposeOffset,
    tonicPc: currentTonic.pc, tonicLetter: currentTonic.letter,
    bpm: parseInt(document.getElementById('bpm').value) || 84,
    showDynamics,
  };
}
function autosave(){
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(()=>{ try{ localStorage.setItem(SESSION_KEY, JSON.stringify(sessionState())); }catch(_){} }, 600);
}
// Apply a saved state object to the app. Returns false if it carries no notes.
function restoreState(s){
  if(!s || !Array.isArray(s.tracks) || !s.tracks.length) return false;
  tracks = s.tracks;
  meterBeats = s.meterBeats || 4; meterType = s.meterType || 4;
  pieceName = s.pieceName || ''; transposeOffset = s.transposeOffset || 0;
  edited = true; lastXML = ''; soloActive = false; editSel = null;
  tracks.forEach(t=>{ if(t.vol === undefined) t.vol = 1; if(t.enabled === undefined) t.enabled = true; });
  if(s.tonicPc != null) setKey(s.tonicPc, s.tonicLetter);
  if(s.bpm) setTempo(s.bpm);
  if(s.showDynamics != null){ showDynamics = s.showDynamics; document.querySelectorAll('#dynToggle button').forEach(b=> b.classList.toggle('on', (b.dataset.dyn === 'show') === showDynamics)); }
  invalidateSheets(); render(); syncEditorView(); contentChanged();
  return true;
}
function restoreSession(){
  try{ const raw = localStorage.getItem(SESSION_KEY); return raw ? restoreState(JSON.parse(raw)) : false; }
  catch(_){ return false; }
}
function saveProject(){
  const m = document.getElementById('editmsg');
  if(!hasMusic()){ if(m) m.textContent = 'Nothing to save yet.'; return; }
  downloadBlob(new Blob([JSON.stringify(sessionState())], {type:'application/json'}), safeName(pieceName || 'project') + '.solfege.json');
  if(m) m.textContent = 'Project saved.';
}
function openProject(file){
  const r = new FileReader();
  r.onload = ()=>{
    try{ if(restoreState(JSON.parse(r.result))){ autosave(); switchTab('player'); } else alert('That file has no parts to open.'); }
    catch(e){ alert('Could not open project: ' + e.message); }
  };
  r.readAsText(file);
}

// True when the Edit tab is the one on screen. Used to keep the editor in sync
// with content loaded/transposed from controls that live outside it (file load,
// the melody box, presets, key/transpose), so it never needs a tab bounce to refresh.
function editVisible(){ const v = document.getElementById('view-edit'); return !!(v && !v.hidden); }
function syncEditorView(){ if(editVisible()){ renderEditor(); scheduleEditPreview(); } }
function playerVisible(){ const v = document.getElementById('view-player'); return !!(v && !v.hidden); }

// Show a tab by name (and refresh the editor when entering it).
function switchTab(view){
  document.querySelectorAll('#tabs .tab').forEach(x=> x.classList.toggle('on', x.dataset.view === view));
  document.querySelectorAll('.view').forEach(s=> s.hidden = (s.id !== 'view-' + view));
  if(view !== 'edit'){ const ban = document.getElementById('omrbanner'); if(ban) ban.hidden = true; }
  if(view === 'edit'){ renderEditor(); renderEditPreview(); }
  if(view === 'player') render();   // now visible: engrave any per-part sheets that were deferred while hidden
}

// Phase 5: after OMR, land in the editor with a "check me" banner before the player.
function enterReviewMode(){
  editSel = tracks.length ? {trackId: tracks[0].id, index: 0} : null;
  switchTab('edit');
  const ban = document.getElementById('omrbanner');
  if(!ban) return;
  const span = ban.querySelector('span');
  if(span) span.textContent = 'Transcribed from your image. OMR is not perfect: review each part (very short ones are flagged as likely slips), fix any wrong notes, then send it to the player.';
  ban.hidden = false;
}
function setMeterFromUI(){
  pushUndo();
  meterBeats = parseInt(document.getElementById('edBeats').value) || 4;
  meterType = parseInt(document.getElementById('edBeatType').value) || 4;
  afterEdit();
}

/* ---- Phase 3: click-to-select + drag-to-nudge on the preview staff ---- */
const LETTERS7 = ['C','D','E','F','G','A','B'];
// Move a note by `steps` diatonic letter-steps (octave wraps; accidental kept).
function nudgePitch(n, steps){
  if(n.isRest || !steps) return;
  const ni = LETTERS7.indexOf(n.step) + steps;
  n.oct = (n.oct||5) + Math.floor(ni/7);
  n.step = LETTERS7[((ni % 7) + 7) % 7];
}
function previewPitchName(n, steps){
  const ni = LETTERS7.indexOf(n.step) + steps;
  const oct = (n.oct||5) + Math.floor(ni/7);
  const step = LETTERS7[((ni % 7) + 7) % 7];
  const acc = n.alter > 0 ? '#'.repeat(n.alter) : n.alter < 0 ? 'b'.repeat(-n.alter) : '';
  return step + acc + oct;
}
// Pixel point -> OSMD unit point within a given page <svg>.
function pixelToUnit(svg, clientX, clientY){
  const r = svg.getBoundingClientRect();
  const u = (editOsmd.EngravingRules && editOsmd.EngravingRules.UnitInPixels) || 10;
  return new opensheetmusicdisplay.PointF2D((clientX - r.left) / u, (clientY - r.top) / u);
}
// Map an OSMD click to {trackId, index} in our model (by instrument index + beat).
function noteAtPoint(pt){
  let gn = null;
  try{ gn = editOsmd.GraphicSheet.GetNearestNote(pt, 6); }catch(_){}
  if(!gn || !gn.sourceNote) return null;
  let pi = -1;
  try{ pi = editOsmd.Sheet.Instruments.indexOf(gn.sourceNote.ParentVoiceEntry.ParentVoice.Parent); }catch(_){}
  if(pi < 0 || pi >= tracks.length) return null;
  const beat = gn.sourceNote.getAbsoluteTimestamp().RealValue * 4;
  const notes = tracks[pi].notes;
  let idx = notes.findIndex(n=> beat >= n.startBeat - 1e-6 && beat < n.startBeat + n.durBeat - 1e-6);
  if(idx < 0){ let best = Infinity; notes.forEach((n,i)=>{ const d = Math.abs(n.startBeat - beat); if(d < best){ best = d; idx = i; } }); }
  return idx < 0 ? null : {trackId: tracks[pi].id, index: idx};
}
function clearStaffHighlight(){ document.querySelectorAll('#editsheet .ednote-sel').forEach(el=> el.classList.remove('ednote-sel')); }
function highlightEditorSelection(){
  clearStaffHighlight();
  if(!editOsmd || !editSel) return;
  const ti = tracks.findIndex(t=> t.id === editSel.trackId); if(ti < 0) return;
  const sel = tracks[ti].notes[editSel.index]; if(!sel) return;
  try{
    editOsmd.GraphicSheet.MeasureList.forEach(row=>{
      const gm = row[ti]; if(!gm) return;
      gm.staffEntries.forEach(se=> se.graphicalVoiceEntries.forEach(gve=> gve.notes.forEach(gn=>{
        const beat = gn.sourceNote.getAbsoluteTimestamp().RealValue * 4;
        if(beat >= sel.startBeat - 1e-6 && beat < sel.startBeat + sel.durBeat - 1e-6){
          const el = gn.getSVGGElement && gn.getSVGGElement(); if(el) el.classList.add('ednote-sel');
        }
      })));
    });
  }catch(_){}
}

let dragState = null, dragLabelEl = null;
function showDragLabel(x, y, text){
  if(!dragLabelEl){ dragLabelEl = document.createElement('div'); dragLabelEl.className = 'draglabel'; document.body.appendChild(dragLabelEl); }
  dragLabelEl.textContent = text; dragLabelEl.style.left = x + 'px'; dragLabelEl.style.top = y + 'px'; dragLabelEl.hidden = false;
}
function hideDragLabel(){ if(dragLabelEl) dragLabelEl.hidden = true; }
const DRAG_STEP_PX = 8;   // vertical pixels per diatonic step while dragging

function initStaffEditing(){
  const box = document.getElementById('editsheet'); if(!box) return;
  box.addEventListener('mousedown', e=>{
    if(!editOsmd) return;
    const svg = e.target.closest('svg'); if(!svg) return;
    const hit = noteAtPoint(pixelToUnit(svg, e.clientX, e.clientY)); if(!hit) return;
    editSel = hit; renderEditor(); highlightEditorSelection();
    const n = selectedNote();
    if(n && !n.isRest){ if(!isPlaying) auditionNote(n); dragState = {startY: e.clientY, n}; e.preventDefault(); }
  });
  document.addEventListener('mousemove', e=>{
    if(!dragState) return;
    const steps = Math.round((dragState.startY - e.clientY) / DRAG_STEP_PX);
    showDragLabel(e.clientX, e.clientY, steps ? '→ ' + previewPitchName(dragState.n, steps) : dragState.n.name);
  });
  document.addEventListener('mouseup', e=>{
    if(!dragState) return;
    const steps = Math.round((dragState.startY - e.clientY) / DRAG_STEP_PX);
    hideDragLabel();
    const n = dragState.n; dragState = null;
    if(steps){ pushUndo(); nudgePitch(n, steps); afterEdit(); }
  });
}

/* ---------- wiring ---------- */
document.getElementById('allmp3').addEventListener('click', e=> exportAllMp3(e.currentTarget));
document.getElementById('mixmp3').addEventListener('click', e=> exportMixMp3(e.currentTarget));
document.getElementById('allpng').addEventListener('click', e=> exportAllPng(e.currentTarget));
document.getElementById('rendersheet').addEventListener('click', renderScore);
document.getElementById('savexml').addEventListener('click', downloadMusicXML);
document.getElementById('savepng').addEventListener('click', downloadScorePNG);
document.getElementById('savepdf').addEventListener('click', downloadScorePDF);
document.querySelectorAll('#masterview button').forEach(b=> b.addEventListener('click', ()=> setAllPartView(b.dataset.m)));
document.querySelectorAll('#dynToggle button').forEach(b=> b.addEventListener('click', ()=> setDynamics(b.dataset.dyn === 'show')));
document.getElementById('trup').addEventListener('click', ()=> transposeBy(1));
document.getElementById('trdown').addEventListener('click', ()=> transposeBy(-1));
document.querySelectorAll('#tabs .tab').forEach(b=> b.addEventListener('click', ()=> switchTab(b.dataset.view)));
document.getElementById('omrDone').addEventListener('click', ()=> switchTab('player'));
// Click a notehead on the player staves or the full score to seek there (like the
// solfa cells). Delegated, so it works for cached/re-rendered sheets.
function seekFromSheetClick(e){
  const el = e.target.closest && e.target.closest('.sheetnote');
  if(el && el.dataset.b0 !== undefined) seek(parseFloat(el.dataset.b0), true);
}
document.getElementById('stave').addEventListener('click', seekFromSheetClick);
document.getElementById('sheet').addEventListener('click', seekFromSheetClick);
// Editor controls
document.getElementById('edNew').addEventListener('click', newPiece);
document.getElementById('edSATB').addEventListener('click', newSATB);
document.getElementById('edAddPart').addEventListener('click', addPart);
document.getElementById('edUndo').addEventListener('click', undo);
document.getElementById('edSaveProj').addEventListener('click', saveProject);
document.getElementById('edOpenProj').addEventListener('click', ()=> document.getElementById('projfile').click());
document.getElementById('projfile').addEventListener('change', e=>{ if(e.target.files[0]) openProject(e.target.files[0]); e.target.value = ''; });
document.getElementById('edBeats').addEventListener('change', setMeterFromUI);
document.getElementById('edBeatType').addEventListener('change', setMeterFromUI);
document.getElementById('edTitle').addEventListener('input', e=>{ pieceName = e.target.value; scheduleEditPreview(); });
initStaffEditing();
document.getElementById('tplay').addEventListener('click', togglePlay);
document.getElementById('tback').addEventListener('click', ()=>step(-1));
document.getElementById('tfwd').addEventListener('click', ()=>step(1));
const scrub = document.getElementById('scrub');
scrub.addEventListener('input', e=>{ isScrubbing = true; seek(parseFloat(e.target.value)*endBeat, !isPlaying); });
scrub.addEventListener('change', ()=>{ isScrubbing = false; });
document.getElementById('bpm').addEventListener('input', e=>{
  document.getElementById('bpmval').textContent = e.target.value;
  if(isPlaying){ const beat = Tone.Transport.seconds / bs; buildPart(); Tone.Transport.seconds = beat * bs; }  // keep position, new tempo
  else dirty = true;
  autosave();
});
// Keyboard transport (ignored while typing in a field)
document.addEventListener('keydown', e=>{
  const tag = (e.target.tagName || '').toLowerCase();
  if(tag==='textarea' || tag==='input' || tag==='select') return;
  if((e.metaKey || e.ctrlKey) && e.code==='KeyZ'){ e.preventDefault(); undo(); return; }
  // In the editor with a note selected, up/down nudge its pitch a diatonic step.
  const inEditor = !document.getElementById('view-edit').hidden;
  if(inEditor && editSel && (e.code==='ArrowUp' || e.code==='ArrowDown')){
    const n = selectedNote();
    if(n && !n.isRest){ e.preventDefault(); pushUndo(); nudgePitch(n, e.code==='ArrowUp' ? 1 : -1); afterEdit(); }
    return;
  }
  if(e.code==='Space'){ e.preventDefault(); togglePlay(); }
  else if(e.code==='ArrowRight'){ e.preventDefault(); step(1); }
  else if(e.code==='ArrowLeft'){ e.preventDefault(); step(-1); }
});
// Movable-do: choosing a key transposes the music into it (so a major scale still
// reads do-re-mi), rather than re-spelling the same pitches into chromatic degrees.
keySel.addEventListener('change', ()=>{
  const selPc = parseInt(keySel.value);
  let d = ((selPc - currentTonic.pc) % 12 + 12) % 12; if(d > 6) d -= 12;   // nearest direction
  if(d === 0){ syncTonicFromSel(); return; }
  if(tracks.length){ transposeBy(d); } else { syncTonicFromSel(); render(); }
  autosave();
});
// The melody box rebuilds the piece only on Re-parse (or an example button), not
// on every keystroke -- typing no longer silently clobbers a multi-part piece.
document.getElementById('parsebtn').addEventListener('click', buildManual);
document.getElementById('xmlbtn').addEventListener('click', ()=>{ pieceName=''; loadMusicXMLText(document.getElementById('xml').value.trim(), document.getElementById('xmlmsg')); });
document.getElementById('loadfilebtn').addEventListener('click', ()=>{
  const f = document.getElementById('musicfile').files[0];
  const msg = document.getElementById('filemsg');
  if(!f){ msg.textContent='Choose a file first.'; return; }
  loadFile(f, msg);
});
document.getElementById('musicfile').addEventListener('change', e=>{ if(e.target.files[0]) loadFile(e.target.files[0], document.getElementById('filemsg')); });
document.getElementById('photobtn').addEventListener('click', ()=>{
  const f = document.getElementById('photo').files[0];
  const msg = document.getElementById('photomsg');
  if(!f){ msg.textContent='Choose an image first.'; return; }
  transcribePhoto(f, msg);
});
document.querySelectorAll('.ghost[data-ex]').forEach(b=>b.addEventListener('click',()=>{
  document.getElementById('notes').value = b.dataset.ex;
  setKey(parseInt(b.dataset.k));
  buildManual();
}));
document.querySelectorAll('#vowel button').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#vowel button').forEach(x=>x.classList.remove('on'));
  b.classList.add('on'); vowel=b.dataset.v; applyVowel();
}));
// Paste a screenshot anywhere (⌘V) -> transcribe it via the local backend.
document.addEventListener('paste', e=>{
  const items = e.clipboardData && e.clipboardData.items;
  if(!items) return;
  for(const it of items){
    if(it.type && it.type.startsWith('image/')){
      const file = it.getAsFile();
      if(file){
        e.preventDefault();
        const d = document.getElementById('photo').closest('details'); if(d) d.open = true;
        transcribePhoto(file, document.getElementById('photomsg'));
      }
      return;
    }
  }
});
document.querySelectorAll('#timbre button').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#timbre button').forEach(x=>x.classList.remove('on'));
  b.classList.add('on');
  useChoir = b.dataset.t === 'choir';
  const msg = document.getElementById('timbremsg');
  if(useChoir){ initAudio(); initChoir(); if(choirReady) msg.textContent='Choir samples loaded ✓'; }
  else { msg.textContent = ''; }
}));

// Fill static buttons that declared an icon (e.g. transport, exports). Dynamic
// buttons (carets, play/pause) set their icon in JS where their state changes.
document.querySelectorAll('[data-icon]').forEach(el=> el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon)));

// Restore the last working piece if there is one; otherwise the default melody.
if(!restoreSession()) buildManual();
