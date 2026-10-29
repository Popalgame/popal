import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { runInNewContext } from 'node:vm';

test('phone benchmark proxies game, injects measurement, and accepts only aggregate local reports', async t => {
  const upstream = createServer((req, res) => {
    if (req.url === '/game.html') { res.setHeader('content-type', 'text/html'); return res.end('<html><body>Game</body></html>'); }
    res.end('asset');
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  t.after(() => upstream.close());
  const port = await new Promise((resolve, reject) => {
    const probe = createServer(); probe.once('error', reject); probe.listen(0, '127.0.0.1', () => {
      const value = probe.address().port; probe.close(() => resolve(value));
    });
  });
  const child = spawn(process.execPath, ['scripts/phone-benchmark.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PHONE_BENCHMARK_PORT: String(port), PHONE_BENCHMARK_UPSTREAM_PORT: String(upstream.address().port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  t.after(() => child.kill());
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 50; i++) {
    try { const response = await fetch(base + '/', { redirect: 'manual' }); ready = response.status === 302; if (ready) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.ok(ready, output);
  const html = await (await fetch(base + '/game.html')).text();
  assert.match(html, /Game<script src="\/__phone-benchmark.js"><\/script><\/body>/);
  const script = await (await fetch(base + '/__phone-benchmark.js')).text();
  assert.match(script, /eval\('started'\) === 1/);
  assert.match(script, /document\.hidden/);
  assert.match(script, /elapsed >= 5000/);
  assert.match(script, /elapsed < 30000/);
  assert.match(script, /frames\.sort/);
  const queued = [];
  const sent = [];
  const page = { hidden: false, createElement: () => ({ style: {}, setAttribute() {} }), body: { append() {} }, addEventListener() {} };
  const context = { document: page, window: { plQuality: { state: () => ({ mode: 'auto' }) }, importedHero: { status: 'ready', url: 'assets/models/hero-mobile.glb' } },
    started: 1, menuO: 0, ccO: 0, pfO: 0, ivO: 0, innerWidth: 844, innerHeight: 390, devicePixelRatio: 3,
    requestAnimationFrame: callback => queued.push(callback), fetch: (...args) => { sent.push(args); return Promise.resolve({ ok: true }); } };
  runInNewContext(script, context);
  let clock = 0;
  const frames = count => { for (let i = 0; i < count; i++) { clock += 100; queued.shift()(clock); } };
  frames(100);
  page.hidden = true;
  frames(1);
  page.hidden = false;
  frames(349);
  assert.equal(sent.length, 0, 'a hidden tab resets warmup and the 30-second sample');
  frames(2);
  assert.equal(sent.length, 1);
  const measured = JSON.parse(sent[0][1].body);
  assert.deepEqual(Object.keys(measured).sort(), ['dpr', 'fps', 'height', 'model', 'p95Ms', 'quality', 'width']);
  assert.equal(measured.fps, 10);
  assert.equal(measured.p95Ms, 100);
  const slowQueue = [];
  const slowReports = [];
  runInNewContext(script, { ...context, document: { ...page, hidden: false },
    requestAnimationFrame: callback => slowQueue.push(callback), fetch: (...args) => { slowReports.push(args); return Promise.resolve({ ok: true }); } });
  let slowClock = 0;
  const slowFrames = (count, duration) => { for (let i = 0; i < count; i++) { slowClock += duration; slowQueue.shift()(slowClock); } };
  slowFrames(51, 100); // first callback starts warmup; the next 50 finish it
  slowFrames(100, 100);
  slowFrames(20, 1000);
  assert.equal(slowReports.length, 1, 'visible one-second frames must stay in the sample');
  const slow = JSON.parse(slowReports[0][1].body);
  assert.equal(slow.fps, 4);
  assert.equal(slow.p95Ms, 1000);
  const token = script.match(/const token = "([a-f0-9]+)"/)[1];
  assert.equal((await fetch(base + '/sw.js')).status, 404);
  assert.equal((await fetch(base + '/sounds/music/day.mp3')).status, 200);
  assert.equal((await fetch(base + '/img/pals/0.webp')).status, 200);
  assert.equal((await fetch(base + '/sounds/music/day.js')).status, 404);
  assert.equal((await fetch(base + '/img/pals/01.html')).status, 404);
  assert.equal((await fetch(base + '/__phone-benchmark/report', { method: 'GET' })).status, 405);
  const report = { fps: 59.5, p95Ms: 18.2, width: 844, height: 390, dpr: 3, quality: 'auto', model: 'mobile' };
  const post = (value, headers = {}) => fetch(base + '/__phone-benchmark/report', { method: 'POST', headers: { 'content-type': 'application/json', 'x-benchmark-token': token, ...headers }, body: JSON.stringify(value) });
  assert.equal((await post(report, { origin: 'http://evil.example' })).status, 403);
  assert.equal((await post({ ...report, coordinates: [1, 2] })).status, 400);
  assert.equal((await post({ ...report, fps: 'fast' })).status, 400);
  assert.equal((await post({ ...report, fps: 0.5, p95Ms: 12000 })).status, 204);
  assert.equal((await post(report, { 'x-benchmark-token': 'wrong' })).status, 403);
  assert.equal((await post(report)).status, 204);
  assert.match(output, /59\.50 FPS.*p95 18\.20 ms.*844×390.*mobile/);
});
