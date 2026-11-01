/* Polpal Studio engine preview: live 3D view of a character build.
   Same Three.js r128 + GLTFLoader as the game. All text goes through textContent. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  // Mounted at '/' (engine.py serve) or '/engine/' (Studio tab 05).
  const BASE = location.pathname.startsWith('/engine') ? '/engine' : '';
  const el = (tag, props = {}, kids = []) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'text') node.textContent = v; else if (k === 'style') node.style.cssText = v; else node.setAttribute(k, v);
    }
    kids.forEach((kid) => node.appendChild(kid));
    return node;
  };
  const STAGES = { base: 'Rzeźba bazowa', optimize: 'Uproszczenie do budżetu gry', start: 'Start', body: 'Ciało', face: 'Twarz', hair: 'Włosy', clothing: 'Ubranie', accessories: 'Akcesoria',
    normalise: 'Wysokość 1,8', rig: 'Szkielet 22 kości', animation: 'Animacje', validate: 'Kontrola', export: 'Eksport GLB',
    reimport: 'Ponowny import', done: 'Gotowe', error: 'Błąd' };

  // ---------------------------------------------------------------- 3D viewer
  const canvas = $('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.outputEncoding = THREE.sRGBEncoding;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x131717);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(2, 4, 3); scene.add(key);
  const grid = new THREE.GridHelper(4, 16, 0x4e5949, 0x26302a); scene.add(grid);
  const pivot = new THREE.Group(); scene.add(pivot);
  let yaw = 0.35, pitch = 0.08, distance = 4.2, model = null, mixer = null, clips = [], shown = null;
  const clock = new THREE.Clock();
  function placeCamera() {
    camera.position.set(Math.sin(yaw) * Math.cos(pitch) * distance, 0.9 + Math.sin(pitch) * distance, Math.cos(yaw) * Math.cos(pitch) * distance);
    camera.lookAt(0, 0.9, 0);
  }
  function resize() {
    const box = canvas.parentElement.getBoundingClientRect();
    renderer.setSize(box.width, box.height, false); camera.aspect = box.width / Math.max(1, box.height); camera.updateProjectionMatrix();
  }
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { drag = [e.clientX, e.clientY, yaw, pitch]; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    yaw = drag[2] - (e.clientX - drag[0]) * 0.01;
    pitch = Math.max(-0.4, Math.min(1.2, drag[3] + (e.clientY - drag[1]) * 0.01));
  });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); distance = Math.max(1.5, Math.min(9, distance * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: false });
  window.addEventListener('resize', resize);
  (function loop() {
    requestAnimationFrame(loop); placeCamera(); if (mixer) mixer.update(clock.getDelta()); else clock.getDelta();
    renderer.render(scene, camera);
  })();
  resize();

  const loader = new THREE.GLTFLoader();
  function showModel(url, label, animated) {
    if (url === shown) return;
    shown = url;
    loader.load(url, (gltf) => {
      if (model) pivot.remove(model);
      model = gltf.scene; pivot.add(model);
      mixer = null; clips = gltf.animations || [];
      const bar = $('clips'); bar.textContent = '';
      if (animated && clips.length) {
        mixer = new THREE.AnimationMixer(model);
        clips.forEach((clip) => {
          const b = el('button', { text: clip.name });
          b.onclick = () => {
            mixer.stopAllAction(); mixer.clipAction(clip).play();
            [...bar.children].forEach((x) => x.classList.toggle('on', x === b));
          };
          bar.appendChild(b);
        });
      }
      const tags = $('overlay'); tags.textContent = '';
      tags.appendChild(el('span', { class: 'tag', text: label }));
    }, undefined, () => { shown = null; });
  }

  // ---------------------------------------------------------------- data
  let current = null, timer = null;
  async function api(path, options) {
    const r = await fetch(BASE + path, options);
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || r.statusText);
    return data;
  }
  async function refreshList(select) {
    const data = await api('/api/runs');
    const box = $('runs'); box.textContent = '';
    data.runs.forEach((run) => box.appendChild(el('option', { value: run.id, text: `${run.name} · ${run.status}` })));
    if (!data.blender) $('status').textContent = 'Blender nie znaleziony – uruchom serwer z --blender';
    const id = select || current || (data.runs[0] && data.runs[0].id);
    if (id) { box.value = id; open(id); }
  }
  $('runs').onchange = () => open($('runs').value);
  $('file').onchange = async () => {
    const file = $('file').files[0];
    if (!file) return;
    const type = file.name.toLowerCase().endsWith('.zip') ? 'application/zip' : file.type;
    $('status').textContent = 'Wysyłanie i analiza…';
    try {
      const data = await api('/api/runs', { method: 'POST', body: file,
        headers: { 'Content-Type': type, 'X-Polpal-Engine': '1', 'X-Pack-Name': encodeURIComponent(file.name) } });
      await refreshList(data.id);
    } catch (e) { $('status').textContent = 'Błąd: ' + e.message; }
    $('file').value = '';
  };

  function open(id) {
    current = id; shown = null;
    clearInterval(timer); timer = setInterval(() => load(id), 1000); load(id);
  }
  async function load(id) {
    let s;
    try { s = await api('/api/runs/' + encodeURIComponent(id)); } catch (e) { $('status').textContent = e.message; return; }
    if (id !== current) return;
    $('status').textContent = `${s.name}: ${s.status}${s.message ? ' – ' + s.message : ''}`;
    if (!['analysing', 'building', 'queued'].includes(s.status)) clearInterval(timer);
    const base = BASE + '/runs/' + encodeURIComponent(id) + '/';
    // references
    const refs = $('refList'); refs.textContent = '';
    ((s.recipe && s.recipe.references) || []).forEach((r) => refs.appendChild(
      el('figure', {}, [el('img', { src: base + 'reference/' + encodeURIComponent(r.file), alt: r.file }),
        el('figcaption', { text: `${r.role}${r.primary ? ' · główny' : ''}` })])));
    // events + live model
    const list = $('events'); list.textContent = '';
    let latest = null;
    (s.events || []).forEach((ev) => {
      const info = ev.triangles ? `${ev.triangles} tr.` : ev.bones ? `${ev.bones} kości` : ev.clips ? `${ev.clips.length} klipów` : ev.message || '';
      list.appendChild(el('li', {}, [el('span', { class: ev.status, text: STAGES[ev.stage] || ev.stage }), el('span', { class: 'src', text: `${info} · ${ev.t}s` })]));
      if (ev.glb) latest = ev;
    });
    if (s.status === 'building' || s.status === 'queued') list.appendChild(el('li', {}, [el('span', { class: 'running', text: 'w toku…' })]));
    if (latest && s.build) {
      const final = latest.glb === 'character.glb';
      showModel(base + s.build + '/' + latest.glb, final ? 'Gotowy model z animacjami' : 'Etap: ' + (STAGES[latest.stage] || latest.stage), final);
    }
    // recipe panels
    const r = s.recipe; if (!r) return;
    const b = r.base || { kind: 'parametric' };
    $('base').textContent = b.kind === 'sculpted'
      ? `Rzeźba: ${b.label || b.id} · dopasowanie ${Number(b.score).toFixed(2)}`
      : 'Parametryczna (bryły) – brak pasującej rzeźby' + ((r.base_candidates || []).length
        ? ` · najbliższa: ${r.base_candidates[0].label} ${Number(r.base_candidates[0].score).toFixed(2)}` : '');
    const prov = r.provenance || {};
    const pal = $('palette'); pal.textContent = '';
    Object.entries(r.palette).forEach(([slot, hex]) => {
      const p = prov['palette.' + slot];
      pal.appendChild(el('div', { class: 'swatch', title: p ? (p.text || p.file || p.source) : 'domyślne' },
        [el('i', { style: 'background:' + hex }), el('span', { text: slot }), el('span', { class: 'src', text: p ? p.source : 'def.' })]));
    });
    const props = $('props'); props.textContent = '';
    Object.entries(r.proportions).forEach(([k, v]) => {
      const p = prov['proportions.' + k];
      props.appendChild(el('tr', {}, [el('td', { text: k }), el('td', { text: String(v) }), el('td', { class: 'src', text: p ? p.source : 'def.' })]));
    });
    const warn = $('warnings'); warn.textContent = '';
    ((s.reference_report && s.reference_report.warnings) || []).concat(s.status === 'failed' && s.message ? [s.message] : [])
      .forEach((w) => warn.appendChild(el('div', { class: 'warn', text: w })));
    if (!warn.children.length) warn.appendChild(el('div', { class: 'src', text: 'brak' }));
    showVariant(id, r, s.status);
    const renders = $('renders'); renders.textContent = '';
    (s.renders || []).forEach((p) => renders.appendChild(el('img', { src: base + p, alt: p })));
  }
  // ---------------------------------------------------------------- variants of a sculpted base
  const VARIANT_SLOTS = { hair_root: 'Włosy – nasada', hair_tip: 'Włosy – końcówki', eyes: 'Oczy', brows: 'Brwi',
    jacket: 'Kurtka', fur: 'Futro', top: 'Top', shorts: 'Szorty', socks: 'Skarpety', boots: 'Buty i skóra',
    sphere_primary: 'Kule – kolor', sphere_secondary: 'Kule – druga barwa', hammer_wood: 'Młot – drewno', rune_glow: 'Runy' };
  let variantFor = null, variantRecipe = null;
  function showVariant(id, r, status) {
    const box = $('variant');
    box.hidden = !(r.base && r.base.kind === 'sculpted');
    if (box.hidden || variantFor === id + ':' + (r.name || '')) return;
    variantFor = id + ':' + (r.name || ''); variantRecipe = r;
    $('variantName').value = r.name || '';
    const list = $('variantColours'); list.textContent = '';
    Object.entries(VARIANT_SLOTS).forEach(([slot, label]) => {
      const input = el('input', { type: 'color', 'data-slot': slot, value: (r.palette[slot] || '#ffffff').toLowerCase() });
      list.appendChild(el('label', { class: 'swatch' }, [input, el('span', { text: label })]));
    });
    $('partWeapon').checked = r.parts.weapon.style !== 'none';
    $('partCollar').checked = r.parts.top.collar === 'fur';
    $('partSpheres').checked = (r.parts.back.spheres || 0) > 0;
    $('variantQuality').value = r.quality;
  }
  $('buildVariant').onclick = async () => {
    if (!variantRecipe || !current) return;
    const recipe = JSON.parse(JSON.stringify(variantRecipe));
    recipe.name = $('variantName').value.trim() || recipe.name;
    document.querySelectorAll('#variantColours input[type=color]').forEach((i) => { recipe.palette[i.dataset.slot] = i.value.toUpperCase(); });
    recipe.parts.weapon.style = $('partWeapon').checked ? 'hammer' : 'none';
    recipe.parts.top.collar = $('partCollar').checked ? 'fur' : 'none';
    recipe.parts.back.spheres = $('partSpheres').checked ? Math.max(1, variantRecipe.parts.back.spheres || 5) : 0;
    recipe.quality = $('variantQuality').value;
    $('status').textContent = 'Budowa wariantu…';
    try {
      await api('/api/runs/' + encodeURIComponent(current) + '/build', { method: 'POST', body: JSON.stringify({ recipe }),
        headers: { 'Content-Type': 'application/json', 'X-Polpal-Engine': '1' } });
      variantFor = null; open(current);
    } catch (e) { $('status').textContent = 'Błąd: ' + e.message; }
  };

  refreshList();
})();
