// Whisper 语音识别核心逻辑。被 src/index.js 的 /api/transcribe 路由调用。
// 导出 handleTranscribe(request, env)。
//
// Provider 优先级链（自动 fallback）：
//   1. OpenRouter  openai/whisper-1   —— 复用 OPENROUTER_API_KEY（与 math-practice 同 key）
//   2. Groq        whisper-large-v3   —— 免费额度 2000 RPD，速度快
// 两者都是 OpenAI 兼容的 /audio/transcriptions 契约。

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

export async function handleTranscribe(request, env) {
  // CORS 预检
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const form = await request.formData();
    const audioFile = form.get('audio');        // File 对象
    const clientMime = form.get('mime') || '';  // 客户端检测到的 MIME，转发给 Whisper 用

    if (!audioFile || typeof audioFile === 'string') {
      return json({ error: 'Missing audio file' }, 400);
    }

    const audioBytes = await audioFile.arrayBuffer();

    // ---- Provider ----
    // Groq：标准 OpenAI 兼容 /audio/transcriptions，实测可用，免费额度 2000 RPD、速度快。
    // 注：OpenRouter 的 /audio/transcriptions 实测返回
    // "invalid content-type: multipart/form-data"，不兼容标准 transcription，故弃用。
    const providers = [];
    if (env.GROQ_API_KEY) {
      providers.push({
        name: 'groq',
        url: 'https://api.groq.com/openai/v1/audio/transcriptions',
        key: env.GROQ_API_KEY,
        model: 'whisper-large-v3',
        extraHeaders: {},
      });
    }
    if (providers.length === 0) {
      return json({ error: 'No ASR API key configured (需要 GROQ_API_KEY)' }, 500);
    }

    let lastErr = null;
    for (const p of providers) {
      try {
        const text = await transcribeWith(p, audioBytes, audioFile.name, clientMime);
        return json({ text, provider: p.name });
      } catch (e) {
        console.error(`[${p.name}] transcribe failed:`, e?.status, e?.message);
        lastErr = e;
      }
    }
    return json({ error: lastErr?.message || 'All ASR providers failed' }, 502);

  } catch (e) {
    console.error('Transcribe error:', e);
    return json({ error: 'Internal server error' }, 500);
  }
}

// 转发 multipart 到 OpenAI 兼容的 /audio/transcriptions 端点。
async function transcribeWith(provider, audioBytes, filename, clientMime) {
  // 用客户端检测到的 MIME 重建 Blob，保证 Whisper 正确解析容器
  // （Chrome/FF=webm/opus，Safari=mp4/aac）。MIME 不匹配是 Whisper 400 的头号原因。
  const mime = clientMime || 'audio/webm';
  let ext = 'webm';
  if (mime.includes('mp4')) ext = 'm4a';
  else if (mime.includes('ogg')) ext = 'ogg';
  const name = filename && /\.\w+$/.test(filename) ? filename : `audio.${ext}`;

  const fd = new FormData();
  fd.append('file', new Blob([audioBytes], { type: mime }), name);
  fd.append('model', provider.model);
  fd.append('response_format', 'json');
  fd.append('language', 'en');

  const headers = {
    'Authorization': `Bearer ${provider.key}`,
    ...provider.extraHeaders,
    // 不手动设 Content-Type，运行时自动加 multipart boundary
  };

  const res = await fetch(provider.url, { method: 'POST', headers, body: fd });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const err = new Error(`${provider.name} HTTP ${res.status}: ${detail.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const text = (data.text || '').trim();
  if (!text) throw new Error(`${provider.name} returned empty transcript`);
  return text;
}
