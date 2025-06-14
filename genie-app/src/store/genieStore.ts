import { create } from 'zustand'

export type Status =
  | 'AWAITING_KEY'
  | 'IDLE'
  | 'REFINING'
  | 'PLANNING'
  | 'CODING'
  | 'TESTING'
  | 'CORRECTING'
  | 'REFACTORING'
  | 'COMPLETED'
  | 'ERROR'

export interface LogEntry {
  message: string
  type: 'agent' | 'user' | 'system' | 'error'
  timestamp: string
}

interface GenieState {
  status: Status
  apiKey: string
  prompt: string
  plan: string
  code: string
  logs: LogEntry[]
  setApiKey: (key: string) => void
  updateStatus: (status: Status) => void
  setPrompt: (prompt: string) => void
  setPlan: (plan: string) => void
  setCode: (code: string) => void
  reset: () => void
  addLog: (message: string, type?: LogEntry['type']) => void
}

export const useGenieStore = create<GenieState>((set) => ({
  status: 'AWAITING_KEY',
  apiKey: '',
  prompt: '',
  plan: '',
  code: '',
  logs: [],
  setApiKey: (key) => set({ apiKey: key }),
  updateStatus: (status) => set({ status }),
  setPrompt: (prompt) => set({ prompt }),
  setPlan: (plan) => set({ plan }),
  setCode: (code) => set({ code }),
  reset: () =>
    set({
      status: 'IDLE',
      prompt: '',
      plan: '',
      code: '',
      logs: [],
    }),
  addLog: (message, type = 'agent') =>
    set((state) => ({
      logs: [
        ...state.logs,
        { message, type, timestamp: new Date().toISOString() },
      ],
    })),
}))
