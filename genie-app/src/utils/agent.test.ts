import { beforeEach, describe, expect, it } from 'vitest'
import { useGenieStore } from '../store/genieStore'
import { orchestrate } from './agent'

beforeEach(() => {
  useGenieStore.setState({
    status: 'IDLE',
    apiKey: '',
    prompt: '',
    plan: '',
    code: '',
    logs: [],
  })
})

describe('orchestrator', () => {
  it('handles empty prompt error', async () => {
    useGenieStore.getState().updateStatus('REFINING')
    await orchestrate()
    expect(useGenieStore.getState().status).toBe('ERROR')
  })

  it('runs full pipeline', async () => {
    useGenieStore.setState({
      status: 'REFINING',
      apiKey: '',
      prompt: 'demo',
      plan: '',
      code: '',
      logs: [],
    })
    await orchestrate() // refinement -> planning
    await orchestrate() // planning -> coding
    await orchestrate() // coding -> completed
    expect(useGenieStore.getState().status).toBe('COMPLETED')
    expect(useGenieStore.getState().plan).not.toBe('')
    expect(useGenieStore.getState().code).not.toBe('')
  })
})
