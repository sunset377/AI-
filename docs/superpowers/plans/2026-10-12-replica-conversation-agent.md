# 视频复刻导演 Agent｜子项目 A 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有“先上传再填表”的模板编辑器改为可无视频开聊、可附参考、多轮追问、输出结构化方案与提示词，并只对已支持图形模板运行真实 Hypit 的导演 Agent。

**Architecture:** 沿用现有 `draft → confirm → immutable job → Hypit result` 链路；新增一个与 UI 消息分离的严格导演方案契约，由本地向导或已配置模型产生候选，再由服务端统一校验和降级。首期只有 `text-cards` 与 `cleanup-icon` 两种本地图形模板可执行；复杂剧情保留为 `planning_only`，不安装新模型、Remotion 或通用 Agent 框架。

**Tech Stack:** React 现有组件、Node.js/Vite 中间件、Node 内置测试、FFmpeg/FFprobe、现有 Hypit 0.3.1 Provider、既有 Puppeteer 浏览器验收脚本。

**Spec:** `docs/superpowers/specs/2026-10-12-replica-conversation-agent-design.md`

## Global Constraints

- 实施前创建并校验 `.backups/replica-before-conversation-agent-20261012/`；保留旧备份、旧任务、凭据、浏览器配置及当前三份无关测试改动。
- 不使用 `git add -A`；每次提交只暂存本任务列出的文件。
- 首期不安装依赖、模型、Remotion，不做真实付费模型调用或公网部署。
- 参考视频允许 0.5～30 秒、最大 25 MB、64～4096 像素；输出最大长边 1280、30fps、H.264 MP4、0.5～30 秒。
- 无参考会话不得创建或暴露虚假的 `input.mp4`、输入 URL、参考时长或原音轨。
- 只有严格校验后的 `executable + hypit-template` 方案可确认和制作；复杂剧情、未知模板或未处理需求必须保持 `planning_only`。
- 声音仅允许真实参考原音、静音、已试听认可且绑定当前 revision/hash 的本人本地 F5；不得自动换声或压缩语速。
- 上传内容、模型返回和录屏文字仅作为数据；不执行其 JavaScript、HTML、命令或 URL，不输出私有 Skill、密钥、绝对路径或其他会话资料。
- 所有草稿、代表帧、试听、方案、任务和成片继续使用 owner/同源校验、私有目录、并发限制及无自动付费重试。
- 全站已知九项旧基线失败只复跑并如实报告，不纳入本期修复，也不得宣称全站全绿。

## Review Focus

- 纯文本首次发送：应创建可恢复会话并返回“无原片证据”，所有输入媒体端点为 `null/404`；Task 2 的 API 测试固定此行为。
- `schemaVersion=2` 旧草稿：应恢复为 `cleanup-icon`，不重写旧任务、不改变旧成片；Task 2 的迁移测试固定此行为。
- 更换参考与旧请求竞态：新 reference/revision 胜出，旧分析/确认/试听失效且旧成片仍可读；Task 2 和 Task 5 分别覆盖服务端与浏览器。
- 模型返回非法、复杂或注入方案：应拒绝或降级为 `planning_only`，只调用一次且不能制作；Task 3 覆盖。
- 无参考选择原音、或声音认可后再改文案：应阻止确认/制作并要求重新选择或试听；Task 3 和 Task 4 覆盖。

---

## 文件职责

