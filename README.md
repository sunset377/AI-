# 辞. Portfolio + AI Interview

刘耀华的双入口个人网站。默认首页提供“进入作品集”和“开始 AI 面试”两条路径；作品集保留原有项目、107 件视觉图库、三星堆互动工具和联系方式，AI 面试则根据求职简历知识库进行实时文字回答。

当前阶段以 AI 面试为第一优先级：首页将“开始 AI 面试”设为青色主按钮，作品集作为次入口保留，暂不新增或上传作品。

## 面试知识库

服务端知识库以《刘耀华_AI_Agent_AI应用开发工程师_优化版简历》为事实源，结构化收录目标岗位、技能、7 个项目、应用与服务经历、教育、荣誉和证书。回答会采用“结论—项目证据—岗位价值”的面试表达，并在项目题中优先说明背景、行动、结果和复盘。

模型可以归纳简历事实体现的能力，但不能新增公司任职、客户、团队规模、商业数据、模型效果或未记录的技术经验；资料不足时必须建议与本人确认。原始 PDF 不会随网站静态资源公开发布。

## 页面入口

- `/`：双入口首页。
- `/?view=portfolio`：完整作品集。
- `/?view=interview`：AI 面试对话。

## 本地运行

仅检查界面：

```powershell
npm.cmd install
npm.cmd run dev
```

连同 Cloudflare Worker 和 Workers AI 一起检查：

```powershell
npm.cmd run dev:cloudflare
```

`npm run dev` 只启动 Vite 界面，不提供真实 AI 接口；提问时会使用简历知识库回答。`dev:cloudflare` 需要当前电脑已登录相应 Cloudflare 账户，并会使用该账户的 Workers AI 配额。

GitHub Pages 等纯静态托管无法运行 Workers AI 接口，因此页面会自动使用简历知识库回答常见面试问题。Cloudflare 接口可用时会自动使用流式 AI 回答。

## 测试与构建

```powershell
npm.cmd run test:deployment
npm.cmd run build -- --base=/AI-/
```

`/AI-/` 构建继续兼容原 GitHub Pages 路径。正式的实时 AI 版本由 Cloudflare Worker 同源托管静态站点与 `/api/interview`：

```powershell
npm.cmd run deploy
```

模型通过服务端 Workers AI binding 调用，简历知识库和限流也在 Worker 中完成。不要把 Cloudflare token、API Key 或其他密钥写进前端源码、仓库或聊天记录。

## 版本回退

本次改造前的完整页面已保存在 Git 标签：

```text
backup/pre-dual-entry-ai-interview-20260915
```

本次功能分阶段提交在 `feat/dual-entry-ai-interview` 分支中。需要查看旧版时可以基于上述标签新建分支，不必覆盖当前页面。
