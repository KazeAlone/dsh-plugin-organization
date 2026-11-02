import { SqliteStore, OrganizationEngine } from '../src/index.mjs'
import { threeProvinces } from '../templates/three-provinces.mjs'

const store = new SqliteStore(':memory:')
let reviews = 0
const runtime = {
  async execute({ node, inputs, feedback }) {
    if (node.kind === 'review') return {
      summary: `Review ${node.id}`, decision: node.id === 'review' && reviews++ === 0 ? 'reject' : 'approve',
      reason: node.id === 'review' && reviews === 1 ? 'Add measurable acceptance criteria' : 'Criteria satisfied',
      subjectDigest: inputs[node.subject].digest,
    }
    return { summary: `${node.role}: ${node.id}`, artifacts: { note: feedback || 'Mock deliverable; no real Agent or model invoked' } }
  },
}
const engine = new OrganizationEngine(store, runtime)
try {
  const created = engine.start(threeProvinces(), 'Build a small task tracker', { ownerSession: 'demo', workspace: '/demo' })
  const run = await engine.drain(created.id)
  console.log(JSON.stringify({ id: run.id, status: run.status, rejections: run.rejections,
    tasks: Object.fromEntries(Object.entries(run.tasks).map(([id, task]) => [id, { status: task.status, attempts: task.attempts.length }])) }, null, 2))
  if (run.status !== 'succeeded') process.exitCode = 1
} finally { await engine.close(); store.close() }
