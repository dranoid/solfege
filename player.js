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
  'wrench':       '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  'film':         '<rect x="2.5" y="4" width="19" height="16" rx="2"/><line x1="7" y1="4" x2="7" y2="20"/><line x1="17" y1="4" x2="17" y2="20"/><line x1="2.5" y1="12" x2="21.5" y2="12"/><line x1="2.5" y1="8" x2="7" y2="8"/><line x1="17" y1="8" x2="21.5" y2="8"/><line x1="2.5" y1="16" x2="7" y2="16"/><line x1="17" y1="16" x2="21.5" y2="16"/>',
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
let transposeOffset = 0;   // semitones shifted from the file's original key (drives the engraved-sheet transpose for imports)
let homeOffset = 0;        // the transposeOffset that counts as "Transpose 0": set when you pick a key, so the
                           // Transpose readout shows steps from your chosen home key, not from C / the file key
function displayTranspose(){ return transposeOffset - homeOffset; }   // the user-facing transpose number
let edited = false;        // true once the notes have been edited/built (sheets then come from the serializer, not lastXML)
let editSel = null;        // {trackId, index} primary/anchor note selected in the editor
let multiSel = null;       // {trackId, set:Set<index>} when 2+ notes are selected in one part (bulk edit)
let noteClip = null;       // deep-copied notes on the clipboard (copy/paste within & across parts)
let meterBeats = 4, meterType = 4;   // piece meter (parsed from imports; editable in the editor)
let pickupBeats = 0;   // anacrusis/lead-in: quarter-note beats in the short first (pickup) bar, 0 = none

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
  exitReview();
  pieceName = ''; lastXML = ''; transposeOffset = 0; homeOffset = 0; pickupBeats = 0; edited = false; meterBeats = 4; meterType = 4; resetSheets();
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
    const clefByStaff = {};   // staff number -> clef name, so each voice keeps its written clef
    [...part.querySelectorAll('measure')].forEach(measure=>{
      const d = measure.querySelector('attributes divisions');
      if(d) divisions = parseInt(d.textContent) || divisions;
      [...measure.querySelectorAll(':scope > attributes > clef')].forEach(cl=>{
        const num = cl.getAttribute('number') || '1';
        const name = clefNameFrom(cl.querySelector('sign')?.textContent, cl.querySelector('line')?.textContent);
        if(name && !clefByStaff[num]) clefByStaff[num] = name;
      });
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
            if(!t){ t = {key, notes:[], sum:0, cnt:0, clef: clefByStaff[staff] || null}; map.set(key, t); }
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
    exitReview();   // a fresh load clears any prior OMR review state (transcribePhoto re-enters it after)
    const doc = new DOMParser().parseFromString(txt, 'application/xml');
    if(doc.querySelector('parsererror')) throw new Error('invalid XML');
    lastXML = txt; transposeOffset = 0; homeOffset = 0; pickupBeats = 0; edited = false; resetSheets();   // keep raw XML for the sheet-music view
    if(!pieceName){ const ti = doc.querySelector('work-title, movement-title'); if(ti && ti.textContent.trim()) pieceName = ti.textContent.trim(); }
    const fifthsEl = doc.querySelector('key fifths');
    if(fifthsEl){ const f = FIFTHS[fifthsEl.textContent.trim()]; if(f) setKey(f[0], f[1]); }
    const tb = parseInt(doc.querySelector('time beats')?.textContent), tt = parseInt(doc.querySelector('time beat-type')?.textContent);
    meterBeats = tb > 0 ? tb : 4; meterType = tt > 0 ? tt : 4;   // piece meter for the serializer
    const tempo = readTempo(doc); const setT = tempo ? setTempo(tempo) : null;
    const built = parseParts(doc);
    if(!built.length) throw new Error('no notes found');
    tracks = built; soloActive = false; render(); contentChanged();
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
  exitReview();
  lastXML = ''; transposeOffset = 0; homeOffset = 0; pickupBeats = 0; edited = false; meterBeats = 4; meterType = 4; resetSheets();   // MIDI has no original notation; the serializer engraves it
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
  tracks = labelTracks(out); soloActive = false; render(); contentChanged();
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
  // Preserve each part's engraved-staff scroll (live preview / sheet view) across
  // the rebuild, so editing a note deep in the staff doesn't jump back to the top.
  stave.querySelectorAll('.voice[data-tid]').forEach(r=>{
    const box = r.querySelector('.voicebox'), t = trackById(r.dataset.tid);
    if(box && t) t._previewScroll = box.scrollTop;
  });
  stave.innerHTML = '';
  const tbar = document.getElementById('transportbar'); if(tbar) tbar.hidden = !tracks.length;
  const tv = document.getElementById('trval'); if(tv){ const d = displayTranspose(); tv.textContent = (d>0?'+':'') + d; }
  const multi = tracks.length > 1;
  // During OMR review, flag very short parts (likely slips) right on the player rows.
  const suspectIds = reviewMode ? new Set(suspectParts().map(s=> s.id)) : new Set();
  tracks.forEach(t=>{
    const muted = soloActive ? !t.solo : !t.enabled;
    const row = document.createElement('div');
    row.dataset.tid = t.id;   // lets the next render() find this row to restore its staff scroll
    row.className = 'voice' + (muted ? ' muted' : '') + (t.collapsed ? ' collapsed' : '') + (suspectIds.has(t.id) ? ' suspect' : '');
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
    // label is a span (so the row is still findable by its text); in edit mode it's
    // contenteditable for in-place renaming. No re-render on input, to keep the caret.
    const lab = document.createElement('span'); lab.className = 'vlabel'; lab.textContent = t.label;
    if(t.editing){
      lab.classList.add('vlabel-edit'); lab.contentEditable = 'true'; lab.title = 'Click to rename this part';
      lab.oninput = ()=>{ t.label = lab.textContent; updatePlayScope(); autosave(); };
      lab.onkeydown = e=>{ if(e.key === 'Enter'){ e.preventDefault(); lab.blur(); } };
    }
    // per-part Solfa / Sheet toggle - Sheet needs engravable MusicXML for this voice
    const tog = document.createElement('div'); tog.className = 'vbtns';
    const tSolfa = document.createElement('button'); tSolfa.textContent = 'Solfa'; if(t.view !== 'sheet') tSolfa.classList.add('on');
    tSolfa.onclick = ()=>{ t.view = 'solfa'; render(); };
    const tSheet = document.createElement('button'); tSheet.textContent = 'Sheet'; if(t.view === 'sheet') tSheet.classList.add('on');
    if(canSheet(t)){ tSheet.onclick = ()=>{ t.view = 'sheet'; render(); }; }
    else { tSheet.disabled = true; tSheet.style.opacity = '0.4'; tSheet.style.cursor = 'not-allowed'; tSheet.title = 'Sheet needs MusicXML (this part has no engravable notation)'; }
    tog.append(tSolfa, tSheet);
    // Inline note editing right here in the player - fix a note where you see/hear
    // it, no tab bounce. Toggles this part's chip strip + note editor under the row.
    const edit = document.createElement('button'); edit.className = 'vedit' + (t.editing ? ' on' : ''); edit.textContent = 'Edit';
    edit.title = t.editing ? 'Done editing this part' : 'Edit this part’s notes';
    edit.onclick = ()=>{
      t.editing = !t.editing;
      if(t.editing && !(editSel && editSel.trackId === t.id))
        editSel = {trackId:t.id, index: Math.max(0, Math.min(editSel ? editSel.index : 0, t.notes.length - 1))};
      render();
    };
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
    const vid = document.createElement('button'); vid.className='vvideo'; vid.innerHTML=icon('film')+'Video'; vid.title='Download this part as a video (the grid scrolls in time with the sound, shareable on WhatsApp)';
    vid.onclick = ()=> exportTrackVideo(t, vid);
    btns.append(vol, mp3, png, vid);
    if(t.editing){   // part-level actions live in edit mode (undoable), replacing the old Edit-tab buttons
      const clefSel = document.createElement('select'); clefSel.className = 'clefpick'; clefSel.title = 'Clef for this part';
      ['auto','treble','bass','alto','tenor'].forEach(c=>{
        const o = document.createElement('option'); o.value = c; o.textContent = CLEF_LABELS[c];
        if((t.clef || 'auto') === c) o.selected = true; clefSel.append(o);
      });
      clefSel.onchange = ()=>{ pushUndo(); t.clef = clefSel.value === 'auto' ? null : clefSel.value; afterEdit(); };
      const dup = document.createElement('button'); dup.className = 'duppart'; dup.textContent = 'Duplicate'; dup.title = 'Duplicate this part';
      dup.onclick = ()=> duplicatePart(t);
      const del = document.createElement('button'); del.className = 'delpart'; del.textContent = 'Delete part'; del.title = 'Delete this part';
      del.onclick = ()=>{ pushUndo(); tracks = tracks.filter(x=> x !== t); if(editSel && editSel.trackId === t.id) editSel = null; afterEdit(); };
      btns.append(clefSel, dup, del);
    }
    head.append(caret, vplay, lab);
    if(suspectIds.has(t.id)){
      const sb = document.createElement('span'); sb.className = 'suspectbadge';
      sb.textContent = 'likely OMR slip'; sb.title = 'Very short part. Fix it, or use the "Remove flagged" button to delete it.';
      head.append(sb);
    }
    head.append(tog, edit, btns);
    row.append(head);
    if(t.view === 'sheet' && canSheet(t)){
      // engraved staff for this one part, themed to the page; cached SVG so solo/mute don't re-render OSMD
      const box = document.createElement('div'); box.className = 'voicebox';
      if(t._sheetHTML && t._sheetKey === transposeOffset){ box.innerHTML = t._sheetHTML; }   // scroll restored after append (below)
      // OSMD can't measure a hidden (display:none) container, so it would cache a
      // blank staff. Only render while the player view is on screen; switchTab
      // re-renders these when you come back to it.
      else if(playerVisible()){ box.innerHTML = '<p class="hint" style="margin:4px">Rendering staff…</p>'; renderPartSheet(t, box); }
      else { box.innerHTML = '<p class="hint" style="margin:4px">Staff updates when you open the Player tab.</p>'; }
      row.append(box);
    } else {
      const cells = document.createElement('div'); cells.className = 'stave-row';
      const selSet = t.editing ? selectionSetFor(t.id) : null;
      const marks = phrasingMarks(t);   // slur/tie indicators on the grid (shown in play mode too)
      // Notes joined by a slur or tie are wrapped in a no-wrap group so a phrase
      // never breaks across grid lines (its arc stays in one piece). links.has(i)
      // means note i connects to i+1.
      const links = new Set([...marks.slurLinks, ...marks.tieStarts]);
      // barlines fall at pickupBeats, +1 bar, +2 bars ... so you can see the metre
      const bb = barBeats(), pk = pickupBeats;
      const onBar = (x)=>{ if(!(bb>0) || x < pk - 1e-6) return false; const r = (((x-pk)%bb)+bb)%bb; return r < 1e-6 || bb - r < 1e-6; };
      let group = null;
      t.notes.forEach((n,i)=>{
        const el = document.createElement('div');
        const sel = selSet && selSet.has(i);
        el.className = 'note' + (n.isRest ? ' rest' : '') + (sel ? ' sel' : '')
          + (marks.slurred.has(i) ? ' slurred' : '') + (marks.slurLinks.has(i) ? ' slurlink' : '')
          + (marks.tied.has(i) ? ' tied' : '') + (marks.tieStarts.has(i) ? ' tiestart' : '');
        el.id = t.id + '-' + i;
        // in edit mode show the duration (so you can read/fix rhythm); otherwise the scale degree
        if(n.isRest){ el.innerHTML = `<span class="solf">–</span><span class="nm">rest</span>` + (t.editing ? `<span class="dur">${durAbbr(n.durBeat)}</span>` : ''); }
        else { const a = analyze(n); el.innerHTML = `<span class="solf">${a.syl}</span><span class="nm">${n.name}</span>` + (t.editing ? `<span class="dur">${durAbbr(n.durBeat)}</span>` : `<span class="deg">${a.deg}</span>`); }
        if(t.editing){ el.title = 'Click to edit · Shift-click to select a run · Cmd/Ctrl-click to toggle'; el.onclick = (e)=> selectChip(t.id, i, n, e); }
        else { el.title = 'Click to start here'; el.addEventListener('click', ()=> seek(n.startBeat, true)); }  // click-to-seek
        let target;
        if(links.has(i) || links.has(i-1)){   // part of a phrasing chain -> keep it on one line
          if(!links.has(i-1)){ group = document.createElement('div'); group.className = 'phrasegroup'; cells.append(group); }
          target = group;
        } else { group = null; target = cells; }
        target.append(el);
        // a barline after any note that ends exactly on a bar boundary (skip the final one)
        if(i < t.notes.length-1 && onBar((n.startBeat||0) + (n.durBeat||0))){
          const bl = document.createElement('div'); bl.className = 'barline'; target.append(bl);
        }
      });
      if(t.editing){
        const add = document.createElement('div'); add.className = 'note addnote'; add.textContent = '+'; add.title = 'Add a note to the end of this part';
        add.onclick = ()=>{ pushUndo(); t.notes.push(defaultNote(t.notes[t.notes.length-1])); editSel = {trackId:t.id, index:t.notes.length-1}; afterEdit(); };
        cells.append(add);
      }
      // incomplete-bar nudge: if the notes don't add up to whole bars (after any pickup),
      // flag how short the last bar is, so a missed/extra beat is visible.
      const total = t.notes.reduce((s,n)=> s + (n.durBeat||0), 0), musical = total - pk;
      const rem = bb>0 ? ((musical % bb) + bb) % bb : 0;
      if(bb>0 && musical > 1e-6 && rem > 1e-6 && bb - rem > 1e-6){
        const trim = (x)=> String(+x.toFixed(3));
        const w = document.createElement('span'); w.className = 'barwarn';
        w.textContent = 'last bar ' + trim(rem) + '/' + trim(bb);
        w.title = 'The last bar is not full (did you miss a beat?). If the piece starts with a pickup, select its lead-in note and click "Lead-in".';
        cells.append(w);
      }
      row.append(cells);
    }
    if(t.editing){
      // Live engraved preview so you see the note on the staff while you edit the
      // grid. In sheet view the body staff IS the preview; in solfa view add one.
      if(t.view !== 'sheet' && canSheet(t)){
        const cap = document.createElement('div'); cap.className = 'previewcap'; cap.textContent = 'Live preview';
        const pv = document.createElement('div'); pv.className = 'voicebox editpreview';
        if(t._sheetHTML && t._sheetKey === transposeOffset){ pv.innerHTML = t._sheetHTML; }   // scroll restored after append (below)
        else if(playerVisible()){ pv.innerHTML = '<p class="hint" style="margin:4px">Rendering staff…</p>'; renderPartSheet(t, pv); }
        else { pv.innerHTML = '<p class="hint" style="margin:4px">Staff updates when you open the Player tab.</p>'; }
        row.append(cap, pv);
      }
      // Under the row: a bulk-edit bar when 2+ notes are selected, else the single-note editor.
      const sel = selectionSetFor(t.id);
      if(sel.size >= 2){
        const bb = document.createElement('div'); bb.className = 'noteeditor bulkbar';
        renderBulkBar(bb, t, sel.size);
        row.append(bb);
      } else if(editSel && editSel.trackId === t.id && t.notes[editSel.index]){
        const ne = document.createElement('div'); ne.className = 'noteeditor';
        renderNoteEditor(ne);
        row.append(ne);
      }
    }
    stave.append(row);
  });
  // Restore each part's staff scroll now that the rows are in the DOM. (Setting
  // scrollTop on a detached element is a no-op, so it must happen post-append; the
  // async renderPartSheet path restores its own once it finishes.)
  tracks.forEach(t=>{
    if(!t._previewScroll) return;
    const r = stave.querySelector('.voice[data-tid="'+t.id+'"]'), box = r && r.querySelector('.voicebox');
    if(box && box.querySelector('svg')) box.scrollTop = t._previewScroll;   // only when the staff is actually drawn
  });
  updateMasterView();
  updatePlayScope();   // reflect solo/mute/audition in the transport scope label
  // keep the Tools fields in step with the current piece (they used to live in the Edit tab)
  const tEl = document.getElementById('edTitle'); if(tEl && document.activeElement !== tEl) tEl.value = pieceName || '';
  const bEl = document.getElementById('edBeats'); if(bEl) bEl.value = String(meterBeats);
  const btEl = document.getElementById('edBeatType'); if(btEl) btEl.value = String(meterType);
  repaintPlayhead();   // keep the paused/playing note lit across re-renders (e.g. solfa<->sheet)
  repaintSelection();  // outline the selected note on the per-part staff while editing
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

// The notes a part actually SOUNDS: tied same-pitch runs merged into one sustained
// attack, and slurred (or tied) notes played legato (full length, no gap) so a
// phrase doesn't sound like separate notes. `spb` = seconds per beat. Returns
// [{name, time, dur}] in seconds.
function playableEvents(t, spb){
  const slurred = phrasingMarks(t).slurred;
  const notes = t.notes || [], out = [];
  for(let i=0;i<notes.length;i++){
    const n = notes[i]; if(n.isRest) continue;
    let j = i, durBeats = n.durBeat;
    while(notes[j].tieNext && notes[j+1] && !notes[j+1].isRest && notes[j+1].midi === notes[j].midi){
      j++; durBeats += notes[j].durBeat;   // merge the tied run into one held note
    }
    const legato = i !== j || slurred.has(i);   // tied group OR under a slur -> no gap
    out.push({ name:n.name, time:n.startBeat*spb, dur:Math.max(0.05, durBeats*spb*(legato ? 1 : 0.95)) });
    i = j;
  }
  return out;
}

function buildPart(){
  if(part){ part.dispose(); part=null; }
  bs = 60 / parseInt(document.getElementById('bpm').value);
  const active = activeTracks();
  const events = []; endBeat = 0;
  active.forEach(t=>{
    t.notes.forEach(n=> endBeat = Math.max(endBeat, n.startBeat + n.durBeat));
    playableEvents(t, bs).forEach(e=> events.push({time:e.time, note:e.name, dur:e.dur, trackId:t.id}));
  });
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
  // solfa cells (player) - one element per note, id'd uniquely under #stave
  tracks.forEach(t=> t.notes.forEach((n,i)=>{
    const lit = on.has(t.id) && beat >= n.startBeat-1e-6 && beat < n.startBeat+n.durBeat-1e-6;
    const el = document.getElementById(t.id+'-'+i); if(el) el.classList.toggle('active', lit);
  }));
  // editable chips (the Edit tab AND the Player's per-part edit mode) - matched by
  // data attrs so the same note can be shown in two places without id collisions.
  document.querySelectorAll('.echip[data-tid]').forEach(c=>{
    const t = trackById(c.dataset.tid); const n = t && t.notes[+c.dataset.i];
    const lit = !!n && on.has(t.id) && beat >= n.startBeat-1e-6 && beat < n.startBeat+n.durBeat-1e-6;
    c.classList.toggle('eplaying', lit);
  });
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
// Outline the selected note on any per-part staff (the editable body staff in sheet
// view, or the live preview in solfa view) so edit selection shows on the engraving
// too, not just the grid. Noteheads already carry data-tid/data-b0 from tagSheetNotes.
function repaintSelection(){
  document.querySelectorAll('#stave .sheetnote.selnote').forEach(el=> el.classList.remove('selnote'));
  const tid = editSel && editSel.trackId; if(!tid) return;
  const t = trackById(tid); if(!t || !t.editing) return;
  // beats of every selected note (the whole multi-selection, not just the anchor)
  const beats = [...selectionSetFor(tid)].map(i=> t.notes[i]).filter(n=> n && !n.isRest).map(n=> n.startBeat);
  if(!beats.length) return;
  document.querySelectorAll('#stave .sheetnote[data-tid="'+tid+'"]').forEach(el=>{
    const b0 = parseFloat(el.dataset.b0);
    if(beats.some(b=> Math.abs(b0 - b) < 1e-3)) el.classList.add('selnote');
  });
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

// Save a blob, asking the user WHERE when the browser supports it (File System
// Access API, Chromium on https/localhost). Elsewhere (Firefox/Safari) it falls
// back to the usual auto-download into the Downloads folder. `accept` is optional
// {desc, mime, ext:[...]} to label the file type in the picker. Returns true if
// written, false if the user cancelled the picker. Must run in a click handler.
async function saveBlob(blob, filename, accept){
  if(window.showSaveFilePicker){
    try{
      const opts = { suggestedName: filename };
      if(accept) opts.types = [{ description: accept.desc, accept: { [accept.mime]: accept.ext } }];
      const handle = await window.showSaveFilePicker(opts);
      const w = await handle.createWritable();
      await w.write(blob); await w.close();
      return true;
    }catch(e){
      if(e && e.name === 'AbortError') return false;   // user cancelled, leave things be
      // anything else (blocked, insecure context): fall back to a plain download
    }
  }
  downloadBlob(blob, filename);
  return true;
}

// For a bulk export ("All parts as …"): ask ONCE for a destination folder instead
// of prompting per file. Returns a directory handle to write into, 'cancel' if the
// user dismissed the folder picker, or null when unsupported (caller then falls
// back to auto-downloading each file into Downloads).
async function pickExportDir(){
  if(!window.showDirectoryPicker) return null;
  try{ return await window.showDirectoryPicker({ mode: 'readwrite' }); }
  catch(e){ if(e && e.name === 'AbortError') return 'cancel'; return null; }
}
async function writeToDir(dir, blob, filename){
  const h = await dir.getFileHandle(filename, { create: true });
  const w = await h.createWritable(); await w.write(blob); await w.close();
}
// Deliver one exported file to its destination: a directory handle (bulk), the
// string 'download' (straight to Downloads), or undefined (ask via the picker).
async function deliver(blob, filename, dest, accept){
  if(dest && dest.getFileHandle){ await writeToDir(dest, blob, filename); return true; }
  if(dest === 'download'){ downloadBlob(blob, filename); return true; }
  return await saveBlob(blob, filename, accept);
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
      playableEvents(t, eb).forEach(e=> inst.triggerAttackRelease(e.name, e.dur, e.time, vel));   // honour ties/slurs
    });
  }, end + 0.8, 1);   // 1 = mono
}

