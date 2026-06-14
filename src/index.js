// Cloudflare Worker 入口。
// 工具挂在 /en 路径下（通过 Workers Route sheng-1980.cc/en* 触发）。
// 职责：剥离 /en 前缀 → API 路由走 ASR，其余交给静态资源绑定（ASSETS）。

import { handleTranscribe } from '../lib/transcribe.js';

// 工具挂载路径前缀。访问 https://sheng-1980.cc/en/ 进入工具。
const PATH_PREFIX = '/en';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // /en（无尾斜杠）→ 301 到 /en/，保证前端相对路径（fetch('api/transcribe')）解析正确
    if (path === PATH_PREFIX) {
      return Response.redirect(url.origin + PATH_PREFIX + '/', 301);
    }

    // 剥离前缀：/en/api/transcribe → /api/transcribe；/en/ → /
    let sub;
    if (path.startsWith(PATH_PREFIX + '/')) {
      sub = path.slice(PATH_PREFIX.length) || '/';
    } else {
      // 不带前缀的请求（兜底，理论上 Route 不会匹配到）
      sub = path;
    }

    // API 路由
    if (sub === '/api/transcribe') {
      return handleTranscribe(request, env);
    }

    // 静态资源：把 URL 改写成剥离前缀的，交给 assets 绑定 serve（index.html 等）
    const assetUrl = new URL(request.url);
    assetUrl.pathname = sub;
    const assetReq = new Request(assetUrl, request);
    return env.ASSETS.fetch(assetReq);
  }
};
