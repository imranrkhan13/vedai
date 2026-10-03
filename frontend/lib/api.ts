import { Assignment, CreateAssignmentInput } from '@/types';


// The session lives in an httpOnly cookie that scripts cannot read. Only the display email is kept in localStorage.
export const auth = {
  email: () => (typeof window === 'undefined' ? null : localStorage.getItem('vedai_email')),
  save: (email: string) => { localStorage.setItem('vedai_email', email); },
  clear: () => { localStorage.removeItem('vedai_email'); },
};

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'quillix' },
    ...options,
  });
  const data = await res.json();
  if (res.status === 401 && !path.startsWith('/auth/') && !path.startsWith('/student') && typeof window !== 'undefined') {
    auth.clear();
    window.location.href = '/login';
  }
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'API request failed');
  }
  return data.data as T;
}

export const api = {
  login: (email: string, password: string) =>
    fetchAPI<{ user: { id: string; email: string } }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email: string, password: string) =>
    fetchAPI<{ user: { id: string; email: string } }>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => fetchAPI<{ id: string; email: string }>('/auth/me'),
  logout: () => fetchAPI('/auth/logout', { method: 'POST', body: '{}' }),
  wsTicket: () => fetchAPI<{ ticket: string }>('/auth/ws-ticket'),
  getAssignments: () => fetchAPI<Assignment[]>('/assignments'),
  getAssignment: (id: string) => fetchAPI<Assignment>(`/assignments/${id}`),
  createAssignment: (input: CreateAssignmentInput) =>
    fetchAPI<{ id: string; jobId: string; status: string }>('/assignments', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  regenerateAssignment: (id: string, clientId?: string) =>
    fetchAPI<{ jobId: string; status: string }>(`/assignments/${id}/regenerate`, {
      method: 'POST',
      body: JSON.stringify({ clientId }),
    }),
  saveRubric: (id: string, questionId: string, levels: { marks: number; descriptor: string; example: string }[]) =>
    fetchAPI(`/assignments/${id}/rubric`, { method: 'PATCH', body: JSON.stringify({ questionId, levels }) }),
  gradeAnswer: (id: string, questionId: string, fixture: string, overwrite?: boolean) =>
    fetchAPI(`/assignments/${id}/grade`, { method: 'POST', body: JSON.stringify({ questionId, fixture, overwrite }) }),
  saveGrade: (id: string, questionId: string, marks: number, reason: string) =>
    fetchAPI(`/assignments/${id}/grade`, { method: 'PATCH', body: JSON.stringify({ questionId, marks, reason }) }),
  rosterList: (aid: string) => fetchAPI<{ totalMarks: number; students: { id: string; studentId: string; name: string; submitted: boolean; submittedAt: string | null; late: boolean; released: boolean; markedTotal: number | null }[] }>(`/roster/${aid}`),
  rosterAdd: (aid: string, studentId: string, name: string, ageGroup = 'unknown') => fetchAPI<{ id: string; studentId: string; accessCode: string }>(`/roster/${aid}`, { method: 'POST', body: JSON.stringify({ studentId, name: name || undefined, ageGroup }) }),
  rosterAge: (aid: string, sid: string, ageGroup: string) => fetchAPI<{ ageGroup: string }>(`/roster/${aid}/${sid}/age-group`, { method: 'PATCH', body: JSON.stringify({ ageGroup }) }),
  studentConsent: (agree: boolean) => fetchAPI<{ aiConsent: boolean }>('/student/consent', { method: 'POST', body: JSON.stringify({ agree }) }),
  rosterReset: (aid: string, sid: string) => fetchAPI<{ accessCode: string }>(`/roster/${aid}/${sid}/reset`, { method: 'POST', body: '{}' }),
  rosterRemove: (aid: string, sid: string) => fetchAPI(`/roster/${aid}/${sid}`, { method: 'DELETE' }),
  rosterSubmission: (aid: string, sid: string) => fetchAPI<any>(`/roster/${aid}/${sid}`),
  rosterMark: (aid: string, sid: string, questionId: string, marks: number, reason: string) => fetchAPI<{ total: number }>(`/roster/${aid}/${sid}/marks`, { method: 'PATCH', body: JSON.stringify({ questionId, marks, reason }) }),
  rosterRelease: (aid: string, sid: string, released: boolean) => fetchAPI(`/roster/${aid}/${sid}/release`, { method: 'POST', body: JSON.stringify({ released }) }),
  studentLogin: (studentId: string, accessCode: string) => fetchAPI<{ student: { studentId: string; name: string } }>('/student/login', { method: 'POST', body: JSON.stringify({ studentId, accessCode }) }),
  studentMe: () => fetchAPI<any>('/student/me'),
  studentSubmit: (answers: Record<string, string>) => fetchAPI<{ submitted: boolean; late: boolean }>('/student/submit', { method: 'POST', body: JSON.stringify({ answers }) }),
  studentLogout: () => fetchAPI('/student/logout', { method: 'POST', body: '{}' }),
  deleteAssignment: (id: string) =>
    fetchAPI(`/assignments/${id}`, { method: 'DELETE' }),
};
