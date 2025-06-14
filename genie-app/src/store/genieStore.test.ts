import { describe, it, expect, beforeEach } from 'vitest'
import { useGenieStore } from './genieStore'

beforeEach(() => {
  useGenieStore.setState({
    status: 'AWAITING_KEY',
    apiKey: '',
    prompt: '',
    plan: '',
    code: '',
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

  it('stores generated plan and code', () => {
    useGenieStore.getState().setPlan('plan')
    useGenieStore.getState().setCode('code')
    expect(useGenieStore.getState().plan).toBe('plan')
    expect(useGenieStore.getState().code).toBe('code')
  })

  it('resets state', () => {
    useGenieStore.getState().setPrompt('p')
    useGenieStore.getState().reset()
    expect(useGenieStore.getState().status).toBe('IDLE')
    expect(useGenieStore.getState().prompt).toBe('')
  })

  it('updates status', () => {
    useGenieStore.getState().updateStatus('CODING')
    expect(useGenieStore.getState().status).toBe('CODING')
  })
})
