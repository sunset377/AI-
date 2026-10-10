# Replica Template Dialogue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 保留旧工作台，新增可确认的分析与修改对话，通过本地 Hypit 重建纯色背景、大字、图标动效模板，产出真实 MP4。

**Architecture:** 复用现有会话、私有文件、串行任务队列与下载接口，新增草稿类型；确认草稿的不可变副本创建模板任务。纯配置模块共享于预览与制作，本地向导与可选模型只提议配置，不获得执行工具权限。本人 F5-TTS 试听为可选能力，缺失时保留/静音路径正常工作。

**Tech Stack:** 现有 React/Vite、Node 24、Hypit 0.3.1、FFmpeg/ffprobe 8.1、已安装 Puppeteer/Chrome；不新增 npm 包或下载第三方模型。

**Spec:** [已确认设计](../specs/2026-10-10-replica-template-dialogue-design.md)

## Global Constraints

- 保持当前工作台的蓝紫配色、侧栏及左右工作区；现有剪辑选项、历史记录、5174 端口、桌面快捷方式和线上作品集不变。
- 默认不调用视频生成 API；修改需求与成片文案必须分开。零模型调用费只适用于本地向导，不用于已配置的分析 API。
- 首阶段不交付任意视频自动恢复源工程、OCR/ASR、复杂真人生成、访客凭据托管、完整 OpenClaw、公网部署或支付。
- 上传保持 0.5～15 秒、25 MB；最大 1280 像素长边，30 fps、H.264 MP4；新模板及旁白最长 30 秒。
- 每会话最多一个耗时操作，全局最多三个待处理操作，串行执行；草稿最多 10 个/会话、50 个全局。
- 仅使用用户指定的本地 F5-TTS 和对应参考音频及准确转写；speed=1、nfe_step=32；不替换声线、不加速压时长，新语气先试听认可。
- 参考、转写、复刻音轨保持本地；默认文字/图像 API 不接收音色参考。权重商业许可当前为 pending_verification，不能宣称可商用。
- 私有数据继续位于 server/hypit/jobs/；密钥只在服务端环境，来源、owner 和输入校验不削弱。
- 保留未提交用户修改，不重置、不顺带修首页/面试测试；默认主代理在当前会话依次执行，不另开用户线程。

## Review Focus

1. 在原片尚在上传/分析时换片：旧异步结果不得回填新原片，Task 6 浏览器测试覆盖。
2. 一个草稿生成两版后删除草稿：两版必须仍能独立播放下载，Task 2 API 测试覆盖。
3. 模型超时后用户再次点击发送：不重放收费请求、同一会话不并发，Task 4 mock 测试覆盖。
4. 宽屏、旋转元数据、超长中文和特殊字符：保持显示比例、不出界、不执行标记，Task 3/7 覆盖。
5. 旁白比参考长或改文案后旧试听仍在：不压速且旧认可失效，Task 5/6 覆盖。

## 回退点与文件职责

实施前的完整源码回退点：`E:/C盘迁移/辞的个人作品集网站/.backups/replica-before-template-20261010-195705/`。52 个文件及 ZIP 逐文件 SHA-256 校验已通过；manifest.json、snapshot/、source-snapshot.zip、回退说明.md 均已保存。现有媒体、任务和密钥保留原位；回退不得删除它们。

| 文件 | 职责 |
| --- | --- |
| 新 src/replica-template.js | 模板校验、时序及本地需求向导 |
| 新 src/replica-template-visual.js | 确定性图形状态及安全 SVG；前端/组件共同使用 |
| 改 server/replica-api.js | 现有认证、队列、文件读取；增加草稿生命周期，不另建框架 |
| 新 server/replica-analysis.js | 探测、受限帧提取、背景和画面变化测量 |
| 新 server/replica-chat.js | 一个已配置聊天接口、每轮授权及返回校验 |
| 新 server/replica-voice.js | F5 就绪、分段情绪试听、自然语速的真实时长 |
| 改 server/replica-render.js | 模板任务分支及独立 Hypit 结果校验，原剪辑分支不变 |
| 新 server/hypit/packages/replica-template/ | 自有 Hypit Surface/Producer 注册及共享图形实现，无示例媒体 |
| 改 ReplicaWorkbench.jsx/CSS；新同目录 TemplateEditor.jsx | 草稿界面与共享图形预览，旧剪辑表单保留为模式 |
| 新 test/replica-template.test.js、test/replica-drafts.test.js | 纯逻辑/API/mock/SSR 契约；原 test/replica.test.js 保留 |
| 改验证脚本、文档及 package.json | 合成夹具、真实输出、浏览器验收、配置与回退说明 |

