# CS Board 页面集成

原项目：ChenShuo2004/cs-board，基准提交 `f7780ef08cc2c752806e49805f5f696bfcd020de`，MIT 许可原文保留于 `LICENSE`。

本地源位置：`E:/AppData/.codex/pilots/cs-board`。`NativeBoard.tsx` 由 `web/app/page.tsx` 适配，`CSBoard.css` 由原 globals / brand 样式加作用域和蓝白配色组成，`public/cs-assets/styles/` 保留其 12 种内置风格预览。

面试入口通过 `/api/replica/whiteboard` 代理，只开放内置风格、6 个命名声音与访客自己的任务。API 设置、参考音色管理、自定义素材和原项目的共享历史管理未对访客开放。声音自我介绍已用本地 F5-TTS 生成；选择声音不会修改视频文案，新文案通过 `/narrations` 本地 F5 合成，试听确认后作为成品旁白进入画面制作，不使用原项目的 IndexTTS。修改文字或声音会撤销确认；后端也校验任务归属、文字、声音及确认状态。服务端配置、密钥、原始声音参考和准确转写不下发。

F5 运行配置位于忽略的 `.local-audio/f5-runtime.json`，单次最多 1000 字、自然语速、输出最多 300 秒，一次仅运行一个本地配音任务；模型或参考不可用时明确报错，不切换其他声音。本人音色默认，新文案生成文件按匿名会话隔离。

真实文本/图片生成需要用户在页面确认调用；离线测试与浏览器提交测试不会创建模型任务。原 DeepSeek 导演和 MiniMax H3 在顶部“导演与复杂镜头”入口保留。
