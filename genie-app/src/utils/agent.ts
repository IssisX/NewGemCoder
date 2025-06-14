import { useGenieStore } from '../store/genieStore'

async function fakeOpenAI(prompt: string) {
  await delay(50)
  return `${prompt} - result`
}

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
  addLog('Prompt looks good', 'system')
  updateStatus('PLANNING')
}

export async function runPlanningPhase() {
  const { prompt, addLog, setPlan, updateStatus } = useGenieStore.getState()
  addLog('Generating plan...')
  const plan = await fakeOpenAI(prompt)
  setPlan(plan)
  updateStatus('CODING')
}

export async function runCodingPhase() {
  const { plan, addLog, setCode, updateStatus } = useGenieStore.getState()
  addLog('Generating code...')
  const code = await fakeOpenAI(plan)
  setCode(code)
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