所有任务完成一步更新本计划复选框。提交只能包含本任务明确文件；重叠的用户已有修改需先核对，不以 git add . 提交整个脏工作区。

### Task 1: 模板配置与本地修改向导

**Files:** Create src/replica-template.js、test/replica-template.test.js；Modify package.json 的 test:replica 增加新专项测试文件。

**Interfaces:** `validateTemplate(value) -> Template`；`planTemplate(template,{width,height,sourceDuration,voiceCues?}) -> TemplatePlan`；`guideTemplate(message,template,{pendingQuestion?}) -> {patch,questions,unhandled}`。Template 的字段为 background、title、benefit、action、titleColor、benefitColor、actionColor、textMotion(none/fade/bounce)、ringMotion(none/rotate)、opening(simultaneous/staged)、duration、audioMode(original/mute/voice)、narration。TemplatePlan 返回 kind:'template'、width、height、duration、fps:30、events、audioMode；不返回剪辑 segments。

- [x] **Step 1: 编写失败测试**：合法六位颜色规范化；标题/利益点/行动各最多 40 字，旁白最多 300 字，需求最多 2000 字；拒绝 NaN、Infinity、非法动效、未知字段、duration 超出 0.5～30 秒。例：`assert.throws(() => validateTemplate({...valid,textMotion:'execute'}))`；`assert.equal(guideTemplate('背景改成绿色',valid).patch.background,'#22c55e')`；“字改黄色”返回字段对象追问，不修改文案。
- [x] **Step 2: 跑红测试**：`node --test test/replica-template.test.js`，预期新增接口未实现失败。
- [x] **Step 3: 实现纯逻辑**：中文颜色词仅列出可识别颜色并显示实际 hex；未知意图进 unhandled，不忽略。事件使用绝对秒，staged 与 simultaneous 明确区分；voiceCues 存在时以真实声音时长定时，不套均分字幕。
- [x] **Step 4: 跑专项测试**：`npm run test:replica`，旧 5 项及新逻辑测试全部通过。
- [x] **Step 5: 记录本任务差异并仅提交本任务文件**，消息 `feat: define editable replica template contract`。

### Task 2: 草稿、证据与安全生命周期

**Files:** Modify server/replica-api.js；Create server/replica-analysis.js、test/replica-drafts.test.js。

**Interfaces:** `analyzeReplica(inputPath,directory,update) -> Analysis`；Analysis 为 metadata、frames([{id,at}])、background({color,coverage,stable})、changes、supported、unknowns。私有草稿 schemaVersion:2/kind:'draft'，保存 revision、confirmedRevision、analysis、template、messages、pendingQuestion、voicePreview；旧 job.json 无 kind 视为剪辑任务。

**Routes:** POST /drafts multipart 创建；GET /drafts 及 /drafts/:id 读取；PATCH /drafts/:id 用 {revision,template} 更新；POST /drafts/:id/analyze；GET /drafts/:id/frames/:index；POST /drafts/:id/confirm 用 {revision}；POST /drafts/:id/render 用 {revision}；DELETE /drafts/:id。均在 /api/replica 下。任务创建复制输入与确认快照到新 UUID 目录；草稿 ID 不作运行任务 ID。

- [x] **Step 1: 编写失败 API 测试**：两会话互相返回 404、跨源 403、非法体 400、过期 revision 409、未确认 render 409、忙碌 429；草稿计数限制、旧任务加载、重启时仅 running 操作中断。生成两版后删草稿，两个输入/result Range 仍 206。
- [x] **Step 2: 跑红测试**：`node --test test/replica-drafts.test.js`，预期新增端点尚不存在失败；调用分析和渲染均注入 mock，不运行收费或真实模型。
- [x] **Step 3: 实现草稿与队列**：复用 owner、multipart 上限和 persist 原子写法，定义只读 publicDraft，不返回 owner/路径；每次编辑 revision+1 并清除确认及相关试听认可。修改/删除遇忙碌返回 409；慢操作 POST 返回 202，GET 草稿给出真实状态。
- [x] **Step 4: 实现本地分析**：复用 runTool/runHypit；先 probe，再在 0、20%、40%、60%、80%、接近末尾共 6 点提取帧，同时采样低分辨率 RGB。边框像素最多量化为每通道 16 档，主色覆盖 >=80% 且各样本色差 <=30/255 才作为“稳定纯色候选”。不得把直方图与差异评分称为文字/语音/镜头语义识别。应用视频旋转元数据；输出带实际 at 的私有 PNG。
- [x] **Step 5: 跑测试**：`npm run test:replica`，所有新增安全/兼容用例通过；合成非纯色图在证据报告中 supported=false，允许用户纠正模板选择但不改写测量事实。
- [x] **Step 6: 仅提交本任务差异**，消息 `feat: add private replica drafts and evidence analysis`。

