/* Local Wi-Fi FPS diagnostic. Run alongside `npm start`; no production files change. */
import { createServer, request as httpRequest } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { networkInterfaces } from 'node:os';

const PORT = Number(process.env.PHONE_BENCHMARK_PORT || 5199);
const UPSTREAM = Number(process.env.PHONE_BENCHMARK_UPSTREAM_PORT || 5173);
const TOKEN = randomBytes(24).toString('hex');
const MAX_BODY = 1024;

function localAddress(address = '') {
  const octets = address.replace(/^::ffff:/, '').split('.').map(Number);
  if (octets.length !== 4 || octets.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = octets;
  return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function permittedPath(path) {
  if (['/game.html', '/three.min.js', '/manifest.webmanifest', '/favicon.png', '/apple-touch-icon.jpg', '/icon-192.png', '/icon-512.png'].includes(path)) return true;
  const file = '(?:[a-zA-Z0-9._-]+/)*[a-zA-Z0-9._-]+';
  if (path.split('/').includes('..')) return false;
  return new RegExp(`^/(?:src|assets|vendor)/${file}\\.(?:js|css|json|glb|gltf|bin|png|jpg|jpeg|webp|svg|ico|mp3|ogg|wav|woff2?)$`).test(path)
    || new RegExp(`^/sounds/${file}\\.(?:mp3|ogg|wav)$`).test(path)
    || new RegExp(`^/img/${file}\\.(?:png|jpg|jpeg|webp|svg)$`).test(path);
}

function validReport(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') return false;
  const keys = Object.keys(value).sort();
  if (keys.join(',') !== 'dpr,fps,height,model,p95Ms,quality,width') return false;
  for (const [key, min, max] of [['fps', 0.01, 240], ['p95Ms', 1, 60000], ['width', 100, 10000], ['height', 100, 10000], ['dpr', 0.5, 8]]) {
    if (typeof value[key] !== 'number' || !Number.isFinite(value[key]) || value[key] < min || value[key] > max) return false;
  }
  return Number.isInteger(value.width) && Number.isInteger(value.height)
    && ['auto', 'battery', 'balanced', 'high', 'unknown'].includes(value.quality)
    && ['mobile', 'full', 'procedural', 'unknown'].includes(value.model);
}

function diagnosticScript() {
  return `(() => {
  'use strict';
  const token = ${JSON.stringify(TOKEN)};
  const panel = document.createElement('div');
  panel.setAttribute('role', 'status');
  panel.setAttribute('aria-live', 'polite');
  panel.style.cssText = 'position:fixed;right:8px;top:8px;z-index:2147483647;max-width:260px;padding:8px 10px;border-radius:8px;background:#10213de8;color:#fff;font:13px/1.4 system-ui,sans-serif;pointer-events:none';
  document.body.append(panel);
  const show = message => { panel.textContent = 'FPS тест: ' + message; };
  function active() {
    try { return eval('started') === 1 && !eval('menuO') && !eval('ccO') && !eval('pfO') && !eval('ivO'); }
    catch (_) { return false; }
  }
  let phase = 'waiting', elapsed = 0, previous = null, frames = [];
  const reset = message => { phase = 'waiting'; elapsed = 0; previous = null; frames = []; show(message); };
  reset('почніть гру, потім грайте 35 с у видимій вкладці.');
  function tick(now) {
    requestAnimationFrame(tick);
    if (phase === 'done' || phase === 'sending') return;
    if (document.hidden || !active()) {
      if (phase !== 'waiting') reset(document.hidden ? 'вкладку приховано; вимір скинуто.' : 'поверніться до гри; вимір скинуто.');
      return;
    }
    if (phase === 'waiting') { phase = 'warmup'; previous = now; show('розігрів 5 с; грайте звичайно.'); return; }
    const dt = now - previous; previous = now;
    // A slow rendered frame belongs in the result. A gap over a minute means the page was suspended.
    if (dt <= 0 || dt > 60000) { reset('сторінку призупинено; почніть вимір знову.'); return; }
    elapsed += dt;
    if (phase === 'warmup') {
      if (elapsed >= 5000) { phase = 'measure'; elapsed = 0; previous = now; show('вимір 30 с; грайте звичайно.'); }
      return;
    }
    frames.push(dt);
    if (elapsed < 30000) return;
    phase = 'sending';
    frames.sort((a, b) => a - b);
    let quality = 'unknown';
    try { const mode = window.plQuality.state().mode; if (['auto', 'battery', 'balanced', 'high'].includes(mode)) quality = mode; } catch (_) {}
    const hero = window.importedHero;
    const model = hero && hero.status === 'ready' ? (hero.url.endsWith('hero-mobile.glb') ? 'mobile' : 'full') : hero && ['failed', 'unavailable'].includes(hero.status) ? 'procedural' : 'unknown';
    const report = { fps: Math.round(frames.length * 100000 / elapsed) / 100, p95Ms: Math.round(frames[Math.ceil(frames.length * .95) - 1] * 100) / 100,
      width: innerWidth, height: innerHeight, dpr: devicePixelRatio, quality, model };
    fetch('/__phone-benchmark/report', { method: 'POST', headers: { 'content-type': 'application/json', 'x-benchmark-token': token }, body: JSON.stringify(report) })
      .then(response => { if (!response.ok) throw Error('HTTP ' + response.status); phase = 'done'; show(report.fps + ' FPS · p95 ' + report.p95Ms + ' мс · ' + report.width + '×' + report.height + ' · DPR ' + report.dpr + ' · ' + report.quality + ' · ' + report.model + '. Збережено на Mac.'); })
      .catch(() => { phase = 'done'; show('результат не збережено на Mac; перевірте сервер.'); });
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden && phase !== 'done' && phase !== 'sending') reset('вкладку приховано; вимір скинуто.'); });
  requestAnimationFrame(tick);
})();`;
}

function respond(res, code, message) {
  res.writeHead(code, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
  res.end(message);
}

const server = createServer((req, res) => {
  if (!localAddress(req.socket.remoteAddress)) return respond(res, 403, 'Local network only');
  let url;
  try { url = new URL(req.url, 'http://benchmark.local'); } catch { return respond(res, 400, 'Bad URL'); }
  if (url.pathname === '/__phone-benchmark/report') {
    if (req.method !== 'POST') return respond(res, 405, 'Method not allowed');
    const origin = req.headers.origin;
    if (origin && origin !== `http://${req.headers.host}`) return respond(res, 403, 'Bad origin');
    const given = req.headers['x-benchmark-token'];
    if (typeof given !== 'string' || given.length !== TOKEN.length || !timingSafeEqual(Buffer.from(given), Buffer.from(TOKEN))) return respond(res, 403, 'Bad token');
    if (req.headers['content-type']?.split(';')[0] !== 'application/json') return respond(res, 415, 'JSON required');
    if (Number(req.headers['content-length']) > MAX_BODY) return respond(res, 413, 'Body too large');
    const chunks = []; let size = 0;
    req.on('data', chunk => { size += chunk.length; if (size > MAX_BODY) { if (!res.writableEnded) respond(res, 413, 'Body too large'); } else chunks.push(chunk); });
    req.on('end', () => {
      if (size > MAX_BODY) return;
      let report;
      try { report = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return respond(res, 400, 'Bad JSON'); }
      if (!validReport(report)) return respond(res, 400, 'Invalid report');
      console.log(`📱 Telefon: ${report.fps.toFixed(2)} FPS · p95 ${report.p95Ms.toFixed(2)} ms · ${report.width}×${report.height} · DPR ${report.dpr} · jakość ${report.quality} · model ${report.model}`);
      respond(res, 204, '');
    });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return respond(res, 405, 'Method not allowed');
  if (url.pathname === '/') { res.writeHead(302, { location: '/game.html', 'cache-control': 'no-store' }); return res.end(); }
  if (url.pathname === '/__phone-benchmark.js') {
    const body = diagnosticScript();
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(req.method === 'HEAD' ? '' : body);
  }
  if (!permittedPath(url.pathname)) return respond(res, 404, 'Not found');
  const upstream = httpRequest({ hostname: '127.0.0.1', port: UPSTREAM, method: req.method, path: url.pathname + url.search, headers: { accept: req.headers.accept || '*/*', 'accept-encoding': 'identity' } }, upstreamRes => {
    if (url.pathname !== '/game.html' || upstreamRes.statusCode !== 200 || req.method === 'HEAD') {
      res.writeHead(upstreamRes.statusCode, { 'content-type': upstreamRes.headers['content-type'] || 'application/octet-stream', 'cache-control': 'no-store' });
      upstreamRes.pipe(res); return;
    }
    const chunks = []; let size = 0;
    upstreamRes.on('data', chunk => { size += chunk.length; if (size > 2_000_000) { upstreamRes.destroy(); respond(res, 502, 'HTML too large'); } else chunks.push(chunk); });
    upstreamRes.on('end', () => {
      if (size > 2_000_000) return;
      const html = Buffer.concat(chunks).toString('utf8');
      if (!html.includes('</body>')) return respond(res, 502, 'HTML injection failed');
      const body = html.replace('</body>', '<script src="/__phone-benchmark.js"></script></body>');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); res.end(body);
    });
  });
  upstream.on('error', () => respond(res, 502, 'Start game server on port ' + UPSTREAM));
  upstream.end();
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`FPS benchmark: http://localhost:${PORT}/game.html`);
  for (const entries of Object.values(networkInterfaces())) for (const item of entries || []) {
    if (item.family === 'IPv4' && !item.internal && localAddress(item.address)) console.log(`Telefon w tej samej sieci Wi-Fi: http://${item.address}:${PORT}/game.html`);
  }
  console.log('Uruchom grę na telefonie; wynik pojawi się tutaj po 5 s rozgrzewki i 30 s gry.');
});
