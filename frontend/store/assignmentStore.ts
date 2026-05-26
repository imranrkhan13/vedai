import { create } from 'zustand';
import { Assignment, WSMessage } from '@/types';
import { api } from '@/lib/api';

interface JobProgress {
  status: string;
  message: string;
  progress: number;
}

interface AssignmentStore {
  assignments: Assignment[];
  currentAssignment: Assignment | null;
  jobProgress: Record<string, JobProgress>;
  clientId: string | null;
  wsConnected: boolean;
  backendOnline: boolean;
  ws: WebSocket | null;

  setAssignments: (a: Assignment[]) => void;
  setCurrentAssignment: (a: Assignment | null) => void;
  updateJobProgress: (assignmentId: string, progress: JobProgress) => void;
  fetchAssignments: () => Promise<void>;
  fetchAssignment: (id: string) => Promise<Assignment>;
  initWebSocket: () => void;
  disconnectWebSocket: () => void;
}

export const useAssignmentStore = create<AssignmentStore>((set, get) => ({
  assignments: [],
  currentAssignment: null,
  jobProgress: {},
  clientId: null,
  wsConnected: false,
  backendOnline: false,
  ws: null,

  setAssignments: (assignments) => set({ assignments }),
  setCurrentAssignment: (currentAssignment) => set({ currentAssignment }),
  updateJobProgress: (assignmentId, progress) =>
    set((state) => ({ jobProgress: { ...state.jobProgress, [assignmentId]: progress } })),

  fetchAssignments: async () => {
    try {
      const assignments = await api.getAssignments();
      set({ assignments, backendOnline: true });
    } catch {
      set({ backendOnline: false });
    }
  },

  fetchAssignment: async (id: string) => {
    const assignment = await api.getAssignment(id);
    set({ currentAssignment: assignment, backendOnline: true });
    return assignment;
  },

  initWebSocket: () => {
    // Don't re-init if already connected
    const existing = get().ws;
    if (existing && existing.readyState <= WebSocket.OPEN) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5000/ws';
    const clientId = `client_${Math.random().toString(36).slice(2)}`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(`${wsUrl}?clientId=${clientId}`);
    } catch {
      // WebSocket not available (SSR) — silently skip
      return;
    }

    ws.onopen = () => {
      console.log('[WS] Connected');
      set({ wsConnected: true, clientId, ws });
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);

        if (msg.type === 'connected') {
          set({ clientId: msg.clientId || clientId });

        } else if (msg.type === 'job:progress' && msg.assignmentId) {
          set((state) => ({
            jobProgress: {
              ...state.jobProgress,
              [msg.assignmentId!]: {
                status: msg.status || 'processing',
                message: msg.message || 'Processing...',
                progress: msg.progress || 0,
              },
            },
          }));

        } else if (msg.type === 'job:completed' && msg.assignmentId) {
          set((state) => ({
            jobProgress: {
              ...state.jobProgress,
              [msg.assignmentId!]: { status: 'completed', message: 'Done!', progress: 100 },
            },
          }));
          // Refresh the assignment data
          api.getAssignment(msg.assignmentId).then((assignment) => {
            set((state) => ({
              currentAssignment:
                state.currentAssignment?._id === msg.assignmentId ? assignment : state.currentAssignment,
              assignments: state.assignments.map((a) =>
                a._id === msg.assignmentId ? assignment : a
              ),
            }));
          }).catch(() => {});

        } else if (msg.type === 'job:failed' && msg.assignmentId) {
          set((state) => ({
            jobProgress: {
              ...state.jobProgress,
              [msg.assignmentId!]: {
                status: 'failed',
                message: msg.message || 'Generation failed',
                progress: 0,
              },
            },
          }));
        }
      } catch {
        // Ignore malformed WS messages
      }
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected');
      set({ wsConnected: false, ws: null });
    };

    // Suppress the noisy browser WS error object — it's always {} anyway
    ws.onerror = () => {
      console.warn('[WS] Connection failed — backend may not be running yet');
      set({ wsConnected: false });
    };

    set({ ws });
  },

  disconnectWebSocket: () => {
    get().ws?.close();
    set({ ws: null, wsConnected: false });
  },
}));
