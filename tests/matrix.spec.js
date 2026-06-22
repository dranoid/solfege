const { test, expect } = require('@playwright/test');
const url = 'file://' + __dirname + '/../theory-course.html';

const TOPICS = ['values', 'naming', 'intervals', 'mixed'];
const DIFFS = [1, 2, 3, 4];
const N = 60;   // seeds per cell

// Audit one (topic,difficulty) cell entirely inside the page, where grade() closures live.
async function audit(page, topic, diff, n) {
  return page.evaluate(([topic, diff, n]) => {
    const parseNoteName = (s) => {
      const m = String(s).match(/^([A-G])(bb|b|#|x|)?(-?\d)$/);
      return m ? { letter: m[1], acc: m[2] || '', octave: +m[3] } : null;
    };
    const recs = [];
    for (let i = 0; i < n; i++) {
      const q = generate(topic, diff, makeRng(i * 131 + diff * 17 + topic.length * 1009));
      const r = {
        ok: true, problems: [],
        topic: q.topic, answerType: q.answerType, difficulty: q.difficulty,
        prompt: q.prompt,
      };
      const bad = (m) => { r.ok = false; r.problems.push(m); };
      // structural contract
      if (typeof q.prompt !== 'string' || !q.prompt) bad('no prompt');
      if (q.answer == null) bad('no answer');
      if (!q.expectedText) bad('no expectedText');
      if (!q.explanation) bad('no explanation');
      if (!['mc', 'text', 'write'].includes(q.answerType)) bad('bad answerType ' + q.answerType);
      if (q.difficulty !== diff) bad('difficulty ' + q.difficulty + ' != ' + diff);
      if (topic !== 'mixed' && q.topic !== topic) bad('topic ' + q.topic + ' != ' + topic);
      if (typeof q.grade !== 'function') bad('no grade fn');

      // self-consistency: canonical answer grades correct; a clear wrong answer is rejected
      let correctInput, wrongInput;
      if (q.answerType === 'mc') {
        if (!Array.isArray(q.choices) || q.choices.length < 3 || q.choices.length > 4) bad('mc choices count ' + (q.choices||[]).length);
        else {
          if (new Set(q.choices).size !== q.choices.length) bad('mc duplicate choices');
          if (!q.choices.includes(q.answer)) bad('mc answer not among choices');
        }
        correctInput = q.answer;
        wrongInput = (q.choices || []).find((c) => c !== q.answer);
      } else if (q.answerType === 'write') {
        if (!q.stimulus || !q.stimulus.clef) bad('write without stimulus/clef');
        const t = parseNoteName(q.answer);
        if (!t) bad('write answer unparseable: ' + q.answer);
        if (t && (t.acc === 'x' || t.acc === 'bb')) bad('write needs double accidental: ' + q.answer);
        correctInput = t;
        wrongInput = t ? { letter: t.letter, acc: t.acc, octave: t.octave + 1 } : null;
      } else { // text
        correctInput = q.answer;
        const num = parseNum(q.answer);
        wrongInput = Number.isNaN(num) ? '∅definitely-wrong' : String(num + 1);
      }
      if (correctInput != null) {
        try { if (!q.grade(correctInput)) bad('canonical answer not graded correct'); }
        catch (e) { bad('grade(correct) threw: ' + e.message); }
      }
      if (wrongInput != null) {
        try { if (q.grade(wrongInput)) bad('wrong answer graded correct'); }
        catch (e) { bad('grade(wrong) threw: ' + e.message); }
      }
      recs.push(r);
    }
    return recs;
  }, [topic, diff, n]);
}

for (const topic of TOPICS) {
  for (const diff of DIFFS) {
    test(`generator matrix · ${topic} · L${diff}`, async ({ page }) => {
      await page.goto(url);
      const recs = await audit(page, topic, diff, N);
      const failures = recs.filter((r) => !r.ok);
      if (failures.length) {
        console.log(`\n${topic} L${diff} failures (${failures.length}/${recs.length}):`);
        failures.slice(0, 8).forEach((f) => console.log('  •', f.problems.join('; '), '::', f.prompt));
      }
      // also report the spread of answerTypes covered in this cell
      const types = [...new Set(recs.map((r) => r.answerType))].join(',');
      console.log(`${topic} L${diff}: ${recs.length} ok=${recs.length - failures.length} types=[${types}]`);
      expect(failures, JSON.stringify(failures.slice(0, 5), null, 2)).toHaveLength(0);
    });
  }
}
