import { demand, text } from './model.mjs'

/** Owner-only browser control plane, separate from model-visible tools. */
export class OrganizationUiApi {
  constructor(api, listAgents) {
    this.api = api; this.listAgents = listAgents
  }

  owner(invocation) {
    demand(invocation?.peer?.principal?.kind === 'owner', 'UNAUTHORIZED', 'Organization UI requires the authenticated Host owner')
  }

  session(id) {
    demand(text(id), 'INVALID_SESSION', 'Select a project session first')
    const agent = this.api.resolveAgent(id)
    demand(agent, 'SESSION_UNAVAILABLE', 'Open the owning project session in DSH before starting or continuing work')
    demand(!agent.session?.header?.parentSession, 'INVALID_SESSION', 'Select a main project session, not a delegated child')
    return agent
  }

  run(id, sessionId) {
    demand(text(id) && text(sessionId), 'INVALID_RUN', 'Run and owning session are required')
    const run = this.api.engine.store.get(id)
    demand(run.ownerSession === sessionId, 'UNAUTHORIZED', 'Run belongs to another session')
    return run
  }

  overview(sessionId, invocation) {
    this.owner(invocation)
    const all = this.api.engine.store.list()
    const sessions = new Map(this.listAgents().filter(agent => !agent.session?.header?.parentSession).map(agent => [agent.id, {
      id: agent.id, label: agent.session?.header?.title || agent.session?.header?.name || agent.id,
      workspace: agent.session?.header?.cwd || null, available: true,
    }]))
    for (const run of all) if (!sessions.has(run.ownerSession)) sessions.set(run.ownerSession, {
      id: run.ownerSession, label: run.ownerSession, workspace: run.workspace, available: false,
    })
    return { definition: this.api.definition, sessions: [...sessions.values()],
      runs: all.filter(run => !sessionId || run.ownerSession === sessionId).slice(0, 100).map(run => ({
        id: run.id, status: run.status, requirement: run.requirement.slice(0, 1000), ownerSession: run.ownerSession,
        workspace: run.workspace, createdAt: run.createdAt, updatedAt: run.updatedAt,
        done: Object.values(run.tasks).filter(task => task.status === 'succeeded').length,
        total: Object.keys(run.tasks).length,
      })) }
  }

  snapshot(id, sessionId, invocation) {
    this.owner(invocation)
    const run = this.run(id, sessionId)
    return { ...run, ownerAvailable: Boolean(this.api.resolveAgent(sessionId)),
      schedulerError: this.api.errors.get(id) || null, events: this.api.engine.store.recentEvents(id) }
  }

  start(sessionId, requirement, invocation) { this.owner(invocation); return this.api.start(requirement, this.session(sessionId)) }
  cancel(id, sessionId, invocation) { this.owner(invocation); this.run(id, sessionId); return this.api.engine.cancel(id) }
  resume(id, sessionId, invocation) { this.owner(invocation); this.run(id, sessionId); return this.api.resume(id, this.session(sessionId)) }
  retry(id, sessionId, nodeId, reason, invocation) {
    this.owner(invocation); this.run(id, sessionId); this.session(sessionId)
    const run = this.api.engine.retry(id, nodeId, reason)
    this.api.kick(id)
    return { id, status: run.status }
  }
  approve(id, sessionId, nodeId, inputDigest, reason, invocation) {
    this.owner(invocation); this.run(id, sessionId)
    const run = this.api.engine.approve(id, nodeId, { actor: 'host-owner:browser', inputDigest, reason })
    if (this.api.resolveAgent(sessionId)) this.api.kick(id)
    return { id, status: run.status }
  }
}
