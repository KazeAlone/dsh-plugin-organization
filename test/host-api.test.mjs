import test from 'node:test'
import assert from 'node:assert/strict'
import { OrganizationHostApi } from '../src/host-api.mjs'
import { OrganizationEngine, SqliteStore } from '../src/index.mjs'

const definition = { id: 'test', version: 1, roles: [{ id: 'worker', name: 'Worker', runtime: { provider: 'spawn' } }],
  nodes: [{ id: 'work', kind: 'agent', role: 'worker', deps: [], instruction: 'work' }] }
function setup(t) {
  const store = new SqliteStore(':memory:')
  const engine = new OrganizationEngine(store, { async execute() { return { summary: 'done' } } })
  const owner = { id: 'owner' }, other = { id: 'other' }
  const api = new OrganizationHostApi(engine, definition, id => ({ owner, other })[id], async () => '/workspace')
  t.after(async () => { await engine.close(); store.close() })
  return { api, engine, store, owner, other }
}

test('host facade starts a background workflow using the owner effective directory', async t => {
  const { api, owner, store } = setup(t)
  const run = await api.start('build', owner)
  await Promise.all(api.background.values())
  assert.equal(api.status(run.id, owner).status, 'succeeded')
  assert.equal(store.get(run.id).workspace, '/workspace')
})

test('another session and a forged live Agent cannot inspect, resume or cancel a run', async t => {
  const { api, owner, other } = setup(t)
  const run = await api.start('build', owner)
  assert.throws(() => api.status(run.id, other), { code: 'UNAUTHORIZED' })
  assert.throws(() => api.resume(run.id, { id: 'owner' }), { code: 'UNAUTHORIZED' })
  await assert.rejects(api.cancel(run.id, other), { code: 'UNAUTHORIZED' })
})

test('host facade does not expose human approval or reconciliation as Agent actions', t => {
  const { api } = setup(t)
  assert.equal(api.approve, undefined)
  assert.equal(api.reconcile, undefined)
  assert.equal(api.retry, undefined)
})

test('cancelled tool signal does not create a background run', async t => {
  const { api, owner, store } = setup(t)
  const controller = new AbortController(); controller.abort()
  await assert.rejects(api.start('build', owner, controller.signal))
  assert.equal(store.list().length, 0)
})
