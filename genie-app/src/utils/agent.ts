import { useGenieStore } from '../store/genieStore'

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function runRefinementPhase() {
  const { prompt, addLog, updateStatus } = useGenieStore.getState()
  addLog('Refining prompt...')
  await delay(100)
  if (!prompt.trim()) {
    addLog('Prompt is empty', 'error')
    updateStatus('ERROR')
    return
  }
  // Simulate analysis
  addLog('Prompt looks good', 'system')
  updateStatus('PLANNING')
}

export async function runPlanningPhase() {
  const { addLog, updateStatus } = useGenieStore.getState()
  addLog('Generating plan...')
  await delay(100)
  updateStatus('CODING')
}

export async function runCodingPhase() {
  const { addLog, updateStatus } = useGenieStore.getState()
  addLog('Generating code...')
  await delay(100)
  updateStatus('COMPLETED')
}

export async function orchestrate() {
  const { status } = useGenieStore.getState()
  switch (status) {
    case 'REFINING':
      await runRefinementPhase()
      break
    case 'PLANNING':
      await runPlanningPhase()
      break
    case 'CODING':
      await runCodingPhase()
      break
  }
}
