import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { demand, refreshStatus } from './model.mjs'

/** SQLite owns atomic snapshot + append-only event commits and cross-process claims. */
export class SqliteStore {
  constructor(filename) {
    if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true })
    this.db = new DatabaseSync(filename)
    this.db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;')
    const version = this.db.prepare('PRAGMA user_version').get().user_version
    demand(version === 0 || version === 1, 'SCHEMA_VERSION', `Unsupported database version ${version}`)
    this.db.exec(`CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, snapshot TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL, revision INTEGER NOT NULL, data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS events_run ON events(run_id,seq);
      PRAGMA user_version=1;`)
  }

  create(run) {
    return this.transaction(() => {
      this.db.prepare('INSERT INTO runs VALUES (?, ?, ?)').run(run.id, 1, JSON.stringify({ ...run, revision: 1 }))
      this.event(run.id, 1, { type: 'run.created', at: Date.now(), definitionDigest: run.definitionDigest })
      return this.get(run.id)
    })
  }

  get(id) {
    const row = this.db.prepare('SELECT snapshot FROM runs WHERE id=?').get(id)
    demand(row, 'NOT_FOUND', `Unknown run ${id}`)
    return JSON.parse(row.snapshot)
  }

  list() { return this.db.prepare('SELECT snapshot FROM runs ORDER BY rowid DESC').all().map(row => JSON.parse(row.snapshot)) }

  /** Callback is synchronous: no runtime calls or awaits inside a transaction. */
  update(id, change) {
    return this.transaction(() => {
      const run = this.get(id)
      const previousStatus = run.status
      const events = []
      const result = change(run, event => events.push({ ...event, at: Date.now() }))
      demand(!(result instanceof Promise), 'ASYNC_TRANSACTION', 'Transactions cannot await')
      refreshStatus(run)
      if (run.status !== previousStatus) events.push({ type: 'run.status-changed', from: previousStatus, to: run.status, at: Date.now() })
      run.revision += 1
      run.updatedAt = Date.now()
      this.db.prepare('UPDATE runs SET revision=?, snapshot=? WHERE id=?').run(run.revision, JSON.stringify(run), id)
      for (const event of events) this.event(id, run.revision, event)
      return { run, result }
    })
  }

  event(id, revision, event) {
    this.db.prepare('INSERT INTO events(run_id,revision,data) VALUES (?,?,?)').run(id, revision, JSON.stringify(event))
  }

  events(id, after = 0) {
    this.get(id)
    demand(Number.isSafeInteger(after) && after >= 0, 'INVALID_CURSOR', 'Invalid event cursor')
    return this.db.prepare('SELECT seq,revision,data FROM events WHERE run_id=? AND seq>? ORDER BY seq LIMIT 1000')
      .all(id, after).map(row => ({ seq: row.seq, revision: row.revision, ...JSON.parse(row.data) }))
  }

  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE')
    try { const result = fn(); this.db.exec('COMMIT'); return result }
    catch (error) { this.db.exec('ROLLBACK'); throw error }
  }

  close() { this.db.close() }
}