// One part -> MP3 (small + shareable on WhatsApp). `dest`: undefined asks via the
// picker (single per-part button); a directory handle or 'download' is passed by
// the export-all loop so it doesn't prompt once per part.
async function exportTrackMp3(track, btn, dest){
  const original = btn ? btn.innerHTML : '';
  if(!window.lamejs){ alert('MP3 encoder failed to load (check your connection).'); return; }
  if(btn){ btn.textContent = '…'; btn.disabled = true; }
  try{
    const rendered = await renderTracksToBuffer([track]);
    const blob = audioBufferToMp3(rendered.get()), name = safeName(exportBase(track)) + '.mp3';
    await deliver(blob, name, dest, {desc:'MP3 audio', mime:'audio/mpeg', ext:['.mp3']});
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
    await saveBlob(audioBufferToMp3(rendered.get()), safeName((pieceName ? pieceName + '-' : '') + 'full-mix') + '.mp3',
      {desc:'MP3 audio', mime:'audio/mpeg', ext:['.mp3']});
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
  const dir = await pickExportDir();
  if(dir === 'cancel') return;                  // user backed out of the folder picker
  const dest = dir || 'download';               // a folder if picked, else straight to Downloads
  const orig = btn.innerHTML; btn.disabled = true;
  for(let i=0;i<tracks.length;i++){ btn.textContent = `Rendering ${i+1}/${tracks.length}…`; await exportTrackMp3(tracks[i], null, dest); }
  btn.innerHTML = orig; btn.disabled = false;
}
async function exportAllPng(btn){
  if(!tracks.length) return;
  const dir = await pickExportDir();
  if(dir === 'cancel') return;
  const dest = dir || 'download';
  const orig = btn.innerHTML; btn.disabled = true;
  for(let i=0;i<tracks.length;i++){
    btn.textContent = `Saving ${i+1}/${tracks.length}…`;
    await exportTrackPng(tracks[i], dest);
    if(!dir) await new Promise(r=> setTimeout(r, 450));   // only the download fallback needs a beat between files
  }
  btn.innerHTML = orig; btn.disabled = false;
}

// Render one part's solfège (+ note names) to a PNG on a canvas. `dest`: undefined
// asks via the picker; a directory handle or 'download' comes from export-all.
// Returns a promise so the bulk loop can await each file.
function exportTrackPng(track, dest){
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
  // slur (over, green) + tie (under, red) arcs, same as the grid/staff show
  const cx = (i)=> padX + (i % perRow)*cw + cw/2, cy = (i)=> padTop + Math.floor(i/perRow)*ch;
  const sameRow = (i,j)=> Math.floor(i/perRow) === Math.floor(j/perRow);
  const arc = (i,j,yOff,peak,color)=>{ const a=cx(i),b=cx(j),ya=cy(i)+yOff,yb=cy(j)+yOff; g.strokeStyle=color; g.lineWidth=2.4; g.beginPath(); g.moveTo(a,ya); g.quadraticCurveTo((a+b)/2, ya+peak, b, yb); g.stroke(); };
  const marks = phrasingMarks(track);
  notes.forEach((n,i)=>{ if(n.tieNext && notes[i+1] && sameRow(i,i+1)) arc(i, i+1, 56, 8, '#8c2f2a'); });   // tie: shallow curve under
  let s = -1;                                                                                                  // slur: arc over each same-row run
  for(let i=0;i<=notes.length;i++){
    const inS = marks.slurred.has(i);
    if(inS && s<0) s = i;
    if((!inS || i===notes.length) && s>=0){
      let a = s; const end = i-1;
      while(a < end){ let r = a; while(r+1<=end && sameRow(a,r+1)) r++; if(r>a) arc(a, r, 6, -14, '#2f6b5f'); a = r+1; }
      s = -1;
    }
  }
  const name = safeName(exportBase(track)) + '.png';
  return new Promise(r=> cv.toBlob(async b=>{ await deliver(b, name, dest, {desc:'PNG image', mime:'image/png', ext:['.png']}); r(); }, 'image/png'));
}

// Render ONE part's engraved staff (OSMD) offscreen and save it as a PNG - so the
// per-part sheet is exportable, not just the solfège grid.
async function exportTrackSheetPng(track, dest){
  if(!window.opensheetmusicdisplay){ alert('Sheet renderer not loaded (check your connection).'); return; }
  const box = document.createElement('div');
  box.style.cssText = 'position:absolute;left:-10000px;top:0;width:1000px;background:#fff';
  document.body.appendChild(box);
  try{
    const inst = new opensheetmusicdisplay.OpenSheetMusicDisplay(box, OSMD_OPTS({drawTitle:true}));
    await inst.load(partXML(track));
    if(partFromOriginal(track) && transposeOffset) applyTransposeTo(inst);   // serializer already carries the transpose
    inst.render();
    const cv = await scoreToCanvas([...box.querySelectorAll('svg')], 2);
    const blob = await new Promise(r=> cv.toBlob(r, 'image/png'));
    await deliver(blob, safeName(exportBase(track)) + '.png', dest, {desc:'PNG image', mime:'image/png', ext:['.png']});
  }catch(e){ alert('Sheet PNG export failed: ' + e.message); }
  finally{ box.remove(); }
}
// Export a part as a PNG of whatever it's currently showing: the engraved staff in
// Sheet view, else the solfège grid.
function exportTrackVisual(track, dest){
  if(track.view === 'sheet' && canSheet(track)) return exportTrackSheetPng(track, dest);
  return exportTrackPng(track, dest);
}

/* ---------- animated video (grid scrolls in time with the sound) ----------
   Records a canvas "karaoke" strip of the solfège grid (one lane per part, each
   scrolling so the sounding note sits under a centre playhead) together with the
   offline-rendered audio, into a single shareable clip. Prefers MP4/H.264 so it
   previews on WhatsApp; falls back to WebM where MP4 recording isn't available.
   Recording is real-time (a 30s piece takes ~30s). */
const VIDEO_FPS = 30;
function videoDims(parts, withSheet){
  const W = 760, cw = 104, titleH = 50, laneH = 134, padBot = 22;
  const sheetH = withSheet ? 240 : 0;   // an extra scrolling staff lane (single-track videos only)
  let H = titleH + parts.length * laneH + sheetH + padBot;
  if(H % 2) H++;                        // H.264 needs even dimensions
  return { W, H, cw, titleH, laneH, padBot, sheetH };
}
// Render a part's staff on ONE horizontal line offscreen, rasterise it, and map each
// notehead's beat to its x in the image - so the staff can scroll in sync in a video lane.
// Returns {img, w, h, pts:[{beat,x}]} or null if it can't (no OSMD / wrapped / empty).
async function prepareSheetStrip(track){
  if(!window.opensheetmusicdisplay || !canSheet(track)) return null;
  let maxBeat = 0; (track.notes||[]).forEach(n=> maxBeat = Math.max(maxBeat, (n.startBeat||0)+(n.durBeat||0)));
  const box = document.createElement('div');
  box.style.cssText = 'position:absolute;left:-100000px;top:0;width:' + Math.max(1400, Math.round(maxBeat*150)) + 'px;background:#f4efe6';
  document.body.appendChild(box);
  try{
    const inst = new opensheetmusicdisplay.OpenSheetMusicDisplay(box, OSMD_OPTS({drawTitle:false}));
    try{ inst.EngravingRules.RenderSingleHorizontalStaffline = true; }catch(_){}   // keep it on one line (newer OSMD)
    try{ inst.zoom = 1.6; }catch(_){}   // render larger so the staff stays crisp when scaled up in the lane
    await inst.load(partXML(track));
    if(partFromOriginal(track) && transposeOffset) applyTransposeTo(inst);
    inst.render();
    tagSheetNotes(inst, track.id);
    const svg = box.querySelector('svg'); if(!svg) return null;
    const pts = [];
    svg.querySelectorAll('.sheetnote[data-b0]').forEach(el=>{
      const b0 = parseFloat(el.dataset.b0); if(!isFinite(b0)) return;
      let bb; try{ bb = el.getBBox(); }catch(_){ bb = null; }
      if(bb) pts.push({ beat: b0, x: bb.x + bb.width/2, bx: bb.x, y: bb.y, w: bb.width, h: bb.height });   // x = centre (alignment); bbox = green highlight
    });
    pts.sort((a,b)=> a.beat - b.beat);
    if(pts.length < 1) return null;
    for(let i=1;i<pts.length;i++) if(pts[i].x < pts[i-1].x - 4) return null;   // x went backwards -> it wrapped, bail
    const { img, w, h } = await svgToImage(svg);
    return { img, w, h, pts };
  }catch(_){ return null; }
  finally{ box.remove(); }
}
function beatToStaffX(sheet, beat){
  const pts = sheet.pts;
  if(beat <= pts[0].beat) return pts[0].x;
  const lastP = pts[pts.length-1];
  if(beat >= lastP.beat) return lastP.x;
  for(let i=0;i<pts.length-1;i++){
    if(beat <= pts[i+1].beat){
      const span = (pts[i+1].beat - pts[i].beat) || 1;
      return pts[i].x + (beat - pts[i].beat)/span * (pts[i+1].x - pts[i].x);
    }
  }
  return lastP.x;
}
function drawSheetLane(g, sheet, beat, dims, top){
  const { W, sheetH } = dims, playheadX = W/2;
  g.fillStyle = '#2f6b5f'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.font = '600 14px Fraunces, serif'; g.fillText('Sheet', 16, top + 18);
  const padTop = 26, drawH = sheetH - padTop - 8, scale = drawH / sheet.h;
  const staffX = beatToStaffX(sheet, beat);
  const imgX = playheadX - staffX*scale;
  g.save(); g.beginPath(); g.rect(0, top, W, sheetH); g.clip();
  g.drawImage(sheet.img, imgX, top + padTop, sheet.w*scale, sheet.h*scale);
  g.restore();
  // recolour the currently-sounding note green (matches the grid's active note + the staff "playing" highlight)
  const pts = sheet.pts; let ci = -1;
  for(let i=0;i<pts.length;i++){ if(beat + 1e-6 >= pts[i].beat) ci = i; else break; }
  if(ci >= 0){
    const p = pts[ci], pad = 2;
    const x0 = Math.max(0, Math.floor(imgX + p.bx*scale) - pad), y0 = Math.max(top, Math.floor(top + padTop + p.y*scale) - pad);
    const x1 = Math.min(W, Math.ceil(imgX + (p.bx+p.w)*scale) + pad), y1 = Math.min(top + sheetH, Math.ceil(top + padTop + (p.y+p.h)*scale) + pad);
    if(x1 > x0 && y1 > y0){
      const id = g.getImageData(x0, y0, x1-x0, y1-y0), d = id.data;
      for(let k=0;k<d.length;k+=4){
        const lum = 0.299*d[k] + 0.587*d[k+1] + 0.114*d[k+2];
        if(d[k+3] > 30 && lum < 150){ d[k]=0x2f; d[k+1]=0x6b; d[k+2]=0x5f; }   // ink pixels -> accent2 green
      }
      g.putImageData(id, x0, y0);
    }
  }
  g.strokeStyle = 'rgba(140,47,42,0.55)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(playheadX, top + padTop - 4); g.lineTo(playheadX, top + sheetH - 6); g.stroke();
}
function roundRectPath(g, x, y, w, h, r){
  if(g.roundRect){ g.beginPath(); g.roundRect(x, y, w, h, r); return; }
  g.beginPath(); g.moveTo(x+r, y); g.arcTo(x+w, y, x+w, y+h, r); g.arcTo(x+w, y+h, x, y+h, r);
  g.arcTo(x, y+h, x, y, r); g.arcTo(x, y, x+w, y, r); g.closePath();
}
function videoArc(g, ax, bx, yBase, peak, color){
  g.strokeStyle = color; g.lineWidth = 2.6;
  g.beginPath(); g.moveTo(ax, yBase); g.quadraticCurveTo((ax+bx)/2, yBase + peak, bx, yBase); g.stroke();
}
function drawVideoCell(g, n, active, x, y, w, h){
  g.fillStyle = active ? '#2f6b5f' : '#ece5d8';
  roundRectPath(g, x, y, w, h, 10); g.fill();
  g.textAlign = 'center'; const mid = x + w/2;
  if(!n) return;
  if(n.isRest){
    g.fillStyle = active ? 'rgba(244,239,230,0.9)' : '#b3a392';
    g.font = '600 26px Fraunces, serif'; g.fillText('–', mid, y + 40);
    g.font = '13px "JetBrains Mono", monospace'; g.fillText('rest', mid, y + 66);
  } else {
    const a = analyze(n);
    g.fillStyle = active ? '#f4efe6' : '#2f6b5f';
    g.font = '600 30px Fraunces, serif'; g.fillText(a.syl, mid, y + 42);
    g.fillStyle = active ? 'rgba(244,239,230,0.85)' : '#736959';
    g.font = '13px "JetBrains Mono", monospace'; g.fillText(n.name, mid, y + 66);
    g.fillStyle = active ? 'rgba(244,239,230,0.7)' : '#8c2f2a';
    g.font = '11px "JetBrains Mono", monospace'; g.fillText('deg ' + a.deg, mid, y + 84);
  }
}
function drawVideoLane(g, t, beat, dims, top, playheadX){
  const { W, cw, laneH } = dims;
  const notes = t.notes || [];
  g.fillStyle = '#2f6b5f'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.font = '600 14px Fraunces, serif'; g.fillText(t.label || 'Voice', 16, top + 20);
  const cellY = top + 30, cellH = 92, cellW = cw - 12;
  // the sounding note: last note whose onset has passed
  let idx = 0; for(let i=0;i<notes.length;i++){ if(beat + 1e-6 >= notes[i].startBeat) idx = i; else break; }
  const n = notes[idx];
  const frac = (n && n.durBeat) ? Math.max(0, Math.min(1, (beat - n.startBeat)/n.durBeat)) : 0;
  const originX = playheadX - (idx + frac + 0.5) * cw;   // scroll so the active note sits at the playhead
  g.save(); g.beginPath(); g.rect(0, top, W, laneH); g.clip();
  const first = Math.max(0, Math.floor((-originX)/cw) - 1);
  const last = Math.min(notes.length - 1, Math.ceil((W - originX)/cw) + 1);
  for(let i=first;i<=last;i++) drawVideoCell(g, notes[i], i === idx, originX + i*cw + 6, cellY, cellW, cellH);
  const marks = phrasingMarks(t), cx = (i)=> originX + i*cw + cw/2;
  for(let i=first;i<=last;i++){
    if(marks.slurLinks.has(i)) videoArc(g, cx(i), cx(i+1), cellY - 4, -16, '#2f6b5f');   // slur over
    if(marks.tieStarts.has(i)) videoArc(g, cx(i), cx(i+1), cellY + cellH + 6, 12, '#8c2f2a'); // tie under
  }
  g.restore();
  g.strokeStyle = 'rgba(140,47,42,0.55)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(playheadX, top + 24); g.lineTo(playheadX, top + laneH - 6); g.stroke();
}
function drawVideoFrame(g, parts, beat, dims, sheet){
  g.fillStyle = '#f4efe6'; g.fillRect(0, 0, dims.W, dims.H);
  g.fillStyle = '#211c16'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.font = '600 22px Fraunces, Georgia, serif';
  g.fillText((pieceName || 'Solfege') + '  (' + currentKeyName() + ')', 18, 32);
  const playheadX = dims.W / 2;
  parts.forEach((t, pi)=> drawVideoLane(g, t, beat, dims, dims.titleH + pi*dims.laneH, playheadX));
  if(sheet && dims.sheetH) drawSheetLane(g, sheet, beat, dims, dims.titleH + parts.length*dims.laneH);
}
// Pick the most shareable container the browser can actually record (MP4 first).
function pickVideoMime(){
  const cands = [
    { type:'video/mp4;codecs="avc1.42E01E,mp4a.40.2"', ext:'.mp4', desc:'MP4 video', mime:'video/mp4' },
    { type:'video/mp4', ext:'.mp4', desc:'MP4 video', mime:'video/mp4' },
    { type:'video/webm;codecs=vp9,opus', ext:'.webm', desc:'WebM video', mime:'video/webm' },
    { type:'video/webm;codecs=vp8,opus', ext:'.webm', desc:'WebM video', mime:'video/webm' },
    { type:'video/webm', ext:'.webm', desc:'WebM video', mime:'video/webm' },
  ];
  for(const c of cands){ try{ if(window.MediaRecorder && MediaRecorder.isTypeSupported(c.type)) return c; }catch(_){} }
  return { type:'', ext:'.webm', desc:'WebM video', mime:'video/webm' };
}
const MP4_MIME = { ext:'.mp4', desc:'MP4 video', mime:'video/mp4' };
// Ask WHERE to save up front (single-file exports), while the click's user activation
// is still valid. Bulk loops pass `dest` (a folder handle or 'download') and skip this.
// Returns {fileHandle} / {dest} / null (cancelled).
async function acquireVideoDest(baseName, mime, dest){
  if(dest) return { dest };
  if(window.showSaveFilePicker){
    try{ return { fileHandle: await window.showSaveFilePicker({ suggestedName: baseName + mime.ext, types:[{ description: mime.desc, accept: { [mime.mime]: [mime.ext] } }] }) }; }
    catch(e){ if(e && e.name === 'AbortError') return null; return { dest:'download' }; }
  }
  return { dest:'download' };
}
async function saveVideo(blob, baseName, mime, target){
  if(target.fileHandle){ const w = await target.fileHandle.createWritable(); await w.write(blob); await w.close(); }
  else await deliver(blob, baseName + mime.ext, target.dest, { desc: mime.desc, mime: mime.mime, ext: [mime.ext] });
}
// WebCodecs offline path available? (encodes faster than real-time, immune to focus/throttling.)
const WC_VCODEC = 'avc1.42002A';   // H.264 Baseline, level 4.2 - handles tall multi-part frames
async function canWebCodecs(W, H){
  if(!(window.VideoEncoder && window.AudioEncoder && window.VideoFrame && window.AudioData && window.Mp4Muxer && window.Mp4Muxer.Muxer)) return false;
  try{
    const v = await VideoEncoder.isConfigSupported({ codec: WC_VCODEC, width: W, height: H, bitrate: 4000000, framerate: VIDEO_FPS });
    const a = await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: 44100, numberOfChannels: 1, bitrate: 128000 });
    return !!(v && v.supported && a && a.supported);
  }catch(_){ return false; }
}

