// JEE Advanced 2026 Paper 1: OBJECTIVE answer-key scorer, tested against the official final key (jeeadv.ac.in p1_solutions_final.pdf).
// This is deterministic key scoring. It says NOTHING about how well Jev (or any model) grades written answers.
import assert from 'node:assert/strict';

type K = { subject: string; q: number; section: 1 | 2 | 3 | 4; correct?: string[]; correctAny?: string[]; range?: [number, number]; value?: number };
// Key transcribed from the official final key text (48 entries). Self-contained so this test runs on its own.
const KEY = {
 "MAT-1": {
  "subject": "Mathematics",
  "q": 1,
  "section": 1,
  "correctAny": [
   "D"
  ]
 },
 "MAT-2": {
  "subject": "Mathematics",
  "q": 2,
  "section": 1,
  "correctAny": [
   "C"
  ]
 },
 "MAT-3": {
  "subject": "Mathematics",
  "q": 3,
  "section": 1,
  "correctAny": [
   "B"
  ]
 },
 "MAT-4": {
  "subject": "Mathematics",
  "q": 4,
  "section": 1,
  "correctAny": [
   "C"
  ]
 },
 "MAT-5": {
  "subject": "Mathematics",
  "q": 5,
  "section": 2,
  "correct": [
   "A",
   "C"
  ]
 },
 "MAT-6": {
  "subject": "Mathematics",
  "q": 6,
  "section": 2,
  "correct": [
   "A",
   "D"
  ]
 },
 "MAT-7": {
  "subject": "Mathematics",
  "q": 7,
  "section": 2,
  "correct": [
   "B",
   "D"
  ]
 },
 "MAT-8": {
  "subject": "Mathematics",
  "q": 8,
  "section": 2,
  "correct": [
   "A",
   "C",
   "D"
  ]
 },
 "MAT-9": {
  "subject": "Mathematics",
  "q": 9,
  "section": 3,
  "value": 2520.0
 },
 "MAT-10": {
  "subject": "Mathematics",
  "q": 10,
  "section": 3,
  "value": 5.0
 },
 "MAT-11": {
  "subject": "Mathematics",
  "q": 11,
  "section": 3,
  "value": 206.0
 },
 "MAT-12": {
  "subject": "Mathematics",
  "q": 12,
  "section": 3,
  "range": [
   3.9,
   4.1
  ]
 },
 "MAT-13": {
  "subject": "Mathematics",
  "q": 13,
  "section": 4,
  "correctAny": [
   "C"
  ]
 },
 "MAT-14": {
  "subject": "Mathematics",
  "q": 14,
  "section": 4,
  "correctAny": [
   "B"
  ]
 },
 "MAT-15": {
  "subject": "Mathematics",
  "q": 15,
  "section": 4,
  "correctAny": [
   "A"
  ]
 },
 "MAT-16": {
  "subject": "Mathematics",
  "q": 16,
  "section": 4,
  "correctAny": [
   "B"
  ]
 },
 "PHY-1": {
  "subject": "Physics",
  "q": 1,
  "section": 1,
  "correctAny": [
   "C"
  ]
 },
 "PHY-2": {
  "subject": "Physics",
  "q": 2,
  "section": 1,
  "correctAny": [
   "C"
  ]
 },
 "PHY-3": {
  "subject": "Physics",
  "q": 3,
  "section": 1,
  "correctAny": [
   "B"
  ]
 },
 "PHY-4": {
  "subject": "Physics",
  "q": 4,
  "section": 1,
  "correctAny": [
   "A",
   "B"
  ]
 },
 "PHY-5": {
  "subject": "Physics",
  "q": 5,
  "section": 2,
  "correct": [
   "A",
   "C"
  ]
 },
 "PHY-6": {
  "subject": "Physics",
  "q": 6,
  "section": 2,
  "correct": [
   "A",
   "B"
  ]
 },
 "PHY-7": {
  "subject": "Physics",
  "q": 7,
  "section": 2,
  "correct": [
   "A",
   "B",
   "C"
  ]
 },
 "PHY-8": {
  "subject": "Physics",
  "q": 8,
  "section": 2,
  "correct": [
   "A",
   "C"
  ]
 },
 "PHY-9": {
  "subject": "Physics",
  "q": 9,
  "section": 3,
  "range": [
   1.7,
   1.75
  ]
 },
 "PHY-10": {
  "subject": "Physics",
  "q": 10,
  "section": 3,
  "range": [
   0.32,
   0.34
  ]
 },
 "PHY-11": {
  "subject": "Physics",
  "q": 11,
  "section": 3,
  "range": [
   0.63,
   0.7
  ]
 },
 "PHY-12": {
  "subject": "Physics",
  "q": 12,
  "section": 3,
  "value": 0.5
 },
 "PHY-13": {
  "subject": "Physics",
  "q": 13,
  "section": 4,
  "correctAny": [
   "D"
  ]
 },
 "PHY-14": {
  "subject": "Physics",
  "q": 14,
  "section": 4,
  "correctAny": [
   "A"
  ]
 },
 "PHY-15": {
  "subject": "Physics",
  "q": 15,
  "section": 4,
  "correctAny": [
   "C"
  ]
 },
 "PHY-16": {
  "subject": "Physics",
  "q": 16,
  "section": 4,
  "correctAny": [
   "A"
  ]
 },
 "CHE-1": {
  "subject": "Chemistry",
  "q": 1,
  "section": 1,
  "correctAny": [
   "B"
  ]
 },
 "CHE-2": {
  "subject": "Chemistry",
  "q": 2,
  "section": 1,
  "correctAny": [
   "C"
  ]
 },
 "CHE-3": {
  "subject": "Chemistry",
  "q": 3,
  "section": 1,
  "correctAny": [
   "A"
  ]
 },
 "CHE-4": {
  "subject": "Chemistry",
  "q": 4,
  "section": 1,
  "correctAny": [
   "C"
  ]
 },
 "CHE-5": {
  "subject": "Chemistry",
  "q": 5,
  "section": 2,
  "correct": [
   "A",
   "B",
   "D"
  ]
 },
 "CHE-6": {
  "subject": "Chemistry",
  "q": 6,
  "section": 2,
  "correct": [
   "A",
   "C"
  ]
 },
 "CHE-7": {
  "subject": "Chemistry",
  "q": 7,
  "section": 2,
  "correct": [
   "B",
   "C"
  ]
 },
 "CHE-8": {
  "subject": "Chemistry",
  "q": 8,
  "section": 2,
  "correct": [
   "A",
   "B",
   "C"
  ]
 },
 "CHE-9": {
  "subject": "Chemistry",
  "q": 9,
  "section": 3,
  "value": 9.8
 },
 "CHE-10": {
  "subject": "Chemistry",
  "q": 10,
  "section": 3,
  "value": 8.0
 },
 "CHE-11": {
  "subject": "Chemistry",
  "q": 11,
  "section": 3,
  "value": 4.0
 },
 "CHE-12": {
  "subject": "Chemistry",
  "q": 12,
  "section": 3,
  "value": 6.0
 },
 "CHE-13": {
  "subject": "Chemistry",
  "q": 13,
  "section": 4,
  "correctAny": [
   "C"
  ]
 },
 "CHE-14": {
  "subject": "Chemistry",
  "q": 14,
  "section": 4,
  "correctAny": [
   "A"
  ]
 },
 "CHE-15": {
  "subject": "Chemistry",
  "q": 15,
  "section": 4,
  "correctAny": [
   "C"
  ]
 },
 "CHE-16": {
  "subject": "Chemistry",
  "q": 16,
  "section": 4,
  "correctAny": [
   "B"
  ]
 }
} as unknown as Record<string, K>;

