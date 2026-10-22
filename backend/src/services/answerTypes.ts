import type { IQuestion } from '../models/Assignment';
export function isMCQ(q: Pick<IQuestion, 'type'>): boolean { return /mcq|multiple.*choice/i.test(q.type); }
const normal = (s: string) => s.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
export function correctChoice(q: IQuestion): number {
 const options = q.options || [];
 if (options.length < 2 || new Set(options.map(normal)).size !== options.length) return -1;
 const exact = options.findIndex(o => normal(o) === normal(q.answer || ''));
 if (exact >= 0) return exact;
 const letter = (q.answer || '').trim().match(/^\(?([a-z])\)?[.)]?$/i);
 const index = letter ? letter[1].toLowerCase().charCodeAt(0) - 97 : -1;
 return index >= 0 && index < options.length ? index : -1;
}
export function selectedChoice(q: Pick<IQuestion, 'options'>, answer: string): number {
 const token = answer.trim().match(/^option:(\d+)$/);
 const letter = answer.trim().match(/^\(?([a-z])\)?[.)]?$/i);
 const index = token ? Number(token[1]) : letter ? letter[1].toLowerCase().charCodeAt(0) - 97 : (q.options || []).findIndex(o => normal(o) === normal(answer));
 return index >= 0 && index < (q.options || []).length ? index : -1;
}
