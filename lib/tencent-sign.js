// 腾讯云 API 3.0 TC3-HMAC-SHA256 签名。
// 纯 Web Crypto API 实现，Cloudflare Worker 原生兼容，不依赖 Node SDK。

const encoder = new TextEncoder();

/** SHA-256 哈希，返回 hex 字符串 */
async function sha256Hex(data) {
  const input = typeof data === 'string' ? encoder.encode(data) : data;
  const buf = await crypto.subtle.digest('SHA-256', input);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** HMAC-SHA256，返回原始字节（Uint8Array） */
async function hmacRaw(keyBytes, message) {
  const input = typeof keyBytes === 'string' ? encoder.encode(keyBytes) : keyBytes;
  const key = await crypto.subtle.importKey(
    'raw', input, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign(
    'HMAC', key, typeof message === 'string' ? encoder.encode(message) : message
  );
  return new Uint8Array(sig);
}

/** HMAC-SHA256，返回 hex 字符串 */
async function hmacHex(keyBytes, message) {
  const raw = await hmacRaw(keyBytes, message);
  return Array.from(raw).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 生成 TC3-HMAC-SHA256 签名。
 *
 * @param {string} secretId   - TENCENT_SECRET_ID
 * @param {string} secretKey  - TENCENT_SECRET_KEY
 * @param {string} service    - 产品名，如 "soe"
 * @param {string} host       - API 主机，如 "soe.tencentcloudapi.com"
 * @param {string} action     - 接口名，如 "TransmitOralProcessWithInit"
 * @param {object} payload    - 请求体（纯对象，会被 JSON.stringify）
 * @param {string} region     - 区域，如 "ap-guangzhou"
 * @returns {{ authorization, timestamp, date }}
 */
export async function signTC3(secretId, secretKey, service, host, action, payload, region) {
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const payloadStr = JSON.stringify(payload);

  // 1. 规范请求
  const canonicalHeaders = `content-type:application/json\nhost:${host}\n`;
  const signedHeaders = 'content-type;host';
  const hashedPayload = await sha256Hex(payloadStr);
  const canonicalRequest =
    `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${hashedPayload}`;

  // 2. 待签字符串
  const credentialScope = `${date}/${service}/tc3_request`;
  const hashedCanonicalRequest = await sha256Hex(canonicalRequest);
  const stringToSign =
    `TC3-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`;

  // 3. 派生签名密钥
  const kDate    = await hmacRaw('TC3' + secretKey, date);
  const kService = await hmacRaw(kDate, service);
  const kSigning = await hmacRaw(kService, 'tc3_request');

  // 4. 签名
  const signature = await hmacHex(kSigning, stringToSign);

  // 5. Authorization 头
  const authorization =
    `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { authorization, timestamp, date };
}
