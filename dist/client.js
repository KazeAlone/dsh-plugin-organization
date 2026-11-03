window.__ModuleLoader__.load({id:"dsh-plugin-organization",factory:(require)=>{var module={exports:{}};var exports=module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.mjs
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react2 = __toESM(require("react"), 1);

// src/descriptors.mjs
var schema = { parse(value) {
  return value;
} };
var json = {
  mode: "strict",
  typeSymbol: "dsh-plugin-organization#Json",
  schema,
  create: () => schema
};
var string = (name) => ({ name, wire: name, source: "json", codec: {
  mode: "strict",
  typeSymbol: "dsh-plugin-organization#String",
  create: () => ({ parse(value) {
    if (typeof value !== "string" || value.length > 1e5) throw new TypeError("Expected a string of at most 100000 characters");
    return value;
  } })
} });
var methods = {
  uiOverview: ["sessionId"],
  uiSnapshot: ["runId", "sessionId"],
  uiStart: ["sessionId", "requirement"],
  uiCancel: ["runId", "sessionId"],
  uiResume: ["runId", "sessionId"],
  uiRetry: ["runId", "sessionId", "nodeId", "reason"],
  uiApprove: ["runId", "sessionId", "nodeId", "inputDigest", "reason"]
};
var ORGANIZATION_DESCRIPTORS = Object.entries(methods).map(([method, names]) => ({
  id: `dsh-plugin-organization#organization/${method}`,
  service: "organization",
  namespace: "organization",
  method,
  invocation: { kind: "direct" },
  parameters: names.map(string),
  result: json
}));
var ORGANIZATION_REMOTE = { package: "dsh-plugin-organization", descriptors: ORGANIZATION_DESCRIPTORS };

// src/client/workbench.jsx
var import_react = __toESM(require("react"), 1);

// src/client/model.mjs
function unwrap(reply) {
  if (reply?.ok === true) return reply.value;
  if (reply?.ok === false) throw new Error(reply.error?.message || reply.error?.code || "Remote request failed");
  throw new Error("Invalid organization RPC response");
}
function layersOf(definition) {
  const remaining = new Map(definition.nodes.map((node) => [node.id, node]));
  const done = /* @__PURE__ */ new Set(), layers = [];
  while (remaining.size) {
    const layer = [...remaining.values()].filter((node) => node.deps.every((dep) => done.has(dep)));
    if (!layer.length) throw new Error("Workflow contains an invalid dependency graph");
    layers.push(layer);
    for (const node of layer) {
      remaining.delete(node.id);
      done.add(node.id);
    }
  }
  return layers;
}
function roleLayers(definition) {
  const remaining = new Map(definition.roles.map((role) => [role.id, role]));
  const done = /* @__PURE__ */ new Set(), layers = [];
  while (remaining.size) {
    const layer = [...remaining.values()].filter((role) => !role.reportsTo || done.has(role.reportsTo));
    if (!layer.length) break;
    layers.push(layer);
    for (const role of layer) {
      remaining.delete(role.id);
      done.add(role.id);
    }
  }
  return layers;
}
function displayTime(value, locale = "zh") {
  return value ? new Date(value).toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }) : "\u2014";
}
function elapsed(attempt, now = Date.now()) {
  if (!attempt?.startedAt) return "\u2014";
  const seconds = Math.max(0, Math.round(((attempt.endedAt || now) - attempt.startedAt) / 1e3));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

// src/client/workbench.jsx
function OrganizationIcon({ size = 20 }) {
  return /* @__PURE__ */ import_react.default.createElement("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.6", "aria-hidden": "true" }, /* @__PURE__ */ import_react.default.createElement("rect", { x: "8", y: "2", width: "8", height: "6", rx: "2" }), /* @__PURE__ */ import_react.default.createElement("path", { d: "M12 8v5M4 17v-4h16v4" }), /* @__PURE__ */ import_react.default.createElement("rect", { x: "1", y: "17", width: "6", height: "5", rx: "1.5" }), /* @__PURE__ */ import_react.default.createElement("rect", { x: "9", y: "17", width: "6", height: "5", rx: "1.5" }), /* @__PURE__ */ import_react.default.createElement("rect", { x: "17", y: "17", width: "6", height: "5", rx: "1.5" }));
}
function Status({ value = "pending", t }) {
  return /* @__PURE__ */ import_react.default.createElement("span", { className: `org-status org-status--${value}` }, /* @__PURE__ */ import_react.default.createElement("i", null), t(`status.${value}`));
}
function Json({ value, label }) {
  return /* @__PURE__ */ import_react.default.createElement("details", { className: "org-json" }, /* @__PURE__ */ import_react.default.createElement("summary", null, label), /* @__PURE__ */ import_react.default.createElement("pre", null, JSON.stringify(value, null, 2)));
}
function OrganizationChart({ definition, run, selected, onSelect, t }) {
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "org-chart" }, roleLayers(definition).map((roles, depth) => /* @__PURE__ */ import_react.default.createElement("div", { className: "org-tier", key: depth }, depth > 0 && /* @__PURE__ */ import_react.default.createElement("span", { className: "org-tier-parent" }, t("reportsTo"), ": ", [...new Set(roles.map((role) => definition.roles.find((parent) => parent.id === role.reportsTo)?.name).filter(Boolean))].join(" / ")), roles.map((role) => {
    const assigned = definition.nodes.filter((node) => node.role === role.id);
    const tasks = assigned.map((node) => run?.tasks[node.id]).filter(Boolean);
    const status = tasks.find((task) => ["running", "unknown", "failed", "waiting"].includes(task.status))?.status || (tasks.length && tasks.every((task) => task.status === "succeeded") ? "succeeded" : "pending");
    return /* @__PURE__ */ import_react.default.createElement(
      "button",
      {
        type: "button",
        key: role.id,
        className: `org-role ${selected === role.id ? "is-selected" : ""}`,
        onClick: () => onSelect(role.id),
        "aria-pressed": selected === role.id
      },
      /* @__PURE__ */ import_react.default.createElement("span", { className: "org-role-mark" }, role.name.slice(0, 1)),
      /* @__PURE__ */ import_react.default.createElement("strong", null, role.name),
      /* @__PURE__ */ import_react.default.createElement("span", { className: "org-muted org-mono" }, role.runtime.provider),
      run && /* @__PURE__ */ import_react.default.createElement(Status, { value: status, t })
    );
  }))), /* @__PURE__ */ import_react.default.createElement("p", { className: "org-footnote" }, t("roleHint")));
}
function Workflow({ definition, run, selected, onSelect, t }) {
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "org-flow" }, layersOf(definition).map((layer, index) => /* @__PURE__ */ import_react.default.createElement("section", { className: "org-flow-layer", key: index }, /* @__PURE__ */ import_react.default.createElement("div", { className: "org-layer-label" }, /* @__PURE__ */ import_react.default.createElement("span", null, String(index + 1).padStart(2, "0")), /* @__PURE__ */ import_react.default.createElement("span", null, t("stage"))), /* @__PURE__ */ import_react.default.createElement("div", { className: "org-flow-nodes" }, layer.map((node) => {
    const task = run?.tasks[node.id];
    const role = definition.roles.find((item) => item.id === node.role);
    return /* @__PURE__ */ import_react.default.createElement(
      "button",
      {
        type: "button",
        key: node.id,
        className: `org-node ${selected === node.id ? "is-selected" : ""}`,
        "data-node-id": node.id,
        "aria-pressed": selected === node.id,
        onClick: () => onSelect(node.id)
      },
      /* @__PURE__ */ import_react.default.createElement("div", { className: "org-node-top" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "org-mono" }, node.id), node.kind !== "agent" && /* @__PURE__ */ import_react.default.createElement("span", { className: "org-gate" }, t(node.kind === "review" ? "review" : "human"))),
      /* @__PURE__ */ import_react.default.createElement("strong", null, role?.name || node.role),
      /* @__PURE__ */ import_react.default.createElement(Status, { value: task?.status, t }),
      task?.output?.summary && /* @__PURE__ */ import_react.default.createElement("p", { className: "org-clamp" }, task.output.summary)
    );
  })))));
}
function Activity({ events = [], t, locale }) {
  return /* @__PURE__ */ import_react.default.createElement("ol", { className: "org-activity" }, events.length ? [...events].reverse().map((event) => /* @__PURE__ */ import_react.default.createElement("li", { key: event.seq }, /* @__PURE__ */ import_react.default.createElement("span", { className: "org-event-dot" }), /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("strong", null, t(`event.${event.type}`)), event.nodeId && /* @__PURE__ */ import_react.default.createElement("span", { className: "org-mono org-event-node" }, event.nodeId), (event.reason || event.error?.message) && /* @__PURE__ */ import_react.default.createElement("p", null, event.reason || event.error.message), event.to && /* @__PURE__ */ import_react.default.createElement("div", { className: "org-event-state" }, /* @__PURE__ */ import_react.default.createElement(Status, { value: event.to, t }))), /* @__PURE__ */ import_react.default.createElement("time", null, displayTime(event.at, locale)))) : /* @__PURE__ */ import_react.default.createElement("p", { className: "org-muted" }, t("emptyEvents")));
}
function NodeDetail({ node, role, task, run, t, locale, busy, command, onSelect, openChild }) {
  const [reason, setReason] = (0, import_react.useState)("");
  const [checked, setChecked] = (0, import_react.useState)(false);
  const latest = task?.attempts.at(-1);
  const locked = busy || !run?.ownerAvailable;
  return /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("span", { className: "org-eyebrow" }, t("nodeDetails")), /* @__PURE__ */ import_react.default.createElement("h2", null, node.id), /* @__PURE__ */ import_react.default.createElement("p", { className: "org-detail-role" }, role?.name), /* @__PURE__ */ import_react.default.createElement(Status, { value: task?.status, t }), /* @__PURE__ */ import_react.default.createElement("dl", { className: "org-fields" }, /* @__PURE__ */ import_react.default.createElement("dt", null, t("runtime")), /* @__PURE__ */ import_react.default.createElement("dd", { className: "org-mono" }, role?.runtime.provider), role?.runtime.agentPreset && /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("dt", null, t("preset")), /* @__PURE__ */ import_react.default.createElement("dd", null, role.runtime.agentPreset)), /* @__PURE__ */ import_react.default.createElement("dt", null, t("dependencies")), /* @__PURE__ */ import_react.default.createElement("dd", null, node.deps.length ? node.deps.map((dep) => /* @__PURE__ */ import_react.default.createElement("button", { key: dep, className: "org-link", onClick: () => onSelect(dep) }, dep)) : t("noDependencies"))), /* @__PURE__ */ import_react.default.createElement("h3", null, t("instruction")), /* @__PURE__ */ import_react.default.createElement("p", { className: "org-instruction" }, node.instruction || t("approvalNotice")), task?.status === "unknown" && /* @__PURE__ */ import_react.default.createElement("div", { className: "org-notice org-notice--warning" }, t("unknown")), task?.status === "waiting" && node.kind === "approval" && /* @__PURE__ */ import_react.default.createElement("div", { className: "org-approval" }, /* @__PURE__ */ import_react.default.createElement("h3", null, t("human")), /* @__PURE__ */ import_react.default.createElement("p", null, t("approvalNotice")), /* @__PURE__ */ import_react.default.createElement(Json, { value: Object.fromEntries(node.deps.map((id) => [id, run.tasks[id].output])), label: t("inputs") }), /* @__PURE__ */ import_react.default.createElement("code", { className: "org-digest" }, task.approval.inputDigest), /* @__PURE__ */ import_react.default.createElement("label", { className: "org-checkbox" }, /* @__PURE__ */ import_react.default.createElement("input", { type: "checkbox", checked, onChange: (event) => setChecked(event.target.checked) }), t("approveCheck")), /* @__PURE__ */ import_react.default.createElement(
    "button",
    {
      className: "org-button org-button--primary",
      disabled: !checked || busy,
      onClick: () => command("uiApprove", run.id, run.ownerSession, node.id, task.approval.inputDigest, t("approveCheck"))
    },
    t("approve")
  )), task?.status === "failed" && (latest?.error?.code === "REWORK_LIMIT" ? /* @__PURE__ */ import_react.default.createElement("p", { className: "org-notice org-notice--warning" }, t("retryLimit")) : /* @__PURE__ */ import_react.default.createElement("div", { className: "org-retry" }, /* @__PURE__ */ import_react.default.createElement("label", { htmlFor: "org-retry-reason" }, t("retryReason")), /* @__PURE__ */ import_react.default.createElement("textarea", { id: "org-retry-reason", value: reason, onChange: (event) => setReason(event.target.value), rows: 2 }), /* @__PURE__ */ import_react.default.createElement("button", { className: "org-button", disabled: locked || !reason.trim(), onClick: () => command("uiRetry", run.id, run.ownerSession, node.id, reason) }, t("retry")))), /* @__PURE__ */ import_react.default.createElement("h3", null, t("output")), /* @__PURE__ */ import_react.default.createElement("p", { className: "org-output" }, task?.output?.summary || t("emptyOutput")), task?.output?.decision && /* @__PURE__ */ import_react.default.createElement("p", { className: "org-decision" }, t("decision"), ": ", t(task.output.decision === "approve" ? "approveDecision" : "rejectDecision"), /* @__PURE__ */ import_react.default.createElement("br", null), task.output.reason), task?.output?.artifacts && /* @__PURE__ */ import_react.default.createElement(Json, { value: task.output.artifacts, label: t("artifacts") }), /* @__PURE__ */ import_react.default.createElement("h3", null, t("attempt"), " ", /* @__PURE__ */ import_react.default.createElement("span", { className: "org-muted" }, task?.attempts.length || 0)), task?.attempts.length ? [...task.attempts].reverse().map((attempt, index) => /* @__PURE__ */ import_react.default.createElement("div", { className: "org-attempt", key: attempt.id }, /* @__PURE__ */ import_react.default.createElement("div", { className: "org-attempt-top" }, /* @__PURE__ */ import_react.default.createElement("b", null, "#", task.attempts.length - index), /* @__PURE__ */ import_react.default.createElement(Status, { value: attempt.status, t })), /* @__PURE__ */ import_react.default.createElement("div", { className: "org-attempt-meta" }, /* @__PURE__ */ import_react.default.createElement("time", null, displayTime(attempt.startedAt, locale)), /* @__PURE__ */ import_react.default.createElement("span", null, elapsed(attempt))), attempt.error && /* @__PURE__ */ import_react.default.createElement("p", { className: "org-error-text" }, attempt.error.code, ": ", attempt.error.message), attempt.output?.reason && /* @__PURE__ */ import_react.default.createElement("p", null, attempt.output.reason), attempt.childId && /* @__PURE__ */ import_react.default.createElement("button", { className: "org-link", onClick: () => openChild(attempt.childId) }, t("childSession")), /* @__PURE__ */ import_react.default.createElement(Json, { value: { attemptId: attempt.id, runtime: attempt.runtime, inputDigest: attempt.inputDigest, inputs: attempt.inputs }, label: t("inputs") }))) : /* @__PURE__ */ import_react.default.createElement("p", { className: "org-muted" }, t("noAttempts")));
}
function Workbench({ remote, sessionId = "", t, locale = "zh", uiWorkspace }) {
  const [data, setData] = (0, import_react.useState)({ overview: null, run: null, loading: true, error: null });
  const [selectedId, setSelectedId] = (0, import_react.useState)(null);
  const [selection, setSelection] = (0, import_react.useState)(null);
  const [tab, setTab] = (0, import_react.useState)("organization");
  const [tick, setTick] = (0, import_react.useState)(0);
  const [formOpen, setFormOpen] = (0, import_react.useState)(false);
  const [requirement, setRequirement] = (0, import_react.useState)("");
  const [targetSession, setTargetSession] = (0, import_react.useState)(sessionId);
  const [busy, setBusy] = (0, import_react.useState)(null);
  const [actionError, setActionError] = (0, import_react.useState)(null);
  const [confirmCancel, setConfirmCancel] = (0, import_react.useState)(false);
  (0, import_react.useEffect)(() => {
    let alive = true, timer;
    setData((previous) => ({ ...previous, loading: true }));
    async function refresh() {
      try {
        const overview2 = unwrap(await remote.uiOverview(sessionId));
        const brief = overview2.runs.find((run3) => run3.id === selectedId);
        if (!selectedId && overview2.runs[0]) {
          if (alive) {
            setData({ overview: overview2, run: null, loading: false, error: null });
            setSelectedId(overview2.runs[0].id);
          }
          return;
        }
        const run2 = brief ? unwrap(await remote.uiSnapshot(brief.id, brief.ownerSession)) : null;
        if (alive) setData({ overview: overview2, run: run2, loading: false, error: null });
      } catch (error) {
        if (alive) setData((previous) => ({ ...previous, loading: false, error: error.message }));
      } finally {
        if (alive) timer = setTimeout(refresh, 2e3);
      }
    }
    refresh();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [remote, sessionId, selectedId, tick]);
  (0, import_react.useEffect)(() => {
    setSelection(null);
    setConfirmCancel(false);
  }, [selectedId]);
  const overview = data.overview;
  const run = data.run?.id === selectedId ? data.run : null;
  const definition = run?.definition || overview?.definition;
  const sessions = overview?.sessions || [];
  const activeSession = sessionId || targetSession;
  const selectedSession = sessions.find((item) => item.id === activeSession);
  async function command(method, ...args) {
    if (busy) return;
    setBusy(method);
    setActionError(null);
    try {
      const result = unwrap(await remote[method](...args));
      if (method === "uiStart") {
        setSelectedId(result.id);
        setFormOpen(false);
        setRequirement("");
        setTab("workflow");
      }
      setConfirmCancel(false);
      setTick((value) => value + 1);
    } catch (error) {
      setActionError(error.message);
    } finally {
      setBusy(null);
    }
  }
  function openSession(id) {
    try {
      uiWorkspace.openSession(id);
    } catch (error) {
      setActionError(error.message);
    }
  }
  const chosenNode = selection?.kind === "node" ? definition?.nodes.find((node) => node.id === selection.id) : null;
  const chosenRole = selection?.kind === "role" ? definition?.roles.find((role) => role.id === selection.id) : null;
  const done = run ? Object.values(run.tasks).filter((task) => task.status === "succeeded").length : 0;
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "org-workbench" }, /* @__PURE__ */ import_react.default.createElement("header", { className: "org-header" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "org-brand" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "org-brand-icon" }, /* @__PURE__ */ import_react.default.createElement(OrganizationIcon, { size: 24 })), /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("h1", null, t("title")), /* @__PURE__ */ import_react.default.createElement("p", null, t("subtitle")))), /* @__PURE__ */ import_react.default.createElement("div", { className: "org-header-actions" }, /* @__PURE__ */ import_react.default.createElement("button", { className: "org-button org-button--quiet", onClick: () => setTick((value) => value + 1), disabled: Boolean(busy) }, t("refresh")), /* @__PURE__ */ import_react.default.createElement("button", { className: "org-button org-button--primary", onClick: () => setFormOpen((value) => !value), disabled: !overview || Boolean(busy) }, "\uFF0B ", t("newTask")))), (data.error || actionError) && /* @__PURE__ */ import_react.default.createElement("div", { className: "org-error", role: "alert" }, t(data.error ? "loadFailed" : "failedRequest"), /* @__PURE__ */ import_react.default.createElement("span", null, actionError || data.error)), data.loading && !overview && /* @__PURE__ */ import_react.default.createElement("div", { className: "org-loading", role: "status" }, t("loading")), formOpen && /* @__PURE__ */ import_react.default.createElement("form", { className: "org-start-form", onSubmit: (event) => {
    event.preventDefault();
    command("uiStart", activeSession, requirement);
  } }, /* @__PURE__ */ import_react.default.createElement("div", { className: "org-form-top" }, /* @__PURE__ */ import_react.default.createElement("h2", null, t("newTask")), /* @__PURE__ */ import_react.default.createElement("button", { type: "button", className: "org-link", onClick: () => setFormOpen(false) }, t("close"))), /* @__PURE__ */ import_react.default.createElement("div", { className: "org-form-layout" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "org-session-field" }, /* @__PURE__ */ import_react.default.createElement("label", { htmlFor: "org-session" }, t("chooseSession")), sessionId ? /* @__PURE__ */ import_react.default.createElement("div", { className: "org-fixed-session" }, selectedSession?.workspace || sessionId) : /* @__PURE__ */ import_react.default.createElement("select", { id: "org-session", value: targetSession, disabled: Boolean(busy), onChange: (event) => setTargetSession(event.target.value) }, /* @__PURE__ */ import_react.default.createElement("option", { value: "" }, t("selectSession")), sessions.filter((item) => item.available).map((item) => /* @__PURE__ */ import_react.default.createElement("option", { key: item.id, value: item.id }, item.workspace || item.label, " \xB7 ", item.id.slice(0, 8)))), !selectedSession?.available && /* @__PURE__ */ import_react.default.createElement("p", { className: "org-muted" }, t("noSession"))), /* @__PURE__ */ import_react.default.createElement("div", { className: "org-requirement-field" }, /* @__PURE__ */ import_react.default.createElement("label", { htmlFor: "org-requirement" }, t("requirement")), /* @__PURE__ */ import_react.default.createElement("textarea", { id: "org-requirement", value: requirement, maxLength: 1e5, onChange: (event) => setRequirement(event.target.value), placeholder: t("requirementHint"), rows: 3, disabled: Boolean(busy) }), /* @__PURE__ */ import_react.default.createElement("button", { className: "org-button org-button--primary", type: "submit", disabled: Boolean(busy) || !requirement.trim() || !selectedSession?.available }, t(busy === "uiStart" ? "starting" : "start"))))), overview && /* @__PURE__ */ import_react.default.createElement("div", { className: "org-layout" }, /* @__PURE__ */ import_react.default.createElement("aside", { className: "org-history" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "org-section-label" }, t("history"), /* @__PURE__ */ import_react.default.createElement("span", null, overview.runs.length)), !overview.runs.length && /* @__PURE__ */ import_react.default.createElement("div", { className: "org-history-empty" }, /* @__PURE__ */ import_react.default.createElement(OrganizationIcon, { size: 32 }), /* @__PURE__ */ import_react.default.createElement("strong", null, t("noRuns")), /* @__PURE__ */ import_react.default.createElement("p", null, t("noRunsHint"))), overview.runs.map((item) => /* @__PURE__ */ import_react.default.createElement(
    "button",
    {
      key: item.id,
      type: "button",
      disabled: Boolean(busy),
      className: `org-run-card ${item.id === selectedId ? "is-selected" : ""}`,
      onClick: () => {
        setSelectedId(item.id);
        setSelection(null);
      },
      "aria-pressed": item.id === selectedId
    },
    /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement(Status, { value: item.status, t }), /* @__PURE__ */ import_react.default.createElement("time", null, displayTime(item.createdAt, locale))),
    /* @__PURE__ */ import_react.default.createElement("strong", null, item.requirement),
    /* @__PURE__ */ import_react.default.createElement("small", { className: "org-workspace-path" }, item.workspace),
    /* @__PURE__ */ import_react.default.createElement("div", { className: "org-run-bottom" }, /* @__PURE__ */ import_react.default.createElement("span", null, item.done, "/", item.total), /* @__PURE__ */ import_react.default.createElement("code", null, item.id.slice(0, 8)))
  ))), /* @__PURE__ */ import_react.default.createElement("main", { className: "org-main" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "org-summary" }, /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("span", { className: "org-eyebrow" }, run ? t("current") : t("template")), /* @__PURE__ */ import_react.default.createElement("h2", null, run?.requirement || definition?.name || definition?.id), run && /* @__PURE__ */ import_react.default.createElement("code", { className: "org-run-id" }, run.id)), run && /* @__PURE__ */ import_react.default.createElement(Status, { value: run.status, t })), run && /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("div", { className: "org-progress-row" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "org-progress", role: "progressbar", "aria-label": t("completed"), "aria-valuemin": 0, "aria-valuemax": definition.nodes.length, "aria-valuenow": done }, /* @__PURE__ */ import_react.default.createElement("span", { style: { width: `${done / definition.nodes.length * 100}%` } })), /* @__PURE__ */ import_react.default.createElement("span", null, done, "/", definition.nodes.length, " ", t("completed"))), /* @__PURE__ */ import_react.default.createElement("div", { className: "org-run-actions" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "org-muted" }, t("runningHint")), /* @__PURE__ */ import_react.default.createElement("button", { className: "org-link", onClick: () => openSession(run.ownerSession) }, t("openSession")), run.status === "running" && /* @__PURE__ */ import_react.default.createElement("button", { className: "org-button", disabled: Boolean(busy) || !run.ownerAvailable, onClick: () => command("uiResume", run.id, run.ownerSession) }, t("resume")), !["succeeded", "cancelled"].includes(run.status) && /* @__PURE__ */ import_react.default.createElement("button", { className: "org-button org-button--danger", disabled: Boolean(busy) || run.cancelRequested, onClick: () => setConfirmCancel(true) }, t("cancel"))), !run.ownerAvailable && /* @__PURE__ */ import_react.default.createElement("div", { className: "org-notice" }, t("sessionUnavailable")), run.schedulerError && /* @__PURE__ */ import_react.default.createElement("div", { className: "org-error", role: "alert" }, run.schedulerError), confirmCancel && /* @__PURE__ */ import_react.default.createElement("div", { className: "org-confirm", role: "alert" }, /* @__PURE__ */ import_react.default.createElement("p", null, t("cancelQuestion")), /* @__PURE__ */ import_react.default.createElement("button", { className: "org-button org-button--danger", disabled: Boolean(busy), onClick: () => command("uiCancel", run.id, run.ownerSession) }, t("confirmCancel")), /* @__PURE__ */ import_react.default.createElement("button", { className: "org-button", onClick: () => setConfirmCancel(false) }, t("back")))), /* @__PURE__ */ import_react.default.createElement("nav", { className: "org-tabs", "aria-label": t("title") }, ["organization", "workflow", "events"].map((key) => /* @__PURE__ */ import_react.default.createElement(
    "button",
    {
      type: "button",
      key,
      "aria-current": tab === key ? "page" : void 0,
      className: tab === key ? "is-active" : "",
      onClick: () => setTab(key)
    },
    t(key)
  )), /* @__PURE__ */ import_react.default.createElement("span", null, t("readOnly"))), definition && tab === "organization" && /* @__PURE__ */ import_react.default.createElement(OrganizationChart, { definition, run, t, selected: chosenRole?.id, onSelect: (id) => setSelection({ kind: "role", id }) }), definition && tab === "workflow" && /* @__PURE__ */ import_react.default.createElement(Workflow, { definition, run, t, selected: chosenNode?.id, onSelect: (id) => setSelection({ kind: "node", id }) }), tab === "events" && /* @__PURE__ */ import_react.default.createElement(Activity, { events: run?.events, t, locale })), /* @__PURE__ */ import_react.default.createElement("aside", { className: "org-detail", "aria-label": t("nodeDetails") }, !chosenNode && !chosenRole && /* @__PURE__ */ import_react.default.createElement("div", { className: "org-detail-empty" }, /* @__PURE__ */ import_react.default.createElement(OrganizationIcon, { size: 40 }), /* @__PURE__ */ import_react.default.createElement("p", null, t("noSelection"))), chosenRole && /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("span", { className: "org-eyebrow" }, t("roleDetails")), /* @__PURE__ */ import_react.default.createElement("h2", null, chosenRole.name), /* @__PURE__ */ import_react.default.createElement("dl", { className: "org-fields" }, /* @__PURE__ */ import_react.default.createElement("dt", null, t("runtime")), /* @__PURE__ */ import_react.default.createElement("dd", { className: "org-mono" }, chosenRole.runtime.provider), chosenRole.reportsTo && /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("dt", null, t("reportsTo")), /* @__PURE__ */ import_react.default.createElement("dd", null, definition.roles.find((role) => role.id === chosenRole.reportsTo)?.name)), chosenRole.runtime.agentPreset && /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("dt", null, t("preset")), /* @__PURE__ */ import_react.default.createElement("dd", null, chosenRole.runtime.agentPreset))), /* @__PURE__ */ import_react.default.createElement("h3", null, t("workflow")), definition.nodes.filter((node) => node.role === chosenRole.id).map((node) => /* @__PURE__ */ import_react.default.createElement("button", { className: "org-role-task", key: node.id, onClick: () => {
    setTab("workflow");
    setSelection({ kind: "node", id: node.id });
  } }, /* @__PURE__ */ import_react.default.createElement("strong", null, node.id), /* @__PURE__ */ import_react.default.createElement(Status, { value: run?.tasks[node.id]?.status, t })))), chosenNode && /* @__PURE__ */ import_react.default.createElement(
    NodeDetail,
    {
      key: `${run?.id}/${chosenNode.id}/${run?.tasks[chosenNode.id]?.approval?.inputDigest || ""}`,
      node: chosenNode,
      role: definition.roles.find((role) => role.id === chosenNode.role),
      task: run?.tasks[chosenNode.id],
      run,
      t,
      locale,
      busy: Boolean(busy),
      command,
      onSelect: (id) => setSelection({ kind: "node", id }),
      openChild: (childId) => {
        try {
          uiWorkspace.openSession({ parentSessionId: run.ownerSession, childSessionId: childId, mode: "unknown" });
        } catch (error) {
          setActionError(error.message);
        }
      }
    }
  ))));
}

