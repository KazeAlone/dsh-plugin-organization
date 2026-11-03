import React, { useEffect, useState } from 'react'
import { unwrap, layersOf, roleLayers, displayTime, elapsed } from './model.mjs'

export function OrganizationIcon({ size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <rect x="8" y="2" width="8" height="6" rx="2"/><path d="M12 8v5M4 17v-4h16v4"/>
    <rect x="1" y="17" width="6" height="5" rx="1.5"/><rect x="9" y="17" width="6" height="5" rx="1.5"/><rect x="17" y="17" width="6" height="5" rx="1.5"/>
  </svg>
}

function Status({ value = 'pending', t }) {
  return <span className={`org-status org-status--${value}`}><i/>{t(`status.${value}`)}</span>
}
function Json({ value, label }) {
  return <details className="org-json"><summary>{label}</summary><pre>{JSON.stringify(value, null, 2)}</pre></details>
}

export function OrganizationChart({ definition, run, selected, onSelect, t }) {
  return <div className="org-chart">
    {roleLayers(definition).map((roles, depth) => <div className="org-tier" key={depth}>
      {depth > 0 && <span className="org-tier-parent">{t('reportsTo')}: {[...new Set(roles.map(role => definition.roles.find(parent => parent.id === role.reportsTo)?.name).filter(Boolean))].join(' / ')}</span>}
      {roles.map(role => {
        const assigned = definition.nodes.filter(node => node.role === role.id)
        const tasks = assigned.map(node => run?.tasks[node.id]).filter(Boolean)
        const status = tasks.find(task => ['running', 'unknown', 'failed', 'waiting'].includes(task.status))?.status
          || (tasks.length && tasks.every(task => task.status === 'succeeded') ? 'succeeded' : 'pending')
        return <button type="button" key={role.id} className={`org-role ${selected === role.id ? 'is-selected' : ''}`}
          onClick={() => onSelect(role.id)} aria-pressed={selected === role.id}>
          <span className="org-role-mark">{role.name.slice(0, 1)}</span>
          <strong>{role.name}</strong><span className="org-muted org-mono">{role.runtime.provider}</span>
          {run && <Status value={status} t={t}/>}
        </button>
      })}
    </div>)}
    <p className="org-footnote">{t('roleHint')}</p>
  </div>
}

export function Workflow({ definition, run, selected, onSelect, t }) {
  return <div className="org-flow">{layersOf(definition).map((layer, index) => <section className="org-flow-layer" key={index}>
    <div className="org-layer-label"><span>{String(index + 1).padStart(2, '0')}</span><span>{t('stage')}</span></div>
    <div className="org-flow-nodes">{layer.map(node => {
      const task = run?.tasks[node.id]
      const role = definition.roles.find(item => item.id === node.role)
      return <button type="button" key={node.id} className={`org-node ${selected === node.id ? 'is-selected' : ''}`}
        data-node-id={node.id} aria-pressed={selected === node.id} onClick={() => onSelect(node.id)}>
        <div className="org-node-top"><span className="org-mono">{node.id}</span>
          {node.kind !== 'agent' && <span className="org-gate">{t(node.kind === 'review' ? 'review' : 'human')}</span>}</div>
        <strong>{role?.name || node.role}</strong>
        <Status value={task?.status} t={t}/>
        {task?.output?.summary && <p className="org-clamp">{task.output.summary}</p>}
      </button>
    })}</div>
  </section>)}</div>
}

function Activity({ events = [], t, locale }) {
  return <ol className="org-activity">{events.length ? [...events].reverse().map(event => <li key={event.seq}>
    <span className="org-event-dot"/><div><strong>{t(`event.${event.type}`)}</strong>
      {event.nodeId && <span className="org-mono org-event-node">{event.nodeId}</span>}
      {(event.reason || event.error?.message) && <p>{event.reason || event.error.message}</p>}
      {event.to && <div className="org-event-state"><Status value={event.to} t={t}/></div>}
    </div><time>{displayTime(event.at, locale)}</time>
  </li>) : <p className="org-muted">{t('emptyEvents')}</p>}</ol>
}

function NodeDetail({ node, role, task, run, t, locale, busy, command, onSelect, openChild }) {
  const [reason, setReason] = useState('')
  const [checked, setChecked] = useState(false)
  const latest = task?.attempts.at(-1)
  const locked = busy || !run?.ownerAvailable
  return <>
    <span className="org-eyebrow">{t('nodeDetails')}</span><h2>{node.id}</h2><p className="org-detail-role">{role?.name}</p>
    <Status value={task?.status} t={t}/>
    <dl className="org-fields"><dt>{t('runtime')}</dt><dd className="org-mono">{role?.runtime.provider}</dd>
      {role?.runtime.agentPreset && <><dt>{t('preset')}</dt><dd>{role.runtime.agentPreset}</dd></>}
      <dt>{t('dependencies')}</dt><dd>{node.deps.length ? node.deps.map(dep => <button key={dep} className="org-link" onClick={() => onSelect(dep)}>{dep}</button>) : t('noDependencies')}</dd>
    </dl>
    <h3>{t('instruction')}</h3><p className="org-instruction">{node.instruction || t('approvalNotice')}</p>
    {task?.status === 'unknown' && <div className="org-notice org-notice--warning">{t('unknown')}</div>}
    {task?.status === 'waiting' && node.kind === 'approval' && <div className="org-approval">
      <h3>{t('human')}</h3><p>{t('approvalNotice')}</p>
      <Json value={Object.fromEntries(node.deps.map(id => [id, run.tasks[id].output]))} label={t('inputs')}/>
      <code className="org-digest">{task.approval.inputDigest}</code>
      <label className="org-checkbox"><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)}/>{t('approveCheck')}</label>
      <button className="org-button org-button--primary" disabled={!checked || busy}
        onClick={() => command('uiApprove', run.id, run.ownerSession, node.id, task.approval.inputDigest, t('approveCheck'))}>{t('approve')}</button>
    </div>}
    {task?.status === 'failed' && (latest?.error?.code === 'REWORK_LIMIT'
      ? <p className="org-notice org-notice--warning">{t('retryLimit')}</p>
      : <div className="org-retry"><label htmlFor="org-retry-reason">{t('retryReason')}</label>
        <textarea id="org-retry-reason" value={reason} onChange={event => setReason(event.target.value)} rows={2}/>
        <button className="org-button" disabled={locked || !reason.trim()} onClick={() => command('uiRetry', run.id, run.ownerSession, node.id, reason)}>{t('retry')}</button></div>)}
    <h3>{t('output')}</h3>
    <p className="org-output">{task?.output?.summary || t('emptyOutput')}</p>
    {task?.output?.decision && <p className="org-decision">{t('decision')}: {t(task.output.decision === 'approve' ? 'approveDecision' : 'rejectDecision')}<br/>{task.output.reason}</p>}
    {task?.output?.artifacts && <Json value={task.output.artifacts} label={t('artifacts')}/>}
    <h3>{t('attempt')} <span className="org-muted">{task?.attempts.length || 0}</span></h3>
    {task?.attempts.length ? [...task.attempts].reverse().map((attempt, index) => <div className="org-attempt" key={attempt.id}>
      <div className="org-attempt-top"><b>#{task.attempts.length - index}</b><Status value={attempt.status} t={t}/></div>
      <div className="org-attempt-meta"><time>{displayTime(attempt.startedAt, locale)}</time><span>{elapsed(attempt)}</span></div>
      {attempt.error && <p className="org-error-text">{attempt.error.code}: {attempt.error.message}</p>}
      {attempt.output?.reason && <p>{attempt.output.reason}</p>}
      {attempt.childId && <button className="org-link" onClick={() => openChild(attempt.childId)}>{t('childSession')}</button>}
      <Json value={{ attemptId: attempt.id, runtime: attempt.runtime, inputDigest: attempt.inputDigest, inputs: attempt.inputs }} label={t('inputs')}/>
    </div>) : <p className="org-muted">{t('noAttempts')}</p>}
  </>
}