### Task 3: 真正的 Hypit 模板及共享预览图形

**Files:** Create src/replica-template-visual.js；Create server/hypit/packages/replica-template/package.json、src/index.js、src/activation.js；Modify server/replica-render.js、test/replica-template.test.js。

**Interfaces:** `renderTemplateSvg(plan,template,at) -> string` 是数据驱动图形表达，文本逐字转义，矢量垃圾桶与光环为自绘；`createTemplateSources(plan,template) -> {author,run}`；`renderTemplateReplica(job,directory,update) -> void` 遵循旧 renderReplica 生命周期，job.kind='template'。组件注册逻辑模块 @portfolio/replica-template@1、Surface Template；生产、预览用相同图形状态，不接受用户自定义 JS/SVML。

- [x] **Step 1: 编写失败测试**：SVG 背景绿色、独立文字黄色、尖括号/引号转义、不同时间旋转/弹跳状态不同、无动效状态相同；横竖布局不越界。例：`assert.match(renderTemplateSvg(plan,green,0),/#22c55e/)`；恶意 `<script>` 不出现在实际元素中。
- [x] **Step 2: 跑红测试**：`node --test test/replica-template.test.js`，预期缺少图形/生产接口失败。
- [x] **Step 3: 对照已安装 Hypit 0.3.1 author-package 公共 SDK 实现组件**：仅复用例子的接口与注册机制，不复制示例人像/媒体。项目局部 package 通过公开包加载机制注册；优先普通 JS 无编译、复用已安装 Distribution 依赖。读取已安装 composition/visual vocabulary，固定 renderer 支持的视觉形状并实现可检查的 Surface。先 check/plan，再真实 build/get，保存 buildId 和 Source/Run/Result。
- [x] **Step 4: 接入 renderReplica 模板分支**：新版本独立 Runtime，适配 original/mute 音轨，模板音轨不 Retime；输出 30fps/最长边<=1280/H.264，完整 probe 与解码。非 30fps 输入不改变源时长；选择保留原音轨且目标更长时明确补静音，不循环或伸缩声音。
- [x] **Step 5: 验证**：`npm run test:replica`；后续 Task 7 的真实模板执行必须看到 bld_ 及图形改变。若 SDK/Renderer 未能产出真实模板，报告失败并修复，不改成仅 FFmpeg 改色而宣称成功。
- [x] **Step 6: 仅提交本任务差异**，消息 `feat: render deterministic replica templates through Hypit`。

### Task 4: 有授权的可选模型对话

**Files:** Create server/replica-chat.js；Modify server/replica-api.js、test/replica-drafts.test.js、docs/replica-workbench.md。

**Interfaces:** `chatReplica({message,analysis,template,history,images,consent},config) -> {reply,patch,questions}`。operator config 仅从 REPLICA_CHAT_BASE_URL、REPLICA_CHAT_MODEL、REPLICA_CHAT_API_KEY、REPLICA_CHAT_VISION 读取；未齐全返回 unavailable。POST /drafts/:id/messages 接收 {revision,message,mode:'local'|'api',consent:{provider,shareImages}}；health 只给 ready、model、vision 和费用说明。

