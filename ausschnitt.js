/* Bild-Ausschnitt-Helfer. Die Vorschau nutzt cropStyle() aus shared.js,
   also exakt dieselbe Formel wie die echte Seite. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const frame = $('#frame'), img = $('#img'), msg = $('#msg');
  const zoom = $('#zoom'), px = $('#px'), py = $('#py'), out = $('#out'), shape = $('#shape');
  let objUrl = null;

  const HINTS = {
    circle: 'Profilbild auf der Startseite und die Profilbilder bei den Freunden.',
    square: 'Logos in den Link-Buttons (Startseite und Freunde).',
    card: 'Titelbild in der Blog-Übersicht (Vorschau-Karte). Derselbe Wert gilt auch für das große Bild im Beitrag.',
    wide: 'Hintergrundbilder. Die Position bestimmt, welche Stelle im Mittelpunkt bleibt. Am Handy wird hochkant ausgeschnitten, dort ist der sichtbare Bereich ein anderer.',
    natural: 'Bild auf der Startseite und Titelbild im Blog-Beitrag.'
  };

  const clamp = (v, a, b) => Math.min(b, Math.max(a, Number(v) || 0));
  const current = () => `${zoom.value} ${px.value} ${py.value}`;

  function paint() {
    $('#zv').textContent = zoom.value + ' %';
    $('#xv').textContent = px.value + ' %';
    $('#yv').textContent = py.value + ' %';
    const st = cropStyle(current());
    if (st) img.setAttribute('style', st); else img.removeAttribute('style');
  }
  function fromSliders() { out.value = current(); paint(); }
  function fromText() {
    const n = out.value.match(/\d+/g);
    if (!n || n.length < 3) return;
    zoom.value = clamp(n[0], 100, 400);
    px.value = clamp(n[1], 0, 100);
    py.value = clamp(n[2], 0, 100);
    paint();
  }
  function setShape() {
    frame.className = 'frame ' + shape.value;
    $('#hint').textContent = HINTS[shape.value];
  }
  function show(src) {
    msg.textContent = '';
    img.classList.remove('broken');
    img.src = src;
  }

  img.addEventListener('error', () => { msg.textContent = 'Das Bild konnte nicht geladen werden. Prüfe den Pfad.'; });

  $('#file').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (objUrl) URL.revokeObjectURL(objUrl);
    objUrl = URL.createObjectURL(f);
    show(objUrl);
  });

  const loadPath = () => { const p = $('#path').value.trim(); if (p) show(resolveImg(p)); };
  $('#load').addEventListener('click', loadPath);
  $('#path').addEventListener('keydown', e => { if (e.key === 'Enter') loadPath(); });

  [zoom, px, py].forEach(el => el.addEventListener('input', fromSliders));
  out.addEventListener('input', fromText);
  shape.addEventListener('change', setShape);

  $('#reset').addEventListener('click', () => { zoom.value = 100; px.value = 50; py.value = 50; fromSliders(); });
  $('#copy').addEventListener('click', async () => {
    const btn = $('#copy');
    try { await navigator.clipboard.writeText(out.value); }
    catch (e) { out.select(); document.execCommand('copy'); }
    btn.textContent = 'Kopiert ✓';
    setTimeout(() => { btn.textContent = 'Wert kopieren'; }, 1800);
  });

  setShape();
  fromSliders();
})();