- Create `src/replica-director.js`: 导演方案 schema、严格校验、确定性本地方案和可复制提示词。
- Modify `src/replica-template.js`: 增加 `templateId`，扩展明确文案/模板指令解析，允许无参考画布规划。
- Modify `src/replica-template-visual.js`: 同一个安全 SVG 渲染入口按 `text-cards` / `cleanup-icon` 绘制。
- Modify `src/replica.js`, `server/replica-analysis.js`: 将参考输入上限一致扩展为 30 秒。
- Modify `server/replica-api.js`: 文本草稿、可选 reference、schema 迁移、方案版本/确认/独立任务。
- Modify `server/replica-chat.js`: 返回并校验结构化导演方案，不暴露私有上下文或隐藏思考。
- Modify `server/replica-render.js`: 无参考图形任务与有参考任务共用真实 Hypit 流水线。
- Modify `src/components/ReplicaWorkbench/TemplateEditor.jsx`: 单一主输入框、附件、对话、证据、方案、提示词和确认制作。
- Modify `src/components/ReplicaWorkbench/ReplicaWorkbench.jsx`: 无原片结果布局、导演入口文案和历史兼容。
- Modify `src/components/ReplicaWorkbench/ReplicaWorkbench.css`: 1440 三段布局、390 单列、固定 composer 与可访问状态。
- Modify `test/replica-template.test.js`, `test/replica-drafts.test.js`, `test/replica.test.js`: 契约、API、兼容与 SSR 回归。
- Modify `scripts/verify-replica.mjs`, `scripts/verify-replica-browser.mjs`: 两类真实 Hypit 任务及桌面/手机完整流程。
- Modify `docs/replica-workbench.md`, `docs/replica-acceptance-2026-10-10.md`: 实际能力、限制、证据和回退点。

### Task 1: 建立回退点、导演方案契约和两类安全图形模板

**Files:**
- Create: `src/replica-director.js`
- Modify: `src/replica-template.js`
- Modify: `src/replica-template-visual.js`
- Test: `test/replica-template.test.js`
- Backup: `.backups/replica-before-conversation-agent-20261012/`

**Interfaces:**
- Produces: `DIRECTOR_PLAN_VERSION = 1`。
- Produces: `validateDirectorPlan(value) -> DirectorPlan`，只接受固定键和来源 `observed | user | model | default`。
- Produces: `buildDirectorPlan({ requirements, reference, canvas, template, questions, blockers }) -> DirectorPlan`。
- Extends: `DEFAULT_TEMPLATE.templateId`，允许值仅 `text-cards | cleanup-icon`。
- Preserves: `validateTemplate`, `guideTemplate`, `planTemplate`, `renderTemplateSvg` 现有导出。

- [ ] **Step 1: 创建可恢复源码快照**

  复制本计划涉及的现有源码/测试/脚本/文档及三份用户未提交测试到 `.backups/replica-before-conversation-agent-20261012/snapshot/`；保存 `git status --short`、`git diff --binary`、实施开始时的 HEAD（其历史必须包含规格提交 `1b908f4` 和本计划提交）、逐文件 SHA-256 manifest 和 ZIP。明确排除 `.env*`、`node_modules`、`server/hypit/jobs`、`.codex-run`、媒体、凭据及旧备份。

- [ ] **Step 2: 校验快照**

  对 snapshot、manifest 和 ZIP 逐项复算哈希，并把精确恢复文件清单写入同目录 `回退说明.md`；Expected: 全部一致，工作树未因备份改变。

- [ ] **Step 3: 写失败的契约测试**

  在 `test/replica-template.test.js` 添加：严格拒绝额外键/断裂时间轴/路径或密钥文本；显式“标题：…/卖点：…/行动：…”进入 copy 而需求句不进入 copy；无文案或有未处理要求为 `planning_only`；三段镜头从 0 连续覆盖 duration；通用文字卡 SVG 不含清理图标，清理模板仍含图标；两者都转义标记并响应颜色/动效。

- [ ] **Step 4: 运行契约测试确认 RED**

  Run: `node --test test/replica-template.test.js`
  Expected: FAIL，缺少 `replica-director.js`、`templateId` 和通用文字卡分支。

- [ ] **Step 5: 实现最小方案契约**

  `buildDirectorPlan(...)` 固定输出：`schemaVersion, status, goal, requirements, reference, canvas, shots, assets, route, audio, prompt, questions, blockers`。已填文字按非空字段等分连续时间轴；`route.kind` 仅 `hypit-template | model-required`；存在 questions/blockers、未知模板或没有可制作文案时必须 `planning_only`。`prompt` 只由已校验字段生成。

- [ ] **Step 6: 扩展模板解析和共用 SVG**

  `guideTemplate()` 仅新增明确的文案标签与模板类型指令，不尝试本地创作剧情；`planTemplate()` 接受显式 `width/height` 且 `sourceDuration` 可空，但 `audioMode=original` 必须有真实参考音频；`renderTemplateSvg()` 依 `templateId` 绘制文字卡或清理图标，继续禁止外部资源和可执行标记。

