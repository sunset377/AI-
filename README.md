# 辞. Portfolio + AI Interview

刘耀华的双入口个人网站。默认首页提供“进入作品集”和“开始 AI 面试”两条路径；作品集保留原有项目、107 件视觉图库、三星堆互动工具和联系方式，AI 面试则根据公开项目档案进行实时文字回答。

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

`npm run dev` 只启动 Vite 界面，不提供真实 AI 接口；此时面试页会明确提示尚未连接 AI 服务。`dev:cloudflare` 需要当前电脑已登录相应 Cloudflare 账户，并会使用该账户的 Workers AI 配额。

## 测试与构建

```powershell
npm.cmd run test:deployment
npm.cmd run build -- --base=/AI-/
```

`/AI-/` 构建继续兼容原 GitHub Pages 路径。正式的实时 AI 版本由 Cloudflare Worker 同源托管静态站点与 `/api/interview`：

```powershell
npm.cmd run deploy
```

模型通过服务端 Workers AI binding 调用，限流也在 Worker 中完成。不要把 Cloudflare token、API Key 或其他密钥写进前端源码、仓库或聊天记录。

## 版本回退

本次改造前的完整页面已保存在 Git 标签：

```text
backup/pre-dual-entry-ai-interview-20260915
```

本次功能分阶段提交在 `feat/dual-entry-ai-interview` 分支中。需要查看旧版时可以基于上述标签新建分支，不必覆盖当前页面。
