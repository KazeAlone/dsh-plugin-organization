import test from 'node:test'
import assert from 'node:assert/strict'
import { SqliteStore, OrganizationEngine } from '../src/index.mjs'
import { OrganizationHostApi } from '../src/host-api.mjs'
import { OrganizationUiApi } from '../src/ui-api.mjs'
import { threeProvinces } from '../templates/three-provinces.mjs'
import { ORGANIZATION_DESCRIPTORS } from '../src/descriptors.mjs'

function setup(t, definition = threeProvinces(), runtime = { async execute() { return { summary: 'done' } } }) {
  const store = new SqliteStore(':memory:')
  const engine = new OrganizationEngine(store, runtime)
  const agent = { id: 'owner', session: { header: { cwd: '/workspace' } } }
  const child = { id: 'child', session: { header: { cwd: '/workspace', parentSession: 'owner' } } }
  const agents = new Map([[agent.id, agent], [child.id, child]])
  const api = new OrganizationHostApi(engine, definition, id => agents.get(id), async () => '/workspace')
  let invocation = { peer: { principal: { kind: 'owner' } } }
  const uiApi = new OrganizationUiApi(api, () => [...agents.values()])
  const ui = new Proxy(uiApi, { get(target, key) {
    const value = target[key]
    return typeof value === 'function' ? (...args) => value.call(target, ...args, invocation) : value
  } })
  t.after(async () => { await engine.close(); store.close() })
  return { store, engine, api, ui, agent, agents, setInvocation(value) { invocation = value } }
}

test('every browser endpoint rejects missing or non-owner principals', t => {
  const { ui, setInvocation } = setup(t)
  const calls = [() => ui.overview(''), () => ui.snapshot('run', 'owner'), () => ui.start('owner', 'task'),
    () => ui.cancel('run', 'owner'), () => ui.resume('run', 'owner'),
    () => ui.retry('run', 'owner', 'node', 'reason'), () => ui.approve('run', 'owner', 'node', 'digest', 'reason')]
  for (const invocation of [undefined, { peer: { principal: { kind: 'guest' } } }]) {
    setInvocation(invocation)
    for (const call of calls) assert.throws(call, { code: 'UNAUTHORIZED' })
  }
})

test('overview excludes child sessions and lists only requested owner runs', t => {
  const { ui, engine } = setup(t)
  engine.start(threeProvinces(), 'one', { ownerSession: 'owner', workspace: '/workspace' })
  engine.start(threeProvinces(), 'two', { ownerSession: 'other', workspace: '/other' })
  const overview = ui.overview('owner')
  assert.equal(overview.runs.length, 1)
  assert.equal(overview.runs[0].requirement, 'one')
  assert.equal(overview.sessions.some(session => session.id === 'child'), false)
  assert.equal(overview.sessions.find(session => session.id === 'other').available, false)
})

test('browser cannot run work in a delegated child or inspect a mismatched run', t => {
  const { ui, engine } = setup(t)
  assert.throws(() => ui.start('child', 'task'), { code: 'INVALID_SESSION' })
  const run = engine.start(threeProvinces(), 'one', { ownerSession: 'owner', workspace: '/workspace' })
  assert.throws(() => ui.snapshot(run.id, 'other'), { code: 'UNAUTHORIZED' })
  assert.throws(() => ui.cancel(run.id, 'other'), { code: 'UNAUTHORIZED' })
})

test('persisted runs can be inspected without restoring the owner Agent', t => {
  const { ui, engine, agents } = setup(t)
  const run = engine.start(threeProvinces(), 'one', { ownerSession: 'owner', workspace: '/workspace' })
  agents.delete('owner')
  assert.equal(ui.snapshot(run.id, 'owner').ownerAvailable, false)
  assert.throws(() => ui.resume(run.id, 'owner'), { code: 'SESSION_UNAVAILABLE' })
})

test('approval from browser binds the digest, records owner identity and resumes work', async t => {
  const definition = threeProvinces({ humanApproval: true })
  const runtime = { async execute({ node, inputs }) { return node.kind === 'review'
    ? { summary: 'reviewed', decision: 'approve', reason: 'verified', subjectDigest: inputs[node.subject].digest }
    : { summary: node.id } } }
  const { ui, engine, store } = setup(t, definition, runtime)
  const created = await ui.start('owner', 'build')
  await engine.drain(created.id)
  const snapshot = ui.snapshot(created.id, 'owner')
  assert.equal(snapshot.status, 'waiting')
  assert.throws(() => ui.approve(created.id, 'owner', 'authorize', 'old', 'approved'), { code: 'STALE_APPROVAL' })
  ui.approve(created.id, 'owner', 'authorize', snapshot.tasks.authorize.approval.inputDigest, 'Reviewed this version')
  await engine.drain(created.id)
  assert.equal(store.get(created.id).status, 'succeeded')
  assert.equal(store.get(created.id).tasks.authorize.output.actor, 'host-owner:browser')
})

test('browser retry cannot replay an uncertain task', t => {
  const { ui, engine } = setup(t)
  const run = engine.start(threeProvinces(), 'one', { ownerSession: 'owner', workspace: '/workspace' })
  engine.claim(run.id)
  engine.recoverExpired(run.id, Date.now() + 60000)
  assert.throws(() => ui.retry(run.id, 'owner', 'plan', 'again'), { code: 'INVALID_RETRY' })
})

test('recent events returns the chronological tail rather than the first page', t => {
  const { engine, store } = setup(t)
  const run = engine.start(threeProvinces(), 'one', { ownerSession: 'owner', workspace: '/workspace' })
  for (let i = 0; i < 90; i++) store.update(run.id, (_run, emit) => emit({ type: 'test', number: i }))
  const recent = store.recentEvents(run.id)
  assert.equal(recent.length, 80)
  assert.equal(recent[0].number, 10)
  assert.equal(recent.at(-1).number, 89)
})

test('descriptors contain only explicit UI endpoints and validate wire string inputs', () => {
  assert.equal(ORGANIZATION_DESCRIPTORS.length, 7)
  for (const descriptor of ORGANIZATION_DESCRIPTORS) {
    assert.equal(descriptor.service, 'organization')
    assert.equal(descriptor.invocation.kind, 'direct')
    for (const parameter of descriptor.parameters) {
      assert.equal(parameter.codec.create().parse('valid'), 'valid')
      assert.throws(() => parameter.codec.create().parse({ id: 'invalid' }))
    }
  }
  const approve = ORGANIZATION_DESCRIPTORS.find(item => item.method === 'uiApprove')
  assert.equal(approve.parameters.some(parameter => parameter.name === 'actor'), false)
})
