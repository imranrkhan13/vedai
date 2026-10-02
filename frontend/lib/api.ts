import { Assignment, CreateAssignmentInput } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const auth = {
  token: () => (typeof window === 'undefined' ? null : localStorage.getItem('vedai_token')),
  email: () => (typeof window === 'undefined' ? null : localStorage.getItem('vedai_email')),
  save: (token: string, email: string) => { localStorage.setItem('vedai_token', token); localStorage.setItem('vedai_email', email); },
  clear: () => { localStorage.removeItem('vedai_token'); localStorage.removeItem('vedai_email'); },
};

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const t = auth.token();
  const res = await fetch(`${API_URL}/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
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
    fetchAPI<{ token: string; user: { id: string; email: string } }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email: string, password: string) =>
    fetchAPI<{ token: string; user: { id: string; email: string } }>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
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