// src/client/locales.mjs
var NS = "organization";
var zh = {
  title: "\u7EC4\u7EC7\u5DE5\u4F5C\u53F0",
  subtitle: "\u8BA9\u89C4\u5212\u3001\u5BA1\u8BAE\u4E0E\u6267\u884C\u6709\u8FF9\u53EF\u5FAA",
  sessionTab: "\u7EC4\u7EC7",
  template: "\u4E09\u7701\u516D\u90E8",
  newTask: "\u65B0\u5EFA\u4EFB\u52A1",
  start: "\u542F\u52A8\u7EC4\u7EC7",
  starting: "\u6B63\u5728\u542F\u52A8\u2026",
  requirement: "\u4EFB\u52A1\u9700\u6C42",
  requirementHint: "\u63CF\u8FF0\u76EE\u6807\u3001\u8303\u56F4\u548C\u9A8C\u6536\u6761\u4EF6\uFF0C\u4F8B\u5982\uFF1A\u4E3A\u5F53\u524D\u9879\u76EE\u589E\u52A0\u4EFB\u52A1\u7B5B\u9009\uFF0C\u5E76\u9A8C\u8BC1\u73B0\u6709\u529F\u80FD\u3002",
  chooseSession: "\u9879\u76EE\u4F1A\u8BDD",
  selectSession: "\u8BF7\u9009\u62E9\u4E00\u4E2A\u5DF2\u6253\u5F00\u7684\u9879\u76EE\u4F1A\u8BDD",
  noSession: "\u5148\u5728 DSH \u6253\u5F00\u4E00\u4E2A\u9879\u76EE\u4F1A\u8BDD\uFF0C\u518D\u8FD4\u56DE\u8FD9\u91CC\u542F\u52A8\u4EFB\u52A1\u3002",
  sessionUnavailable: "\u6240\u5C5E\u4F1A\u8BDD\u5C1A\u672A\u52A0\u8F7D\u3002\u8BF7\u5148\u6253\u5F00\u4F1A\u8BDD\uFF0C\u518D\u7EE7\u7EED\u6267\u884C\u3002",
  openSession: "\u6253\u5F00\u6240\u5C5E\u4F1A\u8BDD",
  history: "\u4EFB\u52A1\u8BB0\u5F55",
  noRuns: "\u8FD8\u6CA1\u6709\u7EC4\u7EC7\u4EFB\u52A1",
  noRunsHint: "\u586B\u5199\u9700\u6C42\u540E\uFF0C\u7EC4\u7EC7\u4F1A\u4F9D\u6B21\u5B8C\u6210\u89C4\u5212\u3001\u5BA1\u8BAE\u548C\u6267\u884C\u3002",
  allSessions: "\u5168\u90E8\u4F1A\u8BDD",
  refresh: "\u5237\u65B0",
  loading: "\u6B63\u5728\u52A0\u8F7D\u7EC4\u7EC7\u2026",
  reload: "\u91CD\u65B0\u52A0\u8F7D",
  organization: "\u7EC4\u7EC7\u7ED3\u6784",
  workflow: "\u8FD0\u884C\u6D41\u7A0B",
  events: "\u6D3B\u52A8\u8BB0\u5F55",
  roles: "\u7EC4\u7EC7\u89D2\u8272",
  reportsTo: "\u4E0A\u7EA7",
  completed: "\u5DF2\u5B8C\u6210",
  current: "\u5F53\u524D\u4EFB\u52A1",
  noSelection: "\u9009\u62E9\u4E00\u4E2A\u8282\u70B9\uFF0C\u67E5\u770B\u804C\u8D23\u548C\u8FD0\u884C\u8BE6\u60C5",
  nodeDetails: "\u8282\u70B9\u8BE6\u60C5",
  roleDetails: "\u89D2\u8272\u8BE6\u60C5",
  instruction: "\u4EFB\u52A1\u804C\u8D23",
  runtime: "\u6267\u884C\u540E\u7AEF",
  preset: "\u89D2\u8272\u914D\u7F6E",
  dependencies: "\u524D\u7F6E\u4EFB\u52A1",
  noDependencies: "\u5165\u53E3\u4EFB\u52A1",
  attempt: "\u6267\u884C\u5C1D\u8BD5",
  noAttempts: "\u5C1A\u672A\u6267\u884C",
  output: "\u672C\u6B21\u4EA7\u51FA",
  artifacts: "\u7ED3\u6784\u5316\u4EA7\u7269",
  inputs: "\u8F93\u5165\u5FEB\u7167",
  reason: "\u539F\u56E0 / \u8BF4\u660E",
  review: "\u5BA1\u8BAE\u95E8\u7981",
  human: "\u4EBA\u5DE5\u6279\u51C6",
  decision: "\u5BA1\u8BAE\u7ED3\u8BBA",
  approve: "\u6279\u51C6\u6B64\u7248\u672C",
  approveCheck: "\u6211\u5DF2\u68C0\u67E5\u5F53\u524D\u7248\u672C\u7684\u65B9\u6848\u53CA\u4EA7\u7269",
  approvalNotice: "\u6279\u51C6\u4EC5\u9002\u7528\u4E8E\u5F53\u524D\u8F93\u5165\u7248\u672C\uFF1B\u6A21\u578B\u4E0D\u80FD\u4EE3\u66FF\u4F60\u70B9\u51FB\u6279\u51C6\u3002",
  retry: "\u91CD\u8BD5\u5931\u8D25\u8282\u70B9",
  retryReason: "\u8BF4\u660E\u5DF2\u4FEE\u590D\u7684\u95EE\u9898\u6216\u91CD\u8BD5\u539F\u56E0",
  retryLimit: "\u5BA1\u8BAE\u8FD4\u5DE5\u6B21\u6570\u5DF2\u7528\u5C3D\uFF0C\u8BF7\u68C0\u67E5\u65B9\u6848\u540E\u65B0\u5EFA\u4EFB\u52A1\u3002",
  unknown: "\u6267\u884C\u7ED3\u679C\u4E0D\u786E\u5B9A\u3002\u8BF7\u5148\u6838\u5BF9\u5E76\u505C\u6B62\u65E7\u6267\u884C\uFF0C\u518D\u901A\u8FC7\u7BA1\u7406 CLI \u5904\u7406\uFF1B\u8FD9\u91CC\u4E0D\u4F1A\u76F2\u76EE\u91CD\u8DD1\u3002",
  resume: "\u7EE7\u7EED\u6267\u884C",
  cancel: "\u53D6\u6D88\u4EFB\u52A1",
  cancelQuestion: "\u786E\u8BA4\u53D6\u6D88\u5F53\u524D\u4EFB\u52A1\uFF1F\u6B63\u5728\u8FD0\u884C\u7684 Agent \u5C06\u6536\u5230\u505C\u6B62\u8BF7\u6C42\u3002",
  confirmCancel: "\u786E\u8BA4\u53D6\u6D88",
  back: "\u8FD4\u56DE",
  close: "\u5173\u95ED",
  runId: "\u4EFB\u52A1 ID",
  copyId: "\u590D\u5236\u4EFB\u52A1 ID",
  copied: "\u5DF2\u590D\u5236",
  startedAt: "\u5F00\u59CB\u65F6\u95F4",
  elapsed: "\u8017\u65F6",
  unavailable: "\u6682\u4E0D\u53EF\u7528",
  emptyOutput: "\u5C1A\u65E0\u4EA7\u51FA",
  emptyEvents: "\u5C1A\u65E0\u6D3B\u52A8\u8BB0\u5F55",
  failedRequest: "\u64CD\u4F5C\u5931\u8D25",
  loadFailed: "\u65E0\u6CD5\u8FDE\u63A5\u7EC4\u7EC7\u670D\u52A1\u3002\u8BF7\u786E\u8BA4\u63D2\u4EF6\u5DF2\u66F4\u65B0\u5E76\u91CD\u542F DSH\u3002",
  roleHint: "\u89D2\u8272\u6309\u4EFB\u52A1\u542F\u52A8\uFF0C\u6267\u884C\u540E\u7AEF\u7531\u5BBF\u4E3B\u914D\u7F6E\uFF1B\u8FD9\u91CC\u5C55\u793A\u5F53\u524D\u5B9A\u4E49\u3002",
  readOnly: "\u7EC4\u7EC7\u5B9A\u4E49\u53EA\u8BFB",
  runningHint: "\u4EFB\u52A1\u5728\u540E\u53F0\u6267\u884C\uFF0C\u754C\u9762\u6BCF 2 \u79D2\u81EA\u52A8\u5237\u65B0\u3002",
  approveDecision: "\u901A\u8FC7",
  rejectDecision: "\u9A73\u56DE",
  stage: "\u9636\u6BB5",
  attemptId: "\u5C1D\u8BD5 ID",
  childSession: "\u6253\u5F00 Agent \u4F1A\u8BDD",
  missingProvider: "\u8BF7\u5148\u5728\u5BBF\u4E3B\u914D\u7F6E\u6240\u9700\u7684 Subagent \u540E\u7AEF\u3002",
  "status.pending": "\u5F85\u6267\u884C",
  "status.running": "\u8FD0\u884C\u4E2D",
  "status.waiting": "\u7B49\u5F85\u6279\u51C6",
  "status.succeeded": "\u5DF2\u5B8C\u6210",
  "status.failed": "\u5931\u8D25",
  "status.unknown": "\u7ED3\u679C\u4E0D\u786E\u5B9A",
  "status.cancelled": "\u5DF2\u53D6\u6D88",
  "status.cancelling": "\u6B63\u5728\u53D6\u6D88",
  "status.blocked": "\u5DF2\u963B\u65AD",
  "status.rejected": "\u5DF2\u9A73\u56DE",
  "event.run.created": "\u4EFB\u52A1\u5DF2\u521B\u5EFA",
  "event.task.started": "\u8282\u70B9\u5F00\u59CB\u6267\u884C",
  "event.task.succeeded": "\u8282\u70B9\u6267\u884C\u5B8C\u6210",
  "event.task.failed": "\u8282\u70B9\u6267\u884C\u5931\u8D25",
  "event.task.uncertain": "\u6267\u884C\u7ED3\u679C\u5F85\u6838\u5BF9",
  "event.task.cancelled": "\u8282\u70B9\u5DF2\u53D6\u6D88",
  "event.review.approved": "\u5BA1\u8BAE\u901A\u8FC7",
  "event.review.rejected": "\u5BA1\u8BAE\u9A73\u56DE",
  "event.approval.requested": "\u7B49\u5F85\u4EBA\u5DE5\u6279\u51C6",
  "event.approval.granted": "\u4EBA\u5DE5\u5DF2\u6279\u51C6",
  "event.task.retry-requested": "\u5DF2\u8BF7\u6C42\u91CD\u8BD5",
  "event.task.reconciled": "\u5DF2\u6838\u5BF9\u5F02\u5E38\u6267\u884C",
  "event.run.cancel-requested": "\u5DF2\u8BF7\u6C42\u53D6\u6D88\u4EFB\u52A1",
  "event.run.status-changed": "\u4EFB\u52A1\u72B6\u6001\u5DF2\u66F4\u65B0"
};
var en = {
  title: "Organization",
  subtitle: "Planning, review and execution in one place",
  sessionTab: "Organization",
  template: "Three provinces",
  newTask: "New task",
  start: "Start organization",
  starting: "Starting\u2026",
  requirement: "Requirement",
  requirementHint: "Describe the goal, scope and acceptance criteria for this project.",
  chooseSession: "Project session",
  selectSession: "Select an open project session",
  noSession: "Open a project session in DSH, then return here to start a task.",
  sessionUnavailable: "The owner session is not loaded. Open it before continuing execution.",
  openSession: "Open owner session",
  history: "Task history",
  noRuns: "No organization tasks yet",
  noRunsHint: "Enter a requirement to begin planning, review and execution.",
  allSessions: "All sessions",
  refresh: "Refresh",
  loading: "Loading organization\u2026",
  reload: "Reload",
  organization: "Organization",
  workflow: "Workflow",
  events: "Activity",
  roles: "Roles",
  reportsTo: "Reports to",
  completed: "Completed",
  current: "Current task",
  noSelection: "Select a node to inspect its responsibilities and execution",
  nodeDetails: "Node details",
  roleDetails: "Role details",
  instruction: "Responsibilities",
  runtime: "Runtime provider",
  preset: "Agent preset",
  dependencies: "Dependencies",
  noDependencies: "Entry task",
  attempt: "Attempts",
  noAttempts: "Not executed yet",
  output: "Output",
  artifacts: "Structured artifacts",
  inputs: "Input snapshot",
  reason: "Reason / notes",
  review: "Review gate",
  human: "Human approval",
  decision: "Review decision",
  approve: "Approve this version",
  approveCheck: "I have reviewed this version of the plan and artifacts",
  approvalNotice: "Approval applies only to this exact input version. The model cannot approve for you.",
  retry: "Retry failed node",
  retryReason: "Describe what was fixed or why a retry is appropriate",
  retryLimit: "Review rework budget exhausted. Inspect the plan and start a new task.",
  unknown: "Execution outcome is uncertain. Stop and check the old execution, then reconcile through the operator CLI. No automatic replay is allowed.",
  resume: "Continue",
  cancel: "Cancel task",
  cancelQuestion: "Cancel this task? Running Agents will receive a stop request.",
  confirmCancel: "Confirm cancellation",
  back: "Back",
  close: "Close",
  runId: "Task ID",
  copyId: "Copy task ID",
  copied: "Copied",
  startedAt: "Started",
  elapsed: "Elapsed",
  unavailable: "Unavailable",
  emptyOutput: "No output yet",
  emptyEvents: "No activity yet",
  failedRequest: "Operation failed",
  loadFailed: "Cannot connect to the organization service. Update the plugin and restart DSH.",
  roleHint: "Roles activate on demand. Runtime providers are configured by the Host; this view shows the current definition.",
  readOnly: "Read-only definition",
  runningHint: "Tasks run in the background. This view refreshes every 2 seconds.",
  approveDecision: "Approved",
  rejectDecision: "Rejected",
  stage: "Stage",
  attemptId: "Attempt ID",
  childSession: "Open Agent session",
  missingProvider: "Configure the required Subagent provider in the Host first.",
  "status.pending": "Pending",
  "status.running": "Running",
  "status.waiting": "Awaiting approval",
  "status.succeeded": "Completed",
  "status.failed": "Failed",
  "status.unknown": "Uncertain",
  "status.cancelled": "Cancelled",
  "status.cancelling": "Cancelling",
  "status.blocked": "Blocked",
  "status.rejected": "Rejected",
  "event.run.created": "Task created",
  "event.task.started": "Node started",
  "event.task.succeeded": "Node completed",
  "event.task.failed": "Node failed",
  "event.task.uncertain": "Execution needs reconciliation",
  "event.task.cancelled": "Node cancelled",
  "event.review.approved": "Review approved",
  "event.review.rejected": "Review rejected",
  "event.approval.requested": "Awaiting human approval",
  "event.approval.granted": "Human approval granted",
  "event.task.retry-requested": "Retry requested",
  "event.task.reconciled": "Uncertain execution reconciled",
  "event.run.cancel-requested": "Cancellation requested",
  "event.run.status-changed": "Task status updated"
};