// Public entry: export `parts` (one lane each) as a video. Prefers the WebCodecs
// offline render (fast, focus-proof, MP4); falls back to the real-time MediaRecorder.
async function recordVideo(parts, baseName, btn, dest){
  const usable = (parts || []).filter(t=> t.notes && t.notes.some(n=> !n.isRest));
  if(!usable.length){ alert('Nothing to record yet, add some notes first.'); return; }
  if(isPlaying) stopPlayback();
  // Single-track videos (per-part, and each "All parts" clip) get a second lane: the
  // engraved staff scrolling in sync underneath. The full mix (many parts) skips it.
  const sheet = (parts.length === 1) ? await prepareSheetStrip(parts[0]) : null;
  const dims = videoDims(parts, !!sheet);
  const wc = await canWebCodecs(dims.W, dims.H);
  const realtimeOK = !!(window.MediaRecorder && document.createElement('canvas').captureStream);
  if(!wc && !realtimeOK){ alert('This browser cannot record video here. Try the latest Chrome.'); return; }
  const mime = wc ? MP4_MIME : pickVideoMime();
  const target = await acquireVideoDest(baseName, mime, dest);
  if(!target) return;   // user cancelled the Save dialog
  if(wc) await recordVideoOffline(parts, dims, baseName, target, btn, sheet);
  else await recordVideoRealtime(parts, dims, baseName, mime, target, btn, sheet);
}

