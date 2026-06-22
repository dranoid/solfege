const { test, expect } = require('@playwright/test');
const url = 'file://' + __dirname + '/../theory-course.html';

test('number words and fractions parse', async ({ page }) => {
  await page.goto(url);
  const r = await page.evaluate(() => ({
    two: parseNum('two'), digit2: parseNum('2'), twoBeats: parseNum('2 beats'),
    threeHalf: parseNum('three and a half'), dec: parseNum('3.5'),
    threeQ: parseNum('three quarters'), half: parseNum('a half'), junk: parseNum('banana')
  }));
  expect(r).toEqual({ two:2, digit2:2, twoBeats:2, threeHalf:3.5, dec:3.5, threeQ:0.75, half:0.5, junk: NaN });
});

test('grader accepts "two" for an answer of 2', async ({ page }) => {
  await page.goto(url);
  const ok = await page.evaluate(() => {
    for (let i=0;i<300;i++){ const q=genNoteValues(2, makeRng(i)); if(q.answer==='2') return q.grade('two') && q.grade('2'); }
    return null;
  });
  expect(ok).toBe(true);
});

test('note-values L1 uses several different templates', async ({ page }) => {
  await page.goto(url);
  const prompts = await page.evaluate(() => {
    const set = new Set();
    for (let i=0;i<60;i++){ set.add(genNoteValues(1, makeRng(i*7+1)).prompt.replace(/\b(a |an )?(semibreve|minim|crotchet|quaver|semiquaver|demisemiquaver)s?\b/g,'§').replace(/\d+/g,'#')); }
    return [...set];
  });
  console.log('distinct L1 templates:', prompts.length);
  expect(prompts.length).toBeGreaterThanOrEqual(3);
});

test('note-values L3 is a "construct the note" task', async ({ page }) => {
  await page.goto(url);
  const q = await page.evaluate(() => { const x = genNoteValues(3, makeRng(5)); return { prompt:x.prompt, type:x.answerType, answer:x.answer }; });
  console.log('L3:', q);
  expect(q.prompt.toLowerCase()).toContain('which single note');
});

test('placement: note renders under the cursor (not far-left)', async ({ page }) => {
  await page.goto(url);
  await page.evaluate(() => { state.topic='naming'; state.diff=3; buildSegments(); newQuestion(); });
  const svg = page.locator('#stage svg');
  const box = await svg.boundingBox();
  const clickX = box.x + 250;
  await page.mouse.click(clickX, box.y + (46 + 2*12));
  const px = await page.evaluate(() => state.placed && state.placed.x);
  // placed x should track the click (svg viewBox == css width 360, so 1:1)
  console.log('clickX-in-svg =', 250, ' placed.x =', px);
  expect(Math.abs(px - 250)).toBeLessThan(6);
});
