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

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.errors = errors;
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

test('tabs (Player/Full score/Edit); transport bar sticky across tabs', async ({ page }) => {
  const tabs = await page.locator('#tabs .tab').allTextContents();
  expect(tabs).toEqual(['Player', 'Full score', 'Edit']);
  await loadSATB(page);
  expect(await page.locator('#transportbar').isVisible()).toBe(true);
  await page.locator('#tabs .tab', { hasText: 'Full score' }).click();
  expect(await page.locator('#transportbar').isVisible()).toBe(true);
  await page.locator('#tabs .tab', { hasText: 'Edit' }).click();
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

// ---- Phase 2: editor ----

test('editor: three tabs; Edit tab lists parts and their notes', async ({ page }) => {
  expect(await page.locator('#tabs .tab').allTextContents()).toEqual(['Player', 'Full score', 'Edit']);
  await loadSATB(page);
  await page.locator('#tabs .tab', { hasText: 'Edit' }).click();
  expect(await page.locator('.epart').count()).toBe(2);
  // Soprano part has its 4 notes as chips (+ the add chip)
  const sopChips = page.locator('.epart').first().locator('.echip:not(.addchip)');
  expect(await sopChips.count()).toBe(4);
});

test('editor: changing pitch updates the model and live preview', async ({ page }) => {
  await loadSATB(page);
  await page.locator('#tabs .tab', { hasText: 'Edit' }).click();
  // select first note of first part, change its letter C -> G
  await page.locator('.epart').first().locator('.echip:not(.addchip)').first().click();
  await page.locator('#neStep').selectOption('G');
  await page.waitForTimeout(500);
  const first = await page.evaluate(() => ({ step: tracks[0].notes[0].step, name: tracks[0].notes[0].name, edited }));
  expect(first.step).toBe('G');
  expect(first.name).toContain('G');
  expect(first.edited).toBe(true);
  // preview engraved
  await page.waitForTimeout(800);
  expect(await page.locator('#editsheet svg').count()).toBeGreaterThan(0);
});

test('editor: insert, delete, rest, duration, add/remove part, undo', async ({ page }) => {
  await loadSATB(page);
  await page.locator('#tabs .tab', { hasText: 'Edit' }).click();
  const sop = () => page.locator('.epart').first();

  // baseline note count in Soprano
  const n0 = await page.evaluate(() => tracks[0].notes.length);

  // select first note, insert after -> +1
  await sop().locator('.echip:not(.addchip)').first().click();
  await page.locator('#neInsAfter').click();
  expect(await page.evaluate(() => tracks[0].notes.length)).toBe(n0 + 1);

  // make it a rest
  await page.locator('#neRest').click();
  expect(await page.evaluate(() => { const i = editSel.index; return tracks[0].notes[i].isRest; })).toBe(true);

  // change duration to half (2 beats) and confirm reflow shifts later start beats
  await page.locator('#neRest').click(); // back to a note so duration select stays enabled
  await page.locator('#neDur').selectOption('2');
  expect(await page.evaluate(() => { const i = editSel.index; return tracks[0].notes[i].durBeat; })).toBe(2);

  // delete it -> back to n0
  await page.locator('#neDelete').click();
  expect(await page.evaluate(() => tracks[0].notes.length)).toBe(n0);

  // add a part -> 3 parts, then delete it -> 2
  await page.locator('#edAddPart').click();
  expect(await page.evaluate(() => tracks.length)).toBe(3);
  await page.locator('.epart').last().locator('.delpart').click();
  expect(await page.evaluate(() => tracks.length)).toBe(2);

  // undo (the delete-part) -> back to 3
  await page.locator('#edUndo').click();
  expect(await page.evaluate(() => tracks.length)).toBe(3);
});

test('editor: time signature drives serialized meter', async ({ page }) => {
  await loadSATB(page);
  await page.locator('#tabs .tab', { hasText: 'Edit' }).click();
  await page.locator('#edBeats').selectOption('3');
  await page.locator('#edBeatType').selectOption('4');
  const meter = await page.evaluate(() => {
    const d = new DOMParser().parseFromString(tracksToMusicXML({ beats: meterBeats, beatType: meterType }), 'application/xml');
    return { b: d.querySelector('time beats').textContent, t: d.querySelector('time beat-type').textContent };
  });
  expect(meter).toEqual({ b: '3', t: '4' });
});

// ---- Phase 3: staff interaction ----

test('editor: clicking a note on the preview staff selects it', async ({ page }) => {
  await loadSATB(page);
  await page.locator('#tabs .tab', { hasText: 'Edit' }).click();
  await page.waitForTimeout(1200); // preview render
  // dispatch a real mousedown at the 3rd Soprano note's on-screen element centre
  const ok = await page.evaluate(() => {
    const gm = editOsmd.GraphicSheet.MeasureList[0][0];
    const gn = gm.staffEntries[2].graphicalVoiceEntries[0].notes[0]; // 3rd note (E5)
    const g = gn.getSVGGElement();
    const r = g.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    g.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: cx, clientY: cy }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: cx, clientY: cy }));
    return editSel && { trackId: editSel.trackId, index: editSel.index };
  });
  expect(ok).toBeTruthy();
  expect(ok.index).toBe(2);
  // the corresponding grid chip is now selected
  expect(await page.locator('.epart').first().locator('.echip.sel .nm').textContent()).toBe('E5');
  // and the note is highlighted on the staff
  expect(await page.locator('#editsheet .ednote-sel').count()).toBeGreaterThan(0);
});