// Offline render: draw every frame and encode it (H.264) + the rendered audio (AAC),
// mux to MP4. Not tied to wall-clock, so it's faster than real-time and never freezes
// when the tab loses focus. No sound plays during this (it's not a live capture).
async function recordVideoOffline(parts, dims, baseName, target, btn, sheet){
  const orig = btn ? btn.innerHTML : '';
  if(btn){ btn.disabled = true; btn.textContent = 'Rendering audio...'; }
  try{
    const spb = 60 / (parseInt(document.getElementById('bpm').value) || 84);
    const ab = (await renderTracksToBuffer(parts)).get();
    const fps = VIDEO_FPS, totalSec = ab.duration, totalFrames = Math.max(1, Math.ceil(totalSec * fps));
    const { Muxer, ArrayBufferTarget } = window.Mp4Muxer;
    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: 'avc', width: dims.W, height: dims.H },
      audio: { codec: 'aac', numberOfChannels: ab.numberOfChannels, sampleRate: ab.sampleRate },
      fastStart: 'in-memory',
    });
    const vEnc = new VideoEncoder({ output: (c,m)=> muxer.addVideoChunk(c,m), error: (e)=>{ throw e; } });
    vEnc.configure({ codec: WC_VCODEC, width: dims.W, height: dims.H, bitrate: 4000000, framerate: fps });
    const cv = document.createElement('canvas'); cv.width = dims.W; cv.height = dims.H;
    const g = cv.getContext('2d');
    const usPerFrame = 1000000 / fps;
    if(btn) btn.textContent = 'Rendering video...';
    for(let i=0;i<totalFrames;i++){
      drawVideoFrame(g, parts, (i/fps)/spb, dims, sheet);
      const frame = new VideoFrame(cv, { timestamp: Math.round(i*usPerFrame), duration: Math.round(usPerFrame) });
      vEnc.encode(frame, { keyFrame: i % (fps*2) === 0 });
      frame.close();
      if(vEnc.encodeQueueSize > 30) await new Promise(r=> setTimeout(r, 0));   // backpressure: let the encoder drain
      if(btn && i % 15 === 0) btn.textContent = 'Rendering ' + Math.round(100*i/totalFrames) + '%';
    }
    await vEnc.flush();
    const aEnc = new AudioEncoder({ output: (c,m)=> muxer.addAudioChunk(c,m), error: (e)=>{ throw e; } });
    aEnc.configure({ codec: 'mp4a.40.2', sampleRate: ab.sampleRate, numberOfChannels: ab.numberOfChannels, bitrate: 128000 });
    const ch = ab.numberOfChannels, sr = ab.sampleRate, block = 4096;
    for(let off=0; off<ab.length; off+=block){
      const n = Math.min(block, ab.length - off);
      const data = new Float32Array(n*ch);
      for(let c=0;c<ch;c++){ const cd = ab.getChannelData(c); for(let k=0;k<n;k++) data[k*ch+c] = cd[off+k]; }   // interleaved f32
      const ad = new AudioData({ format:'f32', sampleRate: sr, numberOfFrames: n, numberOfChannels: ch, timestamp: Math.round(off/sr*1000000), data });
      aEnc.encode(ad); ad.close();
    }
    await aEnc.flush();
    muxer.finalize();
    if(btn) btn.textContent = 'Saving...';
    await saveVideo(new Blob([muxer.target.buffer], { type:'video/mp4' }), baseName, MP4_MIME, target);
  }catch(e){ alert('Video export failed: ' + e.message); }
  finally{ if(btn){ btn.innerHTML = orig; btn.disabled = false; } }
}

