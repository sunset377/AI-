# 作品集模型工作台

## 2026-10-26 普通 API Key 已上线（当前状态）

公开入口：`https://sunset377.github.io/AI-/?view=studio`。作者提供的普通 Key 已加密保存并部署，Worker 版本为 `c35471ec-46be-4bad-9f70-cf0675b4585b`。后台使用 `RELAY_PROTOCOL=api_key`，不再绑定 CLI 任务，也不再设置旧凭据的 18:24 到期时间；正式目录返回 `ready:true`、`publicAccess:true`、`expiresAt:null`。访客自动建立独立会话，无需体验码或注册。

聊天走 `/v1/chat/completions`；图片走 `/api/v1/model-runtime/invoke`，保存返回的 `task_id` 后只通过 `/v1/tasks/{task_id}` 查询原任务，不重复生成。普通 Key 最初仅有 `chat,image`，生成成功后实际任务查询返回 403；已补充 `tasks` 权限。虚构任务 ID 返回 404 不能证明实际任务查询权限可用。Key 原有 80 个模型、60 次/分钟及额度配置保持不变，未开放视频或音频生成。

从正式首页以全新手机尺寸访客会话完成真实调用：

- 聊天请求 `c44d4e8c-e620-40be-9a9a-957ad80778b8`：真实中文回答，账单 `success`，15 micro-USD。
- 图片请求 `f0ef95f8-f5c3-4880-b23a-9096ffdfc874`：账单 `success`，4972 micro-USD。补齐查询权限后恢复同一任务，手机与电脑页面实际显示 1024×1536 成图，无额外生成。
- 合计 4987 micro-USD（0.004987 USD），账户可用余额 4.295088 算力。155 项回归和 Worker dry-run 通过；浏览器无页面异常。仅实测上述两个模型，未测试真实微信设备。

验收回执：`.local-audio/live-permanent-acceptance-20261026.json`；截图：`live-permanent-chat-20261026.png`、`live-permanent-image-20261026.png`、`live-permanent-image-desktop-20261026.png`。当前加密凭据同步保存在 `model-gateway-credential-permanent.json` 和默认 `model-gateway-credential.json`；旧凭据另存 `model-gateway-credential-before-permanent-20261026.json`。这些私密文件均不入库、不发布；临时部署明文文件已清理。

本次维持原网站限制：同一会话每天聊天 6 次、图片 1 次；全站每天聊天 20 次、图片 3 次，按北京时间计数。实际可用性仍取决于账户余额、Key 状态及上游服务。以下记录为历史状态，不代表当前仍需导入 Key。

## 2026-10-26 16:23 公网连接修复与临时凭据验收记录

原 `workers.dev` 地址在当前网络出现连接超时，前端未设置超时且目录失败后没有可用重连入口。现由已有 Pages 网关 `https://ci-interview-gateway.pages.dev` 的 `MODEL_API` 服务绑定转发模型请求，保留 AI 面试服务绑定。网页已改用该入口，目录/访客连接最长等待 15 秒，失败后可重新连接；已提交的生成请求仅查询原任务，不自动重投。

前端提交 `deca3b6` 已发布至 GitHub Pages，Actions 运行 `40291198756` 成功；Pages 网关部署为 `7201dc83`。本地构建、151 项回归，以及 1440/768/390/360 宽度浏览器检查通过，包含断网、挂起连接超时和已有会话恢复。

北京时间 16:23，从正式网址首页进入工作台，以全新手机尺寸浏览器访问，无体验码完成两次真实调用：

- 聊天请求 `6f6283fd-c154-4ffd-8a35-bac350d6aca9`：返回真实中文回答，账单成功，15 micro-USD。
- 图片请求 `3dc72cb5-9965-446d-bc33-794a4758fc25`：最终 `complete`，浏览器成功加载 1024×1536 图片，账单成功，4972 micro-USD。
- 合计 4987 micro-USD；账户可用余额实测为 4.330994 算力。验收回执与截图保存在忽略目录 `.local-audio/live-guest-acceptance-20261026.json`、`live-guest-chat-20261026.png`、`live-guest-image-20261026.png`，会话令牌加密保存。尚未验证真实微信浏览器。

