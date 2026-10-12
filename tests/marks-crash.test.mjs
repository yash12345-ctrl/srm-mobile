import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Core logic extracted from app/marks.tsx
const REGEX = {
  SCORE_FORMAT: /([\d.]+)\s*\/\s*([\d.]+)/,
  ABSENT_TOKENS: /\b(abs|ab|absent|-)\b/i,
};

const parseSingleAssessmentSegment = (raw, fallbackName) => {
  const clean = raw.trim();
  const match = REGEX.SCORE_FORMAT.exec(clean);

  if (match) {
    const obtained = Number.parseFloat(match[1]);
    const max = Number.parseFloat(match[2]);
    const percent = max > 0 ? (obtained / max) * 100 : 0;
    const name = clean.replace(match[0], '').replace(/[-:]/g, '').trim() || fallbackName;
    return { name, scoreStr: match[0], obtained, max, percent };
  }

  const num = Number.parseFloat(clean);
  if (!Number.isNaN(num)) {
    return { name: fallbackName, scoreStr: clean, obtained: num, max: num, percent: 100 };
  }

  return { name: fallbackName, scoreStr: clean, obtained: 0, max: 0, percent: 0 };
};

const processMarksData = (item) => {
  if (!item) return { processedComponents: [], totalObtained: '0', totalMax: '0' };
  const components = item.components || item.marks || [];
  let totalObtained = 0;
  let totalMax = 0;
  const finalProcessed = [];

  components.forEach((comp) => {
    if (!comp) return;
    const existingObtained = typeof comp.obtained === 'number' ? comp.obtained : Number(comp.obtained);
    const existingMax = typeof comp.max === 'number' ? comp.max : Number(comp.max);

    let rawScore = String(comp.score ?? comp.scores ?? comp.scoreStr ?? comp.mark ?? comp.marks ?? '').trim();
    const rawTestName = String(comp.test || comp.name || comp.type || 'Assessment').trim();

    if (!rawScore && Number.isFinite(existingObtained)) {
      rawScore = (existingMax > 0) ? `${existingObtained} / ${existingMax}` : String(existingObtained);
    }

    if ((rawScore.toLowerCase() === 'abs' || rawScore === '0') && existingMax > 0) {
      rawScore = `0 / ${existingMax}`;
    }

    const scoreMatch = REGEX.SCORE_FORMAT.exec(rawScore);
    if (rawTestName.includes('/') && scoreMatch && REGEX.ABSENT_TOKENS.test(rawTestName)) {
      rawScore = `${rawTestName}/${scoreMatch[2]} ${scoreMatch[1]}`;
    }

    const cleanStr = rawScore.toLowerCase();
    if (REGEX.ABSENT_TOKENS.test(cleanStr) || rawScore === '-' || rawScore === '') {
      finalProcessed.push({ name: rawTestName, scoreStr: rawScore || 'Abs', obtained: 0, max: 0, percent: 0 });
      return;
    }

    const segments = rawScore.split(/\n+/).map(s => s.trim()).filter(Boolean);
    const parsedSegments = (segments.length > 1 ? segments : [rawScore]).map(s => parseSingleAssessmentSegment(s, rawTestName));

    parsedSegments.forEach(parsed => {
      totalObtained += parsed.obtained;
      totalMax += parsed.max;
      finalProcessed.push(parsed);
    });
  });

  const fmt = (n) => (n % 1 === 0 ? String(n) : n.toFixed(2));
  return { processedComponents: finalProcessed, totalObtained: fmt(totalObtained), totalMax: fmt(totalMax) };
};

function computeAvgPct(subjects) {
  if (!Array.isArray(subjects) || subjects.length === 0) return 0;
  const withMarks = subjects.filter(d => {
    if (!d) return false;
    const { totalMax } = processMarksData(d);
    return Number.parseFloat(totalMax) > 0;
  });
  if (withMarks.length === 0) return 0;
  return withMarks.reduce((acc, d) => {
    const { totalObtained, totalMax } = processMarksData(d);
    const o = Number.parseFloat(totalObtained) || 0;
    const m = Number.parseFloat(totalMax) || 1;
    return acc + (o / m) * 100;
  }, 0) / withMarks.length;
}

describe('Marks Screen - Crash & Parsing Tests', () => {
  describe('processMarksData Component Parser', () => {
    test('parses standard internal mark components', () => {
      const subject = {
        code: '21AIC301J',
        description: 'DEEP LEARNING',
        marks: [
          { test: 'Cycle Test 1', score: '22.5 / 25' },
          { test: 'Cycle Test 2', score: '24 / 25' }
        ]
      };
      const res = processMarksData(subject);
      assert.equal(res.processedComponents.length, 2);
      assert.equal(res.totalObtained, '46.50');
      assert.equal(res.totalMax, '50');
    });

    test('handles absent / "Abs" / "-" marks without NaN', () => {
      const subject = {
        code: '21AIC302J',
        marks: [
          { test: 'Test 1', score: 'Abs' },
          { test: 'Test 2', score: '-' },
          { test: 'Test 3', score: '' }
        ]
      };
      const res = processMarksData(subject);
      assert.equal(res.processedComponents.length, 3);
      assert.equal(res.totalObtained, '0');
      assert.equal(res.totalMax, '0');
      res.processedComponents.forEach(c => {
        assert.ok(Number.isFinite(c.obtained));
        assert.ok(Number.isFinite(c.max));
      });
    });

    test('handles multi-line composite marks (e.g., theory + lab on separate lines)', () => {
      const subject = {
        code: '21AIC303J',
        marks: [
          { test: 'Practical', score: '10 / 15\n15 / 15' }
        ]
      };
      const res = processMarksData(subject);
      assert.equal(res.processedComponents.length, 2);
      assert.equal(res.totalObtained, '25');
      assert.equal(res.totalMax, '30');
    });

    test('handles null/undefined/missing fields without throwing', () => {
      assert.doesNotThrow(() => processMarksData(null));
      assert.doesNotThrow(() => processMarksData({}));
      assert.doesNotThrow(() => processMarksData({ marks: null }));
      assert.doesNotThrow(() => processMarksData({ marks: [null, undefined, {}] }));
      const res = processMarksData(null);
      assert.equal(res.totalObtained, '0');
    });
  });

  describe('computeAvgPct Aggregator', () => {
    test('computes average percentage across subjects', () => {
      const subjects = [
        { marks: [{ test: 'T1', score: '20 / 25' }] }, // 80%
        { marks: [{ test: 'T1', score: '25 / 25' }] }  // 100%
      ];
      assert.equal(computeAvgPct(subjects), 90);
    });

    test('safely handles 0 subjects or only absent subjects without returning NaN', () => {
      assert.equal(computeAvgPct([]), 0);
      assert.equal(computeAvgPct(null), 0);
      const absentSubjects = [
        { marks: [{ test: 'T1', score: 'Abs' }] },
        { marks: [{ test: 'T2', score: '-' }] }
      ];
      const res = computeAvgPct(absentSubjects);
      assert.equal(res, 0);
      assert.ok(Number.isFinite(res));
    });

    test('safely formats with toFixed(1)', () => {
      const subjects = [
        { marks: [{ test: 'T1', score: '22 / 25' }] } // 88%
      ];
      const avg = computeAvgPct(subjects);
      assert.doesNotThrow(() => {
        const formatted = `${avg.toFixed(1)}%`;
        assert.equal(formatted, '88.0%');
      });
    });
  });
});
