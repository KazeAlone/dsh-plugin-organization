# dsh-plugin-organization

基于 DeepSeek Harness 的可持久化 Agent 组织编排插件，提供三省六部模板、DSH 宿主工具和可点击的组织工作台。

**版本：0.2.1，实验性。已有浏览器工作台，组织定义暂为只读展示。** 模型能力、文件权限和真实交付质量仍取决于所配置的 DSH profile/preset；本插件不会把提示词当作沙箱权限。

## 已实现

- 独立的组织角色与声明式任务依赖；每次运行冻结完整定义和 SHA-256 摘要。
- 三省六部模板：中书规划、门下独立审议及有界驳回、尚书调度、六部专业任务、交付审议、总管汇报。
- 审议绑定精确产物版本；校验定义时拒绝自审、绕过门禁的依赖和组织/流程环。
- SQLite 事务写入状态与追加事件；任务令牌、租约、心跳和陈旧结果隔离。
- 并发控制及同工作区具名资源互斥；结果不确定的执行继续占用资源，防止盲目重跑。
- DSH `startActivation()` 适配、显式后端选择、caller delivery 和取消后清理。
- 四个模型工具；独立本地管理命令负责人工批准、失败重试和异常执行核对。
- DSH 左侧栏“组织工作台”及会话内“组织”标签：启动任务、查看组织与流程、节点详情、事件、取消及失败重试。
- 宿主所有者专用的浏览器 RPC；人工批准按钮绑定当前输入版本，身份来自 Host 调用上下文，不接受客户端伪造身份。

## 环境与安装

需要 Node.js **24.9+**，以及提供 `agents`、`subagents`、`tools`、`workingDirectory` 服务和 `startActivation()` API 的 DSH 宿主。已在官方 DSH **0.2.1-rc.5** 验证本地安装及已认证 RPC；尚未完成真实模型任务的端到端验收。预稳定 API 升级后应重新验证，不声明覆盖所有 DSH 版本。

内核使用原生 ESM `.mjs`；浏览器 UI 使用 React，并通过 esbuild 生成 DSH 可加载的 `dist/client.js`。该产物随仓库和安装包提交，使用者安装时无需自行编译。`node:sqlite` 由 Node 提供，Cordis、Typert 和浏览器 React 由 DSH 宿主提供。

```sh
dsh plugin --profile web add github:KazeAlone/dsh-plugin-organization
# 或在本地仓库目录执行
dsh plugin --profile web add file:.
```

私有仓库安装需要本机拥有对应 GitHub 读取权限。安装后按 DSH 插件管理器提示重启宿主。安装包包含 `src/` 原生模块和 `cordis.patch.yml`。

启动配置中找到 `organization-host` 这一行，可配置：

```yaml
- id: organization-host
  name: dsh-plugin-organization
  config:
    provider: spawn
    concurrency: 2
    pollMs: 1000
    # database: /absolute/path/organization.sqlite
    # definitionFile: /absolute/path/organization.json
    # humanApproval: true
    # runtimes:
    #   planning: { provider: spawn, agentPreset: planner-readonly }
    #   engineering: { provider: engineering-dsh }
```

这段是已插入插件行的配置示例，不要重复添加同名服务。配置项详见 [配置与运行](docs/operations.md)。

## 使用

安装或更新插件后，**重启 DSH 并刷新浏览器页面**。现在有两处入口：

1. 左侧栏 **组织工作台**：查看所有组织任务，点击“新建任务”，选择一个已打开的主项目会话并填写需求。
2. 项目会话中的 **组织** 标签页：直接针对这个会话启动任务并查看运行情况。

工作台包含“组织结构”“运行流程”“活动记录”三个视图。点击角色查看 Runtime 与分配任务；点击流程节点查看职责、前置任务、产物、失败原因和每次执行尝试。任务在后台运行，界面每 2 秒自动刷新。

取消任务需要在界面再次确认；已知失败可以填写原因后重试；结果不确定的 `unknown` 节点仍需管理 CLI 核对，不提供盲目重跑按钮。启用 `humanApproval` 后，点击人工授权节点，检查产物、勾选确认后才能批准当前版本。

浏览器操作仅允许当前 DSH Host 的 owner；非 owner 的分享访问者不能使用这些 RPC。历史任务可直接查看；执行操作需要所属主会话已加载。