test('editor: arrow up/down nudges the selected pitch a diatonic step', async ({ page }) => {
  await loadSATB(page);
  await page.locator('#tabs .tab', { hasText: 'Edit' }).click();
  await page.locator('.epart').first().locator('.echip:not(.addchip)').first().click(); // C5
  await page.keyboard.press('ArrowUp');   // C5 -> D5
  expect(await page.evaluate(() => tracks[0].notes[0].name)).toBe('D5');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown'); // D5 -> C5 -> B4
  expect(await page.evaluate(() => tracks[0].notes[0].name)).toBe('B4');
});

// ---- Phase 4: blank "New piece" builder ----

test('New piece: starts a blank piece, jumps to Edit, builds and serializes', async ({ page }) => {
  // the app boots with a default melody, so New piece asks to confirm; accept it
  page.on('dialog', (d) => d.accept());
  await page.locator('#tabs .tab', { hasText: 'Edit' }).click();
  await page.locator('#edNew').click();
  await page.waitForTimeout(300);
  // edit tab is active with one part + one note
  expect(await page.locator('#view-edit').isVisible()).toBe(true);
  expect(await page.evaluate(() => tracks.length)).toBe(1);
  expect(await page.evaluate(() => tracks[0].notes.length)).toBe(1);
  expect(await page.evaluate(() => ({ beats: meterBeats, type: meterType, edited }))).toEqual({ beats: 4, type: 4, edited: true });

  // build it: add two notes, set title
  await page.locator('.epart').first().locator('.echip.addchip').click();
  await page.locator('.epart').first().locator('.echip.addchip').click();
  await page.fill('#edTitle', 'My Tune');
  expect(await page.evaluate(() => tracks[0].notes.length)).toBe(3);

  // it serializes to valid MusicXML with the title
  const xml = await page.evaluate(() => tracksToMusicXML({ beats: meterBeats, beatType: meterType }));
  expect(xml).toContain('<score-partwise');
  expect(xml).toContain('My Tune');

  // and the live preview engraves
  await page.waitForTimeout(800);
  expect(await page.locator('#editsheet svg').count()).toBeGreaterThan(0);
});

