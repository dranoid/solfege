const { test, expect } = require('@playwright/test');
const url = 'file://' + __dirname + '/../theory-course.html';

async function gotoCell(page, topic, diff) {
  await page.evaluate(([t, d]) => { state.topic = t; state.diff = d; buildSegments(); newQuestion(); }, [topic, diff]);
}

// Read the current question + (for write) the screen coords of the correct notehead, then answer it.
async function answerCorrectly(page) {
  const info = await page.evaluate(() => {
    const q = state.q, out = { type: q.answerType, answer: q.answer };
    if (q.answerType === 'write') {
      const m = q.answer.match(/^([A-G])(bb|b|#|x|)?(-?\d)$/);
      const note = { letter: m[1], acc: m[2] || '', octave: +m[3] };
      const r = document.querySelector('#stage svg').getBoundingClientRect();
      out.note = note; out.y = noteY(q.stimulus.clef, note); out.top = r.top; out.left = r.left;
    }
    return out;
  });
  if (info.type === 'mc') {
    await page.evaluate((ans) => { [...document.querySelectorAll('.choice')].find((b) => b.textContent === ans).click(); }, info.answer);
  } else if (info.type === 'text') {
    await page.fill('#answerInput', info.answer);
    await page.evaluate(() => submit(document.getElementById('answerInput').value));
  } else { // write
    const accIdx = info.note.acc === '#' ? 1 : info.note.acc === 'b' ? 2 : 0;
    await page.locator('.accbtn').nth(accIdx).click();
    await page.mouse.click(info.left + 200, info.top + info.y);
    await page.evaluate(() => submit(state.placed));
  }
  return { type: info.type, verdict: await page.locator('#feedback .verdict').textContent() };
}

const TOPICS = ['values', 'naming', 'intervals'];
for (const topic of TOPICS) {
  for (const diff of [1, 2, 3, 4]) {
    test(`UI end-to-end · ${topic} · L${diff} · answer 5 correctly`, async ({ page }) => {
      await page.goto(url);
      await gotoCell(page, topic, diff);
      const types = new Set();
      for (let k = 0; k < 5; k++) {
        const { type, verdict } = await answerCorrectly(page);
        types.add(type);
        expect(verdict, `${topic} L${diff} iter ${k}`).toBe('Correct');
        await page.locator('#nextBtn').click();
      }
      console.log(`${topic} L${diff} answered via [${[...types].join(',')}]`);
    });
  }
}

// Grading is real: a deliberately wrong answer must be rejected, for each answer type.
test('wrong answers are rejected (mc / text / write)', async ({ page }) => {
  await page.goto(url);
  // mc (values L1)
  await gotoCell(page, 'values', 1);
  await page.evaluate(() => { const wrong = [...document.querySelectorAll('.choice')].find((b) => b.textContent !== state.q.answer); wrong.click(); });
  expect(await page.locator('#feedback .verdict').textContent()).toBe('Not quite');
  // text (intervals L2)
  await gotoCell(page, 'intervals', 2);
  await page.evaluate(() => submit('definitely-not-an-interval'));
  expect(await page.locator('#feedback .verdict').textContent()).toBe('Not quite');
  // write (naming L3) — click an octave off
  await gotoCell(page, 'naming', 3);
  const off = await page.evaluate(() => {
    const m = state.q.answer.match(/^([A-G])(bb|b|#|x|)?(-?\d)$/);
    const note = { letter: m[1], acc: m[2] || '', octave: +m[3] + 1 };
    const r = document.querySelector('#stage svg').getBoundingClientRect();
    return { y: noteY(state.q.stimulus.clef, note), top: r.top, left: r.left };
  });
  await page.mouse.click(off.left + 200, off.top + off.y);
  await page.evaluate(() => submit(state.placed));
  expect(await page.locator('#feedback .verdict').textContent()).toBe('Not quite');
});