// Fallback: real-time capture via MediaRecorder (canvas stream + rendered audio).
async function recordVideoRealtime(parts, dims, baseName, mime, target, btn, sheet){
  const orig = btn ? btn.innerHTML : '';
  if(btn){ btn.disabled = true; btn.textContent = 'Rendering audio...'; }
  let actx = null;
  try{
    const spb = 60 / (parseInt(document.getElementById('bpm').value) || 84);
    const ab = (await renderTracksToBuffer(parts)).get();
    actx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = actx.createBuffer(ab.numberOfChannels, ab.length, ab.sampleRate);
    for(let c=0;c<ab.numberOfChannels;c++) buf.copyToChannel(ab.getChannelData(c), c);
    const src = actx.createBufferSource(); src.buffer = buf;
    const msDest = actx.createMediaStreamDestination();
    src.connect(msDest); src.connect(actx.destination);   // route to speakers too, so you preview it as it records
    const totalSec = ab.duration;
    const cv = document.createElement('canvas'); cv.width = dims.W; cv.height = dims.H;
    const g = cv.getContext('2d');
    drawVideoFrame(g, parts, 0, dims, sheet);
    const vstream = cv.captureStream(VIDEO_FPS);
    const vtrack = vstream.getVideoTracks()[0];
    const pushFrame = (vtrack && typeof vtrack.requestFrame === 'function') ? ()=> vtrack.requestFrame() : ()=>{};
    const stream = new MediaStream([...vstream.getVideoTracks(), ...msDest.stream.getAudioTracks()]);
    const recOpts = { videoBitsPerSecond: 4000000 }; if(mime.type) recOpts.mimeType = mime.type;
    const rec = new MediaRecorder(stream, recOpts);
    const chunks = []; rec.ondataavailable = e=>{ if(e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise(res=> rec.onstop = res);
    const t0 = actx.currentTime + 0.12;
    rec.start(); src.start(t0);
    // Drive the animation off a timer tied to the audio clock, NOT requestAnimationFrame
    // (rAF pauses to 0fps when the window loses focus, freezing the canvas mid-record).
    await new Promise(resolve=>{
      const tick = ()=>{
        const elapsed = actx.currentTime - t0;
        drawVideoFrame(g, parts, Math.max(0, elapsed) / spb, dims, sheet);
        pushFrame();
        if(btn) btn.textContent = 'Recording ' + Math.min(Math.ceil(Math.max(0, elapsed)), Math.ceil(totalSec)) + '/' + Math.ceil(totalSec) + 's';
        if(elapsed >= totalSec + 0.15){ clearInterval(timer); resolve(); }
      };
      const timer = setInterval(tick, 1000 / VIDEO_FPS);
      tick();
    });
    if(rec.state !== 'inactive') rec.stop();
    await stopped;
    if(btn) btn.textContent = 'Saving...';
    await saveVideo(new Blob(chunks, { type: mime.mime }), baseName, mime, target);
  }catch(e){ alert('Video export failed: ' + e.message); }
  finally{ try{ if(actx) actx.close(); }catch(_){} if(btn){ btn.innerHTML = orig; btn.disabled = false; } }
}
async function exportTrackVideo(track, btn, dest){ await recordVideo([track], safeName(exportBase(track)), btn, dest); }
// One separate clip per part (real-time each), all into a folder picked once. This
// differs from the full mix (a single clip of every part stacked together).
async function exportAllVideo(btn){
  if(!tracks.length) return;
  const dir = await pickExportDir();
  if(dir === 'cancel') return;                  // user backed out of the folder picker
  const dest = dir || 'download';               // a folder if picked, else straight to Downloads
  const orig = btn.innerHTML; btn.disabled = true;
  for(let i=0;i<tracks.length;i++){
    btn.textContent = `Recording part ${i+1}/${tracks.length}...`;
    await exportTrackVideo(tracks[i], null, dest);
  }
  btn.innerHTML = orig; btn.disabled = false;
}
async function exportMixVideo(btn){
  const audible = tracks.filter(t=> soloActive ? t.solo : t.enabled);
  if(!audible.length){ alert('No audible parts to record.'); return; }
  await recordVideo(audible, safeName((pieceName ? pieceName + '-' : '') + 'full-mix'), btn);
}

/* ---------- sheet music ---------- */
let osmd = null, sheetReady = false, voiceOsmd = [], voiceSheetsReady = false;

// Shared OSMD options - engrave in the page's ink on the paper-coloured boxes
// (set in CSS) so the staves match the rest of the UI instead of black-on-white.
// autoResize is OFF: OSMD's resize-driven redraw silently wipes the highlight
// classes we add to noteheads (and the edit preview already relies on this).
let showBeams = true;   // user toggle: join eighth/shorter note tails with beams (else show individual flags)
function OSMD_OPTS(extra){ return Object.assign({autoResize:false, backend:'svg', defaultColorMusic:'#211c16', autoBeam:showBeams}, extra||{}); }

function applyTransposeTo(inst){
  try{
    if(!inst.TransposeCalculator) inst.TransposeCalculator = new opensheetmusicdisplay.TransposeCalculator();
    inst.Sheet.Transpose = transposeOffset;
    inst.updateGraphic();
  }catch(_){}
}
function updateSheetBadges(){
  const d = displayTranspose();
  const txt = d ? `Transposed ${d>0?'+':''}${d} → sounds in ${currentKeyName().replace(' major','')}` : '';
  const set = (id, ready)=>{ const el=document.getElementById(id); if(!el) return; el.hidden = !(ready && d); el.textContent = txt; };
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
function partMeasuresXML(notes, measureTicks, attrsXML, totalMeasures, pickupTicks){
  const pk = pickupTicks || 0;   // a short first (pickup) measure of pk ticks, then full measures
  // measure index of a tick position, and the next barline at/after it, with the pickup offset
  const mIndex = (s)=> (pk && s < pk) ? 0 : (pk ? 1 : 0) + Math.floor((s - pk)/measureTicks);
  const nextBoundary = (s)=> (pk && s < pk) ? pk : pk + (Math.floor((s - pk)/measureTicks)+1)*measureTicks;
  // sort + fill gaps with rests so the timeline is contiguous from 0
  const ev = notes.slice().sort((a,b)=> a.startBeat - b.startBeat);
  const seq = []; let cursor = 0, prevTie = false;   // prevTie: previous note is tied into this one
  ev.forEach(n=>{
    const start = Math.round(n.startBeat*XDIV), dur = Math.max(1, Math.round(n.durBeat*XDIV));
    if(start > cursor + 1){ seq.push({rest:true, start:cursor, ticks:start-cursor}); prevTie = false; }  // a gap breaks a tie
    seq.push({rest:!!n.isRest, start, ticks:dur, step:n.step, alter:n.alter, oct:n.oct,
      slurStart:!!n.slurStart, slurStop:!!n.slurStop,
      tieNext:!!n.tieNext && !n.isRest, tiePrev:prevTie && !n.isRest});   // user ties/slurs
    prevTie = !!n.tieNext && !n.isRest;
    cursor = Math.max(cursor, start + dur);
  });
  if(!seq.length) seq.push({rest:true, start:0, ticks: pk || measureTicks});
  // pad the final measure out to a barline with a rest (respecting the pickup offset)
  let total;
  if(cursor <= pk) total = pk || measureTicks;
  else total = pk + Math.ceil((cursor - pk)/measureTicks)*measureTicks;
  if(!total) total = measureTicks;
  if(cursor < total) seq.push({rest:true, start:cursor, ticks:total-cursor});

  const measures = [];               // measures[m] = array of <note> strings
  const put = (m, xml)=>{ (measures[m] = measures[m] || []).push(xml); };
  seq.forEach(e=>{
    // split the event at measure boundaries
    const frags = []; let s = e.start, end = e.start + e.ticks;
    while(s < end){
      const segEnd = Math.min(end, nextBoundary(s));
      frags.push({m:mIndex(s), ticks:segEnd - s});
      s = segEnd;
    }
    // each fragment decomposes into note values; pitched notes tie across all sub-notes
    const subs = [];
    frags.forEach(f=> decomposeTicks(f.ticks).forEach(d=> subs.push({m:f.m, d})));
    subs.forEach((sub,i)=>{
      if(e.rest){
        put(sub.m, `<note><rest/><duration>${sub.d.ticks}</duration><voice>1</voice>${noteTypeXML(sub.d)}</note>`);
      } else {
        // tie across auto-split sub-notes AND across user ties (tieNext on the last sub, tiePrev on the first)
        const tieStart = (i < subs.length-1) || (i === subs.length-1 && e.tieNext);
        const tieStop  = (i > 0) || (i === 0 && e.tiePrev);
        const ties = (tieStop?'<tie type="stop"/>':'') + (tieStart?'<tie type="start"/>':'');
        const tied = (tieStop?'<tied type="stop"/>':'') + (tieStart?'<tied type="start"/>':'');
        let slur = '';
        if(e.slurStart && i === 0) slur += '<slur number="1" type="start"/>';
        if(e.slurStop && i === subs.length-1) slur += '<slur number="1" type="stop"/>';
        const notations = (tied || slur) ? `<notations>${tied}${slur}</notations>` : '';
        put(sub.m, `<note>${pitchXML(e)}<duration>${sub.d.ticks}</duration>${ties}<voice>1</voice>${noteTypeXML(sub.d)}${notations}</note>`);
      }
    });
  });
  const count = Math.max(measures.length || 1, totalMeasures || 1);
  let xml = '';
  for(let m=0; m<count; m++){
    const fillTicks = (pk && m===0) ? pk : measureTicks;   // an empty pickup bar is only pk long
    const body = (measures[m] || [`<note><rest measure="yes"/><duration>${fillTicks}</duration><voice>1</voice></note>`]).join('');
    const implicit = (pk && m===0) ? ' implicit="yes"' : '';   // a pickup measure isn't counted/numbered as a full bar
    xml += `<measure number="${m+1}"${implicit}>${m===0 ? attrsXML : ''}${body}</measure>`;
  }
  return xml;
}

// Per-part clefs. A track's `clef` (treble/bass/alto/tenor) is captured on import
// and settable in edit mode; when unset we fall back to the pitch-average guess,
// so a part never silently flips clef just because you edited its notes.
const CLEFS = { treble:{sign:'G',line:2}, bass:{sign:'F',line:4}, alto:{sign:'C',line:3}, tenor:{sign:'C',line:4} };
const CLEF_LABELS = { auto:'Auto clef', treble:'Treble', bass:'Bass', alto:'Alto', tenor:'Tenor' };
function clefNameFrom(sign, line){
  for(const [name,c] of Object.entries(CLEFS)){ if(c.sign === sign && String(c.line) === String(line)) return name; }
  return null;
}
function clefXML(t){
  const c = CLEFS[t && t.clef];
  if(c) return `<clef><sign>${c.sign}</sign><line>${c.line}</line></clef>`;
  const pitched = (t.notes||[]).filter(n=> !n.isRest);
  const avg = pitched.length ? pitched.reduce((s,n)=> s+n.midi, 0)/pitched.length : 71;
  return avg >= 60 ? '<clef><sign>G</sign><line>2</line></clef>' : '<clef><sign>F</sign><line>4</line></clef>';
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

  const pickupTicks = Math.round((opts.pickupBeats != null ? opts.pickupBeats : pickupBeats) * XDIV);

  // Size the score to the longest voice, so shorter voices get trailing rest bars
  // rather than truncating the whole render to the shortest voice's length.
  let maxTick = 0;
  list.forEach(t=> t.notes.forEach(n=> maxTick = Math.max(maxTick, Math.round((n.startBeat + n.durBeat) * XDIV))));
  const totalMeasures = pickupTicks > 0
    ? 1 + Math.max(0, Math.ceil((maxTick - pickupTicks) / measureTicks))   // pickup measure + full measures
    : Math.max(1, Math.ceil(maxTick / measureTicks));

  let partList = '', partsXML = '';
  list.forEach((t,i)=>{
    const id = 'P'+(i+1);
    partList += `<score-part id="${id}"><part-name>${esc(t.label||('Voice '+(i+1)))}</part-name></score-part>`;
    const clef = clefXML(t);
    const attrs = `<attributes><divisions>${XDIV}</divisions><key><fifths>${fifths}</fifths></key><time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time>${clef}</attributes>`;
    partsXML += `<part id="${id}">${partMeasuresXML(t.notes, measureTicks, attrs, totalMeasures, pickupTicks)}</part>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<score-partwise version="3.1"><work><work-title>${esc(title)}</work-title></work><part-list>${partList}</part-list>${partsXML}</score-partwise>`;
}

/* ---------- save score to file (MusicXML / PNG / PDF) ---------- */
function hasMusic(){ return tracks.some(t=> t.notes && t.notes.length); }
function scoreFileBase(){ return safeName(pieceName || 'score'); }

async function downloadMusicXML(){
  const msg = document.getElementById('savemsg');
  if(!hasMusic()){ if(msg) msg.textContent = 'Load or create a piece first.'; return; }
  const xml = tracksToMusicXML({beats:meterBeats, beatType:meterType});
  const blob = new Blob([xml], {type:'application/vnd.recordare.musicxml+xml'});
  const ok = await saveBlob(blob, scoreFileBase() + '.musicxml',
    {desc:'MusicXML', mime:'application/vnd.recordare.musicxml+xml', ext:['.musicxml']});
  if(msg) msg.textContent = ok ? 'Saved MusicXML ✓' : '';
}

// Render the current notes to an offscreen OSMD; returns its container + page SVGs.
async function renderScoreOffscreen(){
  if(!window.opensheetmusicdisplay) throw new Error('Sheet renderer not loaded.');
  if(!hasMusic()) throw new Error('Load or create a piece first.');
  const box = document.createElement('div');
  box.style.cssText = 'position:absolute;left:-10000px;top:0;width:1000px;background:#fff';
  document.body.appendChild(box);
  try{
    const inst = new opensheetmusicdisplay.OpenSheetMusicDisplay(box, {backend:'svg', drawTitle:true, autoResize:false, autoBeam:showBeams});
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
    const blob = await new Promise(r=> cv.toBlob(r, 'image/png'));
    const ok = await saveBlob(blob, scoreFileBase()+'.png', {desc:'PNG image', mime:'image/png', ext:['.png']});
    if(msg) msg.textContent = ok ? 'Saved PNG ✓' : '';
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
    const ok = await saveBlob(pdf.output('blob'), scoreFileBase()+'.pdf',
      {desc:'PDF document', mime:'application/pdf', ext:['.pdf']});
    if(msg) msg.textContent = ok ? 'Saved PDF ✓' : '';
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
    if(track._previewScroll) box.scrollTop = track._previewScroll;   // keep the reader's place after an edit re-engrave
    repaintPlayhead();    // re-light the current note now that this staff exists (async render)
    repaintSelection();   // and re-mark the selected note if we're editing this part
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
// Toggle beaming (joined eighth/shorter tails) on the engraved sheets. Re-renders
// per-part sheets + the full score (if shown) with autoBeam on/off.
function setBeams(show){
  showBeams = show;
  document.querySelectorAll('#beamToggle button').forEach(b=> b.classList.toggle('on', (b.dataset.beam === 'show') === show));
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
const EDIT_DUR_VALS = EDIT_DURS.map(([,v])=> v).slice().sort((a,b)=> a-b);   // ascending, for the < > duration steppers
const DUR_ABBR = {4:'w',3:'h.',2:'h',1.5:'q.',1:'q',0.75:'e.',0.5:'e',0.25:'s'};
function durAbbr(d){ return DUR_ABBR[d] || (d+'b'); }

let undoStack = [];
// Capture key + transpose too, so undoing a transpose restores both the notes
// (snapshot is taken before they are re-spelled) and the key/offset.
function snapshot(){ return JSON.stringify({tracks, meterBeats, meterType, pieceName, transposeOffset, homeOffset, pickupBeats, tonicPc: currentTonic.pc, tonicLetter: currentTonic.letter}); }
function pushUndo(){ undoStack.push(snapshot()); if(undoStack.length > 80) undoStack.shift(); }
function undo(){
  if(!undoStack.length) return;
  const s = JSON.parse(undoStack.pop());
  tracks = s.tracks; meterBeats = s.meterBeats; meterType = s.meterType; pieceName = s.pieceName;
  if(s.transposeOffset != null) transposeOffset = s.transposeOffset;
  homeOffset = (s.homeOffset != null) ? s.homeOffset : transposeOffset;
  pickupBeats = s.pickupBeats || 0;
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
  // Lay notes back-to-back from beat 0; keep each note's own duration. We do NOT clamp
  // a note to its bar here: the serializer (partMeasuresXML) already splits anything that
  // crosses a barline into tied notes. Clamping was destructive - changing one note's
  // duration shifts later notes' bar positions and would silently shorten THEM.
  let cur = 0;
  (t.notes || []).forEach(n=>{
    n.startBeat = cur;
    cur += n.durBeat;
    recomputeNote(n);
  });
}
function defaultNote(prev){
  if(prev && !prev.isRest) return {isRest:false, step:prev.step, alter:prev.alter||0, oct:prev.oct, durBeat:prev.durBeat};
  return {isRest:false, step:'C', alter:0, oct:5, durBeat:1};
}

// After any edit: reflow, invalidate sheets, re-render the player (which rebuilds
// any open inline editors + live previews), re-sync playback. autosave via contentChanged.
function afterEdit(markEdited){
  if(markEdited !== false) edited = true;
  tracks.forEach(t=>{ reflowTrack(t); clearStaleTies(t); });
  invalidateSheets();
  render();
  contentChanged();
}
// Drop a tie whose target no longer shares its pitch (e.g. the note was re-pitched,
// turned to a rest, or deleted) so we never emit/sound an invalid tie.
function clearStaleTies(t){
  (t.notes||[]).forEach((n,i)=>{
    const m = t.notes[i+1];
    if(n.tieNext && (n.isRest || !m || m.isRest || m.midi !== n.midi)) delete n.tieNext;
  });
}

function selectedTrack(){ return editSel ? tracks.find(t=> t.id === editSel.trackId) : null; }
function selectedNote(){ const t = selectedTrack(); return (t && editSel && t.notes[editSel.index]) || null; }

// The set of selected note indices for a track: the multi-selection if it owns
// this track, else just the single anchor. Empty when nothing is selected here.
function selectionSetFor(trackId){
  if(multiSel && multiSel.trackId === trackId) return multiSel.set;
  if(editSel && editSel.trackId === trackId) return new Set([editSel.index]);
  return new Set();
}
// Selected indices (sorted) for the part currently being bulk-edited.
function selectedIndices(){
  if(multiSel) return [...multiSel.set].sort((a,b)=> a-b);
  return editSel ? [editSel.index] : [];
}

// A note was clicked (a solfa cell or a notehead in a part's edit mode). Plain click
// = single select + audition; Shift = range from the anchor; Cmd/Ctrl = toggle one.
function selectChip(trackId, index, n, e){
  if(e && e.shiftKey && editSel && editSel.trackId === trackId){
    const lo = Math.min(editSel.index, index), hi = Math.max(editSel.index, index);
    const set = new Set(); for(let i=lo;i<=hi;i++) set.add(i);
    multiSel = set.size > 1 ? {trackId, set} : null;
    editSel = {trackId, index};                       // anchor moves to the clicked end
  } else if(e && (e.metaKey || e.ctrlKey)){
    const set = new Set(selectionSetFor(trackId));
    if(set.has(index)) set.delete(index); else set.add(index);
    multiSel = set.size > 1 ? {trackId, set} : null;
    editSel = {trackId, index: set.size ? (set.has(index) ? index : [...set][0]) : index};
  } else {
    multiSel = null;
    editSel = {trackId, index};
    if(!isPlaying) auditionNote(n);
  }
  render();
}

// ---- bulk edit over the current multi-selection ----
function bulkApply(fn){
  const t = selectedTrack(); if(!t) return;
  pushUndo();
  selectedIndices().forEach(i=>{ const n = t.notes[i]; if(n) fn(n); });
  afterEdit();
}
function bulkOct(d){ bulkApply(n=>{ if(!n.isRest) n.oct = Math.max(0, Math.min(9, (n.oct||5) + d)); }); }
function bulkNudge(steps){ bulkApply(n=> nudgePitch(n, steps)); }
function bulkDur(v){ bulkApply(n=>{ n.durBeat = v; }); }
function bulkRest(makeRest){ bulkApply(n=>{ if(makeRest) n.isRest = true; else { n.isRest = false; n.step = n.step||'C'; n.alter = n.alter||0; n.oct = n.oct||5; } }); }
function bulkDelete(){
  const t = selectedTrack(); if(!t) return;
  const idxs = selectedIndices(); if(!idxs.length) return;
  pushUndo();
  idxs.sort((a,b)=> b-a).forEach(i=> t.notes.splice(i, 1));   // high -> low so indices stay valid
  multiSel = null;
  editSel = t.notes.length ? {trackId:t.id, index: Math.min(idxs[idxs.length-1], t.notes.length-1)} : null;
  afterEdit();
}
// Copy the selected notes (deep copy, in order) to the clipboard.
function copySelection(){
  const t = selectedTrack(); if(!t) return;
  noteClip = selectedIndices().map(i=> t.notes[i]).filter(Boolean).map(n=> Object.assign({}, n));
  refreshPasteButtons();
}
// Paste the clipboard into the current part right after the anchor (exact pitches).
function pasteAfterSelection(){
  if(!noteClip || !noteClip.length) return;
  const t = selectedTrack(); if(!t) return;
  pushUndo();
  const at = (multiSel ? Math.max(...multiSel.set) : (editSel ? editSel.index : t.notes.length - 1)) + 1;
  const copies = noteClip.map(n=> Object.assign({}, n));
  t.notes.splice(at, 0, ...copies);
  multiSel = copies.length > 1 ? {trackId:t.id, set:new Set(copies.map((_,k)=> at + k))} : null;
  editSel = {trackId:t.id, index: at};
  afterEdit();
}
function refreshPasteButtons(){
  const has = !!(noteClip && noteClip.length);
  document.querySelectorAll('.nePaste').forEach(b=>{ b.disabled = !has; b.title = has ? ('Paste ' + noteClip.length + ' note(s) after this one') : 'Nothing copied yet'; });
}

// ---- phrasing: slurs (arc over different pitches) + ties (sustain same pitch) ----
// Slur the selected run: an arc from the first to the last selected note. Toggles
// off if the run is already exactly that slur. Needs 2+ pitched notes.
function toggleSlur(){
  const t = selectedTrack(); if(!t) return;
  const idxs = selectedIndices().filter(i=> t.notes[i] && !t.notes[i].isRest);
  if(idxs.length < 2) return;
  pushUndo();
  const a = idxs[0], b = idxs[idxs.length-1];
  const already = t.notes[a].slurStart && t.notes[b].slurStop;
  idxs.forEach(i=>{ delete t.notes[i].slurStart; delete t.notes[i].slurStop; });
  if(!already){ t.notes[a].slurStart = true; t.notes[b].slurStop = true; }
  afterEdit();
}
// Tie adjacent SAME-PITCH notes within the selected run (a tie sustains one pitch).
// Toggles off when every eligible pair is already tied. Needs 2+ notes.
function toggleTie(){
  const t = selectedTrack(); if(!t) return;
  const idxs = selectedIndices().sort((a,b)=> a-b);
  const pairs = [];
  for(let k=0;k<idxs.length-1;k++){
    const i = idxs[k], j = idxs[k+1], a = t.notes[i], b = t.notes[j];
    if(j === i+1 && a && b && !a.isRest && !b.isRest && a.midi === b.midi) pairs.push(i);
  }
  if(!pairs.length) return;
  pushUndo();
  const already = pairs.every(i=> t.notes[i].tieNext);
  pairs.forEach(i=>{ if(already) delete t.notes[i].tieNext; else t.notes[i].tieNext = true; });
  afterEdit();
}
// Tie a single selected note to the very next note when they share a pitch (toggle).
function toggleTieNext(){
  const t = selectedTrack(); if(!t || !editSel) return;
  const a = t.notes[editSel.index], b = t.notes[editSel.index+1];
  if(!a || a.isRest || !b || b.isRest || a.midi !== b.midi) return;
  pushUndo();
  if(a.tieNext) delete a.tieNext; else a.tieNext = true;
  afterEdit();
}
function canTieNext(){
  const t = selectedTrack(); if(!t || !editSel) return false;
  const a = t.notes[editSel.index], b = t.notes[editSel.index+1];
  return !!(a && !a.isRest && b && !b.isRest && a.midi === b.midi);
}
// Which note indices in a track are under a slur / part of a tie (for grid markers).
function phrasingMarks(t){
  const slurred = new Set(), slurLinks = new Set(), tied = new Set(), tieStarts = new Set(); let inSlur = false;
  (t.notes||[]).forEach((n,i)=>{
    if(n.slurStart) inSlur = true;
    if(inSlur || n.slurStop) slurred.add(i);
    if(inSlur && !n.slurStop) slurLinks.add(i);   // slurLinks: draw an arc from this cell to the next within the run
    if(n.slurStop) inSlur = false;
    if(n.tieNext){ tied.add(i); tied.add(i+1); tieStarts.add(i); }   // tieStarts: draw the arc from this cell to the next
  });
  return {slurred, slurLinks, tied, tieStarts};
}

// Fill the per-note controls into `panel` (an inline box under the selected part).
function renderNoteEditor(panel){
  const n = selectedNote();
  if(!panel || !n) return;
  // lead-in (pickup): the beats from the start through this note. Offer the toggle only
  // when that's less than a full bar (a pickup is a short first bar).
  const _lt = selectedTrack();
  const cumThrough = _lt ? _lt.notes.slice(0, editSel.index + 1).reduce((s,m)=> s + (m.durBeat||0), 0) : 0;
  const showLeadIn = cumThrough > 1e-6 && cumThrough < barBeats() - 1e-6;
  const leadInOn = Math.abs(pickupBeats - cumThrough) < 1e-6;
  const letterOpts = PITCH_LETTERS.map(l=> `<option ${!n.isRest && n.step === l ? 'selected' : ''}>${l}</option>`).join('');
  const accOpts = ACCIDENTALS.map(([v,s])=> `<option value="${v}" ${!n.isRest && (n.alter||0) === v ? 'selected' : ''}>${s}</option>`).join('');
  const durOpts = EDIT_DURS.map(([lab,v])=> `<option value="${v}" ${n.durBeat === v ? 'selected' : ''}>${lab}</option>`).join('');
  panel.innerHTML = `
    <div class="grp"><label>Pitch</label>
      <button class="minibtn" id="neStepDn" ${n.isRest?'disabled':''} title="Down a step">−</button>
      <select id="neStep" ${n.isRest?'disabled':''}>${letterOpts}</select>
      <button class="minibtn" id="neStepUp" ${n.isRest?'disabled':''} title="Up a step">+</button>
      <button class="minibtn" id="neAccDn" ${n.isRest?'disabled':''} title="More flat">&lt;</button>
      <select id="neAcc" ${n.isRest?'disabled':''}>${accOpts}</select>
      <button class="minibtn" id="neAccUp" ${n.isRest?'disabled':''} title="More sharp">&gt;</button>
      <button class="minibtn" id="neOctDn" ${n.isRest?'disabled':''}>oct −</button>
      <span class="nm" id="neOct">${n.isRest?'–':n.oct}</span>
      <button class="minibtn" id="neOctUp" ${n.isRest?'disabled':''}>oct +</button>
    </div>
    <div class="grp"><label>Duration</label>
      <button class="minibtn" id="neDurDn" title="Shorter">&lt;</button>
      <select id="neDur">${durOpts}</select>
      <button class="minibtn" id="neDurUp" title="Longer">&gt;</button>
    </div>
    <button class="minibtn" id="neRest">${n.isRest?'Make note':'Make rest'}</button>
    <div class="grp">
      <button class="minibtn" id="neInsBefore">Insert before</button>
      <button class="minibtn" id="neInsAfter">Insert after</button>
      <button class="minibtn" id="neDelete">Delete</button>
      <button class="minibtn" id="neCopy">Copy</button>
      <button class="minibtn nePaste" id="nePaste">Paste</button>
      <button class="minibtn" id="neTie" ${canTieNext()?'':'disabled'} title="Tie to the next note (same pitch)">${n.tieNext?'Untie →':'Tie →'}</button>
      ${showLeadIn ? `<button class="minibtn${leadInOn?' on':''}" id="neLeadIn" title="Mark the notes up to here as a pickup / lead-in (a short first bar / anacrusis)">${leadInOn?'Lead-in ✓':'Lead-in'}</button>` : ''}
    </div>`;
  const t = selectedTrack(), i = editSel.index;
  panel.querySelector('#neStep').onchange = e=>{ pushUndo(); n.step = e.target.value; afterEdit(); };
  panel.querySelector('#neAcc').onchange = e=>{ pushUndo(); n.alter = parseInt(e.target.value); afterEdit(); };
  // step the letter up/down (diatonic, wraps octave) and the accidental flat<->sharp,
  // so you can click around instead of opening the dropdowns.
  panel.querySelector('#neStepDn').onclick = ()=>{ pushUndo(); nudgePitch(n, -1); afterEdit(); };
  panel.querySelector('#neStepUp').onclick = ()=>{ pushUndo(); nudgePitch(n, 1); afterEdit(); };
  panel.querySelector('#neAccDn').onclick = ()=>{ pushUndo(); n.alter = Math.max(-2, (n.alter||0) - 1); afterEdit(); };
  panel.querySelector('#neAccUp').onclick = ()=>{ pushUndo(); n.alter = Math.min(2, (n.alter||0) + 1); afterEdit(); };
  panel.querySelector('#neOctDn').onclick = ()=>{ pushUndo(); n.oct = Math.max(0, (n.oct||5) - 1); afterEdit(); };
  panel.querySelector('#neOctUp').onclick = ()=>{ pushUndo(); n.oct = Math.min(9, (n.oct||5) + 1); afterEdit(); };
  panel.querySelector('#neDur').onchange = e=>{ pushUndo(); n.durBeat = parseFloat(e.target.value); afterEdit(); };
  // < > step to the next shorter / longer standard duration (alongside the dropdown)
  panel.querySelector('#neDurDn').onclick = ()=>{ const prev = [...EDIT_DUR_VALS].reverse().find(v=> v < n.durBeat - 1e-9); if(prev != null){ pushUndo(); n.durBeat = prev; afterEdit(); } };
  panel.querySelector('#neDurUp').onclick = ()=>{ const next = EDIT_DUR_VALS.find(v=> v > n.durBeat + 1e-9); if(next != null){ pushUndo(); n.durBeat = next; afterEdit(); } };
  panel.querySelector('#neRest').onclick = ()=>{ pushUndo(); if(n.isRest){ n.isRest = false; n.step = n.step||'C'; n.alter = n.alter||0; n.oct = n.oct||5; } else n.isRest = true; afterEdit(); };
  panel.querySelector('#neInsBefore').onclick = ()=>{ pushUndo(); t.notes.splice(i, 0, defaultNote(n)); afterEdit(); };
  panel.querySelector('#neInsAfter').onclick = ()=>{ pushUndo(); t.notes.splice(i+1, 0, defaultNote(n)); editSel = {trackId:t.id, index:i+1}; afterEdit(); };
  panel.querySelector('#neDelete').onclick = ()=>{ pushUndo(); t.notes.splice(i, 1); editSel = t.notes.length ? {trackId:t.id, index:Math.min(i, t.notes.length-1)} : null; afterEdit(); };
  panel.querySelector('#neCopy').onclick = copySelection;
  panel.querySelector('#nePaste').onclick = pasteAfterSelection;
  panel.querySelector('#neTie').onclick = toggleTieNext;
  const leadBtn = panel.querySelector('#neLeadIn');
  if(leadBtn) leadBtn.onclick = ()=>{ pushUndo(); pickupBeats = leadInOn ? 0 : cumThrough; afterEdit(); };
  refreshPasteButtons();
}

// Bulk-edit bar shown when 2+ notes are selected in a part. Acts on the whole selection.
function renderBulkBar(panel, t, count){
  const durOpts = '<option value="">Duration…</option>' + EDIT_DURS.map(([lab,v])=> `<option value="${v}">${lab}</option>`).join('');
  panel.innerHTML = `
    <span class="bulkcount">${count} notes selected</span>
    <div class="grp"><label>Pitch</label>
      <button class="minibtn" id="blPitchDn">step −</button>
      <button class="minibtn" id="blPitchUp">step +</button>
      <button class="minibtn" id="blOctDn">oct −</button>
      <button class="minibtn" id="blOctUp">oct +</button>
    </div>
    <div class="grp"><label>Set</label><select id="blDur">${durOpts}</select></div>
    <button class="minibtn" id="blRest">Make rest</button>
    <div class="grp"><label>Phrasing</label>
      <button class="minibtn" id="blSlur" title="Slur the run (arc over the notes)">Slur</button>
      <button class="minibtn" id="blTie" title="Tie adjacent same-pitch notes (sustain)">Tie</button>
    </div>
    <div class="grp">
      <button class="minibtn" id="blCopy">Copy</button>
      <button class="minibtn nePaste" id="blPaste">Paste</button>
      <button class="minibtn" id="blDelete">Delete</button>
    </div>`;
  panel.querySelector('#blPitchUp').onclick = ()=> bulkNudge(1);
  panel.querySelector('#blPitchDn').onclick = ()=> bulkNudge(-1);
  panel.querySelector('#blOctUp').onclick = ()=> bulkOct(1);
  panel.querySelector('#blOctDn').onclick = ()=> bulkOct(-1);
  panel.querySelector('#blDur').onchange = e=>{ if(e.target.value) bulkDur(parseFloat(e.target.value)); };
  panel.querySelector('#blRest').onclick = ()=> bulkRest(true);
  panel.querySelector('#blSlur').onclick = toggleSlur;
  panel.querySelector('#blTie').onclick = toggleTie;
  panel.querySelector('#blCopy').onclick = copySelection;
  panel.querySelector('#blPaste').onclick = pasteAfterSelection;
  panel.querySelector('#blDelete').onclick = bulkDelete;
  refreshPasteButtons();
}


function nextTrackId(){
  const nums = tracks.map(t=> parseInt((t.id||'t0').slice(1)) || 0);
  return 't' + ((nums.length ? Math.max(...nums) : -1) + 1);
}
function addPart(){
  pushUndo();
  const id = nextTrackId();
  tracks.push({id, label:'Voice ' + (tracks.length+1), enabled:true, solo:false, vol:1, notes:[ defaultNote(null) ]});
  editSel = {trackId:id, index:0};
  afterEdit();
}
// Duplicate a part (a deep copy of its notes), inserted right after it, in edit mode.
function duplicatePart(t){
  pushUndo();
  const id = nextTrackId();
  const copy = {
    id, label: (t.label || 'Voice') + ' copy',
    enabled: true, solo: false, vol: t.vol != null ? t.vol : 1,
    view: t.view, editing: true, clef: t.clef || null,
    notes: (t.notes || []).map(n=> Object.assign({}, n)),
  };
  tracks.splice(tracks.indexOf(t) + 1, 0, copy);
  editSel = {trackId: id, index: 0};
  afterEdit();
}

// Phase 4: start a blank piece from scratch (one part, one note, ready to build on).
// Start a fresh piece from a list of parts ({label, note?}). The note's pitch
// fields are recomputed by reflow, so specs only need step/alter/oct/durBeat.
function startPiece(partsSpec){
  if(hasMusic() && !confirm('Start a new piece? This clears the current one.')) return;
  exitReview();
  pushUndo();
  pieceName = ''; lastXML = ''; transposeOffset = 0; homeOffset = 0; pickupBeats = 0; edited = true;
  meterBeats = 4; meterType = 4; setKey(0, 'C');   // sensible defaults: C major, 4/4
  tracks = partsSpec.map((s,i)=> ({id:'t'+i, label:s.label, enabled:true, solo:false, vol:1, clef:s.clef || null, notes:[ s.note || defaultNote(null) ]}));
  soloActive = false; editSel = {trackId:'t0', index:0};
  tracks[0].editing = true;   // open the first part's inline editor so you can start typing notes
  afterEdit();
  switchTab('player');
  openEditTools();            // reveal Title/timesig/Add part etc. for the new piece
  const tEl = document.getElementById('edTitle'); if(tEl){ tEl.value = ''; tEl.focus(); }
}
function newPiece(){ startPiece([{label:'Voice 1'}]); }
// One-click SATB: four empty voices at sensible starting octaves.
function newSATB(){ startPiece([
  {label:'Soprano', clef:'treble', note:{isRest:false, step:'C', alter:0, oct:5, durBeat:1}},
  {label:'Alto',    clef:'treble', note:{isRest:false, step:'A', alter:0, oct:4, durBeat:1}},
  {label:'Tenor',   clef:'treble', note:{isRest:false, step:'E', alter:0, oct:4, durBeat:1}},
  {label:'Bass',    clef:'bass',   note:{isRest:false, step:'C', alter:0, oct:3, durBeat:1}},
]); }

/* ---------- persistence ----------
   Autosave the working piece to localStorage (so a refresh never loses it), and
   let the user save/open a portable .solfege.json project capturing the full
   editor state (notes + meter + key + tempo + title). */
const SESSION_KEY = 'solfege-player-session';
let autosaveTimer = 0;

function sessionState(){
  return {
    v: 1, tracks, meterBeats, meterType, pieceName, transposeOffset, homeOffset, pickupBeats,
    tonicPc: currentTonic.pc, tonicLetter: currentTonic.letter,
    bpm: parseInt(document.getElementById('bpm').value) || 84,
    showDynamics, showBeams,
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
  homeOffset = (s.homeOffset != null) ? s.homeOffset : transposeOffset;   // old saves: treat the saved key as home (readout 0)
  pickupBeats = s.pickupBeats || 0;
  edited = true; lastXML = ''; editSel = null;
  tracks.forEach(t=>{ if(t.vol === undefined) t.vol = 1; if(t.enabled === undefined) t.enabled = true; });
  soloActive = tracks.some(t=> t.solo);   // re-activate solo if any voice was soloed (survives reload)
  if(s.tonicPc != null) setKey(s.tonicPc, s.tonicLetter);
  if(s.bpm) setTempo(s.bpm);
  if(s.showDynamics != null){ showDynamics = s.showDynamics; document.querySelectorAll('#dynToggle button').forEach(b=> b.classList.toggle('on', (b.dataset.dyn === 'show') === showDynamics)); }
  if(s.showBeams != null){ showBeams = s.showBeams; document.querySelectorAll('#beamToggle button').forEach(b=> b.classList.toggle('on', (b.dataset.beam === 'show') === showBeams)); }
  invalidateSheets(); render(); contentChanged();
  return true;
}
function restoreSession(){
  try{ const raw = localStorage.getItem(SESSION_KEY); return raw ? restoreState(JSON.parse(raw)) : false; }
  catch(_){ return false; }
}
async function saveProject(){
  const m = document.getElementById('editmsg');
  if(!hasMusic()){ if(m) m.textContent = 'Nothing to save yet.'; return; }
  const blob = new Blob([JSON.stringify(sessionState())], {type:'application/json'});
  const ok = await saveBlob(blob, safeName(pieceName || 'project') + '.solfege.json',
    {desc:'Solfège project', mime:'application/json', ext:['.json']});
  if(m) m.textContent = ok ? 'Project saved.' : '';
}
function openProject(file){
  const r = new FileReader();
  r.onload = ()=>{
    try{ if(restoreState(JSON.parse(r.result))){ autosave(); switchTab('player'); } else alert('That file has no parts to open.'); }
    catch(e){ alert('Could not open project: ' + e.message); }
  };
  r.readAsText(file);
}

function playerVisible(){ const v = document.getElementById('view-player'); return !!(v && !v.hidden); }

// Show a tab by name.
function switchTab(view){
  document.querySelectorAll('#tabs .tab').forEach(x=> x.classList.toggle('on', x.dataset.view === view));
  document.querySelectorAll('.view').forEach(s=> s.hidden = (s.id !== 'view-' + view));
  syncEditTools(view);
  if(view === 'player') render();   // now visible: engrave any per-part sheets that were deferred while hidden
}

// The piece tools toolbar (title/timesig/new/add/undo/save) is revealed by the
// Player's "Tools" toggle; hidden on the Full score tab.
let editToolsOpen = false;
function syncEditTools(view){
  const tools = document.getElementById('edtools');
  const toggle = document.getElementById('edToolsToggle');
  if(!tools) return;
  if(view === 'player'){ tools.hidden = !editToolsOpen; if(toggle){ toggle.hidden = false; toggle.classList.toggle('on', editToolsOpen); } }
  else { tools.hidden = true; if(toggle) toggle.hidden = true; }
}
function toggleEditTools(){ editToolsOpen = !editToolsOpen; syncEditTools('player'); }
// Open the tools toolbar in the player (used after New piece so you can name it).
function openEditTools(){ editToolsOpen = true; syncEditTools('player'); }

// Phase 5: after OMR, land in the editor with a "check me" banner before the player.
// Phase 5: after OMR, review/fix in the PLAYER (where you see + hear each part)
// behind a banner; very short parts are flagged on their rows as likely slips.
let reviewMode = false;
function enterReviewMode(){
  editSel = tracks.length ? {trackId: tracks[0].id, index: 0} : null;
  reviewMode = true;
  switchTab('player');   // renders the rows; reviewMode makes suspects flag
  setReviewBanner();
}
// Fill the banner text + show/hide the "Remove flagged" button for the current
// suspect set, and reflect reviewMode in the banner's visibility.
function setReviewBanner(){
  const ban = document.getElementById('omrbanner'); if(!ban) return;
  ban.hidden = !reviewMode;
  if(!reviewMode) return;
  const suspects = suspectParts();
  const txt = ban.querySelector('.omrtext');
  if(txt) txt.textContent = suspects.length
    ? `Transcribed from your image. ${suspects.length} very short part(s) are flagged below as likely OMR slips. Review each part, fix wrong notes, then keep or remove the flagged ones.`
    : 'Transcribed from your image. OMR is not perfect, so review each part, fix any wrong notes or rhythms, then dismiss this.';
  const rm = ban.querySelector('#omrRemove');
  if(rm){ rm.hidden = !suspects.length; rm.textContent = `Remove ${suspects.length} flagged part(s)`; }
}
// Leave review: clear the flag state and hide the banner. Callers re-render.
function exitReview(){ reviewMode = false; const ban = document.getElementById('omrbanner'); if(ban) ban.hidden = true; }
// Remove the currently flagged (suspect) parts - user-initiated, undoable.
function removeFlaggedParts(){
  const ids = new Set(suspectParts().map(s=> s.id)); if(!ids.size) return;
  pushUndo();
  tracks = tracks.filter(t=> !ids.has(t.id));
  if(editSel && ids.has(editSel.trackId)) editSel = null;
  afterEdit();
  setReviewBanner();   // fewer/no suspects now: update count / hide the button
}
function setMeterFromUI(){
  pushUndo();
  meterBeats = parseInt(document.getElementById('edBeats').value) || 4;
  meterType = parseInt(document.getElementById('edBeatType').value) || 4;
  afterEdit();
}

// Move a note by `steps` diatonic letter-steps (octave wraps; accidental kept).
// Used by the keyboard up/down nudge when a note is selected in a part's edit mode.
const LETTERS7 = ['C','D','E','F','G','A','B'];
function nudgePitch(n, steps){
  if(n.isRest || !steps) return;
  const ni = LETTERS7.indexOf(n.step) + steps;
  n.oct = (n.oct||5) + Math.floor(ni/7);
  n.step = LETTERS7[((ni % 7) + 7) % 7];
}

/* ---------- wiring ---------- */
document.getElementById('allmp3').addEventListener('click', e=> exportAllMp3(e.currentTarget));
document.getElementById('mixmp3').addEventListener('click', e=> exportMixMp3(e.currentTarget));
document.getElementById('allpng').addEventListener('click', e=> exportAllPng(e.currentTarget));
document.getElementById('allvid').addEventListener('click', e=> exportAllVideo(e.currentTarget));
document.getElementById('mixvid').addEventListener('click', e=> exportMixVideo(e.currentTarget));
document.getElementById('rendersheet').addEventListener('click', renderScore);
document.getElementById('savexml').addEventListener('click', downloadMusicXML);
document.getElementById('savepng').addEventListener('click', downloadScorePNG);
document.getElementById('savepdf').addEventListener('click', downloadScorePDF);
document.querySelectorAll('#masterview button').forEach(b=> b.addEventListener('click', ()=> setAllPartView(b.dataset.m)));
document.querySelectorAll('#dynToggle button').forEach(b=> b.addEventListener('click', ()=> setDynamics(b.dataset.dyn === 'show')));
document.querySelectorAll('#beamToggle button').forEach(b=> b.addEventListener('click', ()=> setBeams(b.dataset.beam === 'show')));
document.getElementById('trup').addEventListener('click', ()=> transposeBy(1));
document.getElementById('trdown').addEventListener('click', ()=> transposeBy(-1));
document.querySelectorAll('#tabs .tab').forEach(b=> b.addEventListener('click', ()=> switchTab(b.dataset.view)));
document.getElementById('omrDone').addEventListener('click', ()=>{ exitReview(); render(); });
document.getElementById('omrRemove').addEventListener('click', removeFlaggedParts);
// Click a notehead on the player staves or the full score to seek there (like the
// solfa cells). Delegated, so it works for cached/re-rendered sheets.
function seekFromSheetClick(e){
  const el = e.target.closest && e.target.closest('.sheetnote');
  if(!el || el.dataset.b0 === undefined) return;
  const b0 = parseFloat(el.dataset.b0);
  const t = el.dataset.tid && trackById(el.dataset.tid);   // per-part sheets carry a track id; full score doesn't
  if(t && t.editing){ selectNoteByBeat(t, b0, e); return; }   // editing this part -> pick the note instead of seeking
  seek(b0, true);
}
// Select the note nearest a beat in a track (used when clicking a notehead on a
// per-part staff while that part is in edit mode). Passes the event so Shift /
// Cmd-click extend the selection just like on the solfa cells.
function selectNoteByBeat(t, beat, e){
  let idx = t.notes.findIndex(n=> beat >= n.startBeat - 1e-3 && beat < n.startBeat + n.durBeat - 1e-3);
  if(idx < 0){ let best = Infinity; t.notes.forEach((n,i)=>{ const d = Math.abs(n.startBeat - beat); if(d < best){ best = d; idx = i; } }); }
  if(idx >= 0) selectChip(t.id, idx, t.notes[idx], e);
}
document.getElementById('stave').addEventListener('click', seekFromSheetClick);
document.getElementById('sheet').addEventListener('click', seekFromSheetClick);
// Editor controls
document.getElementById('edToolsToggle').addEventListener('click', toggleEditTools);
document.getElementById('edNew').addEventListener('click', newPiece);
document.getElementById('edSATB').addEventListener('click', newSATB);
document.getElementById('edAddPart').addEventListener('click', addPart);
document.getElementById('edUndo').addEventListener('click', undo);
document.getElementById('edSaveProj').addEventListener('click', saveProject);
document.getElementById('edOpenProj').addEventListener('click', ()=> document.getElementById('projfile').click());
document.getElementById('projfile').addEventListener('change', e=>{ if(e.target.files[0]) openProject(e.target.files[0]); e.target.value = ''; });
document.getElementById('edBeats').addEventListener('change', setMeterFromUI);
document.getElementById('edBeatType').addEventListener('change', setMeterFromUI);
document.getElementById('edTitle').addEventListener('input', e=>{ pieceName = e.target.value; autosave(); });
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
// Keyboard transport (ignored while typing in a field or the contenteditable label)
document.addEventListener('keydown', e=>{
  const tag = (e.target.tagName || '').toLowerCase();
  if(tag==='textarea' || tag==='input' || tag==='select' || e.target.isContentEditable) return;
  if((e.metaKey || e.ctrlKey) && e.code==='KeyZ'){ e.preventDefault(); undo(); return; }
  const selTrack = selectedTrack(), editing = selTrack && selTrack.editing && editSel;
  // Editing shortcuts on the selection (single note or a multi-selection):
  if(editing){
    if(e.code==='ArrowUp' || e.code==='ArrowDown'){ e.preventDefault(); bulkNudge(e.code==='ArrowUp' ? 1 : -1); return; }
    if((e.metaKey || e.ctrlKey) && e.code==='KeyC'){ e.preventDefault(); copySelection(); return; }
    if((e.metaKey || e.ctrlKey) && e.code==='KeyV'){ e.preventDefault(); pasteAfterSelection(); return; }
    if(e.code==='Backspace' || e.code==='Delete'){ e.preventDefault(); bulkDelete(); return; }
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
  // Picking a key declares it "home": transpose the music into it, then zero the
  // Transpose readout (homeOffset = current offset) so Transpose +/- counts from here.
  if(d !== 0 && tracks.length){ transposeBy(d); } else { syncTonicFromSel(); }
  homeOffset = transposeOffset;
  render();
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
