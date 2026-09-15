# 双入口作品集与 AI 面试 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将最新版作品集改为 Scaling Platform 风格双入口，并增加可在 Cloudflare 公网上运行的实时 AI 面试页面。

**Architecture:** React 继续负责单页界面，通过 `?view=gateway|portfolio|interview` 管理三个视图。Cloudflare Worker 同源处理 `/api/interview` 并把其余请求交给静态资源绑定，Workers AI 负责流式生成。

**Tech Stack:** React、Vite、CSS、Cloudflare Workers Static Assets、Workers AI、Node 内置测试。

**Spec:** `docs/superpowers/specs/2026-09-15-dual-entry-ai-interview-design.md`

## Global Constraints

- 保留全部现有作品、107 件图库、三星堆互动工具和联系方式。
- 不实现本地电脑公网隧道、语音、3D 数字人、登录或聊天持久化。
- 不把任何 token 或 API Key 写入前端、仓库或日志。
- 所有资源路径继续使用 `import.meta.env.BASE_URL` 兼容 `/AI-/`。
- 每个阶段测试后单独提交，基准标签为 `backup/pre-dual-entry-ai-interview-20260915`。

---

### Task 1: 视图路由与双入口视觉首页

**Files:**
- Create: `src/components/Gateway/Gateway.jsx`
- Create: `src/components/Gateway/Gateway.css`
- Create: `src/navigation.js`
- Modify: `src/App.jsx`
- Modify: `src/main.jsx`
- Test: `test/dual-entry.test.js`

**Interfaces:**
- Produces: `readView(location) -> 'gateway' | 'portfolio' | 'interview'`、`writeView(view)`、`Gateway({ onEnterPortfolio, onEnterInterview })`。
- Consumes: `assetPath()` supplied to `Gateway` for current portfolio images.

- [ ] **Step 1: Write the failing route and structure tests**

```js
assert.equal(readView({ search: '?view=portfolio' }), 'portfolio')
assert.equal(readView({ search: '?view=interview' }), 'interview')
assert.match(appSource, /Gateway/)
assert.match(gatewaySource, /进入作品集/)
assert.match(gatewaySource, /开始 AI 面试/)
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test test/dual-entry.test.js`
Expected: FAIL because `src/navigation.js` and Gateway do not exist.

- [ ] **Step 3: Implement the URL view helper and Gateway component**

Use `URLSearchParams`, `history.pushState`, a `popstate` listener, semantic `<header>`, `<main>` and `<nav>`, and the exact six-line Chinese headline from the spec. Use the existing hero and style-gallery assets; do not add remote media.

- [ ] **Step 4: Integrate the three-view shell without altering portfolio data**

Keep all current portfolio hooks active inside `PortfolioView`; add a visible “返回入口” control and route the brand correctly.

- [ ] **Step 5: Run deployment tests and build**

Run: `npm.cmd run test:deployment`
Expected: all tests pass.

Run: `npm.cmd run build -- --base=/AI-/`
Expected: Vite build succeeds and generated assets use `/AI-/`.

- [ ] **Step 6: Commit**

```bash
git add src test
git commit -m "feat: add portfolio and interview gateway"
```

### Task 2: AI 面试界面与流式客户端

**Files:**
- Create: `src/components/Interview/InterviewExperience.jsx`
- Create: `src/components/Interview/InterviewExperience.css`
- Create: `src/interview/client.js`
- Modify: `src/App.jsx`
- Test: `test/interview-client.test.js`

**Interfaces:**
- Produces: `streamInterview({ messages, sessionId, signal, onToken }) -> Promise<void>` and `InterviewExperience({ onBack, onOpenPortfolio })`.
- Consumes: same-origin endpoint `${BASE_URL}api/interview`, normalized so `/AI-/` builds can use the deployed Worker origin.

- [ ] **Step 1: Write failing SSE parsing and UI-source tests**

```js
assert.deepEqual(parseSseLine('data: {"response":"你好"}'), { response: '你好' })
assert.equal(parseSseLine('data: [DONE]'), null)
assert.match(interviewSource, /Shift\+Enter/)
assert.match(interviewSource, /清空对话/)
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test test/interview-client.test.js`
Expected: FAIL because the client module is missing.

- [ ] **Step 3: Implement the stream client**

POST `{ messages, sessionId }`, read `response.body` with a `TextDecoder`, split complete SSE lines, parse `data:` JSON, append each `response` token, and convert non-2xx JSON into a user-facing `Error`.

- [ ] **Step 4: Implement the interview experience**

