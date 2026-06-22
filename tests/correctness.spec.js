const { test, expect } = require('@playwright/test');
const url = 'file://' + __dirname + '/../theory-course.html';

// "a quaver = 1/2 beat" is only true in simple time with a crotchet beat. The note-to-note
// RATIOS (2 quavers per crotchet) are meter-independent, but the word "beat" is not. So:
//  - any question that talks in "beats" must carry an explicit, swappable `meterNote`
//    declaring what equals one beat (compound-time lessons will set a different one);
//  - the ratio questions (L2/L3/L4) must not lean on "beats" at all.

test('every "beat" claim carries an explicit meterNote', async ({ page }) => {
  await page.goto(url);
  const violations = await page.evaluate(() => {
    const bad = [];
    for (const diff of [1, 2, 3, 4])
      for (let i = 0; i < 80; i++) {
        const q = genNoteValues(diff, makeRng(i * 37 + diff * 3));
        const txt = `${q.prompt} ${q.explanation}`.toLowerCase();
        if (/\bbeat/.test(txt)) {
          if (!q.meterNote) bad.push(`no meterNote despite beats — L${diff}: ${q.prompt}`);
          else if (!/beat/i.test(q.meterNote)) bad.push(`meterNote doesn't define a beat — L${diff}: ${q.meterNote}`);
        }
      }
    return [...new Set(bad)];
  });
  expect(violations, JSON.stringify(violations, null, 2)).toHaveLength(0);
});

test('ratio questions (L2/L3/L4) state durations, not beats', async ({ page }) => {
  await page.goto(url);
  const beatClaims = await page.evaluate(() => {
    const out = [];
    for (const diff of [2, 3, 4])
      for (let i = 0; i < 60; i++) {
        const q = genNoteValues(diff, makeRng(i * 41 + diff));
        if (/\bbeat/i.test(`${q.prompt} ${q.explanation}`)) out.push(`L${diff}: ${q.explanation}`);
      }
    return [...new Set(out)];
  });
  expect(beatClaims, JSON.stringify(beatClaims, null, 2)).toHaveLength(0);
});

test('the L1 beats question shows the simple-time beat basis', async ({ page }) => {
  await page.goto(url);
  // at least some L1 questions are the "how many beats" template and must carry the meterNote
  const found = await page.evaluate(() => {
    let withBeats = 0, withTag = 0;
    for (let i = 0; i < 120; i++) {
      const q = genNoteValues(1, makeRng(i * 7 + 1));
      if (/\bbeat/i.test(q.prompt)) { withBeats++; if (q.meterNote && /crotchet\s*=\s*1\s*beat/i.test(q.meterNote)) withTag++; }
    }
    return { withBeats, withTag };
  });
  expect(found.withBeats).toBeGreaterThan(0);
  expect(found.withTag).toBe(found.withBeats);
});
