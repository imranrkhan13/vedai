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
  if (res.status === 401 && !path.startsWith('/auth/') && typeof window !== 'undefined') {
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
  deleteAssignment: (id: string) =>
    fetchAPI(`/assignments/${id}`, { method: 'DELETE' }),
};