- [ ] **Step 7: 运行测试确认 GREEN**

  Run: `node --test test/replica-template.test.js`
  Expected: 全部 PASS。

- [ ] **Step 8: 提交**

  ```bash
  git add src/replica-director.js src/replica-template.js src/replica-template-visual.js test/replica-template.test.js
  git commit -m "feat: define replica director plans"
  ```

### Task 2: 支持文本草稿、可选参考、30 秒输入和旧草稿迁移

**Files:**
- Modify: `src/replica.js`
- Modify: `server/replica-analysis.js`
- Modify: `server/replica-api.js`
- Test: `test/replica.test.js`
- Test: `test/replica-drafts.test.js`

**Interfaces:**
- Consumes: `DEFAULT_TEMPLATE`, `validateTemplate`, `buildDirectorPlan` from Task 1。
- Extends: `POST /api/replica/drafts` 接受 `application/json {}` 创建无参考草稿，原 multipart 上传保持兼容。
- Produces: `POST /api/replica/drafts/:id/reference` multipart 替换/添加参考。
- Produces: public draft fields `schemaVersion: 3`, `reference: null | {filename, metadata: null | ReferenceMetadata}`, `canvas`, `directorPlan`; `inputUrl` 无参考时为 `null`。

- [ ] **Step 1: 写失败的 API/迁移测试**

  添加以下断言：JSON 创建无参考草稿；`GET input` 为 404；无参考公开值不含伪 metadata；上传 30 秒边界通过、超过 30.05 秒拒绝；reference 替换递增 revision 并清空 analysis/confirm/voice/旧 plan；另一 owner 不能读取；重启加载 schema 2 时补 `cleanup-icon` 和 reference/canvas 但不修改旧 job 文件或结果。

- [ ] **Step 2: 运行测试确认 RED**

  Run: `node --test test/replica.test.js test/replica-drafts.test.js`
  Expected: FAIL，当前 POST 只接受 multipart、上限仍为 15 秒、无迁移/reference 路由。

- [ ] **Step 3: 实现草稿创建和持久化迁移**

  新草稿使用 schema 3，默认 `text-cards`、720×1280×30fps、reference null；只在 multipart 真有视频时写 `input.mp4`。读取 schema 2 草稿时内存迁移为明确的 `cleanup-icon`，不自动重跑或覆盖旧任务。

- [ ] **Step 4: 实现 reference 路由和安全媒体端点**

  保留 25 MB、扩展名、同源、owner、并发和原子写限制；完整接收后才替换当前 `input.mp4`。`input`/frames/analyze 在无 reference 时返回 404/409；替换 reference 使旧派生状态失效，不删除已独立保存的 jobs。

- [ ] **Step 5: 将输入时长统一为 30 秒**

  `REPLICA_LIMITS.seconds`、`planReplica()`、`analyzeReplica()`、错误文案及对应测试都使用 0.5～30 秒；保持 25 MB 和 64～4096 像素不变。

- [ ] **Step 6: 运行测试确认 GREEN**

  Run: `node --test test/replica.test.js test/replica-drafts.test.js`
  Expected: 全部 PASS，旧 `/jobs` 和旧 multipart 草稿路径仍通过。

- [ ] **Step 7: 提交**

  ```bash
  git add src/replica.js server/replica-analysis.js server/replica-api.js test/replica.test.js test/replica-drafts.test.js
  git commit -m "feat: allow optional replica references"
  ```

### Task 3: 让本地向导和已配置导演模型产出可校验方案

**Files:**
- Modify: `server/replica-chat.js`
- Modify: `server/replica-api.js`
- Test: `test/replica-drafts.test.js`

**Interfaces:**
- Consumes: `validateDirectorPlan`, `buildDirectorPlan` from Task 1。
- Extends: `chatReplica({ message, analysis, template, plan, history, images, consent }, config)`。
- Produces: chat result `{ reply, patch, questions, plan }`；`plan` 必须通过严格校验。
- Extends: `POST /drafts/:id/messages` 不再要求 analysis；仍接受 `{revision,message,mode,consent?}`。

