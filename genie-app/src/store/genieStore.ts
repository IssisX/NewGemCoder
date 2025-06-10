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
  logs: LogEntry[]
  setApiKey: (key: string) => void
  updateStatus: (status: Status) => void
  addLog: (message: string, type?: LogEntry['type']) => void
}

export const useGenieStore = create<GenieState>((set) => ({
  status: 'AWAITING_KEY',
  apiKey: '',
  prompt: '',
  logs: [],
  setApiKey: (key) => set({ apiKey: key }),
  updateStatus: (status) => set({ status }),
  addLog: (message, type = 'agent') =>
    set((state) => ({
      logs: [
        ...state.logs,
        { message, type, timestamp: new Date().toISOString() },
      ],
    })),
}))
