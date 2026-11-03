/** Shared, browser-safe strict RPC descriptors. No Node or DSH imports. */
const schema = { parse(value) { return value } }
const json = {
  mode: 'strict', typeSymbol: 'dsh-plugin-organization#Json', schema,
  create: () => schema,
}
const string = name => ({ name, wire: name, source: 'json', codec: {
  mode: 'strict', typeSymbol: 'dsh-plugin-organization#String',
  create: () => ({ parse(value) {
    if (typeof value !== 'string' || value.length > 100000) throw new TypeError('Expected a string of at most 100000 characters')
    return value
  } }),
} })

const methods = {
  uiOverview: ['sessionId'], uiSnapshot: ['runId', 'sessionId'],
  uiStart: ['sessionId', 'requirement'], uiCancel: ['runId', 'sessionId'],
  uiResume: ['runId', 'sessionId'], uiRetry: ['runId', 'sessionId', 'nodeId', 'reason'],
  uiApprove: ['runId', 'sessionId', 'nodeId', 'inputDigest', 'reason'],
}
export const ORGANIZATION_DESCRIPTORS = Object.entries(methods).map(([method, names]) => ({
  id: `dsh-plugin-organization#organization/${method}`,
  service: 'organization', namespace: 'organization', method,
  invocation: { kind: 'direct' }, parameters: names.map(string), result: json,
}))
export const ORGANIZATION_REMOTE = { package: 'dsh-plugin-organization', descriptors: ORGANIZATION_DESCRIPTORS }
