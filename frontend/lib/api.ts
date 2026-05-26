import { Assignment, CreateAssignmentInput } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'API request failed');
  }
  return data.data as T;
}

export const api = {
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
