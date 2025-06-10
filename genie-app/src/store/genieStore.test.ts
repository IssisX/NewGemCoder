import { describe, it, expect, beforeEach } from 'vitest'
import { useGenieStore } from './genieStore'

beforeEach(() => {
  useGenieStore.setState({
    status: 'AWAITING_KEY',
    apiKey: '',
    prompt: '',
    logs: [],
  })
})

describe('useGenieStore', () => {
  it('sets api key', () => {
    useGenieStore.getState().setApiKey('123')
    expect(useGenieStore.getState().apiKey).toBe('123')
  })

  it('adds log entry', () => {
    useGenieStore.getState().addLog('hello')
    expect(useGenieStore.getState().logs).toHaveLength(1)
  })

  it('updates status', () => {
    useGenieStore.getState().updateStatus('CODING')
    expect(useGenieStore.getState().status).toBe('CODING')
  })
})
