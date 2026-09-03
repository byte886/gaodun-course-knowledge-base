#!/usr/bin/env node
// Playwright run-code: 在考试页注入 fetch/XHR 网络钩子并 reload，使钩子先于页面脚本生效，
// 把高顿业务请求（请求+响应）记录到 window.__net，供 dump_exam_net.js 导出。
//
// 用法（会话 ga，先切到试卷标签页）：
//   1) npx playwright cli -s=ga run-code scripts/capture_exam_net.js   # 注入钩子并reload
//   2) 在页面上操作：浏览题目 / 展开解析 / 查看用户笔记（请求会被自动记录）
//   3) npx playwright cli -s=ga eval "window.__netBlockWrite=true"      # 可选：阻断写请求
//   4) npx playwright cli -s=ga run-code scripts/dump_exam_net.js      # 导出JSON
//
// 零写入保证：默认 __netBlockWrite=false（只读采集，不拦截任何请求）。
// 置为 true 后，POST/PUT/DELETE/PATCH 会被 abort/伪造响应——用于"捕获交卷payload但不真正发送"。
// 形态对齐 scripts/capture_key.js（run-code 接收 async (page)=>{}）。

async (page) => {
  await page.addInitScript(() => {
    window.__net = [];
    window.__netBlockWrite = false;
    const MAX_BODY = 20000;

    // 只记录高顿业务请求，过滤静态资源/音视频
    const isBiz = (url) => {
      if (!url) return false;
      const u = String(url);
      if (/\.(js|css|png|jpe?g|gif|svg|webp|woff2?|ttf|ico|mp4|m3u8|ts|mp3|aac|map)(\?|$)/i.test(u)) return false;
      return /gaodun\.com/i.test(u);
    };
    const clip = (s) => {
      if (s == null) return null;
      if (typeof s !== 'string') { try { s = JSON.stringify(s); } catch (e) { return '[unserializable]'; } }
      return s.length > MAX_BODY ? s.slice(0, MAX_BODY) + `...[truncated total=${s.length}]` : s;
    };
    // 兼容 string / URLSearchParams / FormData / 对象 等请求体
    const bodyToStr = (b) => {
      if (b == null) return null;
      if (typeof b === 'string') return clip(b);
      if (b instanceof URLSearchParams) return clip(b.toString());
      if (typeof FormData !== 'undefined' && b instanceof FormData) {
        const o = {};
        try { b.forEach((v, k) => { o[k] = (typeof File !== 'undefined' && v instanceof File) ? `[File ${v.name}]` : v; }); } catch (e) {}
        return clip(o);
      }
      return clip(b);
    };
    const headersToObj = (h) => {
      if (!h) return null;
      try {
        if (typeof Headers !== 'undefined' && h instanceof Headers) { const o = {}; h.forEach((v, k) => { o[k] = v; }); return o; }
        if (Array.isArray(h)) { const o = {}; h.forEach((p) => { if (Array.isArray(p)) o[p[0]] = p[1]; }); return o; }
        if (typeof h === 'object') return h;
      } catch (e) {}
      return String(h);
    };
    const push = (o) => { try { window.__net.push(Object.assign({ t: Date.now() }, o)); } catch (e) {} };
    const isWrite = (m) => /^(POST|PUT|DELETE|PATCH)$/i.test(m || 'GET');

    // ---- hook fetch ----
    if (!window.__fetchHooked) {
      window.__fetchHooked = true;
      const origFetch = window.fetch;
      window.fetch = function (input, init) {
        let url = '', method = 'GET', reqBody = null, reqHeaders = null;
        try {
          url = typeof input === 'string' ? input : (input && input.url) || '';
          method = (init && init.method) || (input && input.method) || 'GET';
          reqBody = bodyToStr(init && init.body);
          reqHeaders = headersToObj((init && init.headers) || (input && input.headers));
        } catch (e) {}
        const block = !!window.__netBlockWrite && isWrite(method) && isBiz(url);
        push({ kind: 'fetch', phase: 'req', method, url, reqHeaders, reqBody, blocked: block });
        if (block) {
          // 不真正发送，返回伪造响应
          return Promise.resolve(new Response(JSON.stringify({ blocked: true, by: 'capture_exam_net' }), {
            status: 200, headers: { 'content-type': 'application/json' }
          }));
        }
        return origFetch.apply(this, arguments).then((resp) => {
          try {
            if (isBiz(url)) {
              resp.clone().text().then((txt) => push({
                kind: 'fetch', phase: 'resp', method, url, status: resp.status, respBody: clip(txt)
              })).catch(() => {});
            }
          } catch (e) {}
          return resp;
        });
      };
    }

    // ---- hook XMLHttpRequest ----
    if (!window.__xhrHooked) {
      window.__xhrHooked = true;
      const oOpen = XMLHttpRequest.prototype.open;
      const oSend = XMLHttpRequest.prototype.send;
      const oSetH = XMLHttpRequest.prototype.setRequestHeader;
      XMLHttpRequest.prototype.open = function (m, u) { this.__m = m; this.__u = u; this.__h = {}; return oOpen.apply(this, arguments); };
      XMLHttpRequest.prototype.setRequestHeader = function (k, v) { try { this.__h[k] = v; } catch (e) {} return oSetH.apply(this, arguments); };
      XMLHttpRequest.prototype.send = function (body) {
        const block = !!window.__netBlockWrite && isWrite(this.__m) && isBiz(this.__u);
        push({ kind: 'xhr', phase: 'req', method: this.__m, url: this.__u, reqHeaders: this.__h, reqBody: bodyToStr(body), blocked: block });
        if (block) { try { this.abort(); } catch (e) {} return; }
        this.addEventListener('loadend', () => {
          try { if (isBiz(this.__u)) push({ kind: 'xhr', phase: 'resp', method: this.__m, url: this.__u, status: this.status, respBody: clip(this.responseText) }); } catch (e) {}
        });
        return oSend.apply(this, arguments);
      };
    }
  });

  // reload 使钩子在页面自身脚本之前安装，从而抓到首屏题目下发请求
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const status = await page.evaluate(() => JSON.stringify({
    href: location.href,
    hookedFetch: !!window.__fetchHooked,
    hookedXhr: !!window.__xhrHooked,
    captured: (window.__net || []).length
  }));
  return status;
}
