import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { OrganizationEngine, SqliteStore, digest, validateDefinition } from '../src/index.mjs'
import { threeProvinces } from '../templates/three-provinces.mjs'

const context = { ownerSession: 'owner', workspace: '/workspace' }
const simple = () => ({ id: 'simple', version: 1,
  roles: [{ id: 'worker', name: 'Worker', runtime: { provider: 'spawn' } }],
  nodes: [{ id: 'work', kind: 'agent', role: 'worker', deps: [], instruction: 'Do work', resources: ['workspace'] }] })
const ok = { async execute() { return { summary: 'done' } } }
function setup(t, runtime = ok, definition = simple(), options) {
  const store = new SqliteStore(':memory:')
  const engine = new OrganizationEngine(store, runtime, options)
  const run = engine.start(definition, 'requirement', context)
  t.after(async () => { await engine.close(); store.close() })
  return { store, engine, run }
}
const errorCode = code => error => error.code === code

test('three-province template rejects, revises, reviews and completes all six ministries', async t => {
  let reviews = 0
  const order = []
  const runtime = { async execute(request) {
    const { node, inputs } = request
    order.push(node.id)
    if (node.id === 'dispatch') {
      assert.equal(request.artifacts.plan.output.summary, 'plan')
      assert.equal(request.artifacts.review.output.decision, 'approve')
    }
    if (node.id === 'plan' && reviews) assert.equal(request.feedback, 'Add testable criteria')
    return node.kind === 'review'
      ? { summary: node.id, decision: node.id === 'review' && reviews++ === 0 ? 'reject' : 'approve',
        reason: 'Add testable criteria', subjectDigest: inputs[node.subject].digest }
      : { summary: node.id }
  } }
  const { engine, store, run } = setup(t, runtime, threeProvinces())
  const done = await engine.drain(run.id)
  assert.equal(done.status, 'succeeded')
  assert.equal(done.tasks.plan.attempts.length, 2)
  assert.equal(done.tasks.review.attempts.length, 2)
  assert.equal(done.rejections.review, 1)
  assert.deepEqual(order.slice(0, 5), ['plan', 'review', 'plan', 'review', 'dispatch'])
  assert.ok(order.indexOf('implement') < order.indexOf('quality'))
  assert.ok(store.events(run.id).some(event => event.type === 'review.rejected'))
  assert.equal(Object.keys(done.tasks).length, 12)
})

test('review exhaustion blocks downstream and retry cannot reset rejection budget', async t => {
  const runtime = { async execute({ node, inputs }) {
    return node.kind === 'review' ? { summary: 'No', decision: 'reject', reason: 'Incomplete', subjectDigest: inputs[node.subject].digest } : { summary: 'plan' }
  } }
  const { engine, run } = setup(t, runtime, threeProvinces())
  const done = await engine.drain(run.id)
  assert.equal(done.status, 'blocked')
  assert.equal(done.tasks.plan.attempts.length, 3)
  assert.equal(done.tasks.dispatch.attempts.length, 0)
  assert.equal(done.tasks.review.attempts.at(-1).error.code, 'REWORK_LIMIT')
  assert.throws(() => engine.retry(run.id, 'review', 'Try again'), errorCode('REWORK_LIMIT'))
})

test('stale review digest cannot authorize execution', async t => {
  const runtime = { async execute({ node }) {
    return node.kind === 'review' ? { summary: 'ok', decision: 'approve', reason: 'fine', subjectDigest: 'old' } : { summary: 'plan' }
  } }
  const { engine, run } = setup(t, runtime, threeProvinces())
  const done = await engine.drain(run.id)
  assert.equal(done.tasks.review.attempts.at(-1).error.code, 'STALE_REVIEW')
  assert.equal(done.tasks.dispatch.status, 'pending')
})

test('human approval requires exact input digest and persists actor identity', async t => {
  const def = simple()
  def.roles.push({ id: 'human', name: 'Human', runtime: { provider: 'spawn' } })
  def.nodes.push({ id: 'approve', kind: 'approval', role: 'human', deps: ['work'] })
  const { engine, run, store } = setup(t, ok, def)
  const waiting = await engine.drain(run.id)
  assert.equal(waiting.status, 'waiting')
  assert.throws(() => engine.approve(run.id, 'approve', { actor: 'operator', reason: 'yes', inputDigest: 'stale' }), errorCode('STALE_APPROVAL'))
  assert.equal(store.get(run.id).tasks.approve.status, 'waiting')
  const approved = engine.approve(run.id, 'approve', { actor: 'operator', reason: 'Reviewed', inputDigest: waiting.tasks.approve.approval.inputDigest })
  assert.equal(approved.status, 'succeeded')
  assert.equal(approved.tasks.approve.output.actor, 'operator')
})

