import test from 'node:test'
import assert from 'node:assert/strict'
import { DshRuntime } from '../src/runtime/dsh.mjs'

const parent = { id: 'owner' }
function request(overrides = {}) {
  return { run: { ownerSession: 'owner', workspace: '/workspace', definition: { id: 'test' }, requirement: 'build' },
    node: { id: 'work', kind: 'agent', instruction: 'Implement' }, role: { name: 'Worker', runtime: { provider: 'spawn' } },
    inputs: {}, artifacts: {}, feedback: null, attemptId: 'attempt', signal: new AbortController().signal, onStarted() {}, ...overrides }
}
function backend(output = '{"summary":"done"}') {
  let disposed = 0, spec
  return {
    list: () => ['spawn', 'codex'],
    async startActivation(value) { spec = value; return { childId: 'child', result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: output }] }), async dispose() { disposed++ } } },
    get disposed() { return disposed }, get spec() { return spec },
  }
}

test('DSH adapter uses explicit provider, caller delivery, cwd and optional independent preset', async () => {
  const host = backend()
  const adapter = new DshRuntime(host, () => parent)
  let child
  const value = await adapter.execute(request({ role: { name: 'Planner', runtime: { provider: 'spawn', agentPreset: 'planner-readonly', agentOptions: { model: 'model' } } }, onStarted(id) { child = id } }))
  assert.equal(value.summary, 'done'); assert.equal(child, 'child')
  assert.equal(host.spec.provider, 'spawn'); assert.equal(host.spec.delivery, 'caller')
  assert.equal(host.spec.request.parent, parent); assert.equal(host.spec.request.cwd, '/workspace')
  assert.equal(host.spec.request.agentPreset, 'planner-readonly')
  assert.equal(host.spec.request.agentOptions.model, 'model')
  assert.equal(host.disposed, 1)
})

test('missing provider and missing live parent fail without fallback', async () => {
  const host = backend()
  await assert.rejects(new DshRuntime(host, () => parent).execute(request({ role: { name: 'External', runtime: { provider: 'dsh-sdk' } } })), { code: 'PROVIDER_UNAVAILABLE' })
  await assert.rejects(new DshRuntime(host, () => null).execute(request()), { code: 'PARENT_UNAVAILABLE' })
  assert.equal(host.spec, undefined)
})

test('external provider does not receive unsupported implicit preset or structured-output options', async () => {
  const host = backend()
  await new DshRuntime(host, () => parent).execute(request({ role: { name: 'Codex', runtime: { provider: 'codex' } } }))
  assert.equal(host.spec.provider, 'codex')
  assert.equal('agentPreset' in host.spec.request, false)
  assert.equal('outputSchema' in host.spec.request, false)
})

test('review instruction includes exact subject digest and transitive artifact context', async () => {
  const host = backend('{"summary":"Reviewed","decision":"approve","reason":"verified","subjectDigest":"abc"}')
  const out = await new DshRuntime(host, () => parent).execute(request({
    node: { id: 'review', kind: 'review', subject: 'plan', instruction: 'Review' },
    inputs: { plan: { digest: 'abc', output: { summary: 'plan' } } }, artifacts: { earlier: { output: { summary: 'context' } } },
  }))
  assert.equal(out.subjectDigest, 'abc')
  assert.match(host.spec.request.prompt[0].text, /exactly to abc/)
  assert.match(host.spec.request.prompt[0].text, /earlier/)
})

test('invalid output fails after cleanup, while JSON fences are accepted', async () => {
  const bad = backend('I did it')
  await assert.rejects(new DshRuntime(bad, () => parent).execute(request()), { code: 'INVALID_OUTPUT' })
  assert.equal(bad.disposed, 1)
  const fenced = backend('```json\n{"summary":"done"}\n```')
  assert.equal((await new DshRuntime(fenced, () => parent).execute(request())).summary, 'done')
})

test('post-publication abort disposes the exact activation and waits for settlement', async () => {
  const controller = new AbortController()
  let published, settle, disposed = 0
  const ready = new Promise(resolve => { published = resolve })
  const host = { list: () => ['spawn'], async startActivation() {
    return { childId: 'child', result: new Promise(resolve => { settle = resolve }), async dispose() {
      disposed++; settle({ stopReason: 'aborted', output: [] })
    } }
  } }
  const executing = new DshRuntime(host, () => parent).execute(request({ signal: controller.signal, onStarted() { published() } }))
  await ready; controller.abort()
  await assert.rejects(executing)
  assert.ok(disposed >= 1)
})

test('cleanup failure is an unknown outcome requiring reconciliation', async () => {
  const host = backend()
  const start = host.startActivation.bind(host)
  host.startActivation = async spec => ({ ...await start(spec), async dispose() { throw new Error('process still alive') } })
  await assert.rejects(new DshRuntime(host, () => parent).execute(request()), { code: 'UNKNOWN_OUTCOME' })
})

test('oversized context is rejected before starting a child', async () => {
  const host = backend()
  await assert.rejects(new DshRuntime(host, () => parent, { maxContextBytes: 10 }).execute(request()), { code: 'CONTEXT_LIMIT' })
  assert.equal(host.spec, undefined)
})
