// Tests for solfege-player.html: icons, tabs/per-part toggle, the notes->MusicXML
// serializer, and saving the score to MusicXML / PNG / PDF files.
const { test, expect } = require('@playwright/test');
const path = require('path');

const url = 'file://' + path.resolve(__dirname, '..', 'solfege-player.html');

// A compact 2-voice (Soprano/Alto) MusicXML, both voices in one part via <backup>.
const SATB = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>Test Piece</work-title></work>
  <part-list><score-part id="P1"><part-name>Voice</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>1</duration><voice>1</voice><type>quarter</type><staff>1</staff></note>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><voice>1</voice><type>quarter</type><staff>1</staff></note>
      <note><pitch><step>E</step><octave>5</octave></pitch><duration>1</duration><voice>1</voice><type>quarter</type><staff>1</staff></note>
      <note><pitch><step>F</step><octave>5</octave></pitch><duration>1</duration><voice>1</voice><type>quarter</type><staff>1</staff></note>
      <backup><duration>4</duration></backup>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><voice>2</voice><type>quarter</type><staff>1</staff></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><voice>2</voice><type>quarter</type><staff>1</staff></note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><voice>2</voice><type>quarter</type><staff>1</staff></note>
      <note><pitch><step>A</step><octave>4</octave></pitch><duration>1</duration><voice>2</voice><type>quarter</type><staff>1</staff></note>
    </measure>
  </part>