test('definition validation rejects bypass, self-review, dependency/reporting cycles', () => {
  const bypass = threeProvinces(); bypass.nodes.find(n => n.id === 'dispatch').deps = ['plan']
  assert.throws(() => validateDefinition(bypass), errorCode('INVALID_DEFINITION'))
  const self = threeProvinces(); self.nodes.find(n => n.id === 'review').role = 'planning'
  assert.throws(() => validateDefinition(self), errorCode('INVALID_DEFINITION'))
  const cycle = simple(); cycle.nodes[0].deps = ['work']
  assert.throws(() => validateDefinition(cycle), errorCode('INVALID_DEFINITION'))
  const orgCycle = threeProvinces(); orgCycle.roles[0].reportsTo = 'planning'
  assert.throws(() => validateDefinition(orgCycle), errorCode('INVALID_DEFINITION'))
})

test('snapshots and events roll back together', t => {
  const { store, run } = setup(t)
  const original = store.get(run.id)
  assert.throws(() => store.update(run.id, (state, emit) => {
    state.requirement = 'corrupt'; emit({ type: 'bad-event' }); throw new Error('crash')
  }))
  assert.deepEqual(store.get(run.id), original)
  assert.equal(store.events(run.id).length, 1)
})

test('persisted definition is isolated from caller edits and hashes ignore key order', t => {
  const def = simple()
  const { store, run } = setup(t, ok, def)
  def.nodes[0].instruction = 'changed'
  assert.equal(store.get(run.id).definition.nodes[0].instruction, 'Do work')
  assert.equal(digest({ a: 1, b: 2 }), digest({ b: 2, a: 1 }))
})

test('two SQLite connections cannot claim the same node or overwrite settled output', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'organization-test-'))
  const one = new SqliteStore(join(dir, 'run.db')), two = new SqliteStore(join(dir, 'run.db'))
  const first = new OrganizationEngine(one, ok), second = new OrganizationEngine(two, ok)
  t.after(async () => { await first.close(); await second.close(); one.close(); two.close(); rmSync(dir, { recursive: true, force: true }) })
  const run = first.start(simple(), 'test', context)
  const a = first.claim(run.id).result
  assert.ok(a)
  assert.equal(second.claim(run.id).result, null)
  second.settle(run.id, 'work', 'wrong-token', { summary: 'forged' })
  assert.equal(one.get(run.id).tasks.work.status, 'running')
  first.settle(run.id, 'work', a.attempt.id, { summary: 'legitimate' })
  second.settle(run.id, 'work', a.attempt.id, { summary: 'late' })
  assert.equal(one.get(run.id).tasks.work.output.summary, 'legitimate')
})

test('expired attempt becomes unknown after restart; no rerun until reconciliation', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'organization-restart-'))
  const path = join(dir, 'run.db')
  let store = new SqliteStore(path)
  let engine = new OrganizationEngine(store, ok)
  const run = engine.start(simple(), 'test', context)
  const claim = engine.claim(run.id).result
  await engine.close(); store.close()
  store = new SqliteStore(path); engine = new OrganizationEngine(store, ok)
  t.after(async () => { await engine.close(); store.close(); rmSync(dir, { recursive: true, force: true }) })
  engine.recoverExpired(run.id, Date.now() + 60_000)
  assert.equal((await engine.drain(run.id)).tasks.work.status, 'unknown')
  assert.throws(() => engine.retry(run.id, 'work', 'again'), errorCode('INVALID_RETRY'))
  engine.reconcile(run.id, 'work', { actor: 'operator', reason: 'Old process stopped and filesystem checked', action: 'retry' })
  engine.settle(run.id, 'work', claim.attempt.id, { summary: 'late result' })
  const done = await engine.drain(run.id)
  assert.equal(done.status, 'succeeded')
  assert.equal(done.tasks.work.attempts.length, 2)
  assert.equal(done.tasks.work.output.summary, 'done')
})