// The PDF does not say whether "[0.32 to 0.34]" includes its ends, nor whether "round-off to TWO decimal places" means truncate or round.
// So numerical answers are scored under all four readings; if they disagree the result is 'ambiguous' and gets NO authoritative marks.
export type Score = number | 'ambiguous';
function numerical(k: K, raw: number): number {
  const out = new Set<number>();
  for (const inc of [true, false]) for (const rnd of [true, false]) {
    const x = rnd ? Math.round(raw * 100 + 1e-9) / 100 : Math.trunc(raw * 100 + 1e-9) / 100;
    let hit: boolean;
    if (k.range) hit = inc ? x >= k.range[0] && x <= k.range[1] : x > k.range[0] && x < k.range[1];
    else hit = Math.abs(x - k.value!) < 1e-9;
    out.add(hit ? 4 : 0);
  }
  return out.size === 1 ? [...out][0] : NaN;
}
export function scoreResponse(id: string, resp: string | number | null): Score {
  const k = KEY[id]; if (!k) throw new Error('unknown question ' + id);
  if (resp === null || resp === '' || resp === undefined) return 0;
  if (k.section === 1 || k.section === 4) return k.correctAny!.includes(String(resp)) ? (k.section === 1 ? 3 : 4) : -1;
  if (k.section === 2) {
    const S = [...new Set(String(resp).toUpperCase().split(''))].sort(), C = k.correct!;
    if (S.length === 0) return 0;
    if (S.some((x) => !C.includes(x))) return -1;
    if (S.length === C.length) return 4;
    if (C.length === 4 && S.length === 3) return 3;
    if (C.length >= 3 && S.length === 2) return 2;
    if (C.length >= 2 && S.length === 1) return 1;
    return -1;
  }
  const raw = Number(resp); if (!Number.isFinite(raw)) return 0;
  const m = numerical(k, raw);
  return Number.isNaN(m) ? 'ambiguous' : m;
}