// src/client/styles.css
var styles_default = '.org-workbench{--org-paper:var(--bg-primary,#faf8f4);--org-card:var(--bg-secondary,#fffefa);--org-ink:var(--text-primary,#382f27);--org-muted:var(--text-secondary,#887c6d);--org-line:var(--border-color,#e7e0d5);--org-gold:#967541;--org-soft:color-mix(in srgb,var(--org-gold) 9%,var(--org-paper));color:var(--org-ink);background:var(--org-paper);font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;min-height:100%;width:100%;overflow:auto;box-sizing:border-box}\n.org-workbench *{box-sizing:border-box}.org-workbench button,.org-workbench input,.org-workbench select,.org-workbench textarea{font:inherit}.org-workbench button{cursor:pointer}.org-workbench button:disabled{cursor:default;opacity:.45}.org-workbench button:focus-visible,.org-workbench textarea:focus-visible,.org-workbench select:focus-visible,.org-workbench input:focus-visible{outline:2px solid var(--org-gold);outline-offset:3px}.org-workbench h1,.org-workbench h2,.org-workbench h3,.org-workbench p{margin:0}.org-workbench h1{font-size:23px;letter-spacing:.04em;font-weight:650}.org-workbench h2{font-size:19px;font-weight:600;overflow-wrap:anywhere}.org-workbench h3{font-size:12px;font-weight:650;margin:24px 0 10px;color:var(--org-muted)}.org-muted,.org-footnote{color:var(--org-muted)}.org-mono,.org-workbench code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px}.org-header{padding:26px 30px;display:flex;justify-content:space-between;align-items:center;gap:16px;border-bottom:1px solid var(--org-line)}.org-brand{display:flex;align-items:center;gap:14px}.org-brand-icon{width:46px;height:46px;display:grid;place-items:center;background:var(--org-soft);border:1px solid var(--org-line);border-radius:12px;color:var(--org-gold)}.org-brand p{color:var(--org-muted);font-size:12px;margin-top:3px}.org-header-actions{display:flex;gap:10px;flex-shrink:0}.org-button{padding:8px 13px;background:var(--org-card);color:var(--org-ink);border:1px solid var(--org-line);border-radius:7px;font-size:12px!important;white-space:nowrap}.org-button:hover:not(:disabled){background:var(--org-soft);border-color:var(--org-gold)}.org-button--primary{background:#705438;border-color:#705438;color:#fff9ed}.org-button--primary:hover:not(:disabled){background:#59422d;color:#fff9ed}.org-button--quiet{background:transparent}.org-button--danger{color:#aa5141}.org-link{border:0;padding:2px 0;background:none;color:var(--org-gold);font-size:12px!important;text-decoration:underline;text-underline-offset:3px}.org-layout{display:grid;grid-template-columns:230px minmax(300px,1fr) 310px;min-height:640px}.org-history{padding:22px 14px;border-right:1px solid var(--org-line);background:var(--org-soft)}.org-section-label{display:flex;justify-content:space-between;align-items:center;padding:0 7px 16px;color:var(--org-muted);font-size:12px}.org-section-label span{font-family:monospace}.org-run-card{width:100%;padding:14px;margin-bottom:10px;text-align:left;background:transparent;border:1px solid transparent;border-radius:9px;color:var(--org-ink)}.org-run-card:hover{background:var(--org-card)}.org-run-card.is-selected{background:var(--org-card);border-color:var(--org-line);box-shadow:0 3px 12px #382f2706}.org-run-card>div:first-child{display:flex;align-items:center;justify-content:space-between;gap:5px}.org-run-card time{font-size:10px;color:var(--org-muted)}.org-run-card>strong{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:13px;font-weight:550;margin:11px 0 8px}.org-workspace-path{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--org-muted);font-size:10px}.org-run-bottom{display:flex;justify-content:space-between;margin-top:12px;font-size:11px;color:var(--org-muted)}.org-history-empty{padding:38px 12px;color:var(--org-muted);text-align:center}.org-history-empty svg{margin:0 auto 14px;opacity:.5}.org-history-empty strong{display:block;font-size:13px;font-weight:500}.org-history-empty p{margin-top:10px;font-size:12px}.org-main{min-width:0;padding:26px 26px 38px}.org-summary{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.org-summary h2{margin:7px 0;line-height:1.6;font-size:18px}.org-eyebrow{font-size:10px;color:var(--org-gold);letter-spacing:.12em;text-transform:uppercase}.org-run-id{color:var(--org-muted);font-size:10px!important;overflow-wrap:anywhere}.org-status{display:inline-flex;align-items:center;gap:5px;font-size:10px;white-space:nowrap;padding:3px 7px;border-radius:5px;background:var(--org-soft);color:var(--org-muted);font-weight:500}.org-status i{height:5px;width:5px;flex:0 0 5px;border-radius:50%;background:currentColor}.org-status--running{color:#88702f;background:#c6a95219}.org-status--succeeded{color:#497866;background:#608f7315}.org-status--waiting{color:#96713a;background:#c394491a}.org-status--failed,.org-status--blocked,.org-status--unknown,.org-status--rejected{color:#a95747;background:#b9624614}.org-status--cancelling{color:#96684a}.org-progress-row{display:flex;align-items:center;gap:12px;margin:20px 0 14px;font-size:10px;color:var(--org-muted)}.org-progress{height:4px;background:var(--org-line);flex:1;border-radius:4px;overflow:hidden}.org-progress>span{display:block;height:100%;background:var(--org-gold);transition:width .3s}.org-run-actions{display:flex;align-items:center;flex-wrap:wrap;gap:10px;font-size:11px;margin-bottom:14px}.org-run-actions>.org-muted{flex:1;min-width:180px;font-size:10px}.org-tabs{display:flex;gap:22px;align-items:center;border-bottom:1px solid var(--org-line);margin-top:25px;margin-bottom:22px}.org-tabs>button{padding:10px 0;color:var(--org-muted);background:transparent;border:0;border-bottom:2px solid transparent;font-size:12px}.org-tabs>button.is-active{color:var(--org-ink);border-bottom-color:var(--org-gold)}.org-tabs>span{margin-left:auto;color:var(--org-muted);font-size:10px}.org-chart{padding:10px 0}.org-tier{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;position:relative}.org-tier+.org-tier{padding-top:28px;margin-top:24px;border-top:1px solid var(--org-line)}.org-tier+.org-tier:before{content:"";position:absolute;left:50%;height:24px;top:-25px;border-left:1px solid var(--org-line)}.org-tier-parent{position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:var(--org-paper);padding:0 9px;font-size:9px;color:var(--org-muted);max-width:95%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.org-role{display:flex;flex-direction:column;align-items:center;gap:7px;flex:1 1 130px;max-width:220px;min-width:110px;padding:17px 10px;background:var(--org-card);border:1px solid var(--org-line);border-radius:9px;color:var(--org-ink);text-align:center}.org-role:hover,.org-node:hover{border-color:var(--org-gold);background:var(--org-soft)}.org-role.is-selected,.org-node.is-selected{border-color:var(--org-gold);box-shadow:0 0 0 1px var(--org-gold)}.org-role strong{font-size:12px;font-weight:550}.org-role-mark{display:grid;place-items:center;width:27px;height:27px;background:var(--org-soft);border-radius:50%;font-family:serif;font-size:14px;color:var(--org-gold)}.org-footnote{margin-top:24px!important;text-align:center;font-size:11px}.org-flow-layer{display:flex;gap:13px;position:relative;padding-bottom:23px}.org-flow-layer:not(:last-child):before{content:"";position:absolute;top:25px;bottom:0;left:13px;border-left:1px solid var(--org-line)}.org-layer-label{width:28px;flex:0 0 28px;display:flex;flex-direction:column;align-items:center;color:var(--org-muted);font-size:8px;padding-top:11px;position:relative;z-index:1}.org-layer-label>span:first-child{background:var(--org-paper);font:11px ui-monospace,monospace;padding:3px}.org-flow-nodes{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;flex:1;min-width:0}.org-node{padding:13px 14px;display:flex;flex-direction:column;align-items:flex-start;gap:8px;border:1px solid var(--org-line);border-radius:8px;background:var(--org-card);text-align:left;min-width:0;color:var(--org-ink)}.org-node strong{font-size:12px;font-weight:550}.org-node-top{display:flex;justify-content:space-between;align-items:center;width:100%;gap:8px;color:var(--org-muted)}.org-gate{font-size:9px;color:var(--org-gold);border:1px solid var(--org-line);padding:1px 4px;border-radius:3px}.org-clamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:11px;color:var(--org-muted)}.org-detail{padding:26px 22px;border-left:1px solid var(--org-line);min-width:0;background:var(--org-card)}.org-detail h2{font-size:19px;margin:6px 0}.org-detail-role{color:var(--org-muted);font-size:12px;margin-bottom:13px!important}.org-detail-empty{padding:100px 15px;text-align:center;color:var(--org-muted);font-size:12px}.org-detail-empty svg{opacity:.35;margin-bottom:18px}.org-fields{display:grid;grid-template-columns:75px 1fr;gap:12px 8px;font-size:11px;margin:22px 0}.org-fields dt{color:var(--org-muted)}.org-fields dd{margin:0;overflow-wrap:anywhere}.org-fields dd .org-link{margin-right:10px;font-size:10px!important}.org-instruction{font-size:11px;color:var(--org-muted);line-height:1.8;white-space:pre-wrap;overflow-wrap:anywhere}.org-output{font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.8}.org-json{margin:13px 0;font-size:11px}.org-json summary{color:var(--org-gold);cursor:pointer}.org-json pre{background:var(--org-soft);padding:12px;border-radius:6px;overflow:auto;max-height:300px;font:10px/1.7 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere}.org-attempt{border-top:1px solid var(--org-line);padding:12px 0}.org-attempt-top,.org-attempt-meta{display:flex;align-items:center;justify-content:space-between;gap:8px}.org-attempt-top b{font-size:11px;font-family:monospace;font-weight:500}.org-attempt-meta{margin:8px 0;color:var(--org-muted);font-size:10px}.org-attempt p{font-size:11px;overflow-wrap:anywhere}.org-error-text{color:#ac5949}.org-role-task{border:1px solid var(--org-line);background:var(--org-paper);color:var(--org-ink);border-radius:6px;padding:10px;margin-bottom:8px;width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px}.org-role-task strong{font-size:11px;font-weight:500}.org-activity{padding:0;list-style:none}.org-activity>li{display:grid;grid-template-columns:8px minmax(0,1fr) auto;gap:11px;padding:15px 0;border-bottom:1px solid var(--org-line);font-size:11px}.org-activity strong{font-weight:500}.org-event-dot{margin-top:6px;width:5px;height:5px;background:var(--org-gold);border-radius:50%}.org-event-node{color:var(--org-muted);margin-left:8px}.org-activity time{font-size:10px;color:var(--org-muted)}.org-activity p{margin-top:5px;color:var(--org-muted);overflow-wrap:anywhere}.org-event-state{margin-top:6px}.org-start-form{padding:22px 30px;border-bottom:1px solid var(--org-line);background:var(--org-card)}.org-form-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.org-form-top h2{font-size:16px}.org-form-layout{display:grid;grid-template-columns:minmax(220px,1fr) minmax(300px,2fr);gap:26px}.org-start-form label,.org-retry label{display:block;font-size:11px;color:var(--org-muted);margin-bottom:7px}.org-workbench select,.org-workbench textarea{width:100%;padding:10px 12px;border:1px solid var(--org-line);border-radius:6px;background:var(--org-paper);color:var(--org-ink);font-size:12px;resize:vertical}.org-fixed-session{font-size:12px;padding:10px;background:var(--org-soft);border-radius:6px;overflow-wrap:anywhere}.org-session-field p{font-size:11px;margin-top:12px}.org-requirement-field>.org-button{margin-top:10px;float:right}.org-retry>.org-button{margin-top:8px}.org-notice,.org-error,.org-confirm{padding:12px 15px;font-size:12px;border:1px solid var(--org-line);border-radius:6px;background:var(--org-soft);margin:14px 0}.org-notice--warning,.org-error{color:#995b39;border-color:#d8b89970;background:#c78a4910}.org-error{margin:16px 30px}.org-error span{display:block;margin-top:5px;overflow-wrap:anywhere;font-size:11px}.org-confirm{display:flex;align-items:center;flex-wrap:wrap;gap:9px}.org-confirm p{flex:1;min-width:200px}.org-approval{margin-top:20px;padding:14px;border:1px solid var(--org-gold);border-radius:7px;background:var(--org-soft)}.org-approval h3{margin-top:0}.org-approval p{font-size:11px}.org-digest{display:block;overflow-wrap:anywhere;margin:10px 0;color:var(--org-muted);font-size:9px!important}.org-checkbox{display:flex;align-items:flex-start;gap:7px;font-size:11px;margin:12px 0}.org-checkbox input{margin:3px 0;accent-color:var(--org-gold)}.org-loading{padding:60px;text-align:center;color:var(--org-muted);font-size:13px}.org-decision{padding:10px;background:var(--org-soft);border-radius:5px;font-size:11px;margin-top:12px!important}\n@media(max-width:1100px){.org-layout{grid-template-columns:205px minmax(0,1fr)}.org-detail{grid-column:2;border-top:1px solid var(--org-line);border-left:0}.org-detail-empty{padding:28px}.org-history{grid-row:span 2}.org-main{padding:22px}.org-form-layout{grid-template-columns:1fr 1.5fr}}\n@media(max-width:650px){.org-header{padding:18px 16px;align-items:flex-start}.org-brand-icon{display:none}.org-workbench h1{font-size:19px}.org-header-actions{gap:6px}.org-header-actions .org-button--quiet{display:none}.org-brand p{max-width:180px;font-size:10px}.org-layout{display:block}.org-history{border-right:0;border-bottom:1px solid var(--org-line);max-height:220px;overflow:auto;padding:14px}.org-history-empty{padding:15px}.org-history-empty svg{display:none}.org-run-card{padding:10px;margin-bottom:4px}.org-run-card>strong{margin:7px 0}.org-main,.org-detail{padding:20px 16px}.org-detail{border-left:0}.org-start-form{padding:20px 16px}.org-form-layout{display:block}.org-session-field{margin-bottom:16px}.org-tabs{gap:18px}.org-tabs>span{display:none}.org-role{flex-basis:110px}.org-flow-nodes{grid-template-columns:1fr}.org-error{margin:12px 16px}.org-activity time{font-size:9px}}\n';

