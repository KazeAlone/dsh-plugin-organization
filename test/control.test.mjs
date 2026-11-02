import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { SqliteStore, OrganizationEngine } from '../src/index.mjs'

test('operator CLI approves the exact pending artifact version and records local identity', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'organization-cli-'))
  const database = join(dir, 'test.db')
  const store = new SqliteStore(database)
  const engine = new OrganizationEngine(store, { async execute() { return { summary: 'plan' } } })
  t.after(async () => { await engine.close(); store.close(); rmSync(dir, { recursive: true, force: true }) })
  const def = { id: 'test', version: 1, roles: [
    { id: 'planner', name: 'Planner', runtime: { provider: 'spawn' } }, { id: 'human', name: 'Human', runtime: { provider: 'spawn' } },
  ], nodes: [
    { id: 'plan', kind: 'agent', role: 'planner', deps: [], instruction: 'plan' },
    { id: 'approve', kind: 'approval', role: 'human', deps: ['plan'] },
  ] }
  const run = engine.start(def, 'test', { ownerSession: 'owner', workspace: '/workspace' })
  const waiting = await engine.drain(run.id)
  const call = (...args) => spawnSync(process.execPath, ['scripts/control.mjs', '--database', database, ...args], { encoding: 'utf8' })
  const stale = call('approve', run.id, 'approve', 'stale', 'Reviewed')
  assert.equal(stale.status, 1); assert.match(stale.stderr, /STALE_APPROVAL/)
  const approved = call('approve', run.id, 'approve', waiting.tasks.approve.approval.inputDigest, 'Reviewed the plan')
  assert.equal(approved.status, 0, approved.stderr)
  assert.equal(JSON.parse(approved.stdout).status, 'succeeded')
  assert.match(store.get(run.id).tasks.approve.output.actor, /^local:/)
  const events = call('events', run.id)
  assert.ok(JSON.parse(events.stdout).some(event => event.type === 'approval.granted'))
})

test('operator CLI rejects missing database instead of creating an empty one', () => {
  const result = spawnSync(process.execPath, ['scripts/control.mjs', '--database', '/does-not-exist/organization.db', 'list'], { encoding: 'utf8' })
  assert.equal(result.status, 1); assert.match(result.stderr, /does not exist/)
})