- [ ] **Step 1: 写失败的对话/确认测试**

  覆盖：无参考本地首轮明确回复“依据描述，未分析原片”；明确文案形成 executable 方案；模糊颜色继续追问；复杂动作保留 requirements 并输出 model-required/planning_only；未处理问题不能确认；API 模型返回断裂镜头、额外字段、绝对路径、私有 Skill 文本或假 executable 路由均只调用一次并失败且不改旧方案；模型未就绪时本地模式仍可用。

- [ ] **Step 2: 运行测试确认 RED**

  Run: `node --test test/replica-drafts.test.js`
  Expected: FAIL，当前消息必须有 analysis 且模型没有 plan 契约。

- [ ] **Step 3: 实现本地方案更新**

  每轮先记录用户原文，再用 `guideTemplate()` 生成受支持 patch/questions/unhandled，最后用 `buildDirectorPlan()` 重建方案；来源分别标记 user/observed/default。需求、成片 copy、证据和问题保持分离；失败保留上一版模板和方案，无自动重试。

- [ ] **Step 4: 收紧模型输出**

  系统契约只允许 JSON `reply/patch/questions/plan`，不请求或返回隐藏思考；服务端在持久化前同时验证 patch 与完整 plan，并强制复杂/模型路线为 `planning_only`。代表帧只在 reference 已分析、视觉能力真实就绪且本轮明确同意时发送。

- [ ] **Step 5: 绑定 revision、确认和声音门禁**

  任意消息、模板、reference、路由、素材或声音变化递增 revision 并清除 `confirmedRevision/confirmedPlanHash`；confirm 只接受无问题、无 blocker、executable 的当前方案。无 reference 时 `audioMode=original` 返回 409；F5 仍需当前 revision/hash 的真实试听认可。

- [ ] **Step 6: 运行测试确认 GREEN**

  Run: `node --test test/replica-drafts.test.js`
  Expected: 全部 PASS；外发同意、单次调用、secret 隐藏和 F5 原回归继续通过。

- [ ] **Step 7: 提交**

  ```bash
  git add server/replica-chat.js server/replica-api.js test/replica-drafts.test.js
  git commit -m "feat: add validated director dialogue"
  ```

### Task 4: 让无参考文字卡和有参考清理模板都走真实 Hypit

**Files:**
- Modify: `server/replica-api.js`
- Modify: `server/replica-render.js`
- Test: `test/replica-template.test.js`
- Test: `test/replica-drafts.test.js`

**Interfaces:**
- Consumes: confirmed `directorPlan`, `template`, `canvas`, nullable `reference`。
- Produces: immutable template job fields `directorPlan`, `confirmedPlanHash`, `canvas`, `reference`；reference 为 null 时不复制 input。
- Extends: `renderTemplateReplica(job, directory, update)` 使用 `job.canvas` 与 `job.reference`，不再假设 `job.source/input.mp4` 必有。
- Preserves: `createTemplateSources(plan, template)` 与真实 Hypit check/plan/build/status/get/Runtime cleanup。

- [ ] **Step 1: 写失败的任务/渲染测试**

  添加：无参考 executable 方案可 render，job/inputUrl 为 null 且任务目录无 input；有参考清理模板保留私有 input；planning_only/错误 hash/旧 revision/原音无参考都 409；删除草稿后两个 job 仍可读；Runtime cleanup 完成前 job 不进入 terminal。

- [ ] **Step 2: 运行测试确认 RED**

  Run: `node --test test/replica-template.test.js test/replica-drafts.test.js`
  Expected: FAIL，当前 render 强制 analysis 并复制 input/source。

- [ ] **Step 3: 创建不可变任务**

  render 时重新验证方案并核对 `confirmedPlanHash`，复制当前 template/plan/canvas/reference metadata；仅有 reference 才复制 `input.mp4`，仅当前认可 F5 才复制 `voice.wav`。public job 的 `inputUrl` 与 reference 一致为 URL 或 null。

