# 同页工作台整合｜2026-10-23

## 本次范围

用户确认将“大模型 / 智能体 / Skill 广场”合并到一个工作台，并在看过录屏后明确选择白底、浅灰边框、紫色强调。录屏仅本地抽帧分析，不复制原站源码、账号 Cookie、品牌素材或私人 Skill，不发布录屏与验收截图。

- 入口仍为 `https://sunset377.github.io/AI-/?view=studio`。
- 横向栏目切换左侧目录与右侧主区；不是外链、iframe 或整页跳转。
- MOMOCO 导演和 CS Board 二创白板智能体直接复用原功能组件，收起重复页头和深色导航。
- 导演保留对话、方案、剪辑、结果、记录与执行状态；白板保留音色、文案、画面风格、比例、成片设置与任务进度。
- 已打开的工具保持挂载；切换栏目不清空模型草稿、导演输入、白板文案与设置。白板交接给导演时才显式填入对应文案，不自动发送。
- 切换栏目或智能体时暂停已隐藏工具中的音视频，避免试听在后台继续播放；不删除草稿、不取消制作任务。
- Skill 广场提供三项实际工作流的搜索、分类、步骤、浏览器本地收藏和同页使用入口。不提供虚构的第三方市场、上传、发布或安装成功状态。
- 旧 `?view=replica` 与 `?view=whiteboard` 地址仍能打开对应工具，但使用同一工作台外壳。
- 修复白板内置预览图的 `/AI-/` 子目录路径，未替换或新增媒体素材。

## 不变的费用边界

本次不修改 `wrangler.models.jsonc`、凭据或模型白名单，不申请预算，不做真实生成验收。Skill 的“使用”仅打开操作区，不提交生成。已有本地 RAG 搜索属于只读检索，不是模型生成；测试对它返回固定的未就绪结果，其余外部写请求全部阻止。线上付费网关仍按原先未验收状态关闭。界面统一不等于 DeepSeek / MiniMax 或本地 F5 / Hypit 服务已在线。

## 回退

改动前提交：`12782f1540eb371f24c6de625da40f70912e824c`，保留本机分支 `codex/studio-before-unification-20261023`。原完整 Git bundle 和 271 份源码快照仍在 `.backups/portfolio-2026-10-22T18-28-52-024Z/`。本次没有 reset、clean 或覆盖无关的未提交文件。

## 验证

- `npm run build -- --base=/AI-/`：通过。
- `node --test test/studio-unified.test.js test/model-gateway.test.js test/portfolio-homepage.test.js test/replica.test.js test/replica-template.test.js`：34 项通过。
- `node scripts/verify-unified-studio.mjs`：1440×960 与 390×844 浏览器交互通过。覆盖同一 URL、三处草稿保留、白板比例保留、文案交接、三项 Skill 打开实际工具、搜索收藏、12 张风格预览、键盘栏目导航和无横向溢出。另用内存中生成的静音 WAV 验证切换栏目/智能体会暂停隐藏音频。使用模拟接口，不发生模型消费。
- 原 `verify-model-workbench.mjs`：模型切换、图片参数、视频锁定、邀请、模拟聊天、历史记录和手机适配仍通过。
- 部署检查的 12 项资源与 MineFlow 测试、27 项面试/分镜后台检查及 4 项流式客户端检查通过。
- SSR 展示测试现使用无执行插件、无目录监听的轻量服务，避免页面断言启动本机视频执行器。恢复 npm 测试命令的参数转发，部署工作流可以只运行指定的检查；没有以全套测试通过为名绕过旧失败。

全站 `npm run test:deployment -- test/*.test.js` 完整执行：139 项，131 通过，8 失败。未为通过旧断言恢复已移除的人像、文案或个人资料。仍失败的既有测试：

