# 本地视频复刻工作台

入口：作品集的「爆款视频复刻」卡片，或 `/?view=replica`。这是独立编写的网页版本，不修改原来的 Electron 工作台，也不导入其密钥、模型或媒体。

## 本机运行

已经安装项目依赖、Hypit 和带 libass 的 FFmpeg 后：

```powershell
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

打开 `http://127.0.0.1:5174/?view=replica`。选择 0.5～15 秒、25 MB 以内的视频，推荐从 3～5 秒的 H.264 MP4 开始。

桌面快捷方式「视频复刻工作台」调用 `scripts/launch-replica.ps1`，自动启动或复用 5174 端口的本机服务，以 Chrome / Edge 独立应用窗口全屏打开。F11 切换全屏，Alt+F4 关闭窗口；关闭窗口不会停止后台制作服务。独立浏览器配置存放在 `%LOCALAPPDATA%\ReplicaWorkbench\BrowserProfile`，其任务记录与普通浏览器分开，不复制旧浏览器数据。启动错误通过提示框显示，启动日志在 `.codex-run/replica-app/`。这不是独立安装包，仍需保留项目目录和已安装依赖。

支持原片顺序、前 1 秒 1.35 倍速、中段亮点前置；可添加开头标题、手填字幕、蓝紫包装，选择保留或去掉音轨。先播放浏览器预览，再提交真实制作任务，在结果页对比和下载 MP4。浏览器预览是近似效果，实际剪辑与字幕时序以导出成片为准。字幕逐行均分成片时间，不进行语音识别、语义分析或自动选亮点。

## 真实执行链

浏览器上传 → 校验视频 → 生成 Hypit SVML / SVRUN → 本地 Hypit Normalize / Trim / Retime → 取回真实片段 → FFmpeg 拼接、烧录 ASS 字幕和包装 → 校验时长、音轨并完整解码 → 提供下载。

Hypit 是工作流工具，不是视频生成模型。原片剪辑只绑定 `@hypit/media-local`，模板制作也没有远程视频模型端点或凭据。可选 DeepSeek 对话是另一条需要单独配置和确认的路径。零模型调用费不代表机器、存储和带宽没有成本。

默认进入「模板重建」：上传 → 六帧测量 → 独立需求对话 → 填写/确认三段文案及颜色动效 → 保存 → 确认方案 → 制作真实 MP4。这里重新绘制纯色背景、大字、垃圾桶图标和光圈，不是简单在原片上加字幕；也不是自动还原任意原片工程。可独立设置三段文字颜色、背景、文字淡入/弹跳、光圈旋转、同时/逐段出现、时长和音轨。

模板执行为自有 `@portfolio/replica-template` 组件 → Hypit 编译 HTML 帧程序 → 项目 `@portfolio/provider-template` 通过已安装 Puppeteer/Chrome 按 ABI 逐帧执行 → Provider 编码并将真实 `TimelineVisual` 存入 Hypit Runtime Results → 音轨合成/成片检查。官方 HTML Provider 在当前 Windows 的 `chrome.exe --version` 检查及下载的 Headless Shell 上不稳定，故使用公开 Provider SDK 扩展，不修改已安装 Hypit、不伪造 buildId。Provider 只接受无外部资源的 30fps 图形模板，不支持直接处理复杂真人镜头；实际启动 Chrome 探测就绪，无静默回退。

模板制作需要保留已安装的 Hypit、Puppeteer Core 25.10.0 和 Chrome。`REPLICA_CHROME_PATH` 可指定已存在的浏览器；默认 Windows Chrome 标准路径。项目内依赖 junction 指向现有安装，不下载第二份 SDK。失败准备时的 `.browser-cache` 为私有诊断残留，不参与当前渲染。

执行器自动查找 PATH 对应的 Hypit 安装，也支持环境变量 `HYPIT_CLI` 指向实际 `bin/hypit.mjs`，`FFMPEG_PATH` / `FFPROBE_PATH` 指向对应程序。无需安装原桌面工作台或下载 H3 模型。当前验证环境为 Hypit 0.3.1、FFmpeg 8.1.2、Node 24。

## 数据与访问

模板草稿增加独立需求对话：本地向导不调用模型，只识别界面列出的颜色和动效；模糊颜色目标会追问，未知指令必须用编辑控件明确。修改需求不会自动成为成片字幕。真实分析为六个代表帧、边缘主色和像素差异，不是 OCR/ASR 或镜头语义识别。

可选模型通过服务端 `REPLICA_CHAT_BASE_URL`（默认 https://api.deepseek.com）、`REPLICA_CHAT_MODEL`（默认 deepseek-v4-pro）、`REPLICA_CHAT_API_KEY` 配置。模型名称仍须由供应商实际可用性验证，未配置时不可选。每轮明确外发测量、文案、需求和最近对话；仅当 `REPLICA_CHAT_VISION=1` 且用户本轮勾选图片外发时附最多三张私有代表帧，不发送音色参考或源视频。30秒超时、无自动重试；再次点击是新请求，可能再次计费。密钥和供应商地址不返回浏览器，不接收访客自定义接口。

