// JEE Advanced 2026 Paper 1: OBJECTIVE answer-key scorer, tested against the official final key (jeeadv.ac.in p1_solutions_final.pdf).
// This is deterministic key scoring. It says NOTHING about how well Jev (or any model) grades written answers.
import assert from 'node:assert/strict';
import key from './jee2026.key.json';

type K = { subject: string; q: number; section: 1 | 2 | 3 | 4; correct?: string[]; correctAny?: string[]; range?: [number, number]; value?: number };
const KEY = key as unknown as Record<string, K>;

// RANGE_INCLUSIVE and ROUND_TWO_DP are assumptions: the PDF says "[0.32 to 0.34]" and "truncate/round-off to TWO decimal places" without more detail.
export const RANGE_INCLUSIVE = true;
export function scoreResponse(id: string, resp: string | number | null): number {
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
  const x = Math.round(Number(resp) * 100) / 100; if (!Number.isFinite(x)) return 0;
  if (k.range) return (RANGE_INCLUSIVE ? x >= k.range[0] && x <= k.range[1] : x > k.range[0] && x < k.range[1]) ? 4 : 0;
  return Math.abs(x - k.value!) < 1e-9 ? 4 : 0;
}

let n = 0; const ok = (c: unknown, m: string) => { assert.ok(c, m); n++; };
const ids = Object.keys(KEY);
ok(ids.length === 48, '48 key entries (3 subjects x 16)');
let max = 0; for (const id of ids) { const k = KEY[id]; max += k.section === 1 ? 3 : 4; }
ok(max === 180, 'maximum is 180');
// official-key perfect paper = 180
const perfect = (id: string) => { const k = KEY[id]; return k.section === 2 ? k.correct!.join('') : k.section === 3 ? (k.range ? (k.range[0] + k.range[1]) / 2 : k.value!) : k.correctAny![0]; };
ok(ids.reduce((s, id) => s + scoreResponse(id, perfect(id)), 0) === 180, 'answering the official key scores 180');
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
ok(scoreResponse('PHY-11', 0.65) === 4 && scoreResponse('PHY-11', 0.7) === 4 && scoreResponse('PHY-11', 0.62) === 0 && scoreResponse('PHY-11', 0.71) === 0, 'PHY-11 final range 0.63 to 0.70 (provisional key was 0.63 to 0.68)');
ok(scoreResponse('PHY-10', 0.33) === 4 && scoreResponse('PHY-10', 0.35) === 0, 'PHY-10 range 0.32 to 0.34');
ok(scoreResponse('MAT-12', 4.0) === 4 && scoreResponse('MAT-12', '3.95') === 4 && scoreResponse('MAT-12', 4.2) === 0, 'MAT-12 range 3.9 to 4.1');
ok(scoreResponse('CHE-9', 9.8) === 4 && scoreResponse('CHE-9', 9.79) === 0, 'CHE-9 single value 9.80');
// matching
ok(scoreResponse('PHY-13', 'D') === 4 && scoreResponse('PHY-13', 'A') === -1, 'matching correct +4 / wrong -1');
console.log(`jee2026 key-scorer tests passed: ${n} assertions. UNRESOLVED (not asserted): whether range ends are inclusive; truncate vs round for 3+ decimals.`);
