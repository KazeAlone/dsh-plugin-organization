# 配置与运行

## 宿主配置

配置位于 `organization-host` 插件行的 `config`。相对文件路径按 DSH 宿主进程的当前目录解释，建议使用绝对路径。

| 字段 | 默认值 | 用途 |
|---|---|---|
| `database` | `$DSH_HOME/organization/organization.sqlite`；未设置 DSH_HOME 时使用 `~/.dsh` | 本地 SQLite 文件 |
| `definitionFile` | 不设置 | 自定义组织/流程 JSON；提供后替代内置模板 |
| `provider` | `spawn` | 内置模板的默认 Subagent 后端名 |
| `runtimes` | `{}` | 内置模板各角色的 Runtime 覆盖配置 |
| `humanApproval` | `false` | 在门下审议后插入人工授权节点 |
| `concurrency` | `2` | 单 run 最大并行 Agent 数，1–32 |
| `pollMs` | `1000` | 宿主轮询间隔，100–60000 ms |
| `leaseMs` | `30000` | 执行租约时长，至少 100 ms |
| `heartbeatMs` | `5000` | 心跳间隔，必须大于 0 且小于租约一半 |
| `maxContextBytes` | `2000000` | 单任务上下文 JSON 字节上限；超出则阻断 |

Node 需 24.9+；SQLite 文件只放本机磁盘。不要把数据库放到跨主机共享目录来实现分布式调度。

## 角色 Runtime

每个角色的配置结构：

```json
{
  "provider": "engineering-dsh",
  "agentOptions": { "provider": "your-llm-provider", "model": "your-model-id" }
}
```

外层 `provider` 是 Subagent 后端名；`agentOptions.provider` 是 LLM 路由。不要混用。`agentPreset` 只应给支持它的后端，例如本地 spawn；DSH SDK / Codex 等后端不应配置未经支持的 preset。插件不会静默移除不支持的配置，宿主会拒绝相应启动。

完整独立 DSH 部门节点的推荐配置步骤：

1. 在 DSH 宿主挂载 `dsh-subagent-dsh-sdk` provider。
2. 通过该 provider 的配置指定独立 profile、patches、绝对 `dshHome` 和所需模型/凭据。
3. 各部门配置独立 providerName，再把 organization 的 `runtimes.<role>.provider` 指向该名称。
4. 为规划、审议、测试等角色配置适当的只读工具/沙箱限制；不要依靠 instruction 禁止写文件。
5. 子 profile 不应递归挂载本组织调度器。首版不支持组织内无限嵌套启动组织。

具体 DSH SDK 配置字段以所使用 DSH 版本的官方文档为准。本仓库没有复制宿主凭据或部署配置。

## 输出协议

普通 Agent 返回一个 JSON 对象：

```json
{"summary":"完成了什么","artifacts":{"changedFiles":["src/example.js"],"checks":[{"command":"npm test","exitCode":0}]}}
```

审议 Agent 必须增加三个字段：

```json
{"summary":"审议完成","decision":"approve","reason":"逐项检查通过","subjectDigest":"任务输入中给出的精确摘要"}
```

`decision` 只能是 `approve` 或 `reject`。插件检查 JSON、必要字段和版本绑定，但不会把模型声称的 `exitCode: 0` 当成宿主独立验证的证据。首版未提供任意输出 JSON Schema 或文件产物校验器。

## 人工批准

模型没有 `organization_approve` 工具。由能够访问本机数据库的操作员运行：

```sh
node scripts/control.mjs --database /absolute/path/organization.sqlite status RUN_ID
node scripts/control.mjs --database /absolute/path/organization.sqlite approve RUN_ID authorize INPUT_DIGEST "检查完成，批准此版"
```

身份记录为 `local:<操作系统用户名>`。这是本地文件访问权限下的管理接口，不是多用户认证系统。首版人工节点支持批准，不支持交互式驳回编辑；需要改变已经批准的需求时创建新 run，旧 run 定义和审批记录保留。

宿主会继续已加载主会话的可运行任务。若会话尚未加载，先在 DSH 中打开所属主会话，再执行 `organization_resume`。`resume` 不会替用户批准，也不会把失败或未知任务自动重跑。

## 异常恢复

`failed`：Runtime 已结算或输出格式不合格。修复环境或配置后，`retry RUN NODE REASON` 可创建新的尝试。运行中的定义是快照：修改全局配置不会改变已有 run；需要更换 run 内 Runtime 配置时应建立新 run。

`unknown`：旧执行租约过期或清理失败。先检查旧进程、工作区变更、外部系统操作，再停止旧执行。确认不会重复并发修改后：

```sh
node scripts/control.mjs recover RUN_ID
node scripts/control.mjs reconcile RUN_ID NODE_ID retry "旧进程已停止，已核对文件与外部系统"
```

`recover` 仅把已过期的 running 尝试标为 unknown；不会自动重跑，也不会终止进程。检查和停止旧进程是操作员的责任。陈旧完成结果会被任务令牌拒绝，但这不能阻止旧进程在文件系统继续写入。

取消：`organization_cancel` 或本地 `cancel RUN` 写入取消请求。宿主中的本地 Runtime 立即中止，其他执行宿主通过心跳确认请求。取消后若仍有未知执行：

```sh
node scripts/control.mjs reconcile RUN_ID NODE_ID stopped "已确认旧进程退出"
```

这时才释放该未知任务的资源占用。数据库关闭或插件卸载会等待本地子执行清理；如果某后端永不完成清理，操作可能持续等待，需要排查该后端。首版尚未提供进度护栏或强制杀进程策略。

## 状态、事件与未来 Studio

内核的 `store.events(runId, afterSeq)` 每次最多返回 1000 个事件，用最后一个 `seq` 继续读取。本地 `events` 命令显示第一页。状态 JSON 包含完整结果和尝试记录；不要向无权访问该工作区的人暴露该文件或接口。

未来 Studio 应使用经过认证的 RPC 层访问这些服务。本版没有注册 Typert RPC 描述符，没有浏览器入口，也不提供多租户访问控制。