/** Shared global/session surface. Refreshes never overlap and stale responses are ignored. */
export function Workbench({ remote, sessionId = '', t, locale = 'zh', uiWorkspace }) {
  const [data, setData] = useState({ overview: null, run: null, loading: true, error: null })
  const [selectedId, setSelectedId] = useState(null)
  const [selection, setSelection] = useState(null)
  const [tab, setTab] = useState('organization')
  const [tick, setTick] = useState(0)
  const [formOpen, setFormOpen] = useState(false)
  const [requirement, setRequirement] = useState('')
  const [targetSession, setTargetSession] = useState(sessionId)
  const [busy, setBusy] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  useEffect(() => {
    let alive = true, timer
    setData(previous => ({ ...previous, loading: true }))
    async function refresh() {
      try {
        const overview = unwrap(await remote.uiOverview(sessionId))
        const brief = overview.runs.find(run => run.id === selectedId)
        if (!selectedId && overview.runs[0]) {
          if (alive) { setData({ overview, run: null, loading: false, error: null }); setSelectedId(overview.runs[0].id) }
          return
        }
        const run = brief ? unwrap(await remote.uiSnapshot(brief.id, brief.ownerSession)) : null
        if (alive) setData({ overview, run, loading: false, error: null })
      } catch (error) {
        if (alive) setData(previous => ({ ...previous, loading: false, error: error.message }))
      } finally { if (alive) timer = setTimeout(refresh, 2000) }
    }
    refresh()
    return () => { alive = false; clearTimeout(timer) }
  }, [remote, sessionId, selectedId, tick])
  useEffect(() => { setSelection(null); setConfirmCancel(false) }, [selectedId])
  const overview = data.overview
  const run = data.run?.id === selectedId ? data.run : null
  const definition = run?.definition || overview?.definition
  const sessions = overview?.sessions || []
  const activeSession = sessionId || targetSession
  const selectedSession = sessions.find(item => item.id === activeSession)
  async function command(method, ...args) {
    if (busy) return
    setBusy(method); setActionError(null)
    try {
      const result = unwrap(await remote[method](...args))
      if (method === 'uiStart') { setSelectedId(result.id); setFormOpen(false); setRequirement(''); setTab('workflow') }
      setConfirmCancel(false); setTick(value => value + 1)
    } catch (error) { setActionError(error.message) }
    finally { setBusy(null) }
  }
  function openSession(id) {
    try { uiWorkspace.openSession(id) } catch (error) { setActionError(error.message) }
  }
  const chosenNode = selection?.kind === 'node' ? definition?.nodes.find(node => node.id === selection.id) : null
  const chosenRole = selection?.kind === 'role' ? definition?.roles.find(role => role.id === selection.id) : null
  const done = run ? Object.values(run.tasks).filter(task => task.status === 'succeeded').length : 0
  return <div className="org-workbench">
    <header className="org-header"><div className="org-brand"><span className="org-brand-icon"><OrganizationIcon size={24}/></span>
      <div><h1>{t('title')}</h1><p>{t('subtitle')}</p></div></div>
      <div className="org-header-actions"><button className="org-button org-button--quiet" onClick={() => setTick(value => value + 1)} disabled={Boolean(busy)}>{t('refresh')}</button>
        <button className="org-button org-button--primary" onClick={() => setFormOpen(value => !value)} disabled={!overview || Boolean(busy)}>＋ {t('newTask')}</button></div>
    </header>
    {(data.error || actionError) && <div className="org-error" role="alert">{t(data.error ? 'loadFailed' : 'failedRequest')}<span>{actionError || data.error}</span></div>}
    {data.loading && !overview && <div className="org-loading" role="status">{t('loading')}</div>}
    {formOpen && <form className="org-start-form" onSubmit={event => { event.preventDefault(); command('uiStart', activeSession, requirement) }}>
      <div className="org-form-top"><h2>{t('newTask')}</h2><button type="button" className="org-link" onClick={() => setFormOpen(false)}>{t('close')}</button></div>
      <div className="org-form-layout"><div className="org-session-field"><label htmlFor="org-session">{t('chooseSession')}</label>
        {sessionId ? <div className="org-fixed-session">{selectedSession?.workspace || sessionId}</div>
          : <select id="org-session" value={targetSession} disabled={Boolean(busy)} onChange={event => setTargetSession(event.target.value)}>
            <option value="">{t('selectSession')}</option>{sessions.filter(item => item.available).map(item => <option key={item.id} value={item.id}>{item.workspace || item.label} · {item.id.slice(0, 8)}</option>)}</select>}
        {!selectedSession?.available && <p className="org-muted">{t('noSession')}</p>}
      </div><div className="org-requirement-field"><label htmlFor="org-requirement">{t('requirement')}</label>
        <textarea id="org-requirement" value={requirement} maxLength={100000} onChange={event => setRequirement(event.target.value)} placeholder={t('requirementHint')} rows={3} disabled={Boolean(busy)}/>
        <button className="org-button org-button--primary" type="submit" disabled={Boolean(busy) || !requirement.trim() || !selectedSession?.available}>{t(busy === 'uiStart' ? 'starting' : 'start')}</button>
      </div></div>
    </form>}
    {overview && <div className="org-layout">
      <aside className="org-history"><div className="org-section-label">{t('history')}<span>{overview.runs.length}</span></div>
        {!overview.runs.length && <div className="org-history-empty"><OrganizationIcon size={32}/><strong>{t('noRuns')}</strong><p>{t('noRunsHint')}</p></div>}
        {overview.runs.map(item => <button key={item.id} type="button" disabled={Boolean(busy)} className={`org-run-card ${item.id === selectedId ? 'is-selected' : ''}`}
          onClick={() => { setSelectedId(item.id); setSelection(null) }} aria-pressed={item.id === selectedId}>
          <div><Status value={item.status} t={t}/><time>{displayTime(item.createdAt, locale)}</time></div>
          <strong>{item.requirement}</strong><small className="org-workspace-path">{item.workspace}</small>
          <div className="org-run-bottom"><span>{item.done}/{item.total}</span><code>{item.id.slice(0, 8)}</code></div>
        </button>)}
      </aside>
      <main className="org-main">
        <div className="org-summary"><div><span className="org-eyebrow">{run ? t('current') : t('template')}</span>
          <h2>{run?.requirement || definition?.name || definition?.id}</h2>
          {run && <code className="org-run-id">{run.id}</code>}</div>
          {run && <Status value={run.status} t={t}/>}</div>
        {run && <><div className="org-progress-row"><div className="org-progress" role="progressbar" aria-label={t('completed')} aria-valuemin={0} aria-valuemax={definition.nodes.length} aria-valuenow={done}>
          <span style={{ width: `${done / definition.nodes.length * 100}%` }}/></div><span>{done}/{definition.nodes.length} {t('completed')}</span></div>
          <div className="org-run-actions"><span className="org-muted">{t('runningHint')}</span>
            <button className="org-link" onClick={() => openSession(run.ownerSession)}>{t('openSession')}</button>
            {run.status === 'running' && <button className="org-button" disabled={Boolean(busy) || !run.ownerAvailable} onClick={() => command('uiResume', run.id, run.ownerSession)}>{t('resume')}</button>}
            {!['succeeded', 'cancelled'].includes(run.status) && <button className="org-button org-button--danger" disabled={Boolean(busy) || run.cancelRequested} onClick={() => setConfirmCancel(true)}>{t('cancel')}</button>}
          </div>
          {!run.ownerAvailable && <div className="org-notice">{t('sessionUnavailable')}</div>}
          {run.schedulerError && <div className="org-error" role="alert">{run.schedulerError}</div>}
          {confirmCancel && <div className="org-confirm" role="alert"><p>{t('cancelQuestion')}</p><button className="org-button org-button--danger" disabled={Boolean(busy)} onClick={() => command('uiCancel', run.id, run.ownerSession)}>{t('confirmCancel')}</button><button className="org-button" onClick={() => setConfirmCancel(false)}>{t('back')}</button></div>}
        </>}
        <nav className="org-tabs" aria-label={t('title')}>{['organization', 'workflow', 'events'].map(key => <button type="button" key={key} aria-current={tab === key ? 'page' : undefined}
          className={tab === key ? 'is-active' : ''} onClick={() => setTab(key)}>{t(key)}</button>)}<span>{t('readOnly')}</span></nav>
        {definition && tab === 'organization' && <OrganizationChart definition={definition} run={run} t={t} selected={chosenRole?.id} onSelect={id => setSelection({ kind: 'role', id })}/>}
        {definition && tab === 'workflow' && <Workflow definition={definition} run={run} t={t} selected={chosenNode?.id} onSelect={id => setSelection({ kind: 'node', id })}/>}
        {tab === 'events' && <Activity events={run?.events} t={t} locale={locale}/>}
      </main>
      <aside className="org-detail" aria-label={t('nodeDetails')}>
        {!chosenNode && !chosenRole && <div className="org-detail-empty"><OrganizationIcon size={40}/><p>{t('noSelection')}</p></div>}
        {chosenRole && <><span className="org-eyebrow">{t('roleDetails')}</span><h2>{chosenRole.name}</h2>
          <dl className="org-fields"><dt>{t('runtime')}</dt><dd className="org-mono">{chosenRole.runtime.provider}</dd>
            {chosenRole.reportsTo && <><dt>{t('reportsTo')}</dt><dd>{definition.roles.find(role => role.id === chosenRole.reportsTo)?.name}</dd></>}
            {chosenRole.runtime.agentPreset && <><dt>{t('preset')}</dt><dd>{chosenRole.runtime.agentPreset}</dd></>}</dl>
          <h3>{t('workflow')}</h3>{definition.nodes.filter(node => node.role === chosenRole.id).map(node => <button className="org-role-task" key={node.id} onClick={() => { setTab('workflow'); setSelection({ kind: 'node', id: node.id }) }}>
            <strong>{node.id}</strong><Status value={run?.tasks[node.id]?.status} t={t}/></button>)}</>}
        {chosenNode && <NodeDetail key={`${run?.id}/${chosenNode.id}/${run?.tasks[chosenNode.id]?.approval?.inputDigest || ''}`}
          node={chosenNode} role={definition.roles.find(role => role.id === chosenNode.role)} task={run?.tasks[chosenNode.id]} run={run}
          t={t} locale={locale} busy={Boolean(busy)} command={command} onSelect={id => setSelection({ kind: 'node', id })}
          openChild={childId => { try { uiWorkspace.openSession({ parentSessionId: run.ownerSession, childSessionId: childId, mode: 'unknown' }) } catch (error) { setActionError(error.message) } }}/>} 
      </aside>
    </div>}
  </div>
}
