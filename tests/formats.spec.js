const { test, expect } = require('@playwright/test');
const url = 'file://' + __dirname + '/../theory-course.html';

test('parseNum accepts the forms a human actually types', async ({ page }) => {
  await page.goto(url);
  const r = await page.evaluate(() => ({
    fourUnit: parseNum('four semiquavers'),  // the bug from the screenshot
    four: parseNum('four'), d4: parseNum('4'), beats: parseNum('2 beats'),
    halfFrac: parseNum('1/2'), threeHalfFrac: parseNum('3 1/2'), improper: parseNum('7/2'),
    threeQ: parseNum('three quarters'), threeAndHalf: parseNum('three and a half'),
    junk: parseNum('purple'),
  }));
  expect(r).toEqual({
    fourUnit: 4, four: 4, d4: 4, beats: 2,
    halfFrac: 0.5, threeHalfFrac: 3.5, improper: 3.5,
    threeQ: 0.75, threeAndHalf: 3.5, junk: NaN,
  });
});

test('equivalent answer forms all grade Correct for an integer answer', async ({ page }) => {
  await page.goto(url);
  const res = await page.evaluate(() => {
    let q; for (let i = 0; i < 400; i++) { const x = genNoteValues(2, makeRng(i)); if (parseNum(x.answer) === 4) { q = x; break; } }
    if (!q) return null;
    return ['4', 'four', 'four semiquavers', '  4  '].map((f) => q.grade(f));
  });
  expect(res, 'needed an L2 question with answer 4').not.toBeNull();
  expect(res.every(Boolean)).toBe(true);
});

test('equivalent answer forms all grade Correct for a fractional answer', async ({ page }) => {
  await page.goto(url);
  const res = await page.evaluate(() => {
    let q; for (let i = 0; i < 400; i++) { const x = genNoteValues(4, makeRng(i)); if (parseNum(x.answer) === 3.5) { q = x; break; } }
    if (!q) return null;
    return { forms: ['3.5', '3 1/2', '7/2', 'three and a half'].map((f) => q.grade(f)), wrong: q.grade('4') };
  });
  expect(res, 'needed an L4 question with answer 3.5').not.toBeNull();
  expect(res.forms.every(Boolean)).toBe(true);
  expect(res.wrong).toBe(false);
});

test('every text/write question declares a format hint', async ({ page }) => {
  await page.goto(url);
  const missing = await page.evaluate(() => {
    const out = [];
    for (const topic of ['values', 'naming', 'intervals'])
      for (const diff of [1, 2, 3, 4])
        for (let i = 0; i < 30; i++) {
          const q = generate(topic, diff, makeRng(i * 53 + diff));
          if ((q.answerType === 'text' || q.answerType === 'write') && !q.format)
            out.push(`${topic} L${diff} (${q.answerType}): ${q.prompt}`);
        }
    return [...new Set(out)];
  });
  expect(missing, JSON.stringify(missing, null, 2)).toHaveLength(0);
});

test('note-value displays use fractions, not decimals', async ({ page }) => {
  await page.goto(url);
  const decimals = await page.evaluate(() => {
    const out = [];
    for (const diff of [1, 2, 3, 4])
      for (let i = 0; i < 40; i++) {
        const q = genNoteValues(diff, makeRng(i * 29 + diff));
        for (const field of ['prompt', 'expectedText', 'explanation'])
          if (typeof q[field] === 'string' && /\d\.\d/.test(q[field])) out.push(`L${diff} ${field}: ${q[field]}`);
      }
    return [...new Set(out)];
  });
  expect(decimals, JSON.stringify(decimals, null, 2)).toHaveLength(0);
});
