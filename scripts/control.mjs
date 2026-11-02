#!/usr/bin/env node
import { userInfo, homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { SqliteStore, OrganizationEngine } from '../src/index.mjs'

const args = process.argv.slice(2)
let database = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'organization', 'organization.sqlite')
if (args[0] === '--database') { args.shift(); database = args.shift() }
const [command, runId, nodeId, ...rest] = args
const usage = 'Usage: dsh-organization [--database PATH] list|status RUN|events RUN|approve RUN NODE DIGEST REASON|retry RUN NODE REASON|reconcile RUN NODE retry|stopped REASON|recover RUN|cancel RUN'
if (!['list', 'status', 'events', 'approve', 'retry', 'reconcile', 'recover', 'cancel'].includes(command) || !database) {
  console.error(usage); process.exitCode = 1
} else if (!existsSync(database)) {
  console.error('Database does not exist; start an organization run in DSH first.'); process.exitCode = 1
} else {
  const store = new SqliteStore(database)
  const engine = new OrganizationEngine(store, { execute() { throw new Error('This CLI never starts Agents; use organization_resume in DSH') } })
  try {
    let result
    if (command === 'list') result = store.list().map(run => ({ id: run.id, status: run.status, ownerSession: run.ownerSession, workspace: run.workspace }))
    if (command === 'status') result = store.get(runId)
    if (command === 'events') result = store.events(runId)
    if (command === 'approve') result = engine.approve(runId, nodeId, { actor: `local:${userInfo().username}`, inputDigest: rest[0], reason: rest.slice(1).join(' ') })
    if (command === 'retry') result = engine.retry(runId, nodeId, rest.join(' '))
    if (command === 'reconcile') result = engine.reconcile(runId, nodeId, { actor: `local:${userInfo().username}`, action: rest[0], reason: rest.slice(1).join(' ') })
    if (command === 'recover') result = engine.recoverExpired(runId)
    if (command === 'cancel') result = await engine.cancel(runId)
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    console.error(`${error.code || 'ERROR'}: ${error.message}`); process.exitCode = 1
  } finally { await engine.close(); store.close() }
}