Add the four starter questions, transcript, pending state, streaming caret, accessible composer, retry, clear conversation and explicit AI disclosure. Limit the textarea to 800 characters in the UI.

- [ ] **Step 5: Run focused and full tests**

Run: `node --test test/interview-client.test.js`
Expected: PASS.

Run: `npm.cmd run test:deployment`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src test
git commit -m "feat: add streaming AI interview experience"
```

### Task 3: Cloudflare AI Worker and abuse controls

**Files:**
- Create: `src/worker.js`
- Create: `src/interview/profile.js`
- Modify: `wrangler.jsonc`
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `test/interview-worker.test.js`
- Modify: `test/deployment-assets.test.js`

**Interfaces:**
- Consumes: POST `/api/interview` body `{ messages: Array<{role:'user'|'assistant', content:string}>, sessionId:string }`.
- Produces: Workers AI SSE stream on 200 or `{ error: string }` JSON on 400, 405, 429 and 503.
- Bindings: `env.AI.run(model, input)`, `env.INTERVIEW_RATE_LIMITER.limit({ key })`, `env.ASSETS.fetch(request)`.

- [ ] **Step 1: Write failing Worker validation tests**

```js
assert.equal((await worker.fetch(makeRequest('GET'), env)).status, 405)
assert.equal((await worker.fetch(makeRequest('POST', { messages: [] }), env)).status, 400)
assert.equal((await worker.fetch(validRequest, limitedEnv)).status, 429)
assert.equal((await worker.fetch(validRequest, env)).headers.get('content-type'), 'text/event-stream')
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test test/interview-worker.test.js`
Expected: FAIL because the Worker does not exist.

- [ ] **Step 3: Implement persona and validation**

Build the system message only from facts already shown in the portfolio. Reject more than 10 messages, content over 800 characters, invalid roles, missing session IDs and prompt-injection requests for secrets.

- [ ] **Step 4: Implement AI streaming and static asset fallback**

Use `@cf/google/gemma-4-26b-a4b-it`, `temperature: 0.3`, `max_tokens: 500`, `stream: true`; return `env.ASSETS.fetch(request)` for non-API requests.

- [ ] **Step 5: Configure Cloudflare bindings**

Add `main: "src/worker.js"`, `assets.binding: "ASSETS"`, `assets.run_worker_first: ["/api/*"]`, `ai.binding: "AI"`, and a named `INTERVIEW_RATE_LIMITER` binding. Add Wrangler as a pinned development dependency and scripts `deploy` and `dev:cloudflare`.

- [ ] **Step 6: Run Worker, deployment and build tests**

Run: `node --test test/interview-worker.test.js`
Expected: PASS with mocked bindings.

Run: `npm.cmd run test:deployment`
Expected: all tests pass and deployment assets include the interview modules.

Run: `npm.cmd run build -- --base=/AI-/`
Expected: production build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src test wrangler.jsonc package.json package-lock.json
git commit -m "feat: add Cloudflare AI interview backend"
```

### Task 4: Responsive QA and handoff

**Files:**
- Modify: `README.md`
- Modify: `design-qa.md`
- Modify: `test/hero-visual-refresh.test.js`

**Interfaces:**
- Consumes: completed gateway, portfolio and interview views.
- Produces: documented local/cloud commands and regression coverage for the new default gateway.

- [ ] **Step 1: Update regression expectations**

Replace the old “hero has no central copy” assertion with gateway headline, both entries, portfolio preservation and interview disclosure checks.

- [ ] **Step 2: Document operation and rollback**

Document `npm.cmd run dev`, `npm.cmd run dev:cloudflare`, `npm.cmd run test:deployment`, `npm.cmd run build`, `npm.cmd run deploy`, and rollback tag `backup/pre-dual-entry-ai-interview-20260915`. State that Workers AI development uses the Cloudflare account and no secret belongs in client code.

- [ ] **Step 3: Verify desktop and mobile views**

Run a production preview, inspect gateway/portfolio/interview at desktop and 360px widths, exercise both entries, back/forward navigation, project filters, gallery lightbox, composer and error state. Save screenshots under `.codex-run/dual-entry-qa/` without committing them.

- [ ] **Step 4: Run final verification**

Run: `npm.cmd run test:deployment`
Expected: all tests pass.

Run: `npm.cmd run build -- --base=/AI-/`
Expected: build succeeds.

Run: `git diff --check`
Expected: no whitespace errors.

- [ ] **Step 5: Commit**

```bash
git add README.md design-qa.md test/hero-visual-refresh.test.js
git commit -m "docs: verify dual-entry interview experience"
```