// src/client/index.mjs
var inject = ["remote", "slots", "uiWorkspace", "locale"];
async function apply(ctx) {
  await ctx.remote.$mount(ORGANIZATION_REMOTE);
  const remote = ctx.get("remote.organization");
  const t = ctx.locale.bind(NS);
  ctx.effect(() => ctx.locale.register(NS, { zh, en }));
  ctx.effect(() => {
    const style = document.createElement("style");
    style.dataset.organization = "workbench";
    style.textContent = styles_default;
    document.head.appendChild(style);
    return () => style.remove();
  });
  const props = (sessionId) => ({
    remote,
    sessionId: sessionId || "",
    t,
    locale: ctx.locale.getSnapshot().active,
    uiWorkspace: ctx.get("uiWorkspace")
  });
  ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
    name: "sidebar.panellist",
    id: "organization",
    order: 61,
    locale: NS,
    label: () => t("title")
  }, OrganizationIcon));
  ctx.slots.inject("main", () => ctx.slots.register({
    name: "main",
    key: "organization",
    locale: NS,
    inject: () => props("")
  }, Workbench));
  ctx.slots.inject("conversation.view", () => ctx.slots.register({
    name: "conversation.view",
    id: "organization",
    order: 21,
    locale: NS,
    label: () => t("sessionTab"),
    inject: (sessionId) => props(sessionId)
  }, Workbench));
}
return module.exports;}});