如果仍然没有入口，请检查安装版本是否为 `0.2.1`、安装与启动是否使用同一 `DSH_HOME` / profile，并确认启动日志没有 `organization-host` 加载失败。**0.2.0 中合法 owner 被误判为未授权的问题已在 0.2.1 修复**；遇到“无法连接组织服务”及 owner 身份错误时先更新。升级方法见 [配置与运行](docs/operations.md#更新到带界面的版本)。

### 模型工具

在 DSH 中提出需求并要求通过 organization 执行，或调用 `organization_start`。任务在后台运行，`organization_status` 查看状态；`organization_cancel` 请求取消；`organization_resume` 恢复可运行任务。工具只允许精确的所属主会话 Agent 操作该 run。

默认模板没有额外人工批准点；门下省 Agent 审议是流程的一部分。设置 `humanApproval: true`，可在门下通过后增加人工授权点，通过工作台或本地 CLI 批准。模型工具没有批准、重试、核对异常执行的接口。

本地管理命令（仓库内使用 `node scripts/control.mjs`；安装包提供 `dsh-organization`）：

```sh
node scripts/control.mjs list
node scripts/control.mjs status RUN_ID
node scripts/control.mjs events RUN_ID
node scripts/control.mjs approve RUN_ID authorize INPUT_DIGEST "已检查本版方案"
node scripts/control.mjs retry RUN_ID NODE_ID "已修复执行环境"
node scripts/control.mjs recover RUN_ID
node scripts/control.mjs reconcile RUN_ID NODE_ID retry "旧执行已停止，已核对文件及外部副作用"
```

`INPUT_DIGEST` 读取 `status` 中对应节点的 `approval.inputDigest`，不是 run 摘要。批准、重试后，宿主轮询会继续运行；所属会话必须仍已加载。也可以在所属会话调用 `organization_resume`。

## Runtime 选择

| 配置 | 运行方式 | 首版行为 |
|---|---|---|
| `spawn` | 同进程、独立 Session | 可指定已存在的 `agentPreset`；首版每次尝试新建 activation |
| 自定义 DSH SDK provider | 独立完整 DSH 子进程 | 在宿主挂载对应 provider，按 profile/patch 隔离角色组合 |
| `codex` / Claude Code provider | 真实外部 Agent | 通过宿主对应 provider 单次执行，需返回统一 JSON |

后端名必须与宿主注册名一致，缺失时报错，不回退到其他后端。不同角色需要不同 DSH profile 时，挂载多个具有不同 providerName/profile 的 DSH SDK provider，再在 `runtimes` 中逐角色选择。

**默认 `spawn` 并不代表每个部门都是独立 DSH 进程。** 完整 DSH 节点应选择 DSH SDK provider。首版尚未实现常驻部门 Worker、进程池或外部会话续聊。

## 本地验证

```sh
npm ci --legacy-peer-deps
npm run build
npm run check
npm test
npm run demo
npm pack --dry-run
```

`demo` 使用模拟 Runtime，展示一次驳回后重新规划并完成六部任务，不调用模型、不修改业务项目。测试覆盖 SQLite 重启恢复、双连接抢占、人工批准、驳回预算、并发、取消清理、跨会话拒绝、UI 权限、RPC、浏览器模块和插件生命周期夹具。

浏览器点击验证：先执行 `npx playwright install chromium`，再运行 `npm run test:browser`。它加载实际 `dist/client.js`，通过真实内核和模拟 Runtime 验证启动、批准、详情、取消、重试、中英文和窄窗口；不等同于真实 DSH + 模型端到端验收。截图输出到 `.cache/`。

可选真实宿主验证：把 `ORGANIZATION_DSH_CLI` 设置为官方 DSH 的 `lib/bin.js` 路径，再运行 `npm run test:host`。脚本创建隔离 home、安装本插件，通过官方启动凭据认证后检查 RPC，结束后停止宿主并删除测试 home；不调用模型，也不读取现有 DSH 数据。

## 当前边界

- 工作台支持运行与查看，尚不支持拖拽编辑角色、修改流程或保存组织模板。
- 没有自动重试、token 计量、流式进度护栏或同 child 续跑；失败需要显式重试，便于首版控制副作用。
- SQLite 是同一主机本地存储；不支持跨机器共享数据库、远程 Agent 集群或多租户隔离。
- 阶段成功依赖结构化 Agent 结果；不会独立执行测试命令、验证所有产物文件或证明交付正确。
- 工作区资源锁仅协调本插件声明的任务；不能拦截人在外部修改文件，也不是操作系统沙箱。
- 租约只能隔离状态写入，不能停止失联进程的文件或网络副作用；`unknown` 必须人工核对。

详细模型与下一阶段路线见 [架构](docs/architecture.md)。本项目为独立实现，参考 TeamFlow 的设计经验；未复制其实现代码。