test('resource locks serialize writers across runs and quarantine unknown work', async t => {
  const { engine, run } = setup(t)
  const other = engine.start(simple(), 'other', context)
  const a = engine.claim(run.id).result
  assert.equal(engine.claim(other.id).result, null)
  engine.recoverExpired(run.id, Date.now() + 60_000)
  assert.equal(engine.claim(other.id).result, null)
  await engine.cancel(run.id)
  assert.equal(engine.store.get(run.id).status, 'blocked')
  engine.reconcile(run.id, 'work', { actor: 'operator', reason: 'Old process is stopped', action: 'stopped' })
  assert.equal(engine.store.get(run.id).status, 'cancelled')
  assert.ok(engine.claim(other.id).result)
  assert.ok(a)
})

test('independent tasks run in parallel within the configured concurrency bound', async t => {
  let active = 0, max = 0
  const def = simple(); def.nodes = Array.from({ length: 5 }, (_, i) => ({ ...def.nodes[0], id: `task-${i}`, resources: [] }))
  const { engine, run } = setup(t, { async execute() {
    active++; max = Math.max(max, active)
    await new Promise(resolve => setTimeout(resolve, 10))
    active--; return { summary: 'done' }
  } }, def, { concurrency: 2 })
  assert.equal((await engine.drain(run.id)).status, 'succeeded')
  assert.equal(max, 2)
})

test('cancel waits for runtime cleanup, fences results and prevents downstream starts', async t => {
  let started, cleaned = false
  const entered = new Promise(resolve => { started = resolve })
  const def = simple(); def.nodes.push({ ...def.nodes[0], id: 'later', deps: ['work'] })
  const { engine, run } = setup(t, { execute({ signal }) {
    started()
    return new Promise(resolve => signal.addEventListener('abort', () => {
      setTimeout(() => { cleaned = true; resolve({ summary: 'late' }) }, 10)
    }, { once: true }))
  } }, def)
  const draining = engine.drain(run.id)
  await entered
  const cancelled = await engine.cancel(run.id)
  assert.ok(cleaned)
  assert.equal(cancelled.status, 'cancelled')
  assert.equal(cancelled.tasks.work.output, null)
  assert.equal(cancelled.tasks.later.attempts.length, 0)
  await draining
})

test('runtime failure blocks dependents and explicit retry reuses completed work', async t => {
  let count = 0
  const { engine, run } = setup(t, { async execute() {
    if (count++ === 0) throw new Error('provider down')
    return { summary: 'recovered' }
  } })
  assert.equal((await engine.drain(run.id)).status, 'blocked')
  engine.retry(run.id, 'work', 'Provider recovered')
  assert.equal((await engine.drain(run.id)).status, 'succeeded')
})

test('malformed output is a failure rather than a successful delivery', async t => {
  const { engine, run } = setup(t, { async execute() { return { summary: '' } } })
  const done = await engine.drain(run.id)
  assert.equal(done.tasks.work.attempts.at(-1).error.code, 'INVALID_OUTPUT')
  assert.equal(done.status, 'blocked')
})

test('cleanup failure during cancellation remains unknown and keeps resource quarantine', async t => {
  let started
  const entered = new Promise(resolve => { started = resolve })
  const { engine, run } = setup(t, { execute({ signal }) {
    started()
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => {
      const error = new Error('cleanup failed'); error.code = 'UNKNOWN_OUTCOME'; reject(error)
    }, { once: true }))
  } })
  const draining = engine.drain(run.id)
  await entered
  const cancelled = await engine.cancel(run.id)
  assert.equal(cancelled.status, 'blocked')
  assert.equal(cancelled.tasks.work.status, 'unknown')
  await draining
})

test('completed tasks are not reexecuted when a waiting run resumes', async t => {
  let calls = 0
  const def = simple()
  def.roles.push({ id: 'operator', name: 'Operator', runtime: { provider: 'spawn' } })
  def.nodes.push({ id: 'approval', kind: 'approval', role: 'operator', deps: ['work'] })
  const { engine, run } = setup(t, { async execute() { calls++; return { summary: 'done' } } }, def)
  await engine.drain(run.id); await engine.drain(run.id)
  assert.equal(calls, 1)
})

test('completion after lease expiry is quarantined even before a recovery scan', t => {
  const { engine, run, store } = setup(t)
  const claimed = engine.claim(run.id).result
  store.update(run.id, state => { state.tasks.work.claim.expiresAt = Date.now() - 1 })
  engine.settle(run.id, 'work', claimed.attempt.id, { summary: 'too late' })
  assert.equal(store.get(run.id).tasks.work.status, 'unknown')
  assert.equal(store.get(run.id).tasks.work.output, null)
})