- [x] **Step 1: 编写失败 mock 测试**：无配置/无授权请求数=0，文本模式不含图片，图片模式最多 3 张受限代表帧，错误/超时不重试，响应日志不含密钥。模型试图输出命令、非法属性/颜色、虚构语音转写时不得更新配置或执行。
- [x] **Step 2: 跑红测试**：`node --test test/replica-drafts.test.js`。
- [x] **Step 3: 实现一个兼容接口**：Node fetch、30秒超时、max_tokens:1200、消息历史最多 12 条，总输入正文最多 16000 字；调用 /chat/completions，请求及响应大小有界。配置目标只由操作者决定，不接收访客 URL，生产目标需 HTTPS；mock 仅可注入 loopback 测试目标。响应 JSON 输出只允许 reply/patch/questions，patch 经 Task 1 校验，不直接创建任务。
- [x] **Step 4: 接入需求消息与模型选择**：本地使用 guideTemplate，无 API 网络调用；模型模式显示外发项和计费不确定性后才发送。保存确认前的候选变化，未处理意图呈现给用户。超时记录该轮失败，不自动回落到固定回复。
- [x] **Step 5: 验证**：`npm run test:replica`，API 分支仅 mock；无真实密钥与逐轮授权不做供应商验收，不把 mock 报作真实接入。
- [x] **Step 6: 仅提交本任务差异**，消息 `feat: add consented replica planning dialogue`。

### Task 5: 本人 F5-TTS 试听与声音时间轴

**Files:** Create server/replica-voice.js；Modify server/replica-api.js、server/replica-render.js、test/replica-template.test.js、test/replica-drafts.test.js。

**Interfaces:** `checkReplicaVoice(configPath) -> {ready,reasons,commercialLicense}`；`createVoicePreview({narration,prosody},directory) -> {id,sha256,duration,cues,audioPath}`。POST /drafts/:id/voice 接收 {revision,narration,prosody} 排队；GET /drafts/:id/voice/:previewId 输出私有 WAV；POST /drafts/:id/voice/:previewId/approve 接收 {revision,sha256}。public 结果不暴露 audioPath。

- [x] **Step 1: 编写失败测试**：缺准确转写/参考/模型时 ready=false，不使用其他 TTS；任何命令 speed 不是 1 都失败；改旁白或 prosody 使试听认可失效。用 mock 生成 18 秒音轨：参考 10 秒时计划自动跟到真实18秒，若音轨>30秒返回需要精简，不调用 atempo/asetrate。
- [x] **Step 2: 跑红测试**：`npm run test:replica`。
- [x] **Step 3: 实现固定本地 F5 调用**：读取当次确认的本人配置及准确转写；环境默认候选只使用已知 `E:/98017/Projects/C盘迁移/屈臣氏比赛资料/tmp/f5tts-env/Scripts/python.exe`，可由 REPLICA_F5_PYTHON 指定另一有效本地环境。该路径及 infer_cli.py 本轮只读确认存在，不表示模型权重就绪。核对已安装 infer_cli 参数后用 execFile 参数数组固定 model=F5TTS_v1_Base、speed=1、nfe_step=32；显式传 ref_audio/ref_text，禁止自动 ASR 转写参考。
- [x] **Step 4: 实现句段试听和实际时间**：prosody 为问句、利益重点、行动引导的用户确认文字/停顿规划，不以音量/变调模拟情绪。独立句段合成、自然语速及适量句间停顿，合并试听；probe 实际各句段时长产生 cues，用户听审认可后才制作成片。不把 F5 不支持的参数当作情绪控制；效果不足保留试听供重写/重做，不假报控制成功。
- [x] **Step 5: 验证**：`npm run test:replica` 全部 mock/缺失路径测试通过；本机可用时另外做授权文字试听，未获得新语气认可不生成带该试听的正式成片。明确 pending_verification 许可状态，不提交外部声音参考。
- [x] **Step 6: 仅提交本任务差异**，消息 `feat: gate personal F5 voice previews before rendering`。

### Task 6: 蓝紫工作台的分析、对话、确认与预览

**Files:** Modify src/components/ReplicaWorkbench/ReplicaWorkbench.jsx、ReplicaWorkbench.css；Create 同目录 TemplateEditor.jsx；Modify test/replica-template.test.js、scripts/verify-replica-browser.mjs。

**Interfaces:** `<TemplateEditor draft={publicDraft} onChange onMessage onConfirm onRender onVoicePreview onVoiceApprove busy />`；共享 renderTemplateSvg 提供受控预览，dangerouslySetInnerHTML 只接受自产转义 SVG，绝不接收模型 HTML。旧 StyledPreview 与旧 submit 保留为“原片剪辑包装”模式。