- [ ] **Step 4: 统一 Hypit 图形执行**

  `renderTemplateReplica()` 由 canvas/reference 规划尺寸和音轨；两个 templateId 仍调用同一受信任 Provider，保持无网络素材、30fps、≤1280、≤900 帧。结果继续验证尺寸、时长、音轨、完整解码并保存真实 buildId/review.json。

- [ ] **Step 5: 运行测试确认 GREEN**

  Run: `node --test test/replica-template.test.js test/replica-drafts.test.js`
  Expected: 全部 PASS。

- [ ] **Step 6: 提交**

  ```bash
  git add server/replica-api.js server/replica-render.js test/replica-template.test.js test/replica-drafts.test.js
  git commit -m "feat: render text-only replica plans"
  ```

### Task 5: 改造为单输入框导演工作台并兼容无原片结果

**Files:**
- Modify: `src/components/ReplicaWorkbench/TemplateEditor.jsx`
- Modify: `src/components/ReplicaWorkbench/ReplicaWorkbench.jsx`
- Modify: `src/components/ReplicaWorkbench/ReplicaWorkbench.css`
- Test: `test/replica-template.test.js`
- Test: `test/replica.test.js`

**Interfaces:**
- Consumes: Task 2/3/4 的 draft、directorPlan、nullable inputUrl、job。
- Preserves: `TemplateEditor({ health, requestApi, mediaUrl, onJob, jobBusy })` 调用签名。
- Produces: `submitTurn()` 完成“必要时建草稿 → 必要时上传/分析 reference → 发送当前消息”，并使用现有 generation token 忽略旧响应。

- [ ] **Step 1: 写失败的 SSR/UI 测试**

  断言默认出现一个始终可输入的“告诉导演你想做什么”主输入框、附件按钮、新会话/恢复、无参考说明、对话记录、问题卡、方案状态、证据来源、可复制提示词和确认制作；不出现访客 API key、自定义 URL、虚假价格或“已识别剧情”。结果页在 inputUrl null 时显示“本次无参考原片”，不渲染空 video。

- [ ] **Step 2: 运行测试确认 RED**

  Run: `node --test test/replica.test.js test/replica-template.test.js`
  Expected: FAIL，当前 textarea 依赖 analysis，结果页总渲染原片。

- [ ] **Step 3: 实现单 composer 流程**

  主输入框负责创意/剧情/修改指令；附件可选。首次发送无附件时创建 JSON 草稿后发消息；有附件时创建/替换 reference、等待真实 analyze 回到 idle，再发送同一轮消息。换片先确认替换或新会话，generation token/AbortController 防止旧响应污染。

- [ ] **Step 4: 实现对话、证据和方案卡**

  中央显示用户/本地向导/模型回复、问题和失败；右侧宽屏显示可折叠 evidence/当前 plan，窄屏进入消息流。方案卡显示状态、画布、逐镜时间、route/audio/blockers 和只读可复制 prompt；高级 template/F5 控件只修改明确字段并沿用保存/确认失效机制。

- [ ] **Step 5: 实现确认、制作和结果兼容**

  只有当前 executable 方案展示可用确认/制作；planning_only 明确提示需要素材或模型，不显示假完成。结果页有 reference 时并排，无 reference 时只显示成片；播放、下载、历史、新版本入口和旧原片剪辑 tab 保持可用。

- [ ] **Step 6: 完成响应式和可访问样式**

  1440 宽屏保留蓝紫视觉与左导航/中央会话/右方案；390 单列无横向溢出。固定 composer 不遮挡最后消息；按钮、附件、details、状态使用可聚焦控件、label、`aria-live` 与 reduced-motion 规则。

- [ ] **Step 7: 运行测试确认 GREEN**

  Run: `node --test test/replica.test.js test/replica-template.test.js`
  Expected: 全部 PASS。

- [ ] **Step 8: 提交**

  ```bash
  git add src/components/ReplicaWorkbench/TemplateEditor.jsx src/components/ReplicaWorkbench/ReplicaWorkbench.jsx src/components/ReplicaWorkbench/ReplicaWorkbench.css test/replica.test.js test/replica-template.test.js
  git commit -m "feat: build conversational replica workbench"
  ```

