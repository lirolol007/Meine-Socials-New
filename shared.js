/* Gemeinsame Funktionen für die Seite (index.html) und den Admin-Bereich (admin.html).
   Wichtig: Beide Seiten nutzen dieselben Funktionen, damit die Vorschau im Admin
   genau so aussieht wie auf der echten Seite. */

// Basis-Pfad für Bilder. Auf der Seite leer, im Admin die GitHub-Raw-URL.
window.IMG_BASE = '';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function resolveImg(p) {
  p = String(p || '').trim();
  if (!p) return '';
  if (/^(https?:|data:)/i.test(p)) return p;
  return window.IMG_BASE + p.replace(/^\/+/, '');
}

function safeHref(u) {
  u = String(u || '').trim();
  if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
  if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(u)) return 'https://' + u;
  return '#';
}

/* Mini-Formatierung für Blog und Impressum:
   Leerzeile = neuer Absatz, **fett**, [Text](https://link), ![](images/bild.jpg) */
function md(text) {
  return esc(text).trim().split(/\n{2,}/).filter(Boolean).map(block => {
    const html = block
      .replace(/!\[([^\]]*)\]\(([^\s)]+)\)/g, (_, alt, src) =>
        `<img src="${esc(resolveImg(src.replace(/&amp;/g, '&')))}" alt="${alt}" loading="lazy">`)
      .replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
    return `<p>${html}</p>`;
  }).join('');
}

const ICONS = {
  'instagram.com': '📸', 'tiktok.com': '🎵', 'youtube.com': '▶️', 'youtu.be': '▶️',
  'twitch.tv': '🎮', 'kick.com': '🎮', 'discord.gg': '💬', 'discord.com': '💬',
  'twitter.com': '🐦', 'x.com': '🐦', 'github.com': '🐙', 'spotify.com': '🎧',
  'soundcloud.com': '🎧', 'steamcommunity.com': '🕹️', 'steampowered.com': '🕹️',
  'snapchat.com': '👻', 'facebook.com': '👍', 'reddit.com': '👽', 't.me': '✈️',
  'telegram.org': '✈️', 'wa.me': '📞', 'whatsapp.com': '📞', 'linkedin.com': '💼',
  'paypal.me': '💸', 'paypal.com': '💸', 'pinterest.com': '📌', 'threads.net': '🧵'
};

/* Zoom und Ausschnitt: Wert "Zoom X Y", z. B. "140 50 35" (100 50 50 = unverändert).
   Zoom in Prozent (100 bis 400), X/Y = Position in Prozent (0 bis 100). */
function parseCrop(s) {
  const n = String(s == null ? '' : s).match(/\d+/g);
  if (!n || n.length < 3) return null;
  const z = Math.min(400, Math.max(100, +n[0]));
  const x = Math.min(100, +n[1]), y = Math.min(100, +n[2]);
  return (z === 100 && x === 50 && y === 50) ? null : { z, x, y };
}
function cropStyle(s) {
  const c = parseCrop(s);
  return c ? `object-position:${c.x}% ${c.y}%;transform:scale(${c.z / 100});transform-origin:${c.x}% ${c.y}%` : '';
}
function cropAttr(s) {
  const st = cropStyle(s);
  return st ? ` style="${st}"` : '';
}

function emojiFor(l) {
  const ic = String(l.icon || '').trim();
  if (ic && !/\.(png|jpe?g|gif|webp|svg|avif)$/i.test(ic)) return esc(ic);
  const url = String(l.url || '').trim();
  if (/^mailto:/i.test(url)) return '✉️';
  try {
    const host = new URL(safeHref(url)).hostname.replace(/^www\./, '');
    for (const k in ICONS) if (host === k || host.endsWith('.' + k)) return ICONS[k];
  } catch (e) { /* ignorieren */ }
  return '🔗';
}

/* Eigenes Logo/Bild (Feld "logo") ersetzt das Emoji. Lädt das Bild nicht, bleibt das Emoji sichtbar. */
function iconHtml(l) {
  const logo = String(l.logo || '').trim();
  const ic = String(l.icon || '').trim();
  const img = logo || (/\.(png|jpe?g|gif|webp|svg|avif)$/i.test(ic) ? ic : '');
  if (img) return `<span class="lg"><span class="fb">${emojiFor(l)}</span><img src="${esc(resolveImg(img))}" alt=""${cropAttr(logo ? l.logoCrop : '')}></span>`;
  return emojiFor(l);
}

function avatarHtml(src, name, size, crop) {
  const letter = esc(String(name || '?').trim().charAt(0).toUpperCase() || '?');
  const img = src ? `<img src="${esc(resolveImg(src))}" alt="${esc(name)}"${cropAttr(crop)}>` : '';
  return `<div class="avatar ${size || 'md'}"><span>${letter}</span>${img}</div>`;
}

function linkBtn(l) {
  return `<a class="link-btn" href="${esc(safeHref(l.url))}" target="_blank" rel="noopener noreferrer">
    <span class="ic">${iconHtml(l)}</span>
    <span class="lbl">${esc(l.label || l.url)}</span>
    <span class="go" aria-hidden="true">↗</span>
  </a>`;
}

function fmtDate(d) {
  if (!d) return '';
  const x = new Date(d + 'T12:00:00');
  if (isNaN(x)) return '';
  return x.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
}