- [x] **Step 1: 编写失败 SSR/浏览器断言**：未上传禁用分析/制作；未确认禁用制作；需求和成片文案是不同 textarea；无 API 时只有本地向导可选；未知分析不显示已识别语音；结果 plan.kind=template 不读取 segments；新操作状态可供屏幕阅读器读取。
- [x] **Step 2: 跑红测试**：`npm run test:replica`。
- [x] **Step 3: 实现四段流程**：保留左原片及右编辑布局，用受控数据展示分析/对话/方案/预览；型号每轮显式选择，付费外发按钮描述模型、图片与费用；冲突或未处理意图要求确认，不自动制作。草稿选择每次有 generation token，旧上传/轮询返回不能覆盖新选片，AbortController 仅断开观察，不伪称取消服务器任务。
- [x] **Step 4: 实现声音与版本操作**：试听播放、认可、修改失效；原音轨与新文案可能矛盾时显示确认提示。结果/历史按 kind 渲染；删除须说明范围并确认，运行中禁用，旧成片不覆盖。模型/F5 缺失显示明确原因。
- [x] **Step 5: 验证**：`npm run test:replica`；`node scripts/verify-replica-browser.mjs` 使用当前合成片和本机地址，检查键盘、1440桌面/390手机、换片竞态及更新失效。
- [x] **Step 6: 仅提交本任务差异**，消息 `feat: add interactive template replica workbench`。

### Task 7: 真实端到端验收、文档与回退验证

**Files:** Modify scripts/verify-replica.mjs、scripts/verify-replica-browser.mjs、docs/replica-workbench.md；必要时 Modify .gitignore/vite.config.js（仅新增私有目录漏保护时）；Update 本计划与当前 PROGRESS.md。

**Interfaces:** verify:replica 保留旧模式，新增 REPLICA_VERIFY_KIND=template；浏览器脚本参数 REPLICA_QA_VIDEO/REPLICA_QA_URL 保留。输出检查记录包含实际 buildId、配置、成片 SHA-256、时长、音轨及视频采样时间。

- [x] **Step 1: 增加失败验收断言**：合成蓝底+中文参考、横屏/带旋转元数据参考；绿底黄字模板实际编码像素/中文布局、0/0.3/1.2秒动效状态、独立下载与跨会话隔离。原剪辑 fast/highlight/original+mute 三路仍产出预期时长。
- [x] **Step 2: 实现验证夹具及检查**：仅生成专用测试视频；从真实 MP4 抽帧比对而非只断言配置。视觉打开实际帧和播放成片，音轨需要时听审；技术解码不能代替内容验收。测试输出与用户任务隔离且不自动清理历史。
- [x] **Step 3: 跑完整专项与实际制作**：`npm run test:replica`、`npm run verify:replica`（旧模式）、设置 `REPLICA_VERIFY_KIND=template` 再跑真实模板；运行浏览器回归与 `npm run build -- --base=/AI-/`，记录每项真实通过/失败，不上传部署。
- [x] **Step 4: 跑全站检查并比较基线**：`npm run test:deployment`。旧全站上轮有9项失败，不硬编码本轮数目；报告现存失败与本次新增失败，新增失败必须修复，不修改无关用户测试来凑全绿。
- [x] **Step 5: 完成文档/安全检查**：明确默认向导限制、无 OCR/ASR、API 外发与费用、F5试听认可和商用许可、私有草稿容量与清理；确认任何新私有路径被 Git/Vite 排除。复查备份 ZIP 哈希，给出具体回退入口，不实际覆盖工作区来做破坏性演练。
- [x] **Step 6: 仅提交验收及文档差异**，消息 `test: verify template workflow and safe rollback`；交付真实可用本机功能和检查结果，列出未配置 API、未批准语气试听等实际限制。

## 计划自审与执行交接

- 已将设计 1～12 节映射至 Task 1～7；无真实 OCR/ASR 和复杂生成的边界纳入界面及验收。
- 新任务 kind/草稿 schema 与旧结果分支分开，所有修改均以 revision 校验；接口名和属性以上述定义为准。
- 五项 Review Focus 均已分配具体测试；没有用 mock 成功替代真实视频验收。
- 已保留原源码快照；执行前再核对重叠文件状态，禁止覆盖此后出现的用户修改。
- 设计已确认，计划尚待用户审阅；推荐 Native：由当前主代理在本会话按任务执行，避免多份上下文修改同一 API/UI。审阅确认后使用 executing-plans，不提前实施产品代码。
