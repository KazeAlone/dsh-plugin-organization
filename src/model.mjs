import { createHash } from 'node:crypto'

export class OrganizationError extends Error {
  constructor(code, message) { super(message); this.name = 'OrganizationError'; this.code = code }
}

export function demand(condition, code, message) {
  if (!condition) throw new OrganizationError(code, message)
}

export function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) }
export function text(value) { return typeof value === 'string' && value.trim().length > 0 }

/** Stable JSON hashes bind reviews to the exact input they saw. */
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (object(value)) return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`
  return JSON.stringify(value)
}
export function digest(value) { return createHash('sha256').update(canonical(value)).digest('hex') }

/** Validate persisted/model boundary values before they enter an execution. */
export function validateDefinition(input) {
  demand(object(input), 'INVALID_DEFINITION', 'Definition must be an object')
  const definition = JSON.parse(JSON.stringify(input))
  demand(text(definition.id) && Number.isSafeInteger(definition.version) && definition.version > 0,
    'INVALID_DEFINITION', 'Definition requires id and a positive integer version')
  demand(Array.isArray(definition.roles) && definition.roles.length > 0, 'INVALID_DEFINITION', 'Roles are required')
  const roles = new Map()
  for (const role of definition.roles) {
    demand(object(role) && text(role.id) && text(role.name) && !roles.has(role.id), 'INVALID_DEFINITION', 'Role ids must be unique')
    demand(object(role.runtime) && text(role.runtime.provider), 'INVALID_DEFINITION', `Missing runtime for ${role.id}`)
    demand(role.runtime.agentPreset === undefined || text(role.runtime.agentPreset), 'INVALID_DEFINITION', 'agentPreset must be nonempty')
    demand(role.runtime.agentOptions === undefined || object(role.runtime.agentOptions), 'INVALID_DEFINITION', 'agentOptions must be an object')
    roles.set(role.id, role)
  }
  for (const role of roles.values()) {
    demand(role.reportsTo === undefined || (roles.has(role.reportsTo) && role.reportsTo !== role.id),
      'INVALID_DEFINITION', `Invalid manager for ${role.id}`)
    const visited = new Set([role.id])
    let next = role.reportsTo
    while (next) {
      demand(!visited.has(next), 'INVALID_DEFINITION', 'Organization reporting cycle')
      visited.add(next); next = roles.get(next)?.reportsTo
    }
  }
  demand(Array.isArray(definition.nodes) && definition.nodes.length > 0 && definition.nodes.length <= 100,
    'INVALID_DEFINITION', 'Workflow requires 1–100 nodes')
  const nodes = new Map()
  for (const node of definition.nodes) {
    demand(object(node) && text(node.id) && !nodes.has(node.id), 'INVALID_DEFINITION', 'Node ids must be unique')
    demand(['agent', 'review', 'approval'].includes(node.kind) && roles.has(node.role), 'INVALID_DEFINITION', `Invalid kind/role for ${node.id}`)
    demand(Array.isArray(node.deps) && node.deps.every(text) && new Set(node.deps).size === node.deps.length,
      'INVALID_DEFINITION', `Invalid dependencies for ${node.id}`)
    demand(node.kind === 'approval' || text(node.instruction), 'INVALID_DEFINITION', `Missing instruction for ${node.id}`)
    demand(node.resources === undefined || (Array.isArray(node.resources) && node.resources.every(text)), 'INVALID_DEFINITION', 'Invalid resources')
    if (node.kind === 'review') {
      demand(node.deps.length === 1 && node.subject === node.deps[0], 'INVALID_DEFINITION', 'Review must depend only on its subject')
      demand(Number.isSafeInteger(node.maxRejections) && node.maxRejections >= 0 && node.maxRejections <= 20,
        'INVALID_DEFINITION', 'Review requires maxRejections between 0 and 20')
    }
    nodes.set(node.id, node)
  }
  const visiting = new Set(), visited = new Set()
  const visit = id => {
    demand(nodes.has(id), 'INVALID_DEFINITION', `Unknown dependency ${id}`)
    demand(!visiting.has(id), 'INVALID_DEFINITION', 'Workflow dependency cycle')
    if (visited.has(id)) return
    visiting.add(id)
    for (const dep of nodes.get(id).deps) visit(dep)
    visiting.delete(id); visited.add(id)
  }
  for (const id of nodes.keys()) visit(id)
  for (const node of nodes.values()) {
    if (node.kind === 'review' || node.kind === 'approval') {
      demand(node.deps.length > 0, 'INVALID_DEFINITION', 'A gate requires input artifacts')
      for (const dep of node.deps) {
        demand(nodes.get(dep).role !== node.role, 'INVALID_DEFINITION', 'A role cannot approve its own output')
        // A gated artifact has one exit: every downstream consumer must pass this gate.
        demand(definition.nodes.filter(n => n.deps.includes(dep)).every(n => n.id === node.id),
          'INVALID_DEFINITION', `Gate bypass from ${dep}`)
      }
    }
    if (node.kind === 'review') demand(nodes.get(node.subject).kind === 'agent', 'INVALID_DEFINITION', 'Review subject must be an agent node')
  }
  return definition
}

/** Input snapshot includes hashes and full outputs; no mutable cross-run memory. */
export function inputsFor(run, node) {
  return Object.fromEntries(node.deps.map(id => [id, { digest: run.tasks[id].digest, output: run.tasks[id].output }]))
}

/** All transitive upstream artifacts, once each; review summaries cannot hide the plan. */
export function artifactsFor(run, node) {
  const ids = new Set()
  const visit = id => {
    if (ids.has(id)) return
    ids.add(id)
    for (const dep of run.definition.nodes.find(n => n.id === id).deps) visit(dep)
  }
  for (const dep of node.deps) visit(dep)
  return Object.fromEntries([...ids].map(id => [id, { digest: run.tasks[id].digest, output: run.tasks[id].output }]))
}

export function parseOutput(value) {
  demand(object(value) && text(value.summary), 'INVALID_OUTPUT', 'Agent output requires a nonempty summary')
  const output = JSON.parse(JSON.stringify(value))
  demand(Buffer.byteLength(JSON.stringify(output)) <= 1_000_000, 'INVALID_OUTPUT', 'Output exceeds 1 MB')
  return output
}

export function refreshStatus(run) {
  const tasks = Object.values(run.tasks)
  if (run.cancelRequested) {
    run.status = tasks.some(t => t.status === 'unknown') ? 'blocked'
      : tasks.some(t => t.status === 'running') ? 'cancelling' : 'cancelled'
    return
  }
  run.status = tasks.every(t => t.status === 'succeeded') ? 'succeeded'
    : tasks.some(t => ['failed', 'unknown'].includes(t.status)) ? 'blocked'
      : tasks.some(t => t.status === 'running') ? 'running'
        : tasks.some(t => t.status === 'waiting') ? 'waiting' : 'running'
}