let n = 0; const ok = (c: unknown, m: string) => { assert.ok(c, m); n++; };
const ids = Object.keys(KEY);
ok(ids.length === 48, '48 key entries (3 subjects x 16)');
let max = 0; for (const id of ids) { const k = KEY[id]; max += k.section === 1 ? 3 : 4; }
ok(max === 180, 'maximum is 180');
// official-key perfect paper = 180
const perfect = (id: string) => { const k = KEY[id]; return k.section === 2 ? k.correct!.join('') : k.section === 3 ? (k.range ? (k.range[0] + k.range[1]) / 2 : k.value!) : k.correctAny![0]; };
ok(ids.reduce((s, id) => s + (scoreResponse(id, perfect(id)) as number), 0) === 180, 'answering the official key scores 180');
ok(ids.every((id) => scoreResponse(id, null) === 0), 'blank paper scores 0');
// wrong single: -1; wrong numerical: 0
ok(scoreResponse('MAT-1', 'A') === -1 && scoreResponse('MAT-1', 'D') === 3, 'single correct +3 / wrong -1 (key MAT-1 = D)');
ok(scoreResponse('PHY-4', 'A') === 3 && scoreResponse('PHY-4', 'B') === 3 && scoreResponse('PHY-4', 'C') === -1, 'PHY-4 accepts A or B (official key says "A or B")');
ok(scoreResponse('MAT-9', 2520) === 4 && scoreResponse('MAT-9', 2519) === 0, 'integer numerical exact, wrong = 0 (never negative)');
// the PDF's own Section 2 worked example (answers A, B, D) re-created on a synthetic key entry
KEY['EX-1'] = { subject: 'x', q: 0, section: 2, correct: ['A', 'B', 'D'] };
const ex: [string, number][] = [['ABD', 4], ['AB', 2], ['AD', 2], ['BD', 2], ['A', 1], ['B', 1], ['D', 1], ['', 0], ['C', -1], ['AC', -1], ['ABC', -1], ['ABCD', -1]];
for (const [r, m] of ex) ok(scoreResponse('EX-1', r) === m, `PDF example: choosing "${r}" = ${m}`);
KEY['EX-2'] = { subject: 'x', q: 0, section: 2, correct: ['A', 'B', 'C', 'D'] };
ok(scoreResponse('EX-2', 'ABC') === 3 && scoreResponse('EX-2', 'AB') === 2 && scoreResponse('EX-2', 'A') === 1 && scoreResponse('EX-2', 'ABCD') === 4, 'all four correct: 3 options = +3');
KEY['EX-3'] = { subject: 'x', q: 0, section: 2, correct: ['A', 'C'] };
ok(scoreResponse('EX-3', 'A') === 1 && scoreResponse('EX-3', 'AC') === 4 && scoreResponse('EX-3', 'AB') === -1, 'two correct: one option = +1');
// real multi-correct entries from the final key
ok(scoreResponse('PHY-5', 'AC') === 4 && scoreResponse('PHY-5', 'A') === 1 && scoreResponse('PHY-5', 'AB') === -1, 'PHY-5 (AC) on the official key');
ok(scoreResponse('CHE-8', 'ABC') === 4 && scoreResponse('CHE-8', 'AB') === 2 && scoreResponse('CHE-8', 'D') === -1, 'CHE-8 (ABC) on the official key');
// numerical ranges (official final key, inclusive assumed)
ok(scoreResponse('PHY-11', 0.65) === 4 && scoreResponse('PHY-11', 0.62) === 0 && scoreResponse('PHY-11', 0.71) === 0, 'PHY-11 final range 0.63 to 0.70 (provisional key was 0.63 to 0.68)');
ok(scoreResponse('PHY-10', 0.33) === 4 && scoreResponse('PHY-10', 0.35) === 0, 'PHY-10 range 0.32 to 0.34');
ok(scoreResponse('MAT-12', 4.0) === 4 && scoreResponse('MAT-12', '3.95') === 4 && scoreResponse('MAT-12', 4.2) === 0, 'MAT-12 range 3.9 to 4.1');
ok(scoreResponse('CHE-9', 9.8) === 4 && scoreResponse('CHE-9', 9.79) === 0, 'CHE-9 single value 9.80');
// matching
ok(scoreResponse('PHY-13', 'D') === 4 && scoreResponse('PHY-13', 'A') === -1, 'matching correct +4 / wrong -1');
// ambiguous cases are flagged, never given marks
ok(scoreResponse('PHY-11', 0.7) === 'ambiguous' && scoreResponse('PHY-11', 0.63) === 'ambiguous', 'exact range ends are ambiguous (inclusive vs exclusive)');
ok(scoreResponse('PHY-10', 0.345) === 'ambiguous', '0.345 is ambiguous (round gives 0.35 out, truncate gives 0.34 in range)');
ok(scoreResponse('PHY-10', 0.3301) === 4 && scoreResponse('CHE-9', 9.8049) === 4, 'unambiguous 3+ decimal answers still score');
console.log(`jee2026 key-scorer tests passed: ${n} assertions. Ambiguous cases (range ends, rounding vs truncation) return 'ambiguous', not marks.`);