原版 AI 漫剧导演从 MOMOCO 本机目录只读加载（可用服务端 `REPLICA_DIRECTOR_PATH` 指定），用于镜头、连续性和质检规划，不公开打包原始售卖 Skill。缺文件显示未读取；加载 Skill 不等于 H3/LibTV 已能制作，复杂剧情生成仍未接入。

可选本人旁白固定读取已认可的个人 F5-TTS 配置。`REPLICA_F5_PYTHON` 可指定本地环境，`REPLICA_F5_CHECKPOINT`、`REPLICA_F5_VOCAB`、`REPLICA_F5_VOCODER` 必须明确指定已有权重、词表和 Vocos 目录（含 config.yaml/pytorch_model.bin）；不自动下载，不回退其他 TTS。自然语速 speed=1/nfe_step=32；用户分别规划问句、利益点、行动句及停顿，标点不等于可保证的情绪控制，必须实际试听认可。最长 30 秒；字幕块按实际句段时间，而不是挤进参考视频时长。改方案使认可失效，正式任务复制独立音轨，试听、转写和参考均不外发。权重商业许可仍是 pending_verification，不能承诺可商用。

任务保存在 `server/hypit/jobs/<UUID>/`，包括上传、剪辑方案、独立本地 Runtime、成片和检查记录；已排除版本控制及 Vite 静态访问/文件监视。任务使用 HttpOnly / SameSite 会话 Cookie 隔离，跨来源提交拒绝。每个浏览器同时一个任务，全局最多三个排队任务，执行串行。服务重启后，未完成任务标记中断，不自动重复提交。

每会话最多 10 个草稿，全局最多 50 个；恢复草稿仅适用于当前浏览器会话，保存后再刷新。删除草稿须确认，只删除该草稿输入/代表帧/试听，不删除已经制作的独立版本。修改方案会使原确认及声音认可失效。

运行记录的「删除文件」会永久移除对应任务的上传、成片和工作数据，不删除用户原始视频。任务没有自动过期清理；浏览器 Cookie 清除或过期后不能查看旧任务，运营者应定期检查服务端空间。不要将 `jobs` 目录复制到 `public` 或托管为静态文件。

## 在线边界

静态作品集只能提供选片和包装预览，不能独立执行 Hypit。已上线的作品集没有改变。要让面试官远程制作 MP4，仍需部署一个持续运行的执行服务、HTTPS 同源路由，以及公网限流/登录、文件生命周期和容量策略。不要直接把 Vite 开发服务暴露到公网。

**许可前置条件：**当前安装的 Hypit 使用附加条件的 Apache 2.0，第三方托管服务/多租户（即使免费）、商业再分发可能要求 Hypit.AI 书面商业许可；不能称为无限制开源。保留 Hypit 名称及报告版权信息。本机作者使用与向面试官开放托管制作并非同一种许可场景，公网前须核验并取得所需授权。

「执行与模型」中的付费升级仅说明边界，当前没有 MiniMax H3 或其他模型提交接口，也不收集用户 API Key。复杂镜头生成和自动字幕识别不在这一版。

用户提供的旧工作台源码声明 `UNLICENSED`；当前没有复制其实现或发布原安装包。如以后复用其源码或资源，应先确认许可。

## 检查

```powershell
npm run test:replica
npm run verify:replica
npm run build -- --base=/AI-/
```

`verify:replica` 只生成专用测试片，实际跑 Hypit 并检查真实 MP4，不扫描或选用其他项目的媒体。可设置 `REPLICA_VERIFY_MODE=highlight` / `original`、`REPLICA_VERIFY_MUTE=1` 测试其他剪辑及音轨分支。

模板验收设置 `REPLICA_VERIFY_KIND=template`；`REPLICA_VERIFY_ASPECT=wide`、`REPLICA_VERIFY_ROTATE=1`、`REPLICA_VERIFY_LONG=1` 检查横屏、旋转显示矩阵及长中文。输出保留真实 buildId、SHA-256、成片参数和实际采样时间。FFmpeg 8 的旋转夹具使用 `-display_rotation`，不能仅写一个已被忽略的 rotate 标签后宣称测过旋转。

浏览器回归脚本 `scripts/verify-replica-browser.mjs` 复用已安装 Hypit 的 Puppeteer，需设置 `HYPIT_DISTRIBUTION`；通过 `REPLICA_QA_VIDEO` 指定本次生成的测试片，通过 `REPLICA_QA_URL` 指定本地入口。检查桌面和手机布局、完整预览、真实下载、权限拦截和成片播放。

2026-10-10 最新验收记录见 [本机验收记录](replica-acceptance-2026-10-10.md)。没有调用真实付费模型、没有真实 F5 新试听；mock 声音测试不代表本人音色已听审。

## 回退

实施前源码快照：`.backups/replica-before-template-20261010-195705/`，含 52 个文件、manifest、ZIP 和回退说明。ZIP SHA-256：`D6E4A6F6F1D89D83BBB7C5164D964D1FB302E0C8F5FE617D73A650DF79589675`。仅按说明恢复对应源码，不删除 `server/hypit/jobs`、用户视频、密钥或浏览器配置；未做破坏性覆盖演练。保留当前功能分支和用户原有未提交修改。
