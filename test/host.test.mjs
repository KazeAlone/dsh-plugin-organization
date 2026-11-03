import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Test the real plugin entry with a tiny Cordis lifecycle fixture, not a real DSH host.
registerHooks({ resolve(specifier, context, next) {
  if (specifier !== '@deepseek-ai/dsh-typert-protocol') return next(specifier, context)
  return { url: `data:text/javascript,${encodeURIComponent('export class TypertRemoteService { constructor(ctx, name) { this.ctx = ctx; ctx.services.set(name, this); this.typertRemote = {service:this,serviceKey:name,namespace:name} } } export class RemoteError extends Error {constructor(code,message,details){super(message);this.code=code;this.details=details;this.isDSHRemoteError=true}}')}`, shortCircuit: true }
} })
const { default: OrganizationService } = await import('../src/host.mjs')

test('packaged host registers usable tools, drives the adapter and unwinds effects', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'organization-host-'))
  const definition = { id: 'test', version: 1, roles: [{ id: 'worker', name: 'Worker', runtime: { provider: 'spawn' } }],
    nodes: [{ id: 'work', kind: 'agent', role: 'worker', deps: [], instruction: 'do work' }] }
  const definitionFile = join(dir, 'definition.json')
  writeFileSync(definitionFile, JSON.stringify(definition))
  const tools = new Map(), disposers = [], owner = { id: 'owner', session: { header: { cwd: dir } } }
  let descriptors
  let cleaned = 0
  const subagents = {
    list: () => ['spawn'], async startActivation(spec) {
      assert.equal(spec.request.cwd, dir)
      return { childId: 'child', result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: '{"summary":"done"}' }] }), async dispose() { cleaned++ } }
    },
  }
  const ctx = {
    services: new Map([
      ['agents', { get: id => id === owner.id ? owner : undefined, list: () => [owner] }], ['subagents', subagents],
      ['typert', { register(contribution) { descriptors = contribution.invocations; return () => { descriptors = undefined } } }],
      ['workingDirectory', { ensure: async () => dir }],
      ['tools', { register(tool) {
        assert.equal(tool.parameters.type, 'object'); assert.equal(tool.output.schema.type, 'object')
        tools.set(tool.name, tool); return () => tools.delete(tool.name)
      } }],
    ]),
    get(key) { return this.services.get(key) },
    effect(fn) { const dispose = fn(); disposers.push(dispose); return dispose },
  }
  const service = new OrganizationService(ctx, { database: join(dir, 'organization.db'), definitionFile, pollMs: 100 })
  try {
    assert.equal(ctx.services.get('organization'), service)
    assert.equal(descriptors.length, 7)
    assert.throws(() => service.uiOverview(''), { code: 'organization/error', isDSHRemoteError: true, details: { code: 'UNAUTHORIZED' } })
    ctx.invocation = { peer: { principal: { kind: 'owner' } } }
    assert.equal(service.uiOverview('').sessions[0].id, 'owner')
    assert.deepEqual([...tools.keys()].sort(), ['organization_cancel', 'organization_resume', 'organization_start', 'organization_status'])
    const exec = { agent: owner, signal: new AbortController().signal }
    const created = await tools.get('organization_start').execute({ requirement: 'build' }, exec)
    await Promise.all(service.api.background.values())
    const status = await tools.get('organization_status').execute({ runId: created.id }, exec)
    assert.equal(status.status, 'succeeded'); assert.equal(cleaned, 1)
    // A queued run created without kick is picked up by the host polling loop.
    const queued = service.engine.start(definition, 'next', { ownerSession: 'owner', workspace: dir })
    const deadline = Date.now() + 2000
    while (service.store.get(queued.id).status !== 'succeeded' && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20))
    assert.equal(service.store.get(queued.id).status, 'succeeded')
  } finally {
    for (const dispose of disposers.reverse()) await dispose()
    assert.equal(tools.size, 0)
    assert.equal(descriptors, undefined)
    rmSync(dir, { recursive: true, force: true })
  }
})
