# 作品集模型工作台

## 2026-10-25 首屏与免体验码调整（本地已验证）

默认首页以 AIGC 创作智能体为主入口，提供聊天、图片生成和现有语音试听入口；MineFlow 下移为次要项目。作品集页手机首屏也优先显示智能体卡片。`?view=studio&model=gpt-image-2-c` 直接选择图片模型。

工作台移除手动输入体验码表单，读取服务端公开访问状态后自动申请独立签名会话。旧会话到期会重新连接；服务未就绪时明确提示，不伪装可用或引导输入体验码。保留原有按会话及全站的聊天/图片次数上限。语音入口仅试听已公开样本；旁白生成仍需本地 F5-TTS。

当前阻塞已现场确认：生产网关 `/api/models` 返回 `ready:false`、`publicAccess:false`，配置到期时间为 `2026-10-23T17:56:44Z`；本机保存的作品集专用凭据访问 `/v1/models` 返回 HTTP 401，其原关联任务查询返回 `invalid_cli_task`。这些结果不能用隐藏表单或修改日期修复。恢复公开真实调用需要有效的作品集专用凭据及其支持的接口，完成真实聊天/图片验收后再启用。不得抽取 Codex Provider/Tool Key 作为公网后端密钥，也不得通过循环创建短期任务续命。

本轮检查：`/AI-/` 生产构建通过；全套 `npm run test:deployment` 150 项通过；模型 Worker dry-run 通过。浏览器在 1440、768、390、360 四种宽度通过首页/作品集首屏入口、图片直达、自动访客会话、过期续连、服务不可用提示、聊天/图片模拟结果、历史记录和无横向溢出检查，页面报错为零。浏览器模拟接口用于验证访客流程，不等于真实模型调用。页面发布与模型调用恢复分别验收；在有效凭据恢复前，模型入口保持未就绪状态。

以下为此前接入记录，当前状态以本节实测为准。

入口：`https://sunset377.github.io/AI-/?view=studio`。工作台前端留在 GitHub Pages，后台运行于独立 Cloudflare Worker。聊天协议走中转站 `/v1/chat/completions`，图片走 `/api/v1/model-runtime/cli/generations`。不嵌入原站，不复制登录 Cookie，不读取上游私人会话。

## 目录与权限

### 2026-10-23 实际验收更正

两次用户授权的真实调用都被上游拒绝，余额保持 2.603534 算力，专用凭据下没有消费记录。不能宣称真实聊天、出图或扣款闭环已通过。

`key get` 已证实 CLI 的 `key create` 产生了带 `cli_binding.task_id` 的任务凭据，**不是不依赖任务的普通 API Key**。任务预算当前为 0；聊天接口返回 `cli_budget_authorization_required`，所需预授权为 34 micro-USD。图片 OpenAI 兼容接口返回 `cli_operation_not_supported`，需要改接 CLI 模型运行时协议，不能直接把 `/v1/images/generations` 当成可用接入。

通过本机 CLI 的离线接收器（假密钥、仅监听回环地址、不转发请求）核实了图片提交协议：`{ task_id, request_id, input: { model_id, modality, params } }`。正确格式在零预算下返回 `cli_budget_authorization_required`；同一 request ID 的恢复记录返回 `{ generation_id: "", request_id, state: "starting" }`。没有成品或生成编号，不可当作成功，也不得更换 UUID 重投。

后台现已改用该提交协议：初始回执和生成编号存入 D1；访客的“查看任务状态”只 GET 原 request/generation，不再 POST。临时查询失败保留原回执，内部生成编号不下发访客。最终图片输出结构仍需取得真实回执核实，当前对未确认的最终输出保守显示 `uncertain`，不会假报完成。预算错误与余额耗尽也已区分。平台仍要求账户本人网页确认任务预算。

当前 `RELAY_VERIFIED=0`，线上目录仍能浏览，但付费入口关闭。用户已明确授权一次简短聊天和一张 1K 图片的付费验收；平台预算确认尚未完成。核实最终回执并完成两次成功验收后才能向访客开放。

## 回退保障

完整 Git 历史与工作区源码快照保存在本机 `.backups/portfolio-2026-10-22T18-28-52-024Z/`。Git bundle 已校验，并克隆到该目录的 `restore-check/`；改造前 `3c6c907` 的 `src/App.jsx` 与原仓库逐字一致。271 份源码、配置和文档副本逐文件通过 SHA256 比对；未提交代码也在快照中。依赖、缓存、生成媒体与忽略的私密凭据保留原处，不重复归档或上传。

`scripts/backup-portfolio.mjs` 可重新生成独立快照。恢复时克隆 bundle 到新目录，或使用 working-source/ 副本；不要覆盖当前工作区。

`scripts/sync-model-catalog.mjs` 通过本机已授权的 `tokengo ... --agent codex` 读取聊天、图片、视频和音频目录，生成 `src/model-catalog.json`。目录可浏览不等于开放调用。

