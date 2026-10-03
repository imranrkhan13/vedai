// Age-group rules. The age group only changes (a) whether answers may ever be offered for AI drafting and (b) how the SAME teacher-saved marks are worded.
// It never changes marks, and it is never a date of birth.
export type AgeGroup = 'under18' | 'adult' | 'unknown';
export const AGE_GROUPS: AgeGroup[] = ['under18', 'adult', 'unknown'];
export function cleanAgeGroup(v: unknown): AgeGroup { return v === 'under18' || v === 'adult' ? v : 'unknown'; }

// Gate for sending a student's REAL typed answer to a third-party AI service. Today the switch is OFF for everyone:
// even an adult who agreed is not sent anywhere until REAL_ANSWER_AI is deliberately turned on after the open approvals are settled.
export function realAnswerAiGate(s: { id?: string; age_group?: string; ai_consent?: boolean }): { allowed: boolean; why: string } {
  const g = cleanAgeGroup(s.age_group);
  if (g === 'under18') return { allowed: false, why: 'Under 18: marked by the teacher only, answers are not sent to any AI service.' };
  if (g === 'unknown') return { allowed: false, why: 'Age group not set: marked by the teacher only.' };
  if (!s.ai_consent) return { allowed: false, why: 'The student has not agreed to send their answer to an AI service.' };
  // Not a general switch: only the ONE student row id named in REAL_ANSWER_AI_STUDENT can ever pass.
  if (!s.id || process.env.REAL_ANSWER_AI_STUDENT !== s.id) return { allowed: false, why: 'AI drafting of typed answers is switched off for this student.' };
  return { allowed: true, why: 'Adult, agreed, and named as the single pilot student.' };
}

type Mark = { marks: number; reason?: string };
// Wording built only from the teacher's saved marks and comment. No AI text, no marking-guide text, no invented reasons.
export function feedbackFor(group: AgeGroup, max: number, m: Mark | undefined): { style: 'simple' | 'full'; text: string } | null {
  if (!m || typeof m.marks !== 'number' || !(max > 0)) return null;
  const pct = Math.round((m.marks / max) * 100);
  const comment = (m.reason || '').trim();
  if (group === 'adult') {
    const band = pct >= 80 ? 'Strong result' : pct >= 50 ? 'Partly there' : 'Needs more work';
    return { style: 'full', text: `${band}: ${m.marks} out of ${max} (${pct}%).${comment ? ` Teacher comment: ${comment}` : ' Your teacher left no comment for this question.'}` };
  }
  const band = pct >= 80 ? 'Well done!' : pct >= 50 ? 'Good try, you got part of it.' : 'Keep going, ask your teacher to go over this one.';
  return { style: 'simple', text: `${band} You got ${m.marks} out of ${max}.${comment ? ` Your teacher says: ${comment}` : ''}` };
}
