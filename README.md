# 英语口语练习

输入英文 → 听示范朗读 → 录下你的朗读 → 自动对比原文 → 标红读错/漏读的词 → 给出准确率。

线上：https://speaking.sheng-1980.cc

## 原理

1. **朗读示范**：浏览器原生 `SpeechSynthesis`（TTS，免费、无需 key）。
2. **录音**：`MediaRecorder` 采集麦克风。
3. **对比原文**：录音上传到 Cloudflare Pages Function `/api/transcribe`，
   Function 调 Whisper 语音识别把录音转成文字，前端再用单词级编辑距离（Levenshtein）
   对齐原文与识别结果，区分「读错 / 漏读 / 多读」并着色，统计准确率。

## 语音识别（ASR）

Function 走 provider 链，按优先级尝试：

1. **OpenRouter**（`openai/whisper-1`）—— 复用 `OPENROUTER_API_KEY`（与 math-practice 同一个 key）。
2. **Groq**（`whisper-large-v3`）—— fallback，免费额度 2000 RPD，速度极快。

两者都是 OpenAI 兼容的 `/audio/transcriptions` 契约，Function 里自动切换，无需改代码。

## 本地开发

```bash
cd ~/speaking-practice
cp .dev.vars.example .dev.vars   # 填入 OPENROUTER_API_KEY / GROQ_API_KEY
npx wrangler pages dev . --compatibility-flag=nodejs_compat --compatibility-date=2026-06-14
# → http://localhost:8788
```

## 部署

与 math-practice 同构，双平台：

- **Cloudflare Pages（主用域名）**：`speaking.sheng-1980.cc`，监听 GitHub 仓库自动部署。
  ASR Function 只在此域名可用。
- **GitHub Pages（静态备份）**：`shengyue9999.github.io/speaking-practice/`。
  无 Function，对比步骤会跨域调用 Cloudflare，或提示改用主域名。

```bash
git add . && git commit -m "..." && git push
# Cloudflare Pages 自动部署，约 1–2 分钟生效
```

远程仓库用 SSH：`git@github.com:shengyue9999/speaking-practice.git`（HTTPS 在国内常被墙）。

### Cloudflare 配置要点

- Build command：**留空**（不要填 `npx wrangler deploy`，那是 Worker 命令）。
- Build output directory：`.`
- 密钥（Variables & Secrets）：`OPENROUTER_API_KEY`、`GROQ_API_KEY`，**不写入代码**。

## 已知限制

- iOS Safari 14.4+ 才支持 `MediaRecorder`，更老的系统无法录音。
- 部分系统没有 en-US TTS 语音，示范朗读会降级（不影响录音和对比）。
- 录音建议控制在 90 秒内（远低于 Cloudflare 100MB / Groq 25MB 的请求体上限）。