当前白名单：DeepSeek V4.1 Flash 聊天、GT Image 2 C 文生图。图片仅一张、1K 档、medium；禁止上传和外部参考图。视频、音频和其他模型由后台拒绝。MOMOCO 导演及白板工坊保留独立入口，未在此公共网关中代理其本机执行接口。

## 邀请体验

访客免注册，使用作者提供的 `?view=studio#experience=体验码` 链接；也可从 `?view=portfolio#experience=体验码` 进入作品集，再点击智能体。授权完成后地址栏移除体验码。直接打开公开入口可浏览目录，但调用需要体验码。

体验码和签名密钥仅保存在 Worker Secrets 与本机 DPAPI 加密的 `.local-audio/model-gateway-credential.json`。不得提交该文件或把体验码放进网页构建。运行 `node scripts/provision-model-gateway.mjs --invite` 读取当前邀请链接，只发给需要体验的人。

签名会话有效期 8 小时。同一会话每天最多聊天 6 次、图片 1 次；全站每天最多聊天 20 次、图片 3 次，按北京时间日期计数。上游拒绝或结果不确定的请求也占用一次体验次数，防止自动重试造成额外消费。

当前任务凭据到期时间为 `2026-10-23T17:56:44Z`（北京时间 10 月 24 日 01:56:44）；网关体验期限同步限制到该时刻，不再使用晚于凭据的日期。此凭据仅适用于短期验收，不是永久部署凭据。长期对外体验仍需平台支持的持久受限凭据，不能靠复制登录 Cookie、导出现有 Codex Provider Key 或循环建任务冒充长期接入。

专用任务 API Key 总额度为 100000 micro-USD（0.10 USD），但任务预算仍为 0，两者不是同一额度；不是每位访客额度。上游按调用前余额检查，一次实际消费可能超过剩余额度，不能把 Key 额度宣传为绝对结算上限。Key 无 video/audio 权限，并只允许两个指定模型。密钥的创建不扣生成费用。

## 任务与费用

每次调用先在 D1 原子写入 request ID、会话、请求摘要及当天额度，再发出上游请求。同一 ID 不重复提交；同一 ID 更改内容返回冲突。访客只能读取自己会话下的任务。调用超时或结果不明时保存 `uncertain`，只能查状态，不自动再次扣费。调用上下文不落库，但模型输出及任务状态会保存在网关数据库；浏览器历史仅保留本机最近 12 个会话，每会话最多 24 条消息。目录说明来自供应商，不是对原厂型号、成功率或所有模型实测结果的保证。

## 运维

使用项目安装的 Wrangler，不修改原面试后台或 Codex Provider。

```text
node scripts/sync-model-catalog.mjs
node --test test/model-gateway.test.js
npx wrangler deploy --config wrangler.models.jsonc --dry-run
npx wrangler d1 migrations apply portfolio-model-gateway --remote --config wrangler.models.jsonc
npx wrangler deploy --config wrangler.models.jsonc
node scripts/provision-model-gateway.mjs --install
npm run build -- --base=/AI-/
```

首次创建凭据需先建立专用 TokenGo account task，把其 UUID 设置为 `RELAY_SETUP_TASK_ID` 再运行 provisioning 脚本；Worker 的 `RELAY_TASK_ID` 必须与凭据绑定任务一致，体验到期不晚于任务到期。脚本会先自检 DPAPI，仅首次创建独立凭据，后续复用加密状态。首次配置中一枚未使用的临时凭据已撤销，当前凭据独立保存。任何不确定的创建或安装失败都应先查 key 元数据，不要循环创建。

本地界面验收：`npm run preview -- --port 5190 --base=/AI-/`，再运行 `node scripts/verify-model-workbench.mjs`。该脚本使用隔离浏览器和模拟接口，不发生模型消费，截图仅为本地验收产物，不发布到作品集。

本轮非付费检查：网关、首页及邀请相关 16 项测试通过，`/AI-/` 构建和 Wrangler dry-run 通过；线上目录返回 133 个模型、`ready:false`，付费入口 503。全站测试未通过：旧的默认首页、合作平台展示、历史人像展示 SSR 测试失败/超时；另一次限定运行证实 `interview-knowledge.test.js` 引用不存在的 `agentInterviewQuestionBank` 导出。此处未为通过旧断言而恢复已删除的个人信息或改写无关面试资料。

全站测试因旧 SSR 服务长期不退出而终止，未完成整套执行；已观察到的失败项如下，不代表仅有这些失败：

- `the default render makes the Agent workflow the primary destination while retaining interview access`
- `portfolio exposes the partnership product and the silent project preview`
- `portfolio route preserves the supplied artwork and offers a return to the new gateway`
- `resume fallback optimizes common interview questions without inventing facts`
- `static fallback keeps short follow-up questions connected to recent context`
- `static fallback prioritizes a new explicit question over older conversation topics`
- `interview-knowledge.test.js`：缺少 `agentInterviewQuestionBank` 导出，文件无法加载。
