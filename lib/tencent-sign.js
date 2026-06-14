// 腾讯云智聆口语评测（新版）WebSocket API 签名 —— HMAC-SHA1 + Base64。
// 纯 Web Crypto API 实现，Cloudflare Worker 原生兼容。

const encoder = new TextEncoder();

/** HMAC-SHA1 签名，返回 Base64 字符串 */
async function hmacSha1Base64(keyBytes, message) {
  const keyInput = typeof keyBytes === 'string' ? encoder.encode(keyBytes) : keyBytes;
  const key = await crypto.subtle.importKey(
    'raw', keyInput, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  const msgInput = typeof message === 'string' ? encoder.encode(message) : message;
  const sig = await crypto.subtle.sign('HMAC', key, msgInput);
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

/**
 * 生成新版 SOE WebSocket 签名 URL。
 * 文档：https://cloud.tencent.com/document/product/1774/107497
 *
 * @param {object} opts
 * @param {string} opts.secretId   - TENCENT_SECRET_ID
 * @param {string} opts.secretKey  - TENCENT_SECRET_KEY
 * @param {string} opts.appId      - 腾讯云 AppID
 * @param {object} opts.params     - 除 signature 外的请求参数（纯 key:value）
 * @returns {Promise<string>}      - 完整 wss URL
 */
export async function signSoeUrl({ secretId, secretKey, appId, params }) {
  // 所有参数（含 secretid），不含 signature
  const all = { ...params, secretid: secretId };
  // 字典序排序
  const sorted = Object.keys(all).sort();
  // 拼接签名原文（不 urlencode 参数名和值）
  const signSrc = 'soe.cloud.tencent.com/soe/api/' + appId + '?' +
    sorted.map(k => k + '=' + all[k]).join('&');
  // HMAC-SHA1 → Base64
  const signature = await hmacSha1Base64(secretKey, signSrc);
  // 拼接实际 URL（参数名和值都要 urlencode，signature 也要）
  const qs = sorted.map(k =>
    encodeURIComponent(k) + '=' + encodeURIComponent(String(all[k]))
  ).join('&') + '&signature=' + encodeURIComponent(signature);
  return 'wss://soe.cloud.tencent.com/soe/api/' + appId + '?' + qs;
}
