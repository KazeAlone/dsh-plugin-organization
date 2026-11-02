# dsh-plugin-organization

基于 DeepSeek Harness 的可持久化 Agent 组织编排插件。首版实现运行内核、三省六部模板和 DSH 宿主工具，为后续 Organization Studio 提供基础。

**版本：0.1.0，实验性。当前没有可视化编辑器。** 模型能力、文件权限和真实交付质量仍取决于所配置的 DSH profile/preset；本插件不会把提示词当作沙箱权限。

## 已实现

- 独立的组织角色与声明式任务依赖；每次运行冻结完整定义和 SHA-256 摘要。
- 三省六部模板：中书规划、门下独立审议及有界驳回、尚书调度、六部专业任务、交付审议、总管汇报。
- 审议绑定精确产物版本；校验定义时拒绝自审、绕过门禁的依赖和组织/流程环。
- SQLite 事务写入状态与追加事件；任务令牌、租约、心跳和陈旧结果隔离。
- 并发控制及同工作区具名资源互斥；结果不确定的执行继续占用资源，防止盲目重跑。
- DSH `startActivation()` 适配、显式后端选择、caller delivery 和取消后清理。
- 四个模型工具；独立本地管理命令负责人工批准、失败重试和异常执行核对。

## 环境与安装

需要 Node.js **24.9+**，以及提供 `agents`、`subagents`、`tools`、`workingDirectory` 服务和 `startActivation()` API 的 DSH 宿主。适配代码对照 DSH 提交 `ce7073d51254c26cd63b22a60835b8f948deb447`；尚未在真实 DSH + 模型环境完成端到端验收。预稳定 API 升级后应重新验证，不声明覆盖所有 DSH 版本。

源码使用原生 ESM `.mjs`，无构建步骤，也无新增第三方运行依赖。`node:sqlite` 由 Node 提供，Cordis 由 DSH 宿主提供；直接执行内核测试不需要安装 Cordis。

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

在 DSH 中提出需求并要求通过 organization 执行，或调用 `organization_start`。任务在后台运行，`organization_status` 查看状态；`organization_cancel` 请求取消；`organization_resume` 恢复可运行任务。工具只允许精确的所属主会话 Agent 操作该 run。

默认模板没有额外人工批准点；门下省 Agent 审议是流程的一部分。设置 `humanApproval: true`，可在门下通过后增加总管的人工授权点。模型工具没有批准、重试、核对异常执行的接口。

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
npm run check
npm test
npm run demo
npm pack --dry-run
```

`demo` 使用模拟 Runtime，展示一次驳回后重新规划并完成六部任务，不调用模型、不修改业务项目。测试覆盖 SQLite 重启恢复、双连接抢占、人工批准、驳回预算、并发、取消清理、跨会话拒绝、DSH 协议适配及插件生命周期夹具。

## 当前边界

- 没有 Studio 画布、浏览器工作台或远程管理 API。
- 没有自动重试、token 计量、流式进度护栏或同 child 续跑；失败需要显式重试，便于首版控制副作用。
- SQLite 是同一主机本地存储；不支持跨机器共享数据库、远程 Agent 集群或多租户隔离。
- 阶段成功依赖结构化 Agent 结果；不会独立执行测试命令、验证所有产物文件或证明交付正确。
- 工作区资源锁仅协调本插件声明的任务；不能拦截人在外部修改文件，也不是操作系统沙箱。
- 租约只能隔离状态写入，不能停止失联进程的文件或网络副作用；`unknown` 必须人工核对。

详细模型与下一阶段路线见 [架构](docs/architecture.md)。本项目为独立实现，参考 TeamFlow 的设计经验；未复制其实现代码。
