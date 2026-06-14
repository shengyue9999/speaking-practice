// 腾讯云智聆口语评测（新版）—— 生成签名 WebSocket URL。
// Worker 只负责签名（SecretKey 不出 Worker），前端拿 URL 直连腾讯云 WebSocket。

import { signSoeUrl } from './tencent-sign.js';

/**
 * @param {object} env   - Worker env（含 TENCENT_SECRET_ID/KEY/APPID）
 * @param {object} opts  - { refText, evalMode }
 * @returns {Promise<{ url: string, voiceId: string }>}
 */
export async function generatePronounceUrl(env, { refText, evalMode }) {
  const secretId  = env.TENCENT_SECRET_ID;
  const secretKey = env.TENCENT_SECRET_KEY;
  const appId     = env.TENCENT_APPID;
  if (!secretId || !secretKey || !appId) {
    throw new Error('TENCENT_SECRET_ID / TENCENT_SECRET_KEY / TENCENT_APPID not configured');
  }

  const now = Math.floor(Date.now() / 1000);
  const voiceId = crypto.randomUUID();
  const params = {
    timestamp: now,
    expired: now + 300,               // 5 分钟内有效
    nonce: Math.floor(Math.random() * 9000000000) + 1000000000,
    server_engine_type: '16k_en',     // 英文
    voice_id: voiceId,
    voice_format: 1,                  // WAV
    eval_mode: evalMode || 1,         // 默认句子模式
    score_coeff: 1.5,
    rec_mode: 1,                      // 录音模式：一次性发完
    sentence_info_enabled: 0,
  };
  if (refText) params.ref_text = refText;

  const url = await signSoeUrl({ secretId, secretKey, appId, params });
  return { url, voiceId };
}