CLI 本机 Provider 和 Tool 连接均验证有效，无需重复接入。此次网页验收仍使用原专用任务凭据，**北京时间 2026-10-26 18:24:08 到期**；长期 Key 尚未成功导入。已从公开网页代码确认普通 Key 的管理入口为 `https://aigchub.token6688.com/zh-CN/console/keys`，页面标题与 HTTP 200 已验证。用户提供的一次性 CLI 接入命令未执行、未写入文件。Windows UI helper 不可用，启动 Chrome 自动化窗口及命令行打开标签页均被自动审批审核拒绝，未绕过限制。

当时待办已由本页首节完成：普通 Key 已提供、加密保存、部署，并验证真实聊天和图片查询交付；未通过延长本地配置日期冒充长期可用。

## 2026-10-25 真实聊天、图片恢复与余额提醒（最新实测）

公开工作台已恢复，`/api/models` 返回 `ready:true`、`publicAccess:true`。不带体验码的 `POST /api/sessions {}` 返回 200 和独立访客会话。网站继续使用作者账户支付，访客无需注册、输入验证码或 API Key；后台每日与每会话限额保留。

用户批准 100000 micro-USD 的本轮验收预算。通过生产 Cloudflare 网关分别只提交一次：

- DeepSeek V4.1 Flash：请求 `88f652b0-ee38-4e11-8051-f2ec2ca38ca8`，最终 `complete`，真实中文回答已返回，账单 success，22 micro-USD。
- GT Image 2 C：请求 `3764f83b-984f-4463-95ee-4a9139b49e8b`，1 张 1024×1024 / medium 图片，最终 `complete`，账单 success，4972 micro-USD；成品地址 HEAD 200、`image/jpeg`、157413 字节。
- 合计 4994 micro-USD（0.004994 USD）；账户余额由 4.402858 ⚡变为 4.366901 ⚡。账户余额与 USD 结算分开记录。

图片生成后最初被网关标为 uncertain，原因是新的真实交付域名为 `assets.token6688.com`，旧代码仅允许 `cdn.token6688.com`。已加入精确域名白名单并保留 HTTPS、无用户信息、无自定义端口检查；新增域名及伪造域名测试先复现失败再修复。只 GET 原任务恢复结果，没有重新提交生成。18 项网关、请求策略和验收保护测试通过。最终 Worker 版本：`e07ae4a0-5505-4f05-b446-f4f939ebf85b`。

专用凭据仅有 chat/image/models/tasks 权限，Key 总额度 100000 micro-USD、4 请求/分钟，不含视频音频权限。新任务为 `e0b97bd9-100c-4a78-a2c1-0bc5a6908907`，**北京时间 2026-10-26 18:24:08 到期**。这仍是短期恢复，不能称永久公网接入；之后必须使用平台提供的普通长期 API Key 及其正式协议，不能定时新建 CLI 任务续命。上游 Key 额度在调用前检查，不代表单次最终结算绝不会超出剩余额度。

旧加密凭据备份在 `.local-audio/model-gateway-credential-before-20261025-restore.json`；新凭据已激活至 `.local-audio/model-gateway-credential.json`。实际验收记录在 `.local-audio/model-paid-acceptance-20261025.json`，原始交付回执为同名 `.upstream.json`；全部不入库、不发布。管理脚本支持 `RELAY_CREDENTIAL_FILE` 和显式 `--create`；创建前记录操作，避免不确定响应重复创建。管理命令使用当前登录的 `tokengo.love`，旧 `aigchub.token6688.com` 管理会话无法访问新任务。

已创建 Codex heartbeat `automation-2`，每小时只读检查账户余额和网关状态，余额低于 1 ⚡、实际额度拒绝、凭据临近到期或服务失效时，邮件通知用户在本次聊天指定的 QQ 邮箱；同一持续问题 24 小时去重。通知由本机 Codex 执行，需要电脑联网且 Codex 可运行。测试邮件发送接口确认 SENT，邮件 ID `1a172a338446a990`；尚未核对 QQ 收件箱是否收到。

长期密钥的本机接收脚本为 `scripts/import-portfolio-api-key.ps1`：隐藏输入、Windows DPAPI 加密、不覆盖已有文件、不自动发布或调用模型。作者在 TokenGo 网页创建普通、不绑定 CLI 任务的专用 API Key 后，在 PowerShell 运行该脚本完成一次性导入，再核验权限和图片协议。此步骤只由作者完成，访客不需要任何验证码。长期凭据尚未提供，长期接入仍待完成。

下方为历史记录，状态以本节为准。

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
