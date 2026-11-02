import { Service } from '@deepseek-ai/cordis'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { SqliteStore, OrganizationEngine, validateDefinition } from './index.mjs'
import { DshRuntime } from './runtime/dsh.mjs'
import { OrganizationHostApi } from './host-api.mjs'
import { threeProvinces } from '../templates/three-provinces.mjs'
import { demand } from './model.mjs'

/** Host-plane service. Human approvals are deliberately absent from model tools. */
export default class OrganizationService extends Service {
  static inject = ['agents', 'subagents', 'tools', 'workingDirectory']

  constructor(ctx, config = {}) {
    super(ctx, 'organization')
    const pollMs = config.pollMs ?? 1000
    demand(Number.isSafeInteger(pollMs) && pollMs >= 100 && pollMs <= 60000, 'INVALID_CONFIG', 'pollMs must be 100–60000')
    const definition = validateDefinition(config.definitionFile
      ? JSON.parse(readFileSync(config.definitionFile, 'utf8'))
      : threeProvinces({ provider: config.provider, runtimes: config.runtimes, humanApproval: config.humanApproval }))
    const agents = ctx.get('agents')
    const runtime = new DshRuntime(ctx.get('subagents'), id => agents.get(id), { maxContextBytes: config.maxContextBytes })
    this.store = new SqliteStore(config.database || join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'organization', 'organization.sqlite'))
    try { this.engine = new OrganizationEngine(this.store, runtime, {
      concurrency: config.concurrency, leaseMs: config.leaseMs, heartbeatMs: config.heartbeatMs,
    }) } catch (error) { this.store.close(); throw error }
    this.api = new OrganizationHostApi(this.engine, definition, id => agents.get(id),
      (agent, signal) => ctx.get('workingDirectory').ensure(agent, signal))
    ctx.effect(() => {
      const timer = setInterval(() => {
        try {
          for (const run of this.store.list()) {
            if (run.status === 'running' && agents.get(run.ownerSession)) this.api.kick(run.id)
          }
        } catch (error) { ctx.logger?.error(`organization scheduler: ${error.message}`) }
      }, pollMs)
      return async () => { clearInterval(timer); await this.engine.close(); this.store.close() }
    })
    const output = {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2).slice(0, 16000) }],
    }
    const register = (name, description, properties, required, execute) => ctx.effect(() => ctx.get('tools').register({
      name, description, parameters: { type: 'object', properties, required, additionalProperties: false }, output, execute,
    }))
    register('organization_start', 'Start the configured Agent organization in the background. The organization owns its execution; use status to inspect progress.',
      { requirement: { type: 'string', minLength: 1, maxLength: 100000 } }, ['requirement'],
      (args, exec) => this.api.start(args.requirement, exec.agent, exec.signal))
    for (const [action, description] of [
      ['status', 'Read this session’s organization run, attempts, outputs and approval state.'],
      ['resume', 'Continue ready tasks in this session’s persisted run. Unknown outcomes and failures remain blocked for operator reconciliation.'],
      ['cancel', 'Request cancellation and wait for locally owned child cleanup. Remote workers acknowledge asynchronously.'],
    ]) register(`organization_${action}`, description, { runId: { type: 'string', minLength: 1 } }, ['runId'],
      (args, exec) => this.api[action](args.runId, exec.agent))
  }
}
