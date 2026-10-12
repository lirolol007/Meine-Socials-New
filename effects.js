/* Hintergrund-Effekte: kleine leuchtende Partikel + weicher Lichtschleier unter der Maus.
   Alles läuft hinter bzw. über dem Inhalt, ohne ihn zu verändern oder Klicks abzufangen. */
(function () {
  'use strict';

  const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const canvas = document.createElement('canvas');
  canvas.id = 'fx-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const glow = document.createElement('div');
  glow.id = 'fx-glow';
  glow.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(canvas, document.body.firstChild);
  document.body.appendChild(glow);

  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  let rgb = [208, 208, 214];
  let sprite = null, coreStyle = 'rgb(208,208,214)';
  let parts = [];
  let last = performance.now(), frameNo = 0;
  const mouse = { x: -9999, y: -9999, active: false };
  const gpos = { x: 0, y: 0 };

  const rand = (a, b) => a + Math.random() * (b - a);

  function buildSprite() {
    const s = 64, c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d');
    const col = rgb.join(',');
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, `rgba(${col},1)`);
    grad.addColorStop(0.25, `rgba(${col},0.35)`);
    grad.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
    sprite = c;
    coreStyle = `rgb(${col})`;
  }

  // Akzentfarbe aus dem Design übernehmen (wird erst nach dem Laden der Seite gesetzt)
  function readRgb() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb');
    const v = String(raw).split(',').map(n => parseInt(n, 10));
    if (v.length === 3 && v.every(n => n >= 0 && n <= 255) && v.join() !== rgb.join()) {
      rgb = v;
      buildSprite();
    }
  }

  function spawn() {
    return {
      x: rand(0, W), y: rand(0, H),
      r: rand(0.6, 1.7),
      vx: rand(-0.012, 0.012), vy: rand(-0.02, -0.004),   // Pixel pro Millisekunde
      ph: rand(0, 6.283), sp: rand(0.0008, 0.0025),
      a: rand(0.35, 0.8)
    };
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const target = Math.max(18, Math.min(80, Math.round(W * H / 20000)));
    while (parts.length < target) parts.push(spawn());
    parts.length = Math.min(parts.length, target);
    if (reduce) draw(0, 0);
  }

  function draw(now, dt) {
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (!reduce) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
        if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; } else if (p.y > H + 10) p.y = -10;
      }
      let alpha = p.a * (0.55 + 0.45 * Math.sin(now * p.sp + p.ph));
      if (mouse.active) {                                   // in der Nähe der Maus leuchten sie stärker
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < 22500) alpha = Math.min(1, alpha + (1 - Math.sqrt(d2) / 150) * 0.55);
      }
      const gs = p.r * 9;
      ctx.globalAlpha = alpha * 0.55;
      ctx.drawImage(sprite, p.x - gs / 2, p.y - gs / 2, gs, gs);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = coreStyle;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 0.6, 0, 6.283);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function setGlow(x, y) {
    glow.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  function loop(now) {
    const dt = Math.min(50, now - last);
    last = now;
    if (++frameNo % 90 === 0) readRgb();
    draw(now, dt);
    if (mouse.active) {                                      // Schleier folgt der Maus weich
      const k = Math.min(1, dt * 0.012);
      gpos.x += (mouse.x - gpos.x) * k;
      gpos.y += (mouse.y - gpos.y) * k;
      setGlow(gpos.x, gpos.y);
    }
    requestAnimationFrame(loop);
  }

  function onMove(e) {
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (!mouse.active) {
      mouse.active = true;
      gpos.x = mouse.x; gpos.y = mouse.y;
      setGlow(gpos.x, gpos.y);
      glow.classList.add('on');
    }
    if (reduce) setGlow(mouse.x, mouse.y);
  }
  function off() { mouse.active = false; glow.classList.remove('on'); }

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onMove, { passive: true });
  window.addEventListener('pointerup', e => { if (e.pointerType === 'touch') off(); }, { passive: true });
  window.addEventListener('pointercancel', off, { passive: true });
  window.addEventListener('blur', off);
  document.documentElement.addEventListener('mouseleave', off);
  window.addEventListener('resize', resize);

  buildSprite();
  resize();
  readRgb();

  if (reduce) {
    // Bei "weniger Bewegung": Partikel stehen still, nur der Schleier folgt der Maus.
    [400, 1500].forEach(ms => setTimeout(() => { readRgb(); draw(0, 0); }, ms));
  } else {
    requestAnimationFrame(loop);
  }
})();