test('New piece: prompts before discarding a loaded piece', async ({ page }) => {
  await loadSATB(page); // now hasMusic() is true
  await page.locator('#tabs .tab', { hasText: 'Edit' }).click();

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

test('editor: piece title and part names are editable and app-styled', async ({ page }) => {
  await loadSATB(page);
  await page.locator('#tabs .tab', { hasText: 'Edit' }).click();
  // title input is styled like the app (bordered + serif), not a raw browser box
  const s = await page.evaluate(() => { const c = getComputedStyle(document.getElementById('edTitle')); return { bw: c.borderTopWidth, ff: c.fontFamily.toLowerCase() }; });
  expect(s.bw).not.toBe('0px');
  expect(s.ff).toContain('newsreader');
  // rename a part
  await page.locator('.epart').first().locator('.epart-head input').fill('Descant');
  expect(await page.evaluate(() => tracks[0].label)).toBe('Descant');
  // rename the piece
  await page.fill('#edTitle', 'Hymn 42');
  expect(await page.evaluate(() => pieceName)).toBe('Hymn 42');
});

// ---- Phase 5: OMR review/edit gate ----

test('Phase 5: a transcription lands in the editor behind a review banner', async ({ page }) => {
  await page.route('**/transcribe', (route) => route.fulfill({ status: 200, contentType: 'application/xml', body: SATB }));
  // drive the OMR path directly with a fake file (fetch is mocked)
  await page.evaluate(() => transcribePhoto(new File(['x'], 'scan.png', { type: 'image/png' }), document.getElementById('photomsg')));
  await page.waitForTimeout(400);
  // landed in the Edit tab with the banner shown, parts loaded
  expect(await page.locator('#view-edit').isVisible()).toBe(true);
  expect(await page.locator('#omrbanner').isVisible()).toBe(true);
  expect(await page.evaluate(() => tracks.length)).toBe(2);
  // "send to player" dismisses the banner and shows the Player
  await page.locator('#omrDone').click();
  expect(await page.locator('#view-player').isVisible()).toBe(true);
  expect(await page.locator('#omrbanner').isVisible()).toBe(false);
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

  await page.locator('#tabs .tab', { hasText: 'Edit' }).click();
  await page.waitForTimeout(200);
  expect(await page.locator('.epart.suspect').count()).toBe(4);          // the four 1-note voices flagged
  expect(await page.locator('.editnote').isVisible()).toBe(true);

  // removal is user-initiated and undoable
  await page.locator('.editnote button').click();
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => tracks.length)).toBe(4);
  await page.locator('#edUndo').click();
  expect(await page.evaluate(() => tracks.length)).toBe(8);
});

test('editor: edits flow through to the player sheet (serializer, not stale import)', async ({ page }) => {
  await loadSATB(page);
  await page.locator('#tabs .tab', { hasText: 'Edit' }).click();
  // change Soprano first note to A5
  await page.locator('.epart').first().locator('.echip:not(.addchip)').first().click();
  await page.locator('#neStep').selectOption('A');
  await page.locator('#neOctUp').click(); // 5 -> ensure octave; SATB soprano starts at C5 so A stays oct5
  await page.waitForTimeout(300);
  // player per-part sheet should now render from edited notes
  await page.locator('#tabs .tab', { hasText: 'Player' }).click();
  await page.locator('.voice', { hasText: 'Soprano' }).getByRole('button', { name: 'Sheet', exact: true }).click();
  await page.waitForTimeout(1500);
  expect(await page.locator('.voice', { hasText: 'Soprano' }).locator('.voicebox svg').count()).toBeGreaterThan(0);
});

// ---- SATB template + persistence ----

test('New SATB: creates four named voices', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.locator('#tabs .tab', { hasText: 'Edit' }).click();
  await page.locator('#edSATB').click();
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => tracks.map((t) => t.label))).toEqual(['Soprano', 'Alto', 'Tenor', 'Bass']);
});

test('persistence: the working piece survives a page reload', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.locator('#tabs .tab', { hasText: 'Edit' }).click();
  await page.locator('#edNew').click();
  await page.fill('#edTitle', 'PersistMe');
  await page.locator('.epart').first().locator('.echip.addchip').click(); // 2 notes
  await page.waitForTimeout(900); // let the 600ms autosave debounce flush
  await page.reload();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => pieceName)).toBe('PersistMe');
  expect(await page.evaluate(() => tracks.length)).toBe(1);
  expect(await page.evaluate(() => tracks[0].notes.length)).toBe(2);
});

test('project: Save downloads a .solfege.json and Open restores it', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.locator('#tabs .tab', { hasText: 'Edit' }).click();
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