### Task 6: 真实双路径验收、浏览器回归和文档

**Files:**
- Modify: `scripts/verify-replica.mjs`
- Modify: `scripts/verify-replica-browser.mjs`
- Modify: `docs/replica-workbench.md`
- Modify: `docs/replica-acceptance-2026-10-10.md`

**Interfaces:**
- Consumes: 完整本地 API/UI/Hypit 流程。
- Produces: 仅使用脚本生成素材的两份真实 build/review/哈希证据；不使用用户录屏或其他本地媒体。

- [ ] **Step 1: 扩展真实验收脚本**

  `verify-replica.mjs` 增加明确模式：无参考 `text-cards + mute` 与合成参考 `cleanup-icon + original`。两者都断言真实 `bld_`、画布/时长/音轨、完整解码、指定颜色、文字像素和动效变化；无参考任务断言没有 input 文件。

- [ ] **Step 2: 扩展浏览器完整流程**

  `verify-replica-browser.mjs` 覆盖：无参考首轮/追问/方案/复制/确认/制作/完整播放/下载；有参考分析/替换竞态/清理模板/确认失效/制作；另一 browser context owner 隔离；1440×1000 与 390×844 无横向溢出、键盘发送/附件/方案可操作、无 pageerror。

- [ ] **Step 3: 运行专项测试和构建**

  Run: `npm.cmd run test:replica`
  Expected: 全部 PASS。

  Run: `npm.cmd run build -- --base=/AI-/`
  Expected: exit 0，无客户端 secret 或绝对私有路径进入 `dist`。

- [ ] **Step 4: 运行两个真实 Hypit 验收**

  Run: `$env:REPLICA_VERIFY_KIND='template'; $env:REPLICA_VERIFY_TEMPLATE='text-cards'; $env:REPLICA_VERIFY_REFERENCE='0'; $env:REPLICA_VERIFY_MUTE='1'; node scripts/verify-replica.mjs`

  Run: `$env:REPLICA_VERIFY_KIND='template'; $env:REPLICA_VERIFY_TEMPLATE='cleanup-icon'; $env:REPLICA_VERIFY_REFERENCE='1'; node scripts/verify-replica.mjs`

  Expected: 两次均 `status=complete`、真实 buildId、`decoded=true`；第二次有音轨，第一次没有输入媒体和音轨。

- [ ] **Step 5: 启动本机服务并运行浏览器验收**

  使用现有本机启动方式在空闲端口启动一次服务，设置 `HYPIT_DISTRIBUTION`、`REPLICA_QA_URL` 与仅脚本生成的 reference 路径，再运行 `node scripts/verify-replica-browser.mjs`。Expected: 两条流程完整播放、下载 200、owner 隔离 404、桌面/手机无溢出、浏览器错误数组为空；结束后只停止本次启动的进程。

- [ ] **Step 6: 复跑全站并记录已知基线**

  Run: `npm.cmd run test:deployment`
  Expected: 本期 Replica 测试全过；若仍是既有九项失败，逐项记录且不修复/不宣称全绿；出现新的 Replica 或构建失败则停止交付。

- [ ] **Step 7: 更新文档和回退证据**

  记录真实功能边界、API 契约、两个 buildId/输出哈希、浏览器截图目录、未运行的真实模型/F5、Hypit/F5 公网许可阻塞、5174 实际状态、备份 ZIP 哈希和精确回退文件；不包含密钥、用户录屏、私人 Skill 原文或绝对声音素材。

- [ ] **Step 8: 提交**

  ```bash
  git add scripts/verify-replica.mjs scripts/verify-replica-browser.mjs docs/replica-workbench.md docs/replica-acceptance-2026-10-10.md
  git commit -m "test: verify conversational replica workflow"
  ```

## 完成门禁

- 只有专项测试、构建、两条真实 Hypit 路径和浏览器完整流程都通过，才可称子项目 A 本机完成。
- 真实 DeepSeek/视觉、MiniMax、F5 新试听、公网托管和第三方试用均明确保持未运行；它们分别属于后续授权/预算/许可门禁。
- 分支完成后保留原目录和回退快照，不 merge、不 push、不部署，直到用户单独确认。
