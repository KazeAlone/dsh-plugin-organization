import { randomUUID } from 'node:crypto'
import { demand, digest, inputsFor, artifactsFor, parseOutput, validateDefinition } from './model.mjs'

/** Dependency scheduler. Runtime executions are always outside SQLite transactions. */
export class OrganizationEngine {
  constructor(store, runtime, { concurrency = 2, leaseMs = 30_000, heartbeatMs = 5_000 } = {}) {
    demand(Number.isSafeInteger(concurrency) && concurrency > 0 && concurrency <= 32, 'INVALID_CONFIG', 'concurrency must be 1–32')
    demand(Number.isSafeInteger(leaseMs) && leaseMs >= 100 && Number.isSafeInteger(heartbeatMs)
      && heartbeatMs > 0 && heartbeatMs < leaseMs / 2, 'INVALID_CONFIG', 'Heartbeat must be less than half the lease')
    this.store = store; this.runtime = runtime; this.concurrency = concurrency
    this.leaseMs = leaseMs; this.heartbeatMs = heartbeatMs
    this.jobs = new Map(); this.drains = new Map(); this.closed = false
  }

  start(definition, requirement, { ownerSession, workspace } = {}) {
    demand(!this.closed, 'CLOSED', 'Engine is closed')
    demand(typeof requirement === 'string' && requirement.trim().length > 0 && requirement.length <= 100_000,
      'INVALID_REQUIREMENT', 'Requirement must contain 1–100000 characters')
    demand(typeof ownerSession === 'string' && ownerSession.length > 0 && typeof workspace === 'string' && workspace.length > 0,
      'INVALID_CONTEXT', 'Owner session and workspace are required')
    const frozen = validateDefinition(definition)
    const tasks = Object.fromEntries(frozen.nodes.map(node => [node.id, {
      status: 'pending', output: null, digest: null, attempts: [], claim: null, approval: null,
    }]))
    return this.store.create({ id: randomUUID(), status: 'running', requirement, ownerSession, workspace,
      createdAt: Date.now(), updatedAt: Date.now(), definition: frozen, definitionDigest: digest(frozen),
      tasks, feedback: {}, rejections: {}, cancelRequested: false })
  }

  /** Only expired claims are uncertain. Never automatically rerun their side effects. */
  recoverExpired(id, now = Date.now()) {
    return this.store.update(id, (run, emit) => {
      for (const [nodeId, task] of Object.entries(run.tasks)) {
        if (task.status !== 'running' || task.claim.expiresAt > now) continue
        task.status = 'unknown'
        const attempt = task.attempts.at(-1)
        attempt.status = 'unknown'; attempt.endedAt = now
        task.claim = null
        emit({ type: 'task.uncertain', nodeId, attemptId: attempt.id, reason: 'Execution lease expired; reconcile before retrying' })
      }
    }).run
  }

  claim(id) {
    return this.store.update(id, (run, emit) => {
      if (run.cancelRequested || ['blocked', 'succeeded', 'cancelled'].includes(run.status)) return null
      if (Object.values(run.tasks).filter(t => t.status === 'running').length >= this.concurrency) return null
      const eligible = run.definition.nodes.filter(node => run.tasks[node.id].status === 'pending'
        && node.deps.every(dep => run.tasks[dep].status === 'succeeded'))
      for (const node of eligible) {
        const task = run.tasks[node.id]
        const inputs = inputsFor(run, node)
        if (node.kind === 'approval') {
          task.status = 'waiting'; task.approval = { inputDigest: digest(inputs), requestedAt: Date.now() }
          emit({ type: 'approval.requested', nodeId: node.id, inputDigest: task.approval.inputDigest })
          continue
        }
        const busy = this.store.list().filter(other => other.workspace === run.workspace)
          .flatMap(other => other.definition.nodes.filter(n => ['running', 'unknown'].includes(other.tasks[n.id].status)).flatMap(n => n.resources || []))
        if ((node.resources || []).some(resource => busy.includes(resource))) continue
        const attempt = { id: randomUUID(), status: 'running', startedAt: Date.now(), inputDigest: digest(inputs),
          inputs, runtime: run.definition.roles.find(role => role.id === node.role).runtime }
        task.attempts.push(attempt); task.status = 'running'
        task.claim = { token: attempt.id, expiresAt: Date.now() + this.leaseMs }
        emit({ type: 'task.started', nodeId: node.id, attemptId: attempt.id, inputDigest: attempt.inputDigest })
        return { node, attempt, role: run.definition.roles.find(role => role.id === node.role) }
      }
      return null
    })
  }

