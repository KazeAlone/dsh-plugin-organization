import { demand } from './model.mjs'

/** Host facade keeps ownership checks testable without loading Cordis packages. */
export class OrganizationHostApi {
  constructor(engine, definition, resolveAgent, resolveWorkspace) {
    this.engine = engine; this.definition = definition; this.resolveAgent = resolveAgent
    this.background = new Map(); this.errors = new Map()
    this.resolveWorkspace = resolveWorkspace
  }

  owned(id, agent) {
    demand(agent && this.resolveAgent(agent.id) === agent, 'UNAUTHORIZED', 'Exact live Agent identity is required')
    const run = this.engine.store.get(id)
    demand(run.ownerSession === agent.id, 'UNAUTHORIZED', 'Run belongs to another session')
    return run
  }

  kick(id) {
    if (this.background.has(id)) return
    const promise = this.engine.drain(id).catch(error => {
      this.errors.set(id, String(error.message || error))
    }).finally(() => this.background.delete(id))
    this.background.set(id, promise)
  }

  async start(requirement, agent, signal) {
    demand(agent && this.resolveAgent(agent.id) === agent, 'UNAUTHORIZED', 'Exact live Agent identity is required')
    const workspace = await this.resolveWorkspace(agent, signal)
    signal?.throwIfAborted()
    demand(this.resolveAgent(agent.id) === agent, 'UNAUTHORIZED', 'Owner was replaced while resolving its workspace')
    const run = this.engine.start(this.definition, requirement, { ownerSession: agent.id, workspace })
    this.kick(run.id)
    return { id: run.id, status: run.status }
  }

  status(id, agent) {
    const run = this.owned(id, agent)
    return { ...run, schedulerError: this.errors.get(id) || null }
  }

  resume(id, agent) {
    this.owned(id, agent)
    this.kick(id)
    return { id, status: this.engine.store.get(id).status }
  }

  async cancel(id, agent) { this.owned(id, agent); return this.engine.cancel(id) }
}
