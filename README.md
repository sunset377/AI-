# 辞. Portfolio + AI Interview

刘耀华的双入口个人网站。默认首页提供“进入作品集”和“开始 AI 面试”两条路径；作品集保留原有项目、107 件视觉图库、三星堆互动工具和联系方式，AI 面试则根据求职简历知识库进行实时文字回答。

页面由 GitHub Pages 托管，DeepSeek 面试接口独立运行在 Cloudflare Worker。两者都不需要个人电脑保持开机。

## 面试知识库

`src/interview/profile.js` 是当前事实来源；完整结构化资料进入 system prompt，包括 AIGC Hub、导演 Skill、成语生产线、MOMOCO 短剧、WorkBuddy、商业 TVC、屈臣氏比赛、小红书、《星际穷途X》和三星堆 H5。模型根据 FDE / Agent / 工作流 / AI 产品经理方向选择相关经历，使用自然口语和连续追问，不强制输出 STAR 标题或标准模板。

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

检查云端接口打包与回归测试：

```powershell
npx.cmd wrangler deploy --config wrangler.interview.jsonc --dry-run
node --test test/interview-worker.test.js test/deepseek-interview.test.js
node --test --test-name-pattern="parseSseLine|streamInterview" test/interview-client.test.js
```

`npm run dev` 的 `/api/interview` 开发代理连接已部署接口，因此本地页面也可以实时提问。代理只在开发服务器中存在，不提供密钥；生产页面由 `VITE_INTERVIEW_API_URL` 直连接口，白名单只允许 `https://sunset377.github.io` 和 Worker 同源页面。

接口流式转发 DeepSeek 的 `deepseek-flash` 非思考模式，每条最多 600 个输出 token，每个 IP 每分钟最多 6 次请求。聊天不持久化到数据库，日志不记录问题、回答或密钥。网络、余额或限流故障会回退到本地资料库，回答下方明确标注来源；取消提问不会产生兜底回复。

## 测试与构建

```powershell
npm.cmd run test:deployment
npm.cmd run build -- --base=/AI-/
```

`/AI-/` 构建继续兼容 GitHub Pages。独立接口只上传 Worker 代码，不上传图片或视频，也不覆盖原来的 `ai` Worker：

```powershell
npx.cmd wrangler deploy --config wrangler.interview.jsonc
npx.cmd wrangler secret put DEEPSEEK_API_KEY --config wrangler.interview.jsonc
```

通过上述 secret 命令的交互输入或受保护 stdin 写入密钥，不要放在命令参数、源码、GitHub Pages 环境变量或聊天里。GitHub 仓库 Actions variable `VITE_INTERVIEW_API_URL` 仅保存公开接口地址；部署工作流将其注入静态页面。`VITE_DEEPSEEK_API_KEY` 在 Vite 构建中强制禁用，包含该变量的旧演示不会得到密钥。

网站托管可以免费，但 DeepSeek 按调用量计费。Origin 白名单和单 IP 限流不是登录鉴权或账户级费用上限；公开接口仍有被程序冒用的风险，应在 DeepSeek 控制台限制可用余额并关注用量。不得把代理环境的成功请求当成国内网络可达性证明，仍需手机不开代理实测。

## 版本回退

本次改造前的完整页面已保存在 Git 标签：

```text
backup/pre-dual-entry-ai-interview-20260915
```

本次功能分阶段提交在 `feat/dual-entry-ai-interview` 分支中。需要查看旧版时可以基于上述标签新建分支，不必覆盖当前页面。
