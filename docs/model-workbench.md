# 作品集模型工作台

入口：`https://sunset377.github.io/AI-/?view=studio`。工作台前端留在 GitHub Pages，后台运行于独立 Cloudflare Worker，真实调用 `https://aigchub.token6688.com/v1`。不嵌入原站，不复制登录 Cookie，不读取上游私人会话。

## 目录与权限

`scripts/sync-model-catalog.mjs` 通过本机已授权的 `tokengo ... --agent codex` 读取聊天、图片、视频和音频目录，生成 `src/model-catalog.json`。目录可浏览不等于开放调用。

当前白名单：DeepSeek V4.1 Flash 聊天、GT Image 2 C 文生图。图片仅一张、1K 档、medium；禁止上传和外部参考图。视频、音频和其他模型由后台拒绝。MOMOCO 导演及白板工坊保留独立入口，未在此公共网关中代理其本机执行接口。

## 邀请体验

访客免注册，使用作者提供的 `?view=studio#experience=体验码` 链接；也可从 `?view=portfolio#experience=体验码` 进入作品集，再点击智能体。授权完成后地址栏移除体验码。直接打开公开入口可浏览目录，但调用需要体验码。

体验码和签名密钥仅保存在 Worker Secrets 与本机 DPAPI 加密的 `.local-audio/model-gateway-credential.json`。不得提交该文件或把体验码放进网页构建。运行 `node scripts/provision-model-gateway.mjs --invite` 读取当前邀请链接，只发给需要体验的人。

签名会话有效期 8 小时。同一会话每天最多聊天 6 次、图片 1 次；全站每天最多聊天 20 次、图片 3 次，按北京时间日期计数。上游拒绝或结果不确定的请求也占用一次体验次数，防止自动重试造成额外消费。

Worker 本期开放至 `2026-10-30T15:59:59Z`（北京时间 10 月 30 日 23:59:59）。延长期限须修改 `wrangler.models.jsonc` 后重新部署。专用普通 API Key 总额度为 100000 micro-USD（0.10 USD），不是每位访客额度；上游按调用前余额检查，一次实际消费可能超过剩余额度，不能把此数值宣传为绝对结算上限。Key 无 video/audio 权限，并只允许两个指定模型。密钥的创建不扣生成费用。

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

首次创建凭据需先建立专用 TokenGo account task，把其 UUID 设置为 `RELAY_SETUP_TASK_ID` 再运行 provisioning 脚本；脚本会先自检 DPAPI，仅首次创建独立凭据，后续复用加密状态。首次配置中一枚未使用的临时凭据已撤销，当前凭据独立保存。任何不确定的创建或安装失败都应先查 key 元数据，不要循环创建。

本地界面验收：`npm run preview -- --port 5190 --base=/AI-/`，再运行 `node scripts/verify-model-workbench.mjs`。该脚本使用隔离浏览器和模拟接口，不发生模型消费，截图仅为本地验收产物，不发布到作品集。
