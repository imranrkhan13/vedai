export function sectionInstruction(questions: {marks:number}[]) {
  const values=[...new Set(questions.map(q=>q.marks))];
  return values.length===1 ? `Attempt all questions. Each question carries ${values[0]} mark${values[0]===1?'':'s'}.` : 'Attempt all questions. Marks are shown beside each question.';
}
export const unresolvedToken = /\b(?:N|X|XX|TBD|TODO)\s+marks?\b|\{\{[^}]+\}\}|\[(?:insert|placeholder)[^\]]*\]/i;