function postCard(p, href) {
  const cover = p.cover
    ? `<img src="${esc(resolveImg(p.cover))}" alt="" loading="lazy"${cropAttr(p.coverCrop)}>`
    : '<div class="cover-ph">Kein Bild</div>';
  return `<a class="card post-card" href="${esc(href || '#')}">
    <div class="cover">${cover}</div>
    <div class="card-body">
      <time>${esc(fmtDate(p.date))}</time>
      <h3>${esc(p.title || 'Ohne Titel')}</h3>
      <p>${esc(p.preview || '')}</p>
    </div>
  </a>`;
}

function friendCard(f) {
  const links = (f.links || []).map(l =>
    `<a class="chip" href="${esc(safeHref(l.url))}" target="_blank" rel="noopener noreferrer"><span>${iconHtml(l)}</span>${esc(l.label || l.url)}</a>`
  ).join('');
  return `<article class="card friend">
    <div class="friend-head">${avatarHtml(f.avatar, f.name, 'md', f.avatarCrop)}<h3>${esc(f.name || 'Name')}</h3></div>
    ${f.bio ? `<p>${esc(f.bio)}</p>` : ''}
    <div class="chips">${links}</div>
  </article>`;
}

/* ---------- Schriftarten ---------- */
const FONT_PRESETS = {
  standard: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  rund: '"Nunito", "Varela Round", ui-rounded, "SF Pro Rounded", "Trebuchet MS", system-ui, sans-serif',
  comic: '"Comic Neue", "Comic Sans MS", "Comic Sans", "Chalkboard SE", "Marker Felt", cursive',
  handschrift: '"Segoe Print", "Bradley Hand", "Chalkboard SE", "Comic Sans MS", cursive',
  serif: 'Georgia, "Times New Roman", Times, serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace'
};

function fontFormat(path) {
  const ext = String(path).split('?')[0].split('.').pop().toLowerCase();
  return { woff2: 'woff2', woff: 'woff', ttf: 'truetype', otf: 'opentype' }[ext] || '';
}

/* font = { preset, file, headingPreset, headingFile }.
   Eine hochgeladene Datei hat Vorrang vor der Vorlage. Die Vorlage dient als Ersatz, falls die Datei nicht lädt. */
function applyFonts(font) {
  const f = font || {};
  let css = '';
  const stack = (preset, file, family) => {
    const base = FONT_PRESETS[preset] || FONT_PRESETS.standard;
    file = String(file || '').trim();
    if (!file) return base;
    const url = resolveImg(file).replace(/["'\\\n\r()]/g, '');
    const fmt = fontFormat(file);
    css += `@font-face{font-family:"${family}";src:url("${url}")${fmt ? ` format("${fmt}")` : ''};font-display:swap}`;
    return `"${family}", ${base}`;
  };
  const body = stack(f.preset, f.file, 'SeiteSchrift');
  const ownHead = f.headingFile || (f.headingPreset && f.headingPreset !== 'same');
  const headPreset = !f.headingPreset || f.headingPreset === 'same' ? f.preset : f.headingPreset;
  const head = ownHead ? stack(headPreset, f.headingFile, 'SeiteSchriftTitel') : body;

  let st = document.getElementById('seite-fonts');
  if (css) {
    if (!st) { st = document.createElement('style'); st.id = 'seite-fonts'; document.head.appendChild(st); }
    st.textContent = css;
  } else if (st) { st.remove(); }
  const root = document.documentElement.style;
  root.setProperty('--font', body);
  root.setProperty('--font-head', head);
}

/* Glow: eigene Farbe (sonst Akzentfarbe) und optionaler Schein hinter den Buttons */
function applyGlow(g) {
  g = g || {};
  const html = document.documentElement;
  const c = String(g.color || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(c)) {
    html.style.setProperty('--glow-rgb',
      `${parseInt(c.slice(1, 3), 16)}, ${parseInt(c.slice(3, 5), 16)}, ${parseInt(c.slice(5, 7), 16)}`);
  } else {
    html.style.removeProperty('--glow-rgb');
  }
  html.classList.remove('glow-hover', 'glow-always');
  if (g.buttons === 'hover') html.classList.add('glow-hover');
  else if (g.buttons === 'always') html.classList.add('glow-always');
}

/* Logo im Browser-Tab */
function setFavicon(path) {
  const href = resolveImg(path);
  if (!href) return;
  document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]').forEach(n => n.remove());
  ['icon', 'apple-touch-icon'].forEach(rel => {
    const l = document.createElement('link');
    l.rel = rel; l.href = href;
    document.head.appendChild(l);
  });
}

/* Akzentfarbe setzen und passende Schriftfarbe darauf berechnen */
function applyTheme(site) {
  const a = site && site.accent;
  if (!/^#[0-9a-f]{6}$/i.test(a || '')) return;
  const r = parseInt(a.slice(1, 3), 16), g = parseInt(a.slice(3, 5), 16), b = parseInt(a.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const root = document.documentElement.style;
  root.setProperty('--accent', a);
  root.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
  root.setProperty('--on-accent', lum > 0.55 ? '#0c0c0e' : '#ffffff');
}

/* Kaputte Bilder ausblenden (z. B. Pfad falsch) – dann bleibt der Buchstabe sichtbar */
document.addEventListener('error', e => {
  if (e.target && e.target.tagName === 'IMG') e.target.classList.add('broken');
}, true);
