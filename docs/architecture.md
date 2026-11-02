# Architecture

## Scope

The first release implements an executable organization kernel. It deliberately stops before a visual editor. A future editor must produce the same validated definition used by the scheduler, rather than maintain a separate graph that only resembles execution.

The implementation is original. Research references: [TeamFlow 89aec4b](https://github.com/MichaelShii/dsh-plugin-teamflow/tree/89aec4b094d0450b37c54d65f5dea469e0c01f02) and [DSH ce7073d](https://github.com/deepseek-ai/deepseek-harness/tree/ce7073d51254c26cd63b22a60835b8f948deb447). No TeamFlow source was copied.

## Objects

| Object | Meaning |
|---|---|
| Role | Stable organizational position, reporting relation and explicit runtime route |
| Node | A task definition, input dependencies, role, instructions and shared resource keys |
| Run | Frozen organization/workflow definition, original requirement, owner and workspace |
| Task | Latest state and output for a node within a run |
| Attempt | Immutable identity, input snapshot, runtime configuration and execution result |
| Approval | An operator decision bound to the digest of the exact input artifacts |
| Event | Append-only audit fact committed atomically with the run snapshot |

Roles and workflow nodes are separate arrays. Multiple tasks may use one role. No standing process is implied by a role. Each attempt currently creates a fresh runtime activation.

## Scheduling

The graph is a validated DAG. A node becomes ready after every dependency succeeds. Agent/review nodes use the runtime adapter; approval nodes stop at `waiting` and never invoke a model. Node array order does not determine dependency correctness.

`BEGIN IMMEDIATE` protects claim decisions. Each claim has a unique attempt token and renewable expiry. A completion must match the task's current token and input snapshot. Two SQLite connections cannot claim one pending task simultaneously. Run-level concurrency and workspace-level resource conflicts are checked inside the same write transaction.

The default template uses a conservative `workspace` resource for every Agent task. This serializes access to a shared project. The scheduler supports parallel independent tasks; custom definitions can use separate resource sets or separate runtime working environments. Do not remove resource locks merely to increase a concurrency number when Agents can write the same files.

## Reviews and rework

A review has one direct subject produced by a different role. The subject's only outgoing edge must lead to that review. This restriction prevents a consumer from executing before the subject is approved. It is intentionally narrower than an arbitrary graph editor.

A review output includes `summary`, `decision`, `reason`, and the exact `subjectDigest`. Rejection increments a durable counter, records feedback, and invalidates the subject and its downstream tasks. Attempt history remains intact. A new planning attempt receives the rejection feedback. Exceeding `maxRejections` blocks the review; an ordinary retry cannot reset that budget. The final delivery review uses a zero-rework budget, so rejection blocks for operator intervention rather than pretending that reassembling a report fixes code.

All transitive upstream artifacts are available to a task, deduplicated by node id. Passing only a review's short summary would hide the plan from the executor. The adapter enforces a context size limit rather than silently truncating artifacts.

Human gates bind the entire direct input snapshot to `inputDigest`. The local operator command records the operating-system username. The core API expects a trusted caller to supply verified identity; a future network API must derive it from authentication, never from a model-supplied JSON field.

## Persistence and failure

SQLite schema version 1 stores one JSON run snapshot per row and an append-only event table. Every state transition and its audit events commit in one transaction. WAL, a busy timeout and FULL synchronous mode are enabled. Event reads use a sequence cursor and pages of at most 1000 events.

| Task state | Meaning |
|---|---|
| `pending` | Not yet claimed |
| `running` | Exact attempt owns a renewable execution lease |
| `waiting` | Human approval required |
| `succeeded` | Valid structured output accepted by the scheduler |
| `failed` | Runtime settled or output validation failed; explicit retry allowed |
| `unknown` | Cleanup failed or lease expired; old side effects may still be active |
| `cancelled` | Task cancelled after known cleanup, or never started |

Expired claims become `unknown`; they do not automatically become pending. Unknown tasks continue holding their declared workspace resources. The operator must stop/check the old runtime and reconcile before retrying. This fences state writes, not filesystem or external-system effects: exactly-once side effects are not guaranteed.

Run cancellation first requests cancellation and stops future dispatch. Local child handles are disposed and awaited; other host processes observe the persisted request through heartbeats. The run remains `cancelling` while an execution is active, or `blocked` if cleanup is uncertain. Only known settlement yields `cancelled`. An operator may confirm an uncertain cancelled execution stopped using `reconcile ... stopped`.

The host polls runnable runs whose owner Agent is loaded. Reopening an owner session or calling `organization_resume` allows queued ready work to progress. Failed/unknown tasks remain blocked. The core `drain` call processes locally available work; it does not wait for independently owned executions in another process.

## DSH integration

`src/host.mjs` is a Cordis Service requiring `agents`, `subagents`, `tools`, and `workingDirectory`. The bundle patch inserts it in the host plane. Tools and the poller are reversible effects; unload stops the poller, aborts/joins local runtime work, then closes SQLite.

The adapter explicitly selects the role's registered Subagent provider and uses `delivery: caller`. It publishes the child id to attempt metadata and collects only completed results. After publication, cancellation uses the activation's `dispose()` handle, not only the original signal. Cleanup errors produce unknown outcomes. Independent presets and model options are sent only when explicitly configured; the DSH provider remains responsible for rejecting unsupported capabilities.

This release does not implement cold child continuation. A retry is a fresh activation after known cleanup, with persisted upstream artifacts and review feedback. It does not import TeamFlow's progress guard, retry classifier or metering code.

## Next increments

1. Real DSH profile smoke with restricted planner/reviewer presets and a full DSH SDK engineering node; freeze the supported host version.
2. Runtime capability discovery, durable attempt cancellation handles, progress/usage events, and continuation where supported.
3. Versioned artifact references and host-executed verification policies instead of relying only on model output.
4. Typed RPC descriptors and authenticated operator commands for the Studio backend.
5. Organization editor, workflow editor and run/event inspector over this same execution model.

Cross-machine workers and enterprise tenancy need a separate authorization, mailbox and distributed ownership design; sharing a SQLite file is not that design.
