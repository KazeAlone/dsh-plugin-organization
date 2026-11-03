/** Convert the DSH RPC envelope to data; never mistake a failed request for empty state. */
export function unwrap(reply) {
  if (reply?.ok === true) return reply.value
  if (reply?.ok === false) throw new Error(reply.error?.message || reply.error?.code || 'Remote request failed')
  throw new Error('Invalid organization RPC response')
}

export function layersOf(definition) {
  const remaining = new Map(definition.nodes.map(node => [node.id, node]))
  const done = new Set(), layers = []
  while (remaining.size) {
    const layer = [...remaining.values()].filter(node => node.deps.every(dep => done.has(dep)))
    if (!layer.length) throw new Error('Workflow contains an invalid dependency graph')
    layers.push(layer)
    for (const node of layer) { remaining.delete(node.id); done.add(node.id) }
  }
  return layers
}

export function roleLayers(definition) {
  const remaining = new Map(definition.roles.map(role => [role.id, role]))
  const done = new Set(), layers = []
  while (remaining.size) {
    const layer = [...remaining.values()].filter(role => !role.reportsTo || done.has(role.reportsTo))
    if (!layer.length) break
    layers.push(layer)
    for (const role of layer) { remaining.delete(role.id); done.add(role.id) }
  }
  return layers
}

export function displayTime(value, locale = 'zh') {
  return value ? new Date(value).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }) : '—'
}

export function elapsed(attempt, now = Date.now()) {
  if (!attempt?.startedAt) return '—'
  const seconds = Math.max(0, Math.round(((attempt.endedAt || now) - attempt.startedAt) / 1000))
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}
