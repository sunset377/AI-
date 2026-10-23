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
