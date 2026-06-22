const { test, expect } = require('@playwright/test');
const url = 'file://' + __dirname + '/../theory-course.html';

test('naming/construct: clicking the correct line grades correct', async ({ page }) => {
  await page.goto(url);
  await page.evaluate(() => { state.topic='naming'; state.diff=3; buildSegments(); newQuestion(); });
  // target note + its exact y on the staff, computed by the page itself
  const info = await page.evaluate(() => {
    const m = state.q.prompt.match(/Place ([A-G])([#b]?)(\d) on the (\w+) staff/);
    const target = { letter:m[1], acc:m[2], octave:+m[3] };
    const clef = m[4];
    const svg = document.querySelector('#stage svg');
    const r = svg.getBoundingClientRect();
    return { target, clef, y: noteY(clef, target), rectTop: r.top, rectLeft: r.left, answer: state.q.answer };
  });
  // click at the right vertical position
  await page.mouse.click(info.rectLeft + 200, info.rectTop + info.y);
  const placed = await page.evaluate(() => state.placed);
  // now press Check placement
  await page.getByText('Check placement').click();
  const verdict = await page.locator('#feedback .verdict').textContent();
  const placedX = await page.evaluate(() => {
    const t = [...document.querySelectorAll('#stage svg text')].filter(e=>e.textContent==='');
    return t.map(e=>+e.getAttribute('x'));
  });
  console.log('target', info.target, 'placed', placed, 'verdict', verdict, 'noteheadX', placedX);
  expect(placed, 'placed note should equal target').toMatchObject(info.target);
  expect(verdict).toBe('Correct');
});