</score-partwise>`;

async function loadSATB(page) {
  await page.evaluate((xml) => {
    document.getElementById('xml').value = xml;
    document.getElementById('xmlbtn').click();
  }, SATB);
  await page.waitForTimeout(300);
}

// --- player-editing helpers (the Edit tab was merged into the Player) ---
const partRow = (page, i = 0) => page.locator('.voice').nth(i);
async function editPart(page, i = 0) {            // turn on a part's inline editor
  const row = partRow(page, i);
  if (!(await row.locator('.vedit.on').count())) await row.locator('.vedit').click();
  return row;
}
async function openTools(page) {                   // reveal the piece-tools toolbar in the player
  if (!(await page.locator('#edtools').isVisible())) await page.locator('#edToolsToggle').click();
}
const cells = (row) => row.locator('.stave-row .note:not(.addnote)');

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.errors = errors;
  // Force the auto-download fallback by default so download-based tests are
  // deterministic (the real File System Access picker is a native dialog).
  // The "Save As" test below re-enables a fake picker explicitly.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true, writable: true });
    Object.defineProperty(window, 'showDirectoryPicker', { value: undefined, configurable: true, writable: true });
  });
  await page.goto(url);
  await page.waitForTimeout(300);
});

test('icons: no leftover unicode glyphs, SVG icons present, no page errors', async ({ page }) => {
  const leftover = await page.evaluate(() =>
    (document.body.innerText.match(/[⤓⏮⏭⏸▸▾■]/g) || []));
  expect(leftover).toEqual([]);
  expect(await page.locator('#tback svg, #tplay svg, #tfwd svg').count()).toBe(3);
  expect(await page.locator('#allmp3 svg, #mixmp3 svg, #allpng svg').count()).toBe(3);
  expect(page.errors).toEqual([]);
});

test('no em dashes anywhere in the served page', async ({ page }) => {
  const count = await page.evaluate(() => {
    const html = document.documentElement.outerHTML;
    return (html.match(/—/g) || []).length;
  });
  expect(count).toBe(0);
});

test('tabs (Player/Full score); transport bar sticky across tabs', async ({ page }) => {
  const tabs = await page.locator('#tabs .tab').allTextContents();
  expect(tabs).toEqual(['Player', 'Full score']);
  await loadSATB(page);
  expect(await page.locator('#transportbar').isVisible()).toBe(true);
  await page.locator('#tabs .tab', { hasText: 'Full score' }).click();
  expect(await page.locator('#transportbar').isVisible()).toBe(true);
  await page.locator('#tabs .tab', { hasText: 'Player' }).click();
  expect(await page.locator('#transportbar').isVisible()).toBe(true);
});

test('per-part solfa/sheet toggle is independent; master switch flips all', async ({ page }) => {
  await loadSATB(page);
  const parts = await page.locator('.voice .vlabel').allTextContents();
  expect(parts).toEqual(['Soprano', 'Alto']);

  // flip only Soprano to Sheet
  await page.locator('.voice', { hasText: 'Soprano' }).getByRole('button', { name: 'Sheet', exact: true }).click();
  await page.waitForTimeout(1500);
  expect(await page.locator('.voice', { hasText: 'Soprano' }).locator('.voicebox svg').count()).toBeGreaterThan(0);
  expect(await page.locator('.voice', { hasText: 'Alto' }).locator('.stave-row').count()).toBe(1); // still solfa

  // master -> Sheet renders both
  await page.locator('#masterview button', { hasText: 'Sheet' }).click();
  await page.waitForTimeout(2500);
  expect(await page.locator('.voice .voicebox svg').count()).toBe(2);
});

test('serializer: round-trip, ties across barlines, dotted rhythm', async ({ page }) => {
  const r = await page.evaluate(() => {
    const out = {};
    const d1 = new DOMParser().parseFromString(tracksToMusicXML({ beats: 4, beatType: 4 }), 'application/xml');
    out.parseError = !!d1.querySelector('parsererror');
    const p1 = d1.querySelector('part');
    out.measures = p1.querySelectorAll('measure').length;
    out.notes = [...p1.querySelectorAll('note')].map((n) =>
      n.querySelector('rest') ? 'R' : n.querySelector('step').textContent + n.querySelector('octave').textContent);

    const lt = { label: 'L', notes: [
      { isRest: false, step: 'C', alter: 0, oct: 5, pc: 0, midi: 72, name: 'C5', startBeat: 0, durBeat: 6 },
      { isRest: false, step: 'D', alter: 0, oct: 5, pc: 2, midi: 74, name: 'D5', startBeat: 6, durBeat: 2 } ] };
    const d2 = new DOMParser().parseFromString(tracksToMusicXML({ tracks: [lt], beats: 4, beatType: 4 }), 'application/xml');
    out.tieStarts = d2.querySelectorAll('tie[type="start"]').length;
    out.tieStops = d2.querySelectorAll('tie[type="stop"]').length;

    const dt = { label: 'D', notes: [
      { isRest: false, step: 'E', alter: 0, oct: 4, pc: 4, midi: 64, name: 'E4', startBeat: 0, durBeat: 1.5 },
      { isRest: false, step: 'F', alter: 0, oct: 4, pc: 5, midi: 65, name: 'F4', startBeat: 1.5, durBeat: 0.5 } ] };
    const d3 = new DOMParser().parseFromString(tracksToMusicXML({ tracks: [dt], beats: 4, beatType: 4 }), 'application/xml');
    out.firstType = d3.querySelector('part note type').textContent;
    out.firstDots = d3.querySelectorAll('part note:first-of-type dot').length;
    return out;
  });
  expect(r.parseError).toBe(false);
  expect(r.measures).toBe(2);
  expect(r.notes).toEqual(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']);
  expect(r.tieStarts).toBe(1);
  expect(r.tieStops).toBe(1);
  expect(r.firstType).toBe('quarter');
  expect(r.firstDots).toBe(1);
});

test('save score: MusicXML download is valid', async ({ page }) => {
  await loadSATB(page);
  await page.locator('#tabs .tab', { hasText: 'Full score' }).click();
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#savexml').click(),
  ]);
  expect(dl.suggestedFilename()).toMatch(/\.musicxml$/);
  const fs = require('fs');
  const p = await dl.path();
  const text = fs.readFileSync(p, 'utf8');
  expect(text).toContain('<score-partwise');
  expect(text).toContain('Soprano');
});

test('save score: PNG download has bytes', async ({ page }) => {
  await loadSATB(page);
  await page.locator('#tabs .tab', { hasText: 'Full score' }).click();
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('#savepng').click(),
  ]);
  expect(dl.suggestedFilename()).toMatch(/\.png$/);
  const fs = require('fs');
  const size = fs.statSync(await dl.path()).size;
  expect(size).toBeGreaterThan(1000);
});

test('save score: PDF download has bytes', async ({ page }) => {
  await loadSATB(page);
  await page.locator('#tabs .tab', { hasText: 'Full score' }).click();
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('#savepdf').click(),
  ]);
  expect(dl.suggestedFilename()).toMatch(/\.pdf$/);
  const fs = require('fs');
  const buf = fs.readFileSync(await dl.path());
  expect(buf.length).toBeGreaterThan(1000);
  expect(buf.slice(0, 4).toString()).toBe('%PDF');
});

test('save score: when the browser supports it, asks WHERE to save (File System Access)', async ({ page }) => {
  await loadSATB(page);
  await page.locator('#tabs .tab', { hasText: 'Full score' }).click();
  // Install a fake picker that captures what would be written, and trip a flag
  // if the auto-download fallback fires (it must not, when the picker exists).
  await page.evaluate(() => {
    window.__saved = null;
    window.__downloaded = false;
    const realCreate = document.createElement.bind(document);
    document.createElement = (tag) => {
      const el = realCreate(tag);
      if (tag === 'a') { const click = el.click.bind(el); el.click = () => { if (el.download) window.__downloaded = true; return click(); }; }
      return el;
    };
    window.showSaveFilePicker = async (opts) => ({
      createWritable: async () => ({
        write: async (blob) => { window.__saved = { name: opts.suggestedName, type: opts.types && opts.types[0], text: await blob.text() }; },
        close: async () => {},
      }),
    });
  });
  await page.locator('#savexml').click();
  await page.waitForFunction(() => window.__saved !== null, null, { timeout: 5000 });
  const saved = await page.evaluate(() => window.__saved);
  expect(saved.name).toMatch(/\.musicxml$/);
  expect(saved.text).toContain('<score-partwise');
  expect(await page.evaluate(() => window.__downloaded)).toBe(false);
  await expect(page.locator('#savemsg')).toHaveText(/Saved MusicXML/);
});

test('export all: when supported, asks ONCE for a folder and writes every part into it', async ({ page }) => {
  await loadSATB(page);   // 2 parts (Soprano, Alto)
  await page.evaluate(() => {
    window.__dirFiles = [];
    window.__downloaded = 0;
    const realCreate = document.createElement.bind(document);
    document.createElement = (tag) => {
      const el = realCreate(tag);
      if (tag === 'a') { const click = el.click.bind(el); el.click = () => { if (el.download) window.__downloaded++; return click(); }; }
      return el;
    };
    window.__dirPrompts = 0;
    window.showDirectoryPicker = async () => {
      window.__dirPrompts++;
      return { getFileHandle: async (name) => ({
        createWritable: async () => ({ write: async (blob) => { window.__dirFiles.push({ name, size: blob.size }); }, close: async () => {} }),
      }) };
    };
  });
  await page.locator('#allpng').click();
  await page.waitForFunction(() => window.__dirFiles && window.__dirFiles.length === 2, null, { timeout: 15000 });
  const files = await page.evaluate(() => window.__dirFiles);
  expect(files.every((f) => /\.png$/.test(f.name))).toBe(true);
  expect(files.every((f) => f.size > 0)).toBe(true);
  expect(await page.evaluate(() => window.__dirPrompts)).toBe(1);    // one folder prompt, not one per part
  expect(await page.evaluate(() => window.__downloaded)).toBe(0);    // nothing leaked to Downloads
});

test('save score: cancelling the Save As picker leaves no file and no error', async ({ page }) => {
  await loadSATB(page);
  await page.locator('#tabs .tab', { hasText: 'Full score' }).click();
  await page.evaluate(() => {
    window.__downloaded = false;
    const realCreate = document.createElement.bind(document);
    document.createElement = (tag) => {
      const el = realCreate(tag);
      if (tag === 'a') { const click = el.click.bind(el); el.click = () => { if (el.download) window.__downloaded = true; return click(); }; }
      return el;
    };
    window.showSaveFilePicker = async () => { const e = new Error('user cancelled'); e.name = 'AbortError'; throw e; };
  });
  await page.locator('#savexml').click();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__downloaded)).toBe(false);   // nothing leaked to Downloads
  await expect(page.locator('#savemsg')).toHaveText('');                // no false "Saved ✓"
  expect(page.errors).toEqual([]);
});

// ---- Phase 2: editing in the player ----

test('player lists each part with its notes', async ({ page }) => {
  expect(await page.locator('#tabs .tab').allTextContents()).toEqual(['Player', 'Full score']);
  await loadSATB(page);
  expect(await page.locator('.voice').count()).toBe(2);
  // turn on Soprano's editor: its 4 notes show as editable cells
  const sop = await editPart(page, 0);
  expect(await cells(sop).count()).toBe(4);
});

test('player: the Tools toggle reveals the piece toolbar', async ({ page }) => {
  await loadSATB(page);
  await expect(page.locator('#edtools')).toBeHidden();
  await expect(page.locator('#edToolsToggle')).toBeVisible();
  await page.locator('#edToolsToggle').click();
  await expect(page.locator('#edtools')).toBeVisible();
  // an action works from here (Add part)
  const before = await page.evaluate(() => tracks.length);
  await page.locator('#edAddPart').click();
  expect(await page.evaluate(() => tracks.length)).toBe(before + 1);
  await page.locator('#edToolsToggle').click();
  await expect(page.locator('#edtools')).toBeHidden();
});

test('player edit: changing pitch updates the model and live preview', async ({ page }) => {
  await loadSATB(page);
  const sop = await editPart(page, 0);
  // select first note of Soprano, change its letter C -> G
  await cells(sop).first().click();
  await sop.locator('.noteeditor #neStep').selectOption('G');
  await page.waitForTimeout(400);
  const first = await page.evaluate(() => ({ step: tracks[0].notes[0].step, name: tracks[0].notes[0].name, edited }));
  expect(first.step).toBe('G');
  expect(first.name).toContain('G');
  expect(first.edited).toBe(true);
  // the per-part live preview engraves
  await page.waitForFunction(() => {
    const v = [...document.querySelectorAll('.voice')].find((e) => e.textContent.includes('Soprano'));
    return v && v.querySelector('.editpreview svg');
  }, null, { timeout: 8000 });
});

test('player edit: insert, delete, rest, duration, add/remove part, undo', async ({ page }) => {
  await loadSATB(page);
  const sop = await editPart(page, 0);
  const n0 = await page.evaluate(() => tracks[0].notes.length);

  // select first note, insert after -> +1
  await cells(sop).first().click();
  await sop.locator('.noteeditor #neInsAfter').click();
  expect(await page.evaluate(() => tracks[0].notes.length)).toBe(n0 + 1);

  // make it a rest
  await sop.locator('.noteeditor #neRest').click();
  expect(await page.evaluate(() => tracks[0].notes[editSel.index].isRest)).toBe(true);

  // back to a note, change duration to a half (2 beats)
  await sop.locator('.noteeditor #neRest').click();
  await sop.locator('.noteeditor #neDur').selectOption('2');
  expect(await page.evaluate(() => tracks[0].notes[editSel.index].durBeat)).toBe(2);

  // delete it -> back to n0
  await sop.locator('.noteeditor #neDelete').click();
  expect(await page.evaluate(() => tracks[0].notes.length)).toBe(n0);

  // add a part via Tools -> 3, delete it via its row's Delete part -> 2
  await openTools(page);
  await page.locator('#edAddPart').click();
  expect(await page.evaluate(() => tracks.length)).toBe(3);
  const added = await editPart(page, 2);
  await added.locator('.delpart').click();
  expect(await page.evaluate(() => tracks.length)).toBe(2);

  // undo (the delete-part) -> back to 3
  await page.locator('#edUndo').click();
  expect(await page.evaluate(() => tracks.length)).toBe(3);
});

test('note editor: +/- step buttons and < > accidental buttons drive the pitch (alongside the dropdowns)', async ({ page }) => {
  await loadSATB(page);                                 // Soprano note 0 = C5
  const sop = await editPart(page, 0);
  await cells(sop).first().click();
  // pitch +/- step the letter diatonically (and wrap the octave)
  await sop.locator('.noteeditor #neStepUp').click();
  expect(await page.evaluate(() => tracks[0].notes[0].step)).toBe('D');
  await sop.locator('.noteeditor #neStepDn').click();
  expect(await page.evaluate(() => tracks[0].notes[0].step)).toBe('C');
  // accidental < > go flatter / sharper, clamped to +/-2
  await sop.locator('.noteeditor #neAccUp').click();
  expect(await page.evaluate(() => tracks[0].notes[0].alter)).toBe(1);
  await sop.locator('.noteeditor #neAccDn').click();
  await sop.locator('.noteeditor #neAccDn').click();
  expect(await page.evaluate(() => tracks[0].notes[0].alter)).toBe(-1);
  // duration < > step to the next shorter / longer standard value
  const dur0 = await page.evaluate(() => tracks[0].notes[0].durBeat);   // quarter = 1
  await sop.locator('.noteeditor #neDurUp').click();
  expect(await page.evaluate(() => tracks[0].notes[0].durBeat)).toBe(1.5);   // -> dotted quarter
  await sop.locator('.noteeditor #neDurDn').click();
  await sop.locator('.noteeditor #neDurDn').click();
  expect(await page.evaluate(() => tracks[0].notes[0].durBeat)).toBe(0.75);  // 1.5 -> 1 -> 0.75
  // the dropdowns are still there
  await expect(sop.locator('.noteeditor #neStep')).toBeVisible();
  await expect(sop.locator('.noteeditor #neAcc')).toBeVisible();
  await expect(sop.locator('.noteeditor #neDur')).toBeVisible();
});

test('player edit: a part can be duplicated', async ({ page }) => {
  await loadSATB(page);
  const sop = await editPart(page, 0);
  const n0 = await page.evaluate(() => tracks[0].notes.length);
  await sop.locator('.duppart').click();
  expect(await page.evaluate(() => tracks.length)).toBe(3);                 // copy inserted
  expect(await page.evaluate(() => tracks[1].label)).toBe('Soprano copy');  // right after the original
  expect(await page.evaluate(() => tracks[1].notes.length)).toBe(n0);       // same notes
  // it's a deep copy: editing the copy doesn't touch the original
  expect(await page.evaluate(() => tracks[1].notes !== tracks[0].notes)).toBe(true);
});

test('player edit: the part label is renamable in edit mode', async ({ page }) => {
  await loadSATB(page);
  const sop = await editPart(page, 0);
  await sop.locator('.vlabel-edit').fill('Descant');
  expect(await page.evaluate(() => tracks[0].label)).toBe('Descant');
});

test('player edit: time signature drives serialized meter', async ({ page }) => {
  await loadSATB(page);
  await openTools(page);
  await page.locator('#edBeats').selectOption('3');
  await page.locator('#edBeatType').selectOption('4');
  const meter = await page.evaluate(() => {
    const d = new DOMParser().parseFromString(tracksToMusicXML({ beats: meterBeats, beatType: meterType }), 'application/xml');
    return { b: d.querySelector('time beats').textContent, t: d.querySelector('time beat-type').textContent };
  });
  expect(meter).toEqual({ b: '3', t: '4' });
});

// ---- Phase 3: staff interaction ----

test('player edit: clicking a note on the live preview staff selects it', async ({ page }) => {
  await loadSATB(page);
  const sop = await editPart(page, 0);
  await page.waitForFunction(() => {
    const v = [...document.querySelectorAll('.voice')].find((e) => e.textContent.includes('Soprano'));
    return v && v.querySelector('.editpreview .sheetnote');
  }, null, { timeout: 8000 });
  // click the 3rd Soprano notehead (beat 2 = E5) on the preview staff
  await sop.locator('.editpreview .sheetnote[data-b0="2.0000"]').click();
  expect(await page.evaluate(() => editSel && editSel.index)).toBe(2);
  expect(await sop.locator('.note.sel .nm').textContent()).toBe('E5');           // grid cell selected
  await expect(sop.locator('.editpreview .sheetnote.selnote')).not.toHaveCount(0); // highlighted on staff
});

test('player edit: arrow up/down nudges the selected pitch a diatonic step', async ({ page }) => {
  await loadSATB(page);
  const sop = await editPart(page, 0);
  await cells(sop).first().click(); // C5
  await page.keyboard.press('ArrowUp');   // C5 -> D5
  expect(await page.evaluate(() => tracks[0].notes[0].name)).toBe('D5');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown'); // D5 -> C5 -> B4
  expect(await page.evaluate(() => tracks[0].notes[0].name)).toBe('B4');
});

// ---- Phase 4: blank "New piece" builder ----

test('New piece: starts a blank piece in the player, builds and serializes', async ({ page }) => {
  // the app boots with a default melody, so New piece asks to confirm; accept it
  page.on('dialog', (d) => d.accept());
  await openTools(page);
  await page.locator('#edNew').click();
  await page.waitForTimeout(300);
  // lands in the player with one part + one note, in edit mode
  expect(await page.locator('#view-player').isVisible()).toBe(true);
  expect(await page.evaluate(() => tracks.length)).toBe(1);
  expect(await page.evaluate(() => tracks[0].notes.length)).toBe(1);
  expect(await page.evaluate(() => ({ beats: meterBeats, type: meterType, edited }))).toEqual({ beats: 4, type: 4, edited: true });

  // build it: add two notes via the open part's add cell, set title
  const row = partRow(page, 0);
  await row.locator('.stave-row .note.addnote').click();
  await row.locator('.stave-row .note.addnote').click();
  await page.fill('#edTitle', 'My Tune');
  expect(await page.evaluate(() => tracks[0].notes.length)).toBe(3);

  // it serializes to valid MusicXML with the title
  const xml = await page.evaluate(() => tracksToMusicXML({ beats: meterBeats, beatType: meterType }));
  expect(xml).toContain('<score-partwise');
  expect(xml).toContain('My Tune');

  // and the per-part live preview engraves
  await page.waitForFunction(() => { const pv = document.querySelector('.editpreview'); return pv && pv.querySelector('svg'); }, null, { timeout: 8000 });
});

test('New piece: prompts before discarding a loaded piece', async ({ page }) => {
  await loadSATB(page); // now hasMusic() is true
  await openTools(page);

  // dismiss the confirm -> keep the SATB piece (2 parts)
  page.once('dialog', (d) => d.dismiss());
  await page.locator('#edNew').click();
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => tracks.length)).toBe(2);

  // accept the confirm -> blank piece (1 part)
  page.once('dialog', (d) => d.accept());
  await page.locator('#edNew').click();
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => tracks.length)).toBe(1);
});

test('piece title and part names are editable and app-styled', async ({ page }) => {
  await loadSATB(page);
  await openTools(page);
  // title input is styled like the app (bordered + serif), not a raw browser box
  const s = await page.evaluate(() => { const c = getComputedStyle(document.getElementById('edTitle')); return { bw: c.borderTopWidth, ff: c.fontFamily.toLowerCase() }; });
  expect(s.bw).not.toBe('0px');
  expect(s.ff).toContain('newsreader');
  // rename a part in the player's edit mode
  const sop = await editPart(page, 0);
  await sop.locator('.vlabel-edit').fill('Descant');
  expect(await page.evaluate(() => tracks[0].label)).toBe('Descant');
  // rename the piece
  await page.fill('#edTitle', 'Hymn 42');
  expect(await page.evaluate(() => pieceName)).toBe('Hymn 42');
});

// ---- Phase 5: OMR review/edit gate ----

test('Phase 5: a transcription lands in the Player behind a review banner', async ({ page }) => {
  await page.route('**/transcribe', (route) => route.fulfill({ status: 200, contentType: 'application/xml', body: SATB }));
  // drive the OMR path directly with a fake file (fetch is mocked)
  await page.evaluate(() => transcribePhoto(new File(['x'], 'scan.png', { type: 'image/png' }), document.getElementById('photomsg')));
  await page.waitForTimeout(400);
  // landed in the Player with the review banner shown, parts loaded
  expect(await page.locator('#view-player').isVisible()).toBe(true);
  expect(await page.locator('#omrbanner').isVisible()).toBe(true);
  expect(await page.evaluate(() => tracks.length)).toBe(2);
  // "Looks good" dismisses the banner, still on the Player
  await page.locator('#omrDone').click();
  expect(await page.locator('#view-player').isVisible()).toBe(true);
  expect(await page.locator('#omrbanner').isVisible()).toBe(false);
});

test('OMR review flags suspect parts on the player rows and removes them from the banner', async ({ page }) => {
  // 8 voices: two real (10 notes) + two 1-note slips, across two parts.
  const note = (s, o, v) => `<note><pitch><step>${s}</step><octave>${o}</octave></pitch><duration>1</duration><voice>${v}</voice><type>quarter</type></note>`;
  const rep = (s, o, v, n) => Array.from({ length: n }, () => note(s, o, v)).join('');
  const part = (id) => `<part id="${id}"><measure number="1"><attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>${rep('C', 5, 1, 10)}${rep('E', 4, 2, 10)}${note('G', 4, 3)}${note('A', 4, 4)}</measure></part>`;
  const xml8 = `<?xml version="1.0"?><score-partwise version="3.1"><part-list><score-part id="P1"><part-name>V</part-name></score-part><score-part id="P2"><part-name>V</part-name></score-part></part-list>${part('P1')}${part('P2')}</score-partwise>`;
  await page.route('**/transcribe', (route) => route.fulfill({ status: 200, contentType: 'application/xml', body: xml8 }));
  await page.evaluate(() => transcribePhoto(new File(['x'], 'scan.png', { type: 'image/png' }), document.getElementById('photomsg')));
  await page.waitForTimeout(400);
  expect(await page.locator('#view-player').isVisible()).toBe(true);
  expect(await page.locator('.voice.suspect').count()).toBe(4);        // four 1-note slips flagged on the rows
  await expect(page.locator('#omrRemove')).toBeVisible();
  // remove flagged from the banner -> only the substantial voices remain, flags clear
  await page.locator('#omrRemove').click();
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => tracks.length)).toBe(4);
  expect(await page.locator('.voice.suspect').count()).toBe(0);
  await expect(page.locator('#omrbanner')).toBeVisible();              // still reviewing, just nothing flagged now
});

test('Phase 5: a failed (low-res) picture is handled gracefully through the real UI', async ({ page }) => {
  // Mock the backend rejecting a low-res image, exactly as Audiveris does below ~300 DPI.
  await page.route('**/transcribe', (route) => route.fulfill({
    status: 422, contentType: 'application/json',
    body: JSON.stringify({ detail: 'Image resolution too low for OMR. Audiveris needs roughly 300 DPI.' }),
  }));
  // Choose a picture through the actual file input + Transcribe button (not via internals).
  await page.locator('summary', { hasText: 'Transcribe a photo' }).click();   // open the <details>
  await page.setInputFiles('#photo', { name: 'lowres.png', mimeType: 'image/png', buffer: Buffer.from('not-a-real-image') });
  await page.click('#photobtn');
  await page.waitForFunction(() => /Could not transcribe/.test(document.getElementById('photomsg').textContent || ''), null, { timeout: 10000 });
  const msg = await page.locator('#photomsg').textContent();
  expect(msg).toContain('Could not transcribe');
  expect(msg).toMatch(/New piece|by hand/);              // points to the manual-build fallback
  expect(await page.locator('#omrbanner').isVisible()).toBe(false);   // no review banner on failure
  expect(await page.locator('#view-player').isVisible()).toBe(true);  // stayed put, did not crash
  expect(page.errors).toEqual([]);
});

test('OMR import keeps every voice; editor flags short ones for review (no auto-delete)', async ({ page }) => {
  // A part with two real voices (10 notes each) + two 1-note "voices", times two parts = 8 streams.
  const note = (s, o, v) => `<note><pitch><step>${s}</step><octave>${o}</octave></pitch><duration>1</duration><voice>${v}</voice><type>quarter</type></note>`;
  const rep = (s, o, v, n) => Array.from({ length: n }, () => note(s, o, v)).join('');
  const part = (id) => `<part id="${id}"><measure number="1"><attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>${rep('C', 5, 1, 10)}${rep('E', 4, 2, 10)}${note('G', 4, 3)}${note('A', 4, 4)}</measure></part>`;
  const xml = `<?xml version="1.0"?><score-partwise version="3.1"><part-list><score-part id="P1"><part-name>V</part-name></score-part><score-part id="P2"><part-name>V</part-name></score-part></part-list>${part('P1')}${part('P2')}</score-partwise>`;

  const n = await page.evaluate((x) => { loadMusicXMLText(x, document.getElementById('xmlmsg')); return tracks.length; }, xml);
  expect(n).toBe(8);   // every voice survives import; nothing is dropped automatically
  expect(page.errors).toEqual([]);
});

test('player edit: edits flow through to the player sheet (serializer, not stale import)', async ({ page }) => {
  await loadSATB(page);
  // change Soprano first note to A5 via the player's inline editor
  const sop = await editPart(page, 0);
  await cells(sop).first().click();
  await sop.locator('.noteeditor #neStep').selectOption('A');
  await page.waitForTimeout(300);
  // the part's engraved staff renders from the edited notes
  await page.locator('.voice', { hasText: 'Soprano' }).getByRole('button', { name: 'Sheet', exact: true }).click();
  await page.waitForTimeout(1500);
  expect(await page.locator('.voice', { hasText: 'Soprano' }).locator('.voicebox svg').count()).toBeGreaterThan(0);
});

// ---- SATB template + persistence ----

test('New SATB: creates four named voices', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await openTools(page);
  await page.locator('#edSATB').click();
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => tracks.map((t) => t.label))).toEqual(['Soprano', 'Alto', 'Tenor', 'Bass']);
});

test('persistence: the working piece survives a page reload', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await openTools(page);
  await page.locator('#edNew').click();
  await page.fill('#edTitle', 'PersistMe');
  await partRow(page, 0).locator('.stave-row .note.addnote').click(); // 2 notes
  await page.waitForTimeout(900); // let the 600ms autosave debounce flush
  await page.reload();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => pieceName)).toBe('PersistMe');
  expect(await page.evaluate(() => tracks.length)).toBe(1);
  expect(await page.evaluate(() => tracks[0].notes.length)).toBe(2);
});

test('persistence: a soloed voice stays soloed after a reload', async ({ page }) => {
  await loadSATB(page);
  await page.locator('.voice', { hasText: 'Soprano' }).getByRole('button', { name: 'Solo', exact: true }).click();
  expect(await page.evaluate(() => soloActive)).toBe(true);
  await page.waitForTimeout(900);   // let autosave flush
  await page.reload();
  await page.waitForTimeout(400);
  // solo is re-activated, the soloed track is still flagged, and the button shows it
  expect(await page.evaluate(() => soloActive)).toBe(true);
  expect(await page.evaluate(() => tracks.find((t) => t.label === 'Soprano').solo)).toBe(true);
  const on = await page.locator('.voice', { hasText: 'Soprano' }).getByRole('button', { name: 'Solo', exact: true }).evaluate((el) => el.classList.contains('on'));
  expect(on).toBe(true);
});

test('project: Save downloads a .solfege.json and Open restores it', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await openTools(page);
  await page.locator('#edSATB').click();
  await page.fill('#edTitle', 'ProjTest');
  await page.waitForTimeout(300);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#edSaveProj').click()]);
  expect(dl.suggestedFilename()).toMatch(/\.solfege\.json$/);
  const fs = require('fs');
  const path = await dl.path();
  const json = JSON.parse(fs.readFileSync(path, 'utf8'));
  expect(json.tracks.length).toBe(4);
  expect(json.pieceName).toBe('ProjTest');
  // replace with a different piece, then open the saved file back
  await page.locator('#edNew').click();
  expect(await page.evaluate(() => tracks.length)).toBe(1);
  await page.setInputFiles('#projfile', path);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => tracks.length)).toBe(4);
  expect(await page.evaluate(() => pieceName)).toBe('ProjTest');
});

// ---- movable-do: changing key transposes (regression: no double-transpose) ----

test('key change transposes movable-do; sheet is not double-transposed', async ({ page }) => {
  // default melody is the C-major scale in C; choose E major
  await page.selectOption('#key', { label: 'E major' });
  await page.waitForTimeout(200);
  // movable do: solfège stays do-re-mi..., and the notes actually move to E major
  expect(await page.locator('#stave .note .solf').allTextContents()).toEqual(['Do', 'Re', 'Mi', 'Fa', 'So', 'La', 'Ti', 'Do']);
  expect(await page.evaluate(() => tracks[0].notes.map((n) => n.name))).toEqual(['E4', 'F#4', 'G#4', 'A4', 'B4', 'C#5', 'D#5', 'E5']);
  expect(await page.evaluate(() => transposeOffset)).toBe(4);
  // the serialized sheet carries E major (4 sharps) in the key signature
  const fifths = await page.evaluate(() => new DOMParser()
    .parseFromString(tracksToMusicXML({ beats: meterBeats, beatType: meterType }), 'application/xml')
    .querySelector('key fifths').textContent);
  expect(fifths).toBe('4');
  // rendering the full score must NOT re-apply OSMD transpose on top (would double it)
  await page.locator('#tabs .tab', { hasText: 'Full score' }).click();
  await page.locator('#rendersheet').click();
  await page.waitForFunction(() => typeof osmd !== 'undefined' && osmd && osmd.GraphicSheet, null, { timeout: 8000 });
  expect(await page.evaluate(() => osmd.Sheet.Transpose || 0)).toBe(0);
});

// ---- manual entry folded into the Edit tab + live editor sync ----

test('manual entry + presets live in the always-visible load panel', async ({ page }) => {
  const loadPanel = page.locator('.upload').first().locator('xpath=ancestor::div[contains(@class,"panel")]');
  expect(await loadPanel.locator('#notes').count()).toBe(1);
  expect(await loadPanel.locator('.ghost[data-ex]').count()).toBe(4);
});

test('presets update the player immediately', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.locator('summary', { hasText: 'Type a melody by hand' }).click();   // open the load-panel section
  // click a preset in the load panel
  await page.locator('.ghost[data-ex]', { hasText: 'Twinkle' }).click();
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => tracks[0].notes.length)).toBe(14);
  // the player grid reflects the new melody (turn on its editor to read the cells)
  const row = await editPart(page, 0);
  expect(await cells(row).count()).toBe(14);
});

test('transposing updates the player grid immediately', async ({ page }) => {
  await loadSATB(page);
  const sop = await editPart(page, 0);
  // bump up a semitone from the transpose control; the grid re-renders in place
  await page.locator('#trup').click();
  await page.waitForTimeout(200);
  // first Soprano note moved C5 -> C#5/Db5 and the cell text follows the model
  const name = await page.evaluate(() => tracks[0].notes[0].name);
  const cell = await cells(sop).first().locator('.nm').textContent();
  expect(cell).toBe(name);
});

// ---- playback highlights the engraved staff (not just the solfa cells) ----

test('playback lights the sounding note on a per-part sheet', async ({ page }) => {
  await loadSATB(page);
  await page.locator('.voice', { hasText: 'Soprano' }).getByRole('button', { name: 'Sheet', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.voicebox .sheetnote').length > 0, null, { timeout: 8000 });
  // every pitched notehead is tagged with its beat window
  expect(await page.locator('.voicebox .sheetnote').count()).toBeGreaterThan(0);

  // at beat 0 the first notehead lights up, mirroring the solfa cell behaviour
  await page.evaluate(() => paintHighlights(0));
  expect(await page.locator('.voicebox .sheetnote.playing').count()).toBeGreaterThan(0);
  const first = await page.evaluate(() => {
    const el = document.querySelector('.voicebox .sheetnote.playing');
    return { b0: parseFloat(el.dataset.b0), b1: parseFloat(el.dataset.b1) };
  });
  expect(first.b0).toBeLessThanOrEqual(0);
  expect(first.b1).toBeGreaterThan(0);

  // advance into the 3rd quarter note (beat 2..3): only notes whose window holds 2.5 are lit
  await page.evaluate(() => paintHighlights(2.5));
  const lit = await page.evaluate(() => [...document.querySelectorAll('.voicebox .sheetnote.playing')]
    .map((el) => [parseFloat(el.dataset.b0), parseFloat(el.dataset.b1)]));
  expect(lit.length).toBeGreaterThan(0);
  expect(lit.every(([b0, b1]) => b0 <= 2.5 && b1 > 2.5)).toBe(true);

  // a muted part does not light up
  await page.evaluate(() => { tracks[0].enabled = false; render(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => paintHighlights(0));
  expect(await page.locator('.voicebox .sheetnote.playing').count()).toBe(0);
});

test('playback lights noteheads on the full score too', async ({ page }) => {
  await loadSATB(page);
  await page.locator('#tabs .tab', { hasText: 'Full score' }).click();
  await page.locator('#rendersheet').click();
  await page.waitForFunction(() => document.querySelectorAll('#sheet .sheetnote').length > 0, null, { timeout: 8000 });
  await page.evaluate(() => paintHighlights(0));
  // both voices sound at beat 0, so at least the two opening noteheads light up
  expect(await page.locator('#sheet .sheetnote.playing').count()).toBeGreaterThan(0);
});

// ---- melody box is gated behind Re-parse (no per-keystroke clobber) ----

test('melody box rebuilds only on Re-parse, not on every keystroke', async ({ page }) => {
  await loadSATB(page);
  expect(await page.evaluate(() => tracks.length)).toBe(2);
  await page.locator('summary', { hasText: 'Type a melody by hand' }).click();
  await page.fill('#notes', 'C4 D4 E4');
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => tracks.length)).toBe(2);            // typing did not clobber the 2-part piece
  await page.locator('#parsebtn').click();
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => tracks.length)).toBe(1);            // Re-parse rebuilt to a single melody
  expect(await page.evaluate(() => tracks[0].notes.length)).toBe(3);
});

// ---- a note keeps its own duration; the sheet ties it across barlines (reflow never clamps) ----

test('a note longer than its bar keeps its duration; the sheet ties it across the barline', async ({ page }) => {
  const r = await page.evaluate(() => {
    meterBeats = 4; meterType = 4; soloActive = false; edited = true;
    tracks = [{ id: 't0', label: 'M', enabled: true, solo: false, vol: 1, notes: [
      { isRest: false, step: 'C', alter: 0, oct: 5, durBeat: 4 },   // whole
      { isRest: false, step: 'D', alter: 0, oct: 5, durBeat: 1 },   // quarter
      { isRest: false, step: 'E', alter: 0, oct: 5, durBeat: 4 },   // whole, starts at beat 5 -> crosses the barline
    ] }];
    tracks.forEach(reflowTrack);
    computeEndBeat();
    const doc = new DOMParser().parseFromString(tracksToMusicXML({ beats: 4, beatType: 4 }), 'application/xml');
    return {
      dur2: tracks[0].notes[2].durBeat,
      start2: tracks[0].notes[2].startBeat,
      end: endBeat,
      tieStarts: doc.querySelectorAll('tie[type="start"]').length,
      tieStops: doc.querySelectorAll('tie[type="stop"]').length,
    };
  });
  expect(r.dur2).toBe(4);     // duration preserved, NOT clamped to the 3 remaining beats
  expect(r.start2).toBe(5);   // laid back-to-back: 0 + 4 + 1
  expect(r.end).toBe(9);      // audio plays the full 4 beats
  expect(r.tieStarts).toBeGreaterThanOrEqual(1);   // the serializer ties it across the barline instead
  expect(r.tieStops).toBeGreaterThanOrEqual(1);
});

test('reflow preserves a duration: editing one note never re-clamps a later one (paste bug)', async ({ page }) => {
  const r = await page.evaluate(() => {
    meterBeats = 4; meterType = 4; soloActive = false; edited = true;
    // mimic copy/paste then editing: note B was set to a half note, then note A's duration changes
    tracks = [{ id: 't0', label: 'M', enabled: true, solo: false, vol: 1, notes: [
      { isRest: false, step: 'C', alter: 0, oct: 5, durBeat: 1 },   // A
      { isRest: false, step: 'G', alter: 0, oct: 5, durBeat: 2 },   // B (pasted, then re-pitched + made a half)
      { isRest: false, step: 'E', alter: 0, oct: 5, durBeat: 1 },
    ] }];
    tracks.forEach(reflowTrack);
    tracks[0].notes[0].durBeat = 3;   // now change A -> shifts B to beat 3 (only 1 beat left in the bar)
    tracks.forEach(reflowTrack);
    return tracks[0].notes[1].durBeat;
  });
  expect(r).toBe(2);   // B keeps the half-note the user set, it is NOT shortened to fit the bar
});

// ---- in-tab note preview (audition) ----

test('player edit: clicking a note auditions it without errors', async ({ page }) => {
  await loadSATB(page);
  const sop = await editPart(page, 0);
  expect(await page.evaluate(() => typeof auditionNote)).toBe('function');
  await cells(sop).first().click();
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => editSel && editSel.index)).toBe(0);
  expect(page.errors).toEqual([]);   // a blocked/again-started audio context must not throw
});

// ---- master Solfa/Sheet switch reflects the real per-part state ----

// ---- full-score cursor lands on the sounding note (no off-by-one) ----

test('full score cursor sits on the sounding note, not one ahead', async ({ page }) => {
  await loadSATB(page);
  await page.locator('#tabs .tab', { hasText: 'Full score' }).click();
  await page.locator('#rendersheet').click();
  await page.waitForFunction(() => document.querySelectorAll('#sheet .sheetnote').length > 0, null, { timeout: 8000 });
  const at = (beat) => page.evaluate((b) => {
    syncSheetCursor(b);
    const it = osmd.cursor.iterator;
    return (it && it.currentTimeStamp) ? it.currentTimeStamp.RealValue * 4 : null;
  }, beat);
  // SATB are quarter notes onset at beats 0,1,2,3; a mid-note beat maps to that note's onset
  expect(await at(0.5)).toBe(0);   // during note 0 (was 1 before the fix)
  expect(await at(1.5)).toBe(1);
  expect(await at(2.5)).toBe(2);
  expect(await at(0.5)).toBe(0);   // seeking back resets correctly
});

// ---- transpose is undoable ----

test('transpose is undoable: notes, key, and offset all revert', async ({ page }) => {
  await loadSATB(page);   // C major, Soprano C5 D5 E5 F5, offset 0
  const before = await page.evaluate(() => ({ names: tracks[0].notes.map((n) => n.name), off: transposeOffset, pc: currentTonic.pc }));
  expect(before.off).toBe(0);

  await page.locator('#trup').click();   // up a semitone
  const up = await page.evaluate(() => ({ off: transposeOffset, pc: currentTonic.pc, names: tracks[0].notes.map((n) => n.name) }));
  expect(up.off).toBe(1);
  expect(up.pc).not.toBe(before.pc);
  expect(up.names).not.toEqual(before.names);

  // undo from the Tools button (works regardless of which tab transposed)
  await openTools(page);
  await page.locator('#edUndo').click();
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => ({ names: tracks[0].notes.map((n) => n.name), off: transposeOffset, pc: currentTonic.pc }));
  expect(after.off).toBe(0);
  expect(after.pc).toBe(before.pc);
  expect(after.names).toEqual(before.names);
});

test('master view switch goes neutral when parts are mixed', async ({ page }) => {
  await loadSATB(page);
  const isOn = (name) => page.locator('#masterview button', { hasText: name }).evaluate((el) => el.classList.contains('on'));
  // both parts start on Solfa -> master shows Solfa active
  expect(await isOn('Solfa')).toBe(true);
  // flip only Soprano to Sheet -> mixed -> neither master button is active
  await page.locator('.voice', { hasText: 'Soprano' }).getByRole('button', { name: 'Sheet', exact: true }).click();
  await page.waitForTimeout(800);
  expect(await isOn('Solfa')).toBe(false);
  expect(await isOn('Sheet')).toBe(false);
});

// ---- the fifth degree reads "So", not "Sol" ----

test('the fifth degree is labelled So, not Sol', async ({ page }) => {
  // boot melody is the C-major scale in C major
  expect(await page.locator('#stave .note .solf').allTextContents()).toEqual(['Do', 'Re', 'Mi', 'Fa', 'So', 'La', 'Ti', 'Do']);
});

// ---- chords collapse to a single (top) note per part ----

test('import is faithful: chords are kept, no notes dropped', async ({ page }) => {
  const xml = `<?xml version="1.0"?><score-partwise version="3.1"><part-list><score-part id="P1"><part-name>V</part-name></score-part></part-list>`
    + `<part id="P1"><measure number="1"><attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>`
    + `<note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><type>quarter</type></note>`
    + `<note><chord/><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><type>quarter</type></note>`
    + `<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><type>quarter</type></note>`
    + `</measure></part></score-partwise>`;
  const r = await page.evaluate((x) => { loadMusicXMLText(x, null); return { parts: tracks.length, notes: tracks[0].notes.map((n) => n.name) }; }, xml);
  expect(r.parts).toBe(1);
  expect(r.notes).toEqual(['E4', 'G4', 'C4']);   // chord E4+G4 both kept (faithful), then C4
});

// ---- dynamics can be toggled on the engraved sheets ----

test('dynamics toggle strips and restores direction markings', async ({ page }) => {
  const xml = `<?xml version="1.0"?><score-partwise version="3.1"><part-list><score-part id="P1"><part-name>V</part-name></score-part></part-list>`
    + `<part id="P1"><measure number="1"><attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>`
    + `<direction placement="below"><direction-type><dynamics><p/></dynamics></direction-type></direction>`
    + `<note><pitch><step>C</step><octave>5</octave></pitch><duration>4</duration><voice>1</voice><type>whole</type></note>`
    + `</measure></part></score-partwise>`;
  await page.evaluate((x) => loadMusicXMLText(x, null), xml);
  const directions = () => page.evaluate(() => (scoreXML().match(/<direction\b/g) || []).length);
  expect(await directions()).toBeGreaterThan(0);   // shown by default (faithful)
  await page.evaluate(() => setDynamics(false));
  expect(await directions()).toBe(0);              // hidden -> stripped
  await page.evaluate(() => setDynamics(true));
  expect(await directions()).toBeGreaterThan(0);   // shown again
});

// ---- editor: note editor sits under the selected part; parts collapse ----

test('the note editor appears under the part that owns the selected note', async ({ page }) => {
  await loadSATB(page);   // Soprano, Alto
  const sop = await editPart(page, 0);
  const alto = await editPart(page, 1);
  // select in Soprano -> editor under the first part only
  await cells(sop).first().click();
  expect(await sop.locator('.noteeditor #neStep').count()).toBe(1);
  expect(await alto.locator('.noteeditor #neStep').count()).toBe(0);
  // select in Alto -> editor moves under the second part
  await cells(alto).first().click();
  expect(await alto.locator('.noteeditor #neStep').count()).toBe(1);
  expect(await sop.locator('.noteeditor #neStep').count()).toBe(0);
});

test('player parts are collapsible', async ({ page }) => {
  await loadSATB(page);
  const sop = await editPart(page, 0);   // editing -> shows a grid
  expect(await sop.locator('.stave-row').isVisible()).toBe(true);
  await sop.locator('.caret').click();   // collapse the row
  expect(await page.evaluate(() => tracks[0].collapsed)).toBe(true);
  expect(await sop.locator('.stave-row').isVisible()).toBe(false);
  await sop.locator('.caret').click();   // expand again
  expect(await page.evaluate(() => tracks[0].collapsed)).toBe(false);
  expect(await sop.locator('.stave-row').isVisible()).toBe(true);
});

// ---- serializer pads parts so OSMD doesn't truncate to the shortest voice ----

test('serializer pads short voices to the longest (preview spans the whole piece)', async ({ page }) => {
  const r = await page.evaluate(() => {
    const short = { label: 'S', notes: [ { isRest: false, step: 'C', alter: 0, oct: 5, midi: 72, name: 'C5', startBeat: 0, durBeat: 4 } ] };       // 1 bar
    const long = { label: 'L', notes: [0, 4, 8].map((b) => ({ isRest: false, step: 'E', alter: 0, oct: 4, midi: 64, name: 'E4', startBeat: b, durBeat: 4 })) };  // 3 bars
    const ser = tracksToMusicXML({ tracks: [short, long], beats: 4, beatType: 4 });
    const doc = new DOMParser().parseFromString(ser, 'application/xml');
    return [...doc.querySelectorAll('part')].map((p) => p.querySelectorAll('measure').length);
  });
  expect(r).toEqual([3, 3]);   // the 1-bar voice is padded to match the 3-bar voice
});

// ---- paused-note highlight survives a solfa<->sheet view toggle ----

test('paused note stays highlighted when switching a part between sheet and solfa', async ({ page }) => {
  await loadSATB(page);
  // Soprano on Sheet, rendered
  await page.locator('.voice', { hasText: 'Soprano' }).getByRole('button', { name: 'Sheet', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.voicebox .sheetnote').length > 0, null, { timeout: 8000 });
  // simulate a paused playhead at beat 2 (no audio gesture needed)
  await page.evaluate(() => { bs = 60 / (parseInt(document.getElementById('bpm').value) || 84); Tone.Transport.seconds = 2 * bs; paintHighlights(2); });
  expect(await page.locator('.voice', { hasText: 'Soprano' }).locator('.voicebox .sheetnote.playing').count()).toBeGreaterThan(0);

  // switch to Solfa: the paused note must still be lit on the cells
  await page.locator('.voice', { hasText: 'Soprano' }).getByRole('button', { name: 'Solfa', exact: true }).click();
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => { const t = tracks.find((x) => x.label === 'Soprano'); const el = document.getElementById(t.id + '-2'); return !!(el && el.classList.contains('active')); })).toBe(true);

  // and vice versa: back to Sheet, the staff note lights again
  await page.locator('.voice', { hasText: 'Soprano' }).getByRole('button', { name: 'Sheet', exact: true }).click();
  await page.waitForFunction(() => {
    const v = [...document.querySelectorAll('.voice')].find((e) => e.textContent.includes('Soprano'));
    return v && v.querySelector('.voicebox .sheetnote.playing');
  }, null, { timeout: 8000 });
});

// ---- per-part staff re-renders after an edit (no stuck "Rendering staff") ----

test('per-part staff updates after an edit instead of staying blank', async ({ page }) => {
  await loadSATB(page);
  // show Soprano as a staff in the player (renders while visible)
  await page.locator('.voice', { hasText: 'Soprano' }).getByRole('button', { name: 'Sheet', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.voicebox svg').length > 0, null, { timeout: 8000 });
  // edit a Soprano note in the player (sheet view + edit: click a notehead, change pitch)
  const sop = await editPart(page, 0);
  await sop.locator('.voicebox .sheetnote[data-b0="0.0000"]').click();
  await sop.locator('.noteeditor #neStep').selectOption('A');
  await page.waitForTimeout(400);
  // the staff must re-engrave the update, not sit on "Rendering staff"
  await page.waitForFunction(() => {
    const v = [...document.querySelectorAll('.voice')].find((el) => el.textContent.includes('Soprano'));
    return v && v.querySelector('.voicebox svg');
  }, null, { timeout: 8000 });
  const box = page.locator('.voice', { hasText: 'Soprano' }).locator('.voicebox');
  expect(await box.locator('svg').count()).toBeGreaterThan(0);
  expect(await box.innerText()).not.toContain('Rendering staff');
});

// ---- play-scope clarity: removed top button, per-part play in player, scope label ----

test('the top "Sing it" button is gone; transport bar still drives playback', async ({ page }) => {
  expect(await page.locator('#stopbtn').count()).toBe(0);
  expect(await page.locator('#transportbar #tplay').count()).toBe(1);
});

test('player: each voice row has its own play button', async ({ page }) => {
  await loadSATB(page);
  expect(await page.locator('.voice .vplay').count()).toBe(2);
});

test('player per-part play scopes playback to that one voice', async ({ page }) => {
  await loadSATB(page);
  await page.locator('.voice', { hasText: 'Alto' }).locator('.vplay').click();
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => auditionTracks && auditionTracks.map((t) => t.label))).toEqual(['Alto']);
  expect(await page.locator('#playscope').textContent()).toContain('Alto');
});

test('transport scope label reflects all-parts vs a soloed voice', async ({ page }) => {
  await loadSATB(page);
  expect(await page.locator('#playscope').textContent()).toContain('all parts');
  await page.locator('.voice', { hasText: 'Soprano' }).getByRole('button', { name: 'Solo', exact: true }).click();
  await page.waitForTimeout(150);
  const label = await page.locator('#playscope').textContent();
  expect(label).toContain('Soprano');
  expect(label).not.toContain('all parts');
});

// ---- click-to-seek on engraved sheets ----

test('clicking a notehead on a per-part sheet seeks the playhead', async ({ page }) => {
  await loadSATB(page);
  await page.locator('.voice', { hasText: 'Soprano' }).getByRole('button', { name: 'Sheet', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.voice .voicebox .sheetnote').length >= 4, null, { timeout: 8000 });
  // SATB soprano = quarter notes at beats 0,1,2,3; click the one at beat 2
  await page.locator('.voice', { hasText: 'Soprano' }).locator('.voicebox .sheetnote[data-b0="2.0000"]').click();
  await page.waitForFunction(() => /beat 2/.test(document.getElementById('posdisp').textContent || ''), null, { timeout: 5000 });
  expect(await page.locator('#posdisp').textContent()).toContain('beat 2');
});

test('clicking a notehead on the full score seeks the playhead', async ({ page }) => {
  await loadSATB(page);
  await page.locator('#tabs .tab', { hasText: 'Full score' }).click();
  await page.locator('#rendersheet').click();
  await page.waitForFunction(() => document.querySelectorAll('#sheet .sheetnote[data-b0="3.0000"]').length > 0, null, { timeout: 8000 });
  await page.locator('#sheet .sheetnote[data-b0="3.0000"]').first().click();
  await page.waitForFunction(() => /beat 3/.test(document.getElementById('posdisp').textContent || ''), null, { timeout: 5000 });
  expect(await page.locator('#posdisp').textContent()).toContain('beat 3');
});

// ---- per-part inline edit in the Player (Edit/Player merge, step 1) ----

test('player: Edit reuses the existing solfa grid (no duplicate) and appends the note editor', async ({ page }) => {
  await loadSATB(page);
  const sop = page.locator('.voice', { hasText: 'Soprano' });
  await expect(sop.locator('.vedit')).toHaveCount(1);
  expect(await sop.locator('.noteeditor').count()).toBe(0);   // editor hidden until a note is picked
  await sop.locator('.vedit').click();
  // still exactly one grid; an "add note" cell appears in edit mode
  expect(await sop.locator('.stave-row').count()).toBe(1);
  await expect(sop.locator('.stave-row .note.addnote')).toHaveCount(1);
  expect(await sop.locator('.stave-row .note:not(.addnote)').count()).toBe(4);   // soprano = 4 quarters, same cells
  // click a cell in the existing grid -> it selects and the editor appears under THIS row
  await sop.locator('.stave-row .note:not(.addnote)').first().click();
  await expect(sop.locator('.note.sel')).toHaveCount(1);
  await expect(sop.locator('.noteeditor #neStep')).toHaveCount(1);
  // change its pitch; the same cell updates in place
  await sop.locator('.noteeditor #neStep').selectOption('G');
  await page.waitForTimeout(150);
  expect(await sop.locator('.stave-row .note:not(.addnote)').first().locator('.nm').textContent()).toMatch(/^G5/);
  // toggle Edit off: editor + add cell go away
  await sop.locator('.vedit').click();
  expect(await sop.locator('.noteeditor').count()).toBe(0);
  expect(await sop.locator('.stave-row .note.addnote').count()).toBe(0);
  expect(page.errors).toEqual([]);
});

test('player: an inline edit flows into the serialized score (one shared model)', async ({ page }) => {
  await loadSATB(page);
  const sop = page.locator('.voice', { hasText: 'Soprano' });
  await sop.locator('.vedit').click();
  await sop.locator('.stave-row .note:not(.addnote)').first().click();
  await sop.locator('.noteeditor #neStep').selectOption('A');
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => tracks[0].notes[0].name)).toMatch(/^A5/);
  // the change is in the serialized MusicXML (the player IS the single source now)
  const xml = await page.evaluate(() => tracksToMusicXML({ beats: meterBeats, beatType: meterType }));
  expect(xml).toContain('<step>A</step>');
});

test('player: the editable grid still lights the sounding note', async ({ page }) => {
  await loadSATB(page);
  const sop = page.locator('.voice', { hasText: 'Soprano' });
  await sop.locator('.vedit').click();
  await page.evaluate(() => paintHighlights(0));
  expect(await page.evaluate(() => { const t = tracks.find((x) => x.label === 'Soprano'); const el = document.getElementById(t.id + '-0'); return !!(el && el.classList.contains('active')); })).toBe(true);
  await page.evaluate(() => paintHighlights(1.5));   // quarter notes -> index-1 cell now lit
  expect(await page.evaluate(() => { const t = tracks.find((x) => x.label === 'Soprano'); return document.getElementById(t.id + '-1').classList.contains('active') && !document.getElementById(t.id + '-0').classList.contains('active'); })).toBe(true);
});

test('player: in sheet view, Edit makes noteheads selectable instead of seeking', async ({ page }) => {
  await loadSATB(page);
  const sop = page.locator('.voice', { hasText: 'Soprano' });
  await sop.getByRole('button', { name: 'Sheet', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.voice .voicebox .sheetnote').length >= 4, null, { timeout: 8000 });
  await sop.locator('.vedit').click();
  await sop.locator('.voicebox .sheetnote[data-b0="2.0000"]').click();
  await expect(sop.locator('.noteeditor #neStep')).toHaveCount(1);   // picked the note for editing
  expect(await page.locator('#posdisp').textContent()).not.toContain('beat 2');   // did NOT seek
});

test('player: editing a solfa part shows a live staff preview alongside the grid', async ({ page }) => {
  await loadSATB(page);
  const sop = page.locator('.voice', { hasText: 'Soprano' });
  await sop.locator('.vedit').click();
  // grid stays; a live engraved preview appears next to it
  await page.waitForFunction(() => {
    const v = [...document.querySelectorAll('.voice')].find((e) => e.textContent.includes('Soprano'));
    return v && v.querySelector('.editpreview .sheetnote');
  }, null, { timeout: 8000 });
  expect(await sop.locator('.stave-row .note:not(.addnote)').count()).toBe(4);   // grid still present
  // selecting a grid note highlights it on the preview staff (beat 2)
  await sop.locator('.stave-row .note:not(.addnote)').nth(2).click();
  await page.waitForFunction(() => {
    const v = [...document.querySelectorAll('.voice')].find((e) => e.textContent.includes('Soprano'));
    return v && v.querySelector('.editpreview .sheetnote.selnote');
  }, null, { timeout: 5000 });
  expect(await sop.locator('.editpreview .sheetnote.selnote').first().getAttribute('data-b0')).toBe('2.0000');
});

test('player: in sheet view, the selected note is highlighted on the staff', async ({ page }) => {
  await loadSATB(page);
  const sop = page.locator('.voice', { hasText: 'Soprano' });
  await sop.getByRole('button', { name: 'Sheet', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.voice .voicebox .sheetnote').length >= 4, null, { timeout: 8000 });
  await sop.locator('.vedit').click();
  await sop.locator('.voicebox .sheetnote[data-b0="2.0000"]').click();
  await expect(sop.locator('.voicebox .sheetnote.selnote')).toHaveCount(1);
  expect(await sop.locator('.voicebox .sheetnote.selnote').first().getAttribute('data-b0')).toBe('2.0000');
});

test('player: editing/selecting keeps the live preview scrolled to your place, not the top', async ({ page }) => {
  // a long single voice so the engraved preview is taller than its scroll box
  const noteX = (s) => `<note><pitch><step>${s}</step><octave>5</octave></pitch><duration>1</duration><voice>1</voice><type>quarter</type></note>`;
  let body = '';
  for (let m = 1; m <= 24; m++) {
    const attrs = m === 1 ? '<attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>' : '';
    body += `<measure number="${m}">${attrs}${['C', 'D', 'E', 'F'].map(noteX).join('')}</measure>`;
  }
  const xml = `<?xml version="1.0"?><score-partwise version="3.1"><part-list><score-part id="P1"><part-name>V</part-name></score-part></part-list><part id="P1">${body}</part></score-partwise>`;
  await page.evaluate((x) => loadMusicXMLText(x, document.getElementById('xmlmsg')), xml);
  const row = page.locator('.voice').first();
  await row.locator('.vedit').click();
  await page.waitForFunction(() => { const pv = document.querySelector('.editpreview'); return pv && pv.querySelector('.sheetnote'); }, null, { timeout: 8000 });
  // confirm the preview actually overflows, then scroll it down
  const scrollable = await page.evaluate(() => { const pv = document.querySelector('.editpreview'); return pv.scrollHeight > pv.clientHeight + 20; });
  expect(scrollable).toBe(true);
  await page.evaluate(() => { document.querySelector('.editpreview').scrollTop = 120; });
  // selecting a note must NOT reset the scroll
  await row.locator('.stave-row .note:not(.addnote)').nth(40).click();
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => document.querySelector('.editpreview').scrollTop)).toBeGreaterThan(60);
  // and editing it (re-engraves) must keep the place too
  await row.locator('.noteeditor #neStep').selectOption('A');
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => document.querySelector('.editpreview').scrollTop)).toBeGreaterThan(60);
});

// ---- multiselect: bulk edit + copy/paste ----

test('player edit: shift-click selects a range and shows the bulk bar', async ({ page }) => {
  await loadSATB(page);
  const sop = await editPart(page, 0);
  await cells(sop).nth(0).click();                          // anchor
  await cells(sop).nth(2).click({ modifiers: ['Shift'] });  // extend to a 3-note run
  expect(await sop.locator('.note.sel').count()).toBe(3);
  await expect(sop.locator('.bulkbar')).toBeVisible();
  expect(await sop.locator('.bulkcount').textContent()).toMatch(/3 notes/);
});

test('player edit: cmd/ctrl-click toggles notes in the selection', async ({ page }) => {
  await loadSATB(page);
  const sop = await editPart(page, 0);
  await cells(sop).nth(0).click();
  await cells(sop).nth(2).click({ modifiers: ['ControlOrMeta'] });   // {0,2}
  expect(await sop.locator('.note.sel').count()).toBe(2);
  await cells(sop).nth(2).click({ modifiers: ['ControlOrMeta'] });   // toggle 2 off -> {0}
  expect(await sop.locator('.note.sel').count()).toBe(1);
});

test('player edit: bulk octave shift applies to every selected note', async ({ page }) => {
  await loadSATB(page);
  const sop = await editPart(page, 0);
  const before = await page.evaluate(() => tracks[0].notes.slice(0, 3).map((n) => n.oct));
  await cells(sop).nth(0).click();
  await cells(sop).nth(2).click({ modifiers: ['Shift'] });
  await sop.locator('.bulkbar #blOctUp').click();
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => tracks[0].notes.slice(0, 3).map((n) => n.oct));
  expect(after).toEqual(before.map((o) => o + 1));
});

test('player edit: bulk delete removes all selected notes', async ({ page }) => {
  await loadSATB(page);
  const sop = await editPart(page, 0);
  const n0 = await page.evaluate(() => tracks[0].notes.length);   // 4
  await cells(sop).nth(1).click();
  await cells(sop).nth(3).click({ modifiers: ['Shift'] });        // 1..3 (3 notes)
  await sop.locator('.bulkbar #blDelete').click();
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => tracks[0].notes.length)).toBe(n0 - 3);
});

test('player edit: copy a run and paste it after the anchor', async ({ page }) => {
  await loadSATB(page);
  const sop = await editPart(page, 0);
  const n0 = await page.evaluate(() => tracks[0].notes.length);   // 4: C5 D5 E5 F5
  await cells(sop).nth(0).click();
  await cells(sop).nth(1).click({ modifiers: ['Shift'] });        // C5,D5
  await sop.locator('.bulkbar #blCopy').click();
  await sop.locator('.bulkbar #blPaste').click();
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => tracks[0].notes.length)).toBe(n0 + 2);
  expect(await page.evaluate(() => tracks[0].notes.slice(2, 4).map((n) => n.name))).toEqual(['C5', 'D5']);
});

test('player edit: copy from one part and paste into another keeps exact pitches', async ({ page }) => {
  await loadSATB(page);                          // Soprano C5 D5 E5 F5, Alto E4 F4 G4 A4
  const sop = await editPart(page, 0);
  await cells(sop).nth(0).click();
  await cells(sop).nth(1).click({ modifiers: ['Shift'] });        // copy C5,D5
  await sop.locator('.bulkbar #blCopy').click();
  const alto = await editPart(page, 1);
  const a0 = await page.evaluate(() => tracks[1].notes.length);    // 4
  await cells(alto).nth(0).click();
  await alto.locator('.noteeditor #nePaste').click();
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => tracks[1].notes.length)).toBe(a0 + 2);
  expect(await page.evaluate(() => tracks[1].notes.slice(1, 3).map((n) => n.name))).toEqual(['C5', 'D5']);
});

// ---- phrasing: slurs + ties ----

// A single part: C5 C5 D5 E5 (two same-pitch notes up front, so ties are eligible).
const REPEAT = `<?xml version="1.0"?><score-partwise version="3.1"><part-list><score-part id="P1"><part-name>V</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes><note><pitch><step>C</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type></note><note><pitch><step>C</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type></note><note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type></note><note><pitch><step>E</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type></note></measure></part></score-partwise>`;

test('player edit: slur a run emits slur start/stop and marks the grid', async ({ page }) => {
  await loadSATB(page);
  const sop = await editPart(page, 0);
  await cells(sop).nth(0).click();
  await cells(sop).nth(2).click({ modifiers: ['Shift'] });   // run 0..2
  await sop.locator('.bulkbar #blSlur').click();
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => ({ a: !!tracks[0].notes[0].slurStart, b: !!tracks[0].notes[2].slurStop }))).toEqual({ a: true, b: true });
  const xml = await page.evaluate(() => tracksToMusicXML({ beats: meterBeats, beatType: meterType }));
  expect(xml).toContain('<slur number="1" type="start"/>');
  expect(xml).toContain('<slur number="1" type="stop"/>');
  expect(await sop.locator('.note.slurred').count()).toBeGreaterThanOrEqual(3);
  // toggling again removes it
  await cells(sop).nth(0).click();
  await cells(sop).nth(2).click({ modifiers: ['Shift'] });
  await sop.locator('.bulkbar #blSlur').click();
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => !!tracks[0].notes[0].slurStart)).toBe(false);
});

test('player edit: tie adjacent same-pitch notes emits tie/tied', async ({ page }) => {
  await page.evaluate((x) => loadMusicXMLText(x, document.getElementById('xmlmsg')), REPEAT);
  const v = await editPart(page, 0);
  await cells(v).nth(0).click();
  await cells(v).nth(1).click({ modifiers: ['Shift'] });     // the two C5s
  await v.locator('.bulkbar #blTie').click();
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => !!tracks[0].notes[0].tieNext)).toBe(true);
  const xml = await page.evaluate(() => tracksToMusicXML({ beats: meterBeats, beatType: meterType }));
  expect(xml).toContain('<tie type="start"/>');
  expect(xml).toContain('<tie type="stop"/>');
  expect(xml).toContain('<tied type="start"/>');
  expect(await v.locator('.note.tied').count()).toBeGreaterThanOrEqual(2);
});

test('player edit: single-note "Tie ->" ties to the next same-pitch note', async ({ page }) => {
  await page.evaluate((x) => loadMusicXMLText(x, document.getElementById('xmlmsg')), REPEAT);
  const v = await editPart(page, 0);
  await cells(v).nth(0).click();                              // single-select first C5
  await expect(v.locator('.noteeditor #neTie')).toBeEnabled();
  await v.locator('.noteeditor #neTie').click();
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => !!tracks[0].notes[0].tieNext)).toBe(true);
  // a non-tieable note (different next pitch) disables the button
  await cells(v).nth(2).click();                              // D5 followed by E5
  await expect(v.locator('.noteeditor #neTie')).toBeDisabled();
});

// Four quavers (eighths) + a half rest, no <beam> in the source -> autoBeam should join them.
const QUAVERS = `<?xml version="1.0"?><score-partwise version="3.1"><part-list><score-part id="P1"><part-name>V</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>2</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes><note><pitch><step>C</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type></note><note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type></note><note><pitch><step>E</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type></note><note><pitch><step>F</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type></note><note><rest/><duration>4</duration><type>half</type></note></measure></part></score-partwise>`;

test('engraved staff beams consecutive quavers (joined tails)', async ({ page }) => {
  await page.evaluate((x) => loadMusicXMLText(x, document.getElementById('xmlmsg')), QUAVERS);
  const v = page.locator('.voice').first();
  await v.getByRole('button', { name: 'Sheet', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.voicebox .sheetnote').length >= 4, null, { timeout: 8000 });
  expect(await page.locator('.voicebox .vf-beam').count()).toBeGreaterThan(0);   // VexFlow beams join the tails
});

test('slur/tie markers show on the player grid in play mode (not just while editing)', async ({ page }) => {
  await page.evaluate((x) => loadMusicXMLText(x, document.getElementById('xmlmsg')), REPEAT);  // C5 C5 D5 E5
  const v = await editPart(page, 0);
  await cells(v).nth(0).click();
  await cells(v).nth(1).click({ modifiers: ['Shift'] });
  await v.locator('.bulkbar #blTie').click();                 // tie the two C5s
  await page.waitForTimeout(100);
  await cells(v).nth(2).click();
  await cells(v).nth(3).click({ modifiers: ['Shift'] });
  await v.locator('.bulkbar #blSlur').click();                // slur D5..E5
  await page.waitForTimeout(100);
  await v.locator('.vedit').click();                          // leave edit mode
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => tracks[0].editing || false)).toBe(false);
  expect(await v.locator('.note.tied').count()).toBeGreaterThanOrEqual(2);
  expect(await v.locator('.note.slurred').count()).toBeGreaterThanOrEqual(2);
});

test('per-part PNG export works with slurs/ties present', async ({ page }) => {
  await page.evaluate((x) => loadMusicXMLText(x, document.getElementById('xmlmsg')), REPEAT);
  await page.evaluate(() => { tracks[0].notes[0].tieNext = true; tracks[0].notes[2].slurStart = true; tracks[0].notes[3].slurStop = true; render(); });
  const v = page.locator('.voice').first();
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    v.getByRole('button', { name: 'PNG' }).click(),
  ]);
  expect(dl.suggestedFilename()).toMatch(/\.png$/);
  const fs = require('fs');
  expect(fs.statSync(await dl.path()).size).toBeGreaterThan(1000);
  expect(page.errors).toEqual([]);
});

test('playback: tied same-pitch notes merge into one sustained note', async ({ page }) => {
  await page.evaluate((x) => loadMusicXMLText(x, document.getElementById('xmlmsg')), REPEAT);  // C5 C5 D5 E5
  await page.evaluate(() => { tracks[0].notes[0].tieNext = true; });
  const r = await page.evaluate(() => playableEvents(tracks[0], 0.5).map((e) => ({ name: e.name, dur: e.dur })));
  expect(r.length).toBe(3);                       // the two C5s collapse to one event
  expect(r[0].name).toBe('C5');
  expect(r[0].dur).toBeCloseTo(2 * 0.5, 3);       // held for both quarters, full length
});

test('playback: slurred notes play legato (no detach gap)', async ({ page }) => {
  await loadSATB(page);                            // Soprano C5 D5 E5 F5 quarters
  await page.evaluate(() => { tracks[0].notes[0].slurStart = true; tracks[0].notes[2].slurStop = true; });
  const r = await page.evaluate(() => playableEvents(tracks[0], 0.5).map((e) => e.dur));
  expect(r[0]).toBeCloseTo(0.5, 3);               // slurred -> full length
  expect(r[1]).toBeCloseTo(0.5, 3);
  expect(r[2]).toBeCloseTo(0.5, 3);
  expect(r[3]).toBeCloseTo(0.5 * 0.95, 3);        // outside the slur -> usual small gap
});

test('editing a tied note away from its pitch drops the stale tie', async ({ page }) => {
  await page.evaluate((x) => loadMusicXMLText(x, document.getElementById('xmlmsg')), REPEAT);
  await page.evaluate(() => { tracks[0].notes[0].tieNext = true; });
  const v = await editPart(page, 0);
  await cells(v).nth(1).click();                   // the 2nd C5 (tie target)
  await v.locator('.noteeditor #neStep').selectOption('G');   // re-pitch it
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => !!tracks[0].notes[0].tieNext)).toBe(false);   // tie cleared
});

test('slur draws a bridging arc on the grid (slurlink marker), showing the run as one gesture', async ({ page }) => {
  await page.evaluate((x) => loadMusicXMLText(x, document.getElementById('xmlmsg')), REPEAT);  // C5 C5 D5 E5
  await page.evaluate(() => { tracks[0].notes[0].slurStart = true; tracks[0].notes[2].slurStop = true; render(); });
  const v = page.locator('.voice').first();
  expect(await v.locator('.note.slurlink').count()).toBe(2);                  // arcs bridge 0->1 and 1->2
  expect(await v.locator('.note.slurred').count()).toBeGreaterThanOrEqual(3); // whole run tinted
  const bw = await v.locator('.note.slurlink').first().evaluate((el) => getComputedStyle(el, '::after').borderTopWidth);
  expect(parseFloat(bw)).toBeGreaterThan(1);
});

test('phrasing: a slurred run is kept on one grid line (wrapped in a phrasegroup)', async ({ page }) => {
  await page.evaluate((x) => loadMusicXMLText(x, document.getElementById('xmlmsg')), REPEAT);  // C5 C5 D5 E5
  await page.evaluate(() => { tracks[0].notes[0].slurStart = true; tracks[0].notes[2].slurStop = true; render(); });
  const v = page.locator('.voice').first();
  expect(await v.locator('.phrasegroup').count()).toBe(1);
  expect(await v.locator('.phrasegroup > .note').count()).toBe(3);   // the whole slur run lives in one no-wrap group
  // the group itself does not wrap
  const wrap = await v.locator('.phrasegroup').first().evaluate((el) => getComputedStyle(el).flexWrap);
  expect(wrap).toBe('nowrap');
});

test('phrasing: a tied pair is kept on one grid line (wrapped in a phrasegroup)', async ({ page }) => {
  await page.evaluate((x) => loadMusicXMLText(x, document.getElementById('xmlmsg')), REPEAT);
  await page.evaluate(() => { tracks[0].notes[0].tieNext = true; render(); });
  const v = page.locator('.voice').first();
  expect(await v.locator('.phrasegroup').count()).toBe(1);
  expect(await v.locator('.phrasegroup > .note').count()).toBe(2);
});

test('tie draws a bridging arc on the grid (tiestart marker, not just an underline)', async ({ page }) => {
  await page.evaluate((x) => loadMusicXMLText(x, document.getElementById('xmlmsg')), REPEAT);  // C5 C5 D5 E5
  await page.evaluate(() => { tracks[0].notes[0].tieNext = true; render(); });
  const v = page.locator('.voice').first();
  expect(await v.locator('.note.tiestart').count()).toBe(1);                 // the arc starts on the first C5
  expect(await v.locator('.note.tied').count()).toBeGreaterThanOrEqual(2);   // both C5s are tinted
  // the arc is drawn via a ::before pseudo with a visible bottom border
  const bw = await v.locator('.note.tiestart').first().evaluate((el) => getComputedStyle(el, '::before').borderBottomWidth);
  expect(parseFloat(bw)).toBeGreaterThan(1);
});

// ---- keyboard copy / paste of selected grid notes ----

test('keyboard: Cmd/Ctrl+C then Cmd/Ctrl+V duplicates the selected grid notes', async ({ page }) => {
  await loadSATB(page);                             // Soprano C5 D5 E5 F5
  const sop = await editPart(page, 0);
  const n0 = await page.evaluate(() => tracks[0].notes.length);   // 4
  await cells(sop).nth(0).click();
  await cells(sop).nth(1).click({ modifiers: ['Shift'] });        // select C5,D5
  await page.keyboard.press('ControlOrMeta+c');
  await page.keyboard.press('ControlOrMeta+v');
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => tracks[0].notes.length)).toBe(n0 + 2);
  expect(await page.evaluate(() => tracks[0].notes.slice(2, 4).map((n) => n.name))).toEqual(['C5', 'D5']);
});

test('keyboard: Backspace deletes the selected grid notes', async ({ page }) => {
  await loadSATB(page);
  const sop = await editPart(page, 0);
  await cells(sop).nth(1).click();
  await cells(sop).nth(3).click({ modifiers: ['Shift'] });        // 1..3 (3 notes)
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => tracks[0].notes.length)).toBe(1);
});

// ---- per-part clef ----

test('clef is captured on import (bass clef stays bass)', async ({ page }) => {
  const bassPart = `<?xml version="1.0"?><score-partwise version="3.1"><part-list><score-part id="P1"><part-name>Bass</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>F</sign><line>4</line></clef></attributes><note><pitch><step>C</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note><note><pitch><step>G</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type></note><note><pitch><step>A</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type></note><note><pitch><step>B</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type></note></measure></part></score-partwise>`;
  await page.evaluate((x) => loadMusicXMLText(x, document.getElementById('xmlmsg')), bassPart);
  expect(await page.evaluate(() => tracks[0].clef)).toBe('bass');
  // even though the average pitch is high (would auto-guess treble), the written bass clef is kept after an edit
  await page.evaluate(() => { tracks[0].notes.shift(); edited = true; });
  const xml = await page.evaluate(() => tracksToMusicXML({}));
  expect(xml).toContain('<clef><sign>F</sign><line>4</line></clef>');
});

test('player edit: setting a part clef changes the serialized clef', async ({ page }) => {
  await loadSATB(page);
  const sop = await editPart(page, 0);
  await sop.locator('select.clefpick').selectOption('bass');
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => tracks[0].clef)).toBe('bass');
  const xml = await page.evaluate(() => tracksToMusicXML({}));
  expect(xml).toContain('<clef><sign>F</sign><line>4</line></clef>');
  // back to auto -> derived from pitch (Soprano is high -> treble); no bass clef remains anywhere
  await sop.locator('select.clefpick').selectOption('auto');
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => tracks[0].clef)).toBeFalsy();
  expect(await page.evaluate(() => tracksToMusicXML({}))).not.toContain('<clef><sign>F</sign><line>4</line></clef>');
});

// ---- key sets home, transpose counts from it ----

test('key sets home: picking a key zeroes Transpose; transpose then counts from that key', async ({ page }) => {
  await loadSATB(page);                                   // C major
  expect(await page.locator('#trval').textContent()).toBe('0');
  await page.locator('#key').selectOption({ label: 'A major' });   // declare A as home
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => currentKeyName())).toBe('A major');
  expect(await page.locator('#trval').textContent()).toBe('0');    // home reads 0, not -3 from C
  await page.locator('#trdown').click();                  // transpose -1 from A
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => currentKeyName())).toBe('Ab major');   // A -> Ab
  expect(await page.locator('#trval').textContent()).toBe('-1');
});

test('key sets home: re-picking the current key re-zeroes the Transpose readout', async ({ page }) => {
  await loadSATB(page);
  await page.locator('#key').selectOption({ label: 'A major' });
  await page.locator('#trdown').click();                  // Ab, -1
  await page.waitForTimeout(100);
  expect(await page.locator('#trval').textContent()).toBe('-1');
  await page.locator('#key').selectOption({ label: 'Ab major' });   // declare current key as home
  await page.waitForTimeout(100);
  expect(await page.locator('#trval').textContent()).toBe('0');
});

test('key + transpose persist in the project (key, homeOffset, transposeOffset) and round-trip', async ({ page }) => {
  await loadSATB(page);
  await page.locator('#key').selectOption({ label: 'A major' });
  await page.locator('#trdown').click();                  // Ab, displayed -1
  await page.waitForTimeout(100);
  const st = await page.evaluate(() => sessionState());
  expect(st.tonicPc).toBe(8);                             // Ab is stored as the key
  expect(st.homeOffset).toBe(-3);                         // A (home) is -3 from C
  expect(st.transposeOffset).toBe(-4);                    // Ab is -4 from C
  // restoring the saved project shows the same key + transpose readout
  await page.evaluate(() => { tracks = []; render(); });
  await page.evaluate((s) => restoreState(s), st);
  expect(await page.evaluate(() => currentKeyName())).toBe('Ab major');
  expect(await page.locator('#trval').textContent()).toBe('-1');
});

// ---- animated video export ----

test('video (WebCodecs): the muxer loads and the offline encoder path is detected', async ({ page }) => {
  expect(await page.evaluate(() => !!(window.Mp4Muxer && window.Mp4Muxer.Muxer))).toBe(true);   // CDN muxer present
  // Chrome supports the WebCodecs offline path; just assert the detector runs and returns a boolean.
  const wc = await page.evaluate(() => canWebCodecs(760, 206));
  expect(typeof wc).toBe('boolean');
});

test('video (WebCodecs): offline export produces a valid MP4 (fast, no live capture)', async ({ page }) => {
  await page.evaluate((x) => loadMusicXMLText(x, document.getElementById('xmlmsg')), REPEAT);
  const wc = await page.evaluate(() => canWebCodecs(760, 206));
  test.skip(!wc, 'WebCodecs offline path not available in this browser');
  await page.evaluate(() => {
    window.__mp4 = null;
    window.showSaveFilePicker = async (opts) => ({
      createWritable: async () => ({ write: async (b) => { window.__mp4 = { name: opts.suggestedName, size: b.size, type: b.type }; }, close: async () => {} }),
    });
  });
  await page.locator('.voice').first().locator('button.vvideo').click();
  await page.waitForFunction(() => window.__mp4 !== null, null, { timeout: 30000 });
  const f = await page.evaluate(() => window.__mp4);
  expect(f.name).toMatch(/\.mp4$/);
  expect(f.type).toBe('video/mp4');
  expect(f.size).toBeGreaterThan(1000);
  expect(page.errors).toEqual([]);
});

test('video: per-part Video, All parts as video, and Full mix (video) buttons exist', async ({ page }) => {
  await loadSATB(page);
  await expect(page.locator('.voice').first().locator('button.vvideo')).toBeVisible();
  await expect(page.locator('#allvid')).toBeVisible();
  await expect(page.locator('#mixvid')).toBeVisible();
  expect(await page.locator('#allvid svg').count()).toBe(1);     // film icon injected
  expect(await page.locator('#mixvid svg').count()).toBe(1);
});

test('video: All parts as video records a separate clip per part', async ({ page }) => {
  test.slow();                                                    // each part records in real time
  await loadSATB(page);                                           // Soprano + Alto -> 2 parts
  await page.evaluate(() => { document.getElementById('bpm').value = 160; });   // keep clips short
  const downloads = [];
  page.on('download', (d) => downloads.push(d));
  await page.locator('#allvid').click();
  await expect.poll(() => downloads.length, { timeout: 40000 }).toBe(2);   // one file per part, not a single mix
  for (const d of downloads) expect(d.suggestedFilename()).toMatch(/\.(mp4|webm)$/);
  expect(page.errors).toEqual([]);
});

test('video: Full mix asks for a destination up front (Save As), not a silent download', async ({ page }) => {
  test.slow();                                                    // records in real time
  await page.evaluate((x) => loadMusicXMLText(x, document.getElementById('xmlmsg')), REPEAT);
  await page.evaluate(() => { document.getElementById('bpm').value = 160; });   // keep the clip short
  await page.evaluate(() => {
    window.__vid = null; window.__vidDownloaded = false;
    const realCreate = document.createElement.bind(document);
    document.createElement = (tag) => {                           // detect any fallback <a download> save
      const el = realCreate(tag);
      if (tag === 'a') { const c = el.click.bind(el); el.click = () => { if (el.download) window.__vidDownloaded = true; return c(); }; }
      return el;
    };
    window.showSaveFilePicker = async (opts) => ({                // a fake picker that records what it was asked to save
      createWritable: async () => ({ write: async (blob) => { window.__vid = { name: opts.suggestedName, size: blob.size }; }, close: async () => {} }),
    });
  });
  await page.locator('#mixvid').click();
  await page.waitForFunction(() => window.__vid !== null, null, { timeout: 30000 });
  const v = await page.evaluate(() => window.__vid);
  expect(v.name).toMatch(/\.(mp4|webm)$/);                        // suggested a real filename
  expect(v.size).toBeGreaterThan(1000);                          // wrote the recorded clip through the chosen handle
  expect(await page.evaluate(() => window.__vidDownloaded)).toBe(false);   // NOT a silent fallback download
});

// Real multi-part hymn projects (saved from the app) - good stress tests for the mix video.
const HYMN_FIXTURES = ['through-the-love-of-god.solfege.json', 'o-perfect-love.solfege.json'];
for (const fx of HYMN_FIXTURES) {
  test(`video: mix frames animate the whole way through ${fx} (no freeze, no throw)`, async ({ page }) => {
    const json = require('fs').readFileSync(path.resolve(__dirname, 'fixtures', fx), 'utf8');
    const r = await page.evaluate((data) => {
      restoreState(JSON.parse(data));
      const audible = tracks.filter((t) => (soloActive ? t.solo : t.enabled));
      const dims = videoDims(audible);
      const cv = document.createElement('canvas'); cv.width = dims.W; cv.height = dims.H;
      const g = cv.getContext('2d');
      let maxBeat = 0;
      audible.forEach((t) => t.notes.forEach((n) => { maxBeat = Math.max(maxBeat, n.startBeat + n.durBeat); }));
      const snap = (beat) => { drawVideoFrame(g, audible, beat, dims); return g.getImageData(0, 0, dims.W, 60).data.join(','); };
      let threw = null, frames = [];
      try {
        for (let beat = 0; beat <= maxBeat + 1; beat += 0.25) drawVideoFrame(g, audible, beat, dims);  // whole piece must not throw
        frames = [snap(0), snap(maxBeat * 0.25), snap(maxBeat * 0.5), snap(maxBeat * 0.75)];
      } catch (e) { threw = e.message; }
      const distinct = new Set(frames).size;
      return { parts: audible.length, maxBeat, threw, distinct };
    }, json);
    expect(r.threw).toBeNull();
    expect(r.parts).toBeGreaterThan(1);          // both fixtures are full multi-part mixes (no track soloed)
    expect(r.distinct).toBeGreaterThan(1);       // the strip actually scrolls (it isn't frozen on one frame)
    expect(page.errors).toEqual([]);
  });
}

test('video: a single-track video gets a scrolling sheet lane underneath the grid', async ({ page }) => {
  await page.evaluate((x) => loadMusicXMLText(x, document.getElementById('xmlmsg')), QUAVERS);
  const r = await page.evaluate(async () => {
    const sheet = await prepareSheetStrip(tracks[0]);
    if (!sheet) return { ok: false };
    const dims = videoDims([tracks[0]], true);
    const cv = document.createElement('canvas'); cv.width = dims.W; cv.height = dims.H;
    const g = cv.getContext('2d');
    drawVideoFrame(g, [tracks[0]], 1, dims, sheet);
    const top = dims.titleH + dims.laneH;            // the sheet lane sits below the single grid lane
    const data = g.getImageData(0, top, dims.W, dims.sheetH).data;
    let nonPaper = 0;
    for (let i = 0; i < data.length; i += 4) if (!(data[i] === 244 && data[i + 1] === 239 && data[i + 2] === 230)) nonPaper++;
    // count accent2-green pixels in the staff area only (below the "Sheet" label) = the recoloured current note
    const staffTop = top + 30;
    const sd = g.getImageData(0, staffTop, dims.W, dims.sheetH - 30).data;
    let green = 0;
    for (let i = 0; i < sd.length; i += 4) if (sd[i] === 47 && sd[i + 1] === 107 && sd[i + 2] === 95) green++;
    // a frame at a later beat should scroll the staff (different pixels)
    const g2 = document.createElement('canvas'); g2.width = dims.W; g2.height = dims.H;
    const c2 = g2.getContext('2d'); drawVideoFrame(c2, [tracks[0]], 0, dims, sheet);
    const d0 = c2.getImageData(0, top, dims.W, dims.sheetH).data.join(',');
    const d1 = data.join(',');
    return { ok: true, sheetH: dims.sheetH, pts: sheet.pts.length, nonPaper, green, scrolls: d0 !== d1 };
  });
  expect(r.ok).toBe(true);
  expect(r.sheetH).toBe(240);                // bigger sheet lane
  expect(r.pts).toBeGreaterThan(0);
  expect(r.nonPaper).toBeGreaterThan(500);   // the staff actually rendered into the lane
  expect(r.green).toBeGreaterThan(0);        // the current note is turned green
  expect(r.scrolls).toBe(true);              // and it moves with the beat
});

test('video: the full mix gets NO sheet lane (kept compact)', async ({ page }) => {
  await loadSATB(page);   // 2 parts
  const sheetH = await page.evaluate(() => videoDims(tracks, false).sheetH);
  expect(sheetH).toBe(0);
});

test('video: a frame renders the active note highlighted (canvas paints, no error)', async ({ page }) => {
  await loadSATB(page);
  const ok = await page.evaluate(() => {
    const parts = [tracks[0]];
    const dims = videoDims(parts);
    const cv = document.createElement('canvas'); cv.width = dims.W; cv.height = dims.H;
    const g = cv.getContext('2d');
    drawVideoFrame(g, parts, 0, dims);                            // beat 0 -> first note active
    const data = g.getImageData(0, 0, dims.W, dims.H).data;
    let nonPaper = 0;
    for (let i = 0; i < data.length; i += 4) if (!(data[i] === 244 && data[i + 1] === 239 && data[i + 2] === 230)) nonPaper++;
    return { w: dims.W, even: dims.H % 2 === 0, nonPaper };
  });
  expect(ok.w).toBe(760);
  expect(ok.even).toBe(true);                                     // H.264 needs even dimensions
  expect(ok.nonPaper).toBeGreaterThan(1000);                      // it actually drew the grid
});

test('video: pickVideoMime returns a recordable type', async ({ page }) => {
  const m = await page.evaluate(() => pickVideoMime());
  expect(['.mp4', '.webm']).toContain(m.ext);                     // prefers mp4, falls back to webm
});

test('video: exporting a part records a shareable clip with audio', async ({ page }) => {
  test.slow();                                                    // recording runs in real time
  await page.evaluate((x) => loadMusicXMLText(x, document.getElementById('xmlmsg')), REPEAT);
  await page.evaluate(() => { document.getElementById('bpm').value = 160; });   // keep the clip short
  const row = page.locator('.voice').first();
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    row.locator('button.vvideo').click(),
  ]);
  expect(dl.suggestedFilename()).toMatch(/\.(mp4|webm)$/);
  const fs = require('fs');
  expect(fs.statSync(await dl.path()).size).toBeGreaterThan(1000);
  expect(page.errors).toEqual([]);
});

// ---- beaming toggle ----

test('beams: the Join/Split toggle turns eighth-note beams on and off', async ({ page }) => {
  await page.evaluate((x) => loadMusicXMLText(x, document.getElementById('xmlmsg')), QUAVERS);
  const v = page.locator('.voice').first();
  await v.getByRole('button', { name: 'Sheet', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.voicebox .vf-beam').length > 0, null, { timeout: 8000 });
  await page.locator('#beamToggle button', { hasText: 'Split' }).click();   // turn beaming off
  await page.waitForFunction(() => document.querySelectorAll('.voicebox .sheetnote').length >= 4 && document.querySelectorAll('.voicebox .vf-beam').length === 0, null, { timeout: 8000 });
  expect(await page.evaluate(() => showBeams)).toBe(false);
  await page.locator('#beamToggle button', { hasText: 'Join' }).click();    // back on
  await page.waitForFunction(() => document.querySelectorAll('.voicebox .vf-beam').length > 0, null, { timeout: 8000 });
});

// ---- per-part sheet (staff) export ----

test('export: a part in Sheet view exports its engraved staff as PNG', async ({ page }) => {
  await page.evaluate((x) => loadMusicXMLText(x, document.getElementById('xmlmsg')), QUAVERS);
  const v = page.locator('.voice').first();
  await v.getByRole('button', { name: 'Sheet', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.voicebox .sheetnote').length >= 4, null, { timeout: 8000 });
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    v.getByRole('button', { name: 'PNG' }).click(),
  ]);
  expect(dl.suggestedFilename()).toMatch(/\.png$/);
  const fs = require('fs');
  expect(fs.statSync(await dl.path()).size).toBeGreaterThan(1000);
  expect(page.errors).toEqual([]);
});

// ---- anacrusis / pickup (lead-in) + bar feedback ----

test('pickup: the serializer emits a short implicit first measure', async ({ page }) => {
  const r = await page.evaluate(() => {
    meterBeats = 4; meterType = 4; edited = true; pickupBeats = 1;
    tracks = [{ id: 't0', label: 'M', enabled: true, solo: false, vol: 1, notes:
      [0,0,0,0,0].map(() => ({ isRest: false, step: 'C', alter: 0, oct: 5, durBeat: 1 })) }];   // pickup + 4-beat bar
    tracks.forEach(reflowTrack);
    const doc = new DOMParser().parseFromString(tracksToMusicXML({ beats: 4, beatType: 4, pickupBeats: 1 }), 'application/xml');
    const ms = [...doc.querySelectorAll('part measure')];
    return {
      count: ms.length,
      implicit: ms[0].getAttribute('implicit'),
      firstDur: [...ms[0].querySelectorAll('note duration')].reduce((s, d) => s + (+d.textContent), 0),
    };
  });
  expect(r.count).toBe(2);          // pickup measure + one full bar
  expect(r.implicit).toBe('yes');   // pickup bar isn't a counted full measure
  expect(r.firstDur).toBe(768);     // the pickup bar holds just the 1-beat lead-in (XDIV ticks)
});

test('bar feedback: a barline shows at each bar boundary in the grid', async ({ page }) => {
  await page.evaluate(() => {
    meterBeats = 4; meterType = 4; edited = true; pickupBeats = 0;
    tracks = [{ id: 't0', label: 'M', enabled: true, solo: false, vol: 1, notes:
      Array.from({ length: 8 }, () => ({ isRest: false, step: 'C', alter: 0, oct: 5, durBeat: 1 })) }];   // two full 4/4 bars
    afterEdit();
  });
  expect(await page.locator('.voice').first().locator('.barline').count()).toBe(1);   // one internal barline (the final one is omitted)
});

test('bar feedback: an incomplete last bar is flagged, and marking the lead-in clears it', async ({ page }) => {
  await page.evaluate(() => {
    meterBeats = 4; meterType = 4; edited = true; pickupBeats = 0;
    tracks = [{ id: 't0', label: 'M', enabled: true, solo: false, vol: 1, notes:
      Array.from({ length: 5 }, () => ({ isRest: false, step: 'C', alter: 0, oct: 5, durBeat: 1 })) }];   // 5 beats -> not whole bars
    afterEdit();
  });
  const v = page.locator('.voice').first();
  await expect(v.locator('.barwarn')).toBeVisible();              // "last bar 1/4"
  const sop = await editPart(page, 0);
  await cells(sop).nth(0).click();                               // select the would-be lead-in note
  await expect(sop.locator('.noteeditor #neLeadIn')).toBeVisible();
  await sop.locator('.noteeditor #neLeadIn').click();            // mark it as the pickup
  expect(await page.evaluate(() => pickupBeats)).toBe(1);
  await expect(v.locator('.barwarn')).toHaveCount(0);            // now 1 + 4 = whole bars, warning gone
});

test('pickup persists in the project and round-trips', async ({ page }) => {
  await page.evaluate(() => {
    meterBeats = 4; meterType = 4; edited = true; pickupBeats = 1;
    tracks = [{ id: 't0', label: 'M', enabled: true, solo: false, vol: 1, notes:
      [0,0,0,0,0].map(() => ({ isRest: false, step: 'C', alter: 0, oct: 5, durBeat: 1 })) }];
    afterEdit();
  });
  const st = await page.evaluate(() => sessionState());
  expect(st.pickupBeats).toBe(1);
  await page.evaluate((s) => { pickupBeats = 0; restoreState(s); }, st);
  expect(await page.evaluate(() => pickupBeats)).toBe(1);
});