  settle(id, nodeId, token, output, error) {
    return this.store.update(id, (run, emit) => {
      const task = run.tasks[nodeId]
      if (task.status !== 'running' || task.claim?.token !== token) return false
      if (task.claim.expiresAt <= Date.now()) {
        task.status = 'unknown'; task.claim = null
        task.attempts.at(-1).status = 'unknown'; task.attempts.at(-1).endedAt = Date.now()
        emit({ type: 'task.uncertain', nodeId, attemptId: token, reason: 'Result arrived after execution lease expired' })
        return false
      }
      const node = run.definition.nodes.find(n => n.id === nodeId)
      const attempt = task.attempts.at(-1)
      task.claim = null; attempt.endedAt = Date.now()
      if (run.cancelRequested) {
        if (error?.code === 'UNKNOWN_OUTCOME') {
          task.status = attempt.status = 'unknown'
          attempt.error = { code: error.code, message: String(error.message).slice(0, 2000) }
          emit({ type: 'task.uncertain', nodeId, attemptId: token, reason: attempt.error.message }); return true
        }
        task.status = attempt.status = 'cancelled'
        emit({ type: 'task.cancelled', nodeId, attemptId: token }); return true
      }
      try {
        if (error) throw error
        output = parseOutput(output)
        demand(digest(inputsFor(run, node)) === attempt.inputDigest, 'STALE_INPUT', 'Task inputs changed during execution')
        if (node.kind === 'review') {
          demand(['approve', 'reject'].includes(output.decision) && typeof output.reason === 'string' && output.reason.trim(),
            'INVALID_REVIEW', 'Review requires approve/reject and a reason')
          demand(output.subjectDigest === attempt.inputs[node.subject].digest, 'STALE_REVIEW', 'Review is not bound to its subject version')
          attempt.output = output
          if (output.decision === 'reject') {
            const count = (run.rejections[nodeId] || 0) + 1
            run.rejections[nodeId] = count
            demand(count <= node.maxRejections, 'REWORK_LIMIT', 'Review rejection budget exhausted')
            attempt.status = 'rejected'
            run.feedback[node.subject] = output.reason
            const affected = new Set([node.subject])
            let size
            do {
              size = affected.size
              for (const candidate of run.definition.nodes) if (candidate.deps.some(dep => affected.has(dep))) affected.add(candidate.id)
            } while (affected.size !== size)
            for (const target of affected) {
              const reset = run.tasks[target]
              demand(reset.status !== 'running' || target === nodeId, 'ACTIVE_DESCENDANT', 'Cannot invalidate a running descendant')
              reset.status = 'pending'; reset.output = null; reset.digest = null; reset.approval = null
            }
            emit({ type: 'review.rejected', nodeId, attemptId: token, subjectDigest: output.subjectDigest, reason: output.reason, count })
            return true
          }
        }
        task.output = output; task.digest = digest(output); task.status = attempt.status = 'succeeded'
        attempt.output = output
        emit({ type: node.kind === 'review' ? 'review.approved' : 'task.succeeded', nodeId, attemptId: token, digest: task.digest })
      } catch (failure) {
        task.status = attempt.status = failure.code === 'UNKNOWN_OUTCOME' ? 'unknown' : 'failed'
        attempt.error = { code: failure.code || 'RUNTIME_FAILURE', message: String(failure.message || failure).slice(0, 2000) }
        emit({ type: 'task.failed', nodeId, attemptId: token, error: attempt.error })
      }
      return true
    }).run
  }

  async executeClaim(id, claimed, run) {
    const { node, attempt, role } = claimed
    const controller = new AbortController()
    const key = `${id}/${node.id}`
    const timer = setInterval(() => {
      try {
        const { result: valid } = this.store.update(id, state => {
          const task = state.tasks[node.id]
          if (state.cancelRequested || task.status !== 'running' || task.claim?.token !== attempt.id) return false
          task.claim.expiresAt = Date.now() + this.leaseMs
          return true
        })
        if (!valid) controller.abort(new Error('Execution cancelled or claim lost'))
      } catch (error) { controller.abort(error) }
    }, this.heartbeatMs)
    const job = { controller, promise: null, runId: id }
    this.jobs.set(key, job)
    job.promise = (async () => {
      try {
        const output = await this.runtime.execute({ run, node, role, inputs: attempt.inputs, artifacts: artifactsFor(run, node),
          feedback: run.feedback[node.id] || null, attemptId: attempt.id, signal: controller.signal,
          onStarted: childId => this.store.update(id, state => {
            const task = state.tasks[node.id]
            if (task.claim?.token === attempt.id) task.attempts.at(-1).childId = childId
          }) })
        this.settle(id, node.id, attempt.id, output)
      } catch (error) { this.settle(id, node.id, attempt.id, null, error) }
      finally { clearInterval(timer); this.jobs.delete(key) }
    })()
    return job.promise
  }

