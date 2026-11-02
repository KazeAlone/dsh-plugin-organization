/** Organization roles are stable; activations are created only when a task becomes ready. */
export function threeProvinces({ provider = 'spawn', runtimes = {}, humanApproval = false } = {}) {
  const role = (id, name, reportsTo) => ({ id, name, ...(reportsTo ? { reportsTo } : {}), runtime: runtimes[id] || { provider } })
  const roles = [
    role('chief', '总管'), role('planning', '中书省 · 规划', 'chief'),
    role('review', '门下省 · 独立审议', 'chief'), role('execution', '尚书省 · 执行调度', 'chief'),
    role('personnel', '吏部 · 任务与能力核对', 'execution'), role('resources', '户部 · 资源与成本', 'execution'),
    role('experience', '礼部 · 交互与文档', 'execution'), role('engineering', '工部 · 工程实现', 'execution'),
    role('security', '刑部 · 安全审查', 'execution'), role('quality', '兵部 · 测试与质量', 'execution'),
  ]
  const worker = (id, role, instruction, deps = ['dispatch']) => ({ id, kind: 'agent', role, deps, instruction, resources: ['workspace'] })
  const nodes = [
    { id: 'plan', kind: 'agent', role: 'planning', deps: [], resources: ['workspace'],
      instruction: 'Research the requirement and produce a concrete plan with scope, acceptance criteria, risks and deliverables. Do not implement. Address any rejection feedback.' },
    { id: 'review', kind: 'review', role: 'review', deps: ['plan'], subject: 'plan', maxRejections: 2, resources: ['workspace'],
      instruction: 'Independently assess feasibility, completeness, risks and verifiable acceptance criteria. Do not implement or rewrite the plan. Reject with actionable reasons if necessary.' },
    ...(humanApproval ? [{ id: 'authorize', kind: 'approval', role: 'chief', deps: ['review'] }] : []),
    { id: 'dispatch', kind: 'agent', role: 'execution', deps: [humanApproval ? 'authorize' : 'review'], resources: ['workspace'],
      instruction: 'Using the approved plan, describe bounded tasks for the six specialties, their deliverables and verification commands. Do not expand scope or implement.' },
    worker('capability', 'personnel', 'Check task allocation and available tools/skills. Report gaps; do not modify project code.'),
    worker('budget', 'resources', 'Assess compute, dependencies and resource needs. Report constraints; do not modify project code.'),
    worker('experience', 'experience', 'Produce UX and documentation recommendations aligned with the plan. Do not modify project code.'),
    worker('implement', 'engineering', 'Implement the approved engineering task. Run relevant checks and report changed files, commands and results.'),
    worker('security', 'security', 'Review the actual implementation for security and permission issues. Report evidence; do not silently fix or approve missing checks.', ['implement']),
    worker('quality', 'quality', 'Test the actual implementation against acceptance criteria. Report commands, exit codes and defects; do not claim unexecuted tests passed.', ['implement']),
    { id: 'accept', kind: 'review', role: 'review', deps: ['delivery'], subject: 'delivery', maxRejections: 0, resources: ['workspace'],
      instruction: 'Review the assembled delivery and test/security evidence. Approve only if all acceptance criteria are met and no blocking issues remain. Otherwise reject for operator intervention.' },
    { id: 'delivery', kind: 'agent', role: 'execution', deps: ['capability', 'budget', 'experience', 'security', 'quality'], resources: ['workspace'],
      instruction: 'Assemble the implementation, verification evidence, unresolved issues and acceptance checklist without modifying implementation. Include upstream artifacts in the delivery record.' },
    { id: 'report', kind: 'agent', role: 'chief', deps: ['accept'], resources: ['workspace'],
      instruction: 'Report the delivered result, verification evidence, remaining limitations and artifact locations to the user. Do not modify implementation.' },
  ]
  return { id: 'three-provinces-six-ministries', version: 1, name: '三省六部', roles, nodes }
}
