// 腾讯云智聆口语评测（SOE）—— 基础版 TransmitOralProcessWithInit。
// 接收前端发来的 base64 WAV 音频 + 参考文本，返回发音评分。

import { signTC3 } from './tencent-sign.js';

/**
 * @param {string} audioBase64 - 16kHz 16bit mono WAV 的 base64 编码
 * @param {string} refText     - 参考文本（原文）
 * @param {object} env         - Worker env（含 TENCENT_SECRET_ID / TENCENT_SECRET_KEY / TENCENT_REGION）
 * @returns {Promise<object>}  - 腾讯云 SOE 响应 JSON
 */
export async function pronounceAudio(audioBase64, refText, env) {
  const secretId  = env.TENCENT_SECRET_ID;
  const secretKey = env.TENCENT_SECRET_KEY;
  if (!secretId || !secretKey) {
    throw new Error('TENCENT_SECRET_ID / TENCENT_SECRET_KEY not configured');
  }

  const host    = 'soe.tencentcloudapi.com';
  const service = 'soe';
  const region  = env.TENCENT_REGION || 'ap-guangzhou';
  const action  = 'TransmitOralProcessWithInit';

  // 去掉用户可能在音频 base64 前加的 data:…;base64, 前缀
  const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, '');

  const payload = {
    SeqId: 1,
    IsEnd: 1,
    VoiceFileType: 2,            // 2 = WAV
    VoiceEncodeType: 1,          // 1 = PCM
    RefText: refText,
    WorkMode: 0,                 // 0 = 流式评估
    EvalMode: 1,                 // 1 = 句子模式（0=单词,1=句子,2=段落,3=自由说）
    ScoreCoeff: 1.0,             // 评分苛刻指数，1.0 标准
    SessionId: crypto.randomUUID(),
    UserVoiceData: cleanBase64,
    ServerType: 1,               // 1 = 英文
  };

  const { authorization, timestamp } =
    await signTC3(secretId, secretKey, service, host, action, payload, region);

  const res = await fetch(`https://${host}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Host': host,
      'X-TC-Action': action,
      'X-TC-Version': '2018-07-24',
      'X-TC-Timestamp': String(timestamp),
      'X-TC-Region': region,
      'Authorization': authorization,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Tencent SOE HTTP ${res.status}: ${errText.slice(0, 300)}`);
  }

  return res.json();
}