  /** Coalesce overlapping calls in one engine; SQLite fences independent engines. */
  drain(id) {
    demand(!this.closed, 'CLOSED', 'Engine is closed')
    if (this.drains.has(id)) return this.drains.get(id)
    const promise = this.pump(id).finally(() => this.drains.delete(id))
    this.drains.set(id, promise)
    return promise
  }

  async pump(id) {
    this.recoverExpired(id)
    while (!this.closed) {
      let next
      do {
        next = this.claim(id)
        if (next.result) void this.executeClaim(id, next.result, next.run)
      } while (next.result && !this.closed)
      const jobs = [...this.jobs.values()].filter(job => job.runId === id)
      if (!jobs.length) break
      await Promise.race(jobs.map(job => job.promise))
    }
    return this.store.get(id)
  }

  /** Trusted control-plane API only. Do not expose as an Agent tool. */
  approve(id, nodeId, { actor, inputDigest, reason }) {
    demand(typeof actor === 'string' && actor.trim() && typeof reason === 'string' && reason.trim(), 'INVALID_APPROVAL', 'Authenticated actor and reason are required')
    return this.store.update(id, (run, emit) => {
      demand(!run.cancelRequested, 'CANCELLED', 'Run is cancelled')
      const node = run.definition.nodes.find(n => n.id === nodeId)
      const task = run.tasks[nodeId]
      demand(node?.kind === 'approval' && task.status === 'waiting', 'INVALID_APPROVAL', 'No pending human approval')
      demand(inputDigest === task.approval.inputDigest && inputDigest === digest(inputsFor(run, node)), 'STALE_APPROVAL', 'Approval input version changed')
      task.output = { summary: reason, actor, inputDigest, approvedAt: Date.now() }
      task.digest = digest(task.output); task.status = 'succeeded'
      emit({ type: 'approval.granted', nodeId, actor, inputDigest, reason })
    }).run
  }

  /** Failed tasks are safe to retry only after their runtime has settled. */
  retry(id, nodeId, reason) {
    demand(typeof reason === 'string' && reason.trim(), 'INVALID_RETRY', 'Retry reason is required')
    return this.store.update(id, (run, emit) => {
      demand(!run.cancelRequested, 'CANCELLED', 'Run is cancelled')
      const task = run.tasks[nodeId]
      demand(task?.status === 'failed', 'INVALID_RETRY', 'Only settled failures may be retried; reconcile unknown attempts first')
      demand(task.attempts.at(-1).error?.code !== 'REWORK_LIMIT', 'REWORK_LIMIT', 'Rejection budget cannot be reset by retry')
      task.status = 'pending'
      emit({ type: 'task.retry-requested', nodeId, reason })
    }).run
  }

  /** Unknown side effects require an operator check; stale runtime results stay fenced. */
  reconcile(id, nodeId, { actor, reason, action }) {
    demand(typeof actor === 'string' && actor.trim() && typeof reason === 'string' && reason.trim() && ['retry', 'stopped'].includes(action),
      'INVALID_RECONCILIATION', 'Reconcile requires actor, reason and action=retry/stopped after stopping/checking the old runtime')
    return this.store.update(id, (run, emit) => {
      const task = run.tasks[nodeId]
      demand(task?.status === 'unknown', 'INVALID_RECONCILIATION', 'Only uncertain attempts require reconciliation')
      demand(!run.cancelRequested || action === 'stopped', 'CANCELLED', 'A cancelled run can only confirm the old execution stopped')
      demand(action !== 'stopped' || run.cancelRequested, 'INVALID_RECONCILIATION', 'Use retry for a live run or cancel it before confirming stopped')
      task.status = action === 'retry' ? 'pending' : 'cancelled'
      emit({ type: 'task.reconciled', nodeId, actor, reason, action })
    }).run
  }

  async cancel(id) {
    this.store.update(id, (run, emit) => {
      if (['succeeded', 'cancelled'].includes(run.status)) return
      run.cancelRequested = true
      for (const task of Object.values(run.tasks)) if (['pending', 'waiting'].includes(task.status)) task.status = 'cancelled'
      emit({ type: 'run.cancel-requested' })
    })
    const jobs = [...this.jobs.values()].filter(job => job.runId === id)
    for (const job of jobs) job.controller.abort(new Error('Run cancelled'))
    await Promise.allSettled(jobs.map(job => job.promise))
    return this.store.get(id)
  }

  async close() {
    this.closed = true
    const jobs = [...this.jobs.values()]
    for (const job of jobs) job.controller.abort(new Error('Plugin unloading'))
    await Promise.allSettled(jobs.map(job => job.promise))
    await Promise.allSettled([...this.drains.values()])
  }
}