1. `the default render makes the Agent workflow the primary destination while retaining interview access`
2. `portfolio exposes the partnership product and the silent project preview`
3. `portfolio route preserves the supplied artwork and offers a return to the new gateway`
4. `resume fallback optimizes common interview questions without inventing facts`
5. `static fallback keeps short follow-up questions connected to recent context`
6. `static fallback prioritizes a new explicit question over older conversation topics`
7. `interview view explains the AI identity and offers starter questions`
8. `interview-knowledge.test.js`：引用不存在的 `agentInterviewQuestionBank` 导出。

因此本次只声称同页 UI 与所列交互完成验证，不声称全站测试全绿或真实付费生成已验收。

## 后续排错与归属校正

统一页面版本 `55db9c6` 的 GitHub Pages 发布已成功，运行记录：`https://github.com/sunset377/AI-/actions/runs/39902128235`。正式域名的电脑/手机交互也通过模拟接口验证，付费调用为零。

后续复现上述 8 项旧失败后：

- 校正入口、当前主图、筛选和推荐问题的旧断言，不恢复已删除的个人介绍与旧页面。
- 知识库测试改用当前资料结构与 `broadTopics`，不为测试恢复未被应用消费的旧问答库。
- 删除没有任何生产调用方的 `src/interview/fallback.js` 及其三项旧演示测试。该模块存在虚构平台分工等不实答案；实时面试依旧只能返回服务端真实流，失败报错、不生成本地替代答案，相关网络失败/取消/中断检查保留。
- 按用户明确说明，AIGC Hub 为他人开发、本人作为客户充值使用的第三方服务。修正作品集卡片、时间线、知识库及面试提示中的错误归属，入口改为自己的工作台，不再要求访客注册原站。个人工作台集成与原平台开发分开表述。
- 修改前另存本机分支 `codex/studio-before-evidence-fix-20261023`（`55db9c6`）；删除的历史演示代码可由 Git 恢复，无关未跟踪文件未改动。

归属校正后的首轮本机验证：`npm run build -- --base=/AI-/` 成功；`npm run test:deployment -- test/*.test.js` 为 138 通过、0 失败、0 跳过。项目总测试数变化来自删除三项孤立演示测试，以及将原先无法导入的知识库文件恢复为三项实际边界检查，不是跳过失败。GitHub Pages 工作流也改为执行全套检查（Linux 上仅 Windows 专用进程测试按原约定跳过）。

审查另发现 `portfolio-invite.test.js` 原先直接读取未跟踪的本机音色库。现将 API/音色根目录和配额文件路径通过启动参数传入，生产默认目录不变；集成测试使用临时目录中的两条公开合成条目与一条私有条目，断言只返回两条公开项且不泄露路径。任务与审计目录也隔离，不接触本机在制任务；测试不包含任何真实音频、不调用 F5。浏览器脚本补充作品集服务卡片进入工作台的同标签页检查。

真实付费验收、扣费证据和执行服务可用性仍未由这些测试证明，模型网关继续保持未验收关闭状态。

首次全套 Linux CI（`39904125955`）检测到原审计日志的异步落盘竞态：`append()` 在写文件之前返回，重建日志实例时可能少读条目。现共享首次初始化 Promise，并等待各条追加写入完成后返回（保留磁盘异常不阻塞工作台的原策略）；新增 20 条并发冷启动回归，用返回记录 ID 对比落盘和重载结果。旧实现已在本机复现失败。原 API 对话测试也改为等待模拟提供方实际进入处理后再释放失败，不假定 HTTP 202 返回就意味着异步提供方已被调用。

竞态修复后本机全套 139 项通过、0 失败。面试服务 `ci-interview-api` 已部署归属修正，版本 `b0ae81c0-9aa4-4eee-967f-405fb1f3b446`，原版本 `b2e3d362-9ddb-4d0a-b266-87284d203c3b` 保留可回退。部署使用原配置及 `--keep-vars`，没有替换密钥或增加预算；临时使用 IPv4 DNS 顺序解决本机部署连接超时，未修改全局网络配置。实际 Pages 服务代理跨域预检返回 204，无效空请求在调用提供方前返回 400；未进行真实模型生成验收。
