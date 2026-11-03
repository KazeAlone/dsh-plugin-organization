import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'

// Optional real-DSH regression: requires a separately installed official CLI, no model credentials.
assert.ok(process.env.ORGANIZATION_DSH_CLI, 'Set ORGANIZATION_DSH_CLI to the official DSH lib/bin.js path')
const cli = resolve(process.env.ORGANIZATION_DSH_CLI)
const home = mkdtempSync(join(tmpdir(), 'organization-real-host-'))
const env = { ...process.env, DSH_HOME: home, DSH_AGENTS_HOME: join(home, 'agents') }
const probe = createServer()
await new Promise(resolveListen => probe.listen(0, '127.0.0.1', resolveListen))
const port = probe.address().port
await new Promise(resolveClose => probe.close(resolveClose))
let child, log = ''
const redact = value => value.replace(/token=[^\s]+/g, 'token=[redacted]')
try {
  const installed = spawnSync(process.execPath, [cli, 'plugin', '--profile', 'web', 'add', `file:${process.cwd()}`],
    { env, encoding: 'utf8', timeout: 60000 })
  assert.equal(installed.status, 0, redact(installed.stderr || installed.stdout || 'Plugin installation failed'))
  child = spawn(process.execPath, [cli, 'web', '--no-open', '--port', String(port)], { env, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.on('data', value => { log += value })
  child.stderr.on('data', value => { log += value })
  let launchUrl
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    launchUrl = log.match(/dsh web: (http[^\s]+)/)?.[1]
    if (launchUrl) break
    if (child.exitCode !== null) throw new Error(`DSH exited: ${redact(log)}`)
    await new Promise(resolveWait => setTimeout(resolveWait, 100))
  }
  assert.ok(launchUrl, `DSH did not publish a launch URL: ${redact(log)}`)
  // Mint an owner cookie through the official bootstrap, never synthesize or log credentials.
  const bootstrap = await fetch(launchUrl, { redirect: 'manual', signal: AbortSignal.timeout(5000) })
  const cookie = bootstrap.headers.get('set-cookie')?.split(';')[0]
  assert.ok(cookie, `Bootstrap failed with HTTP ${bootstrap.status}`)
  let seq = 0
  async function rpc(method, args) {
    const response = await fetch(new URL(`/api/organization/${method}`, launchUrl), {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ type: 'client-request', rpcId: `organization-smoke-${++seq}`,
        method: `organization/${method}`, payload: { args } }), signal: AbortSignal.timeout(10000),
    })
    const envelope = await response.json()
    assert.equal(envelope.type, 'server-response')
    return envelope.result
  }
  const overview = await rpc('uiOverview', { sessionId: '' })
  assert.equal(overview.ok, true, JSON.stringify(overview.error))
  assert.equal(overview.value.definition.roles.length, 10)
  assert.ok(Array.isArray(overview.value.runs))
  const start = await rpc('uiStart', { sessionId: 'missing-session', requirement: 'No model invocation' })
  assert.equal(start.ok, false)
  assert.equal(start.error.details.code, 'SESSION_UNAVAILABLE', 'Owner identity must survive the asynchronous start path')
  console.log('Real DSH RPC smoke passed: local package installation, authenticated Gateway overview and owner-validated start. No model was called.')
} finally {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM')
    await Promise.race([new Promise(resolveExit => child.once('exit', resolveExit)), new Promise(resolveWait => setTimeout(resolveWait, 1500))])
    if (child.exitCode === null) { child.kill('SIGKILL'); await new Promise(resolveExit => child.once('exit', resolveExit)) }
  }
  rmSync(home, { recursive: true, force: true })
}
