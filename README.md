# 英语口语练习

输入英文 → 听示范朗读 → 录下你的朗读 → 自动对比原文 → 标红读错/漏读的词 → 给出准确率。

线上：https://sheng-1980.cc/en

## 架构

Cloudflare **Worker**（不是 Pages），挂在主站 `/en` 路径下，通过 Workers Route `sheng-1980.cc/en*` 触发。

```
~/speaking-practice/
├── public/index.html   # 单文件前端 SPA（HTML+CSS+JS 内联）
├── src/index.js        # Worker 入口：剥 /en 前缀 → /api/transcribe 走 ASR，其余交 ASSETS
├── lib/transcribe.js   # Whisper ASR 逻辑（OpenRouter→Groq provider 链）
└── wrangler.jsonc      # Worker 配置：main + assets
```

## 工作流程

1. **朗读示范**：浏览器原生 `SpeechSynthesis`（TTS，免费、无 key）。
2. **录音**：`MediaRecorder` 采集麦克风。
3. **对比**：前端 `fetch('api/transcribe')`（相对 `/en/` 解析为 `/en/api/transcribe`）→ Worker 剥前缀转发到 Whisper → 返回文字 → 前端 Levenshtein 单词级 diff → 标红 + 准确率。

## ASR（语音识别）

`lib/transcribe.js` 的 provider 链，自动 fallback：

1. **OpenRouter** `openai/whisper-1`（复用 `OPENROUTER_API_KEY`，与 math-practice 同 key）
2. **Groq** `whisper-large-v3`（`GROQ_API_KEY`，免费 2000 RPD，速度快）

两者都是 OpenAI 兼容的 `/audio/transcriptions` 契约。

## 本地开发

```bash
cd ~/speaking-practice
cp .dev.vars.example .dev.vars   # 填 OPENROUTER_API_KEY / GROQ_API_KEY
npx wrangler dev
# → http://localhost:8788（路径前缀 /en 在线上才有意义，本地直接访问根即可测）
```

## 部署

### 1. 部署到 Worker（两种方式任选）

**方式 A — wrangler CLI：**
```bash
npx wrangler deploy
```
需先 `npx wrangler login` 或设置 `CLOUDFLARE_API_TOKEN`。`wrangler.jsonc` 的 `name: speaking-practice` 决定部署到哪个 Worker。

**方式 B — Workers Builds（Dashboard 连 Git，push 自动部署）：**
Cloudflare Dashboard → Workers & Pages → speaking-practice → Settings → Builds → 连 GitHub 仓库 `shengyue9999/speaking-practice`，Build command 填 `npx wrangler deploy`。

### 2. 配 Workers Route（挂到 /en）

Dashboard → `sheng-1980.cc` Zone → Workers Routes（或 Worker → Triggers）：
- Route：`sheng-1980.cc/en*`

> ⚠️ `*.sheng-1980.cc/en*` 的 `*.` 只匹配子域、不匹配裸域。要用 `sheng-1980.cc/en` 访问，Route 必须是裸域 `sheng-1980.cc/en*`。
> ⚠️ `/en` 是前缀匹配，会连带 `/english`、`/engage` 等。若主站有此类路径会被劫持——可改用更具体前缀（同时改 `src/index.js` 的 `PATH_PREFIX`）。

### 3. 密钥

Dashboard → speaking-practice → Settings → Variables and Secrets：
- `OPENROUTER_API_KEY`（复用 math-practice 同值）
- `GROQ_API_KEY`（console.groq.com/keys 新申请）

## 入口

sheng-1980-cc 主站侧栏「小工具」入口指向 `/en`。

## 已知限制

- iOS Safari 14.4+ 才支持录音；更老的系统无法录音。
- 部分系统没有 en-US TTS 语音，示范朗读降级（不影响录音和对比）。
- 录音建议 ≤90 秒。
