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
  if (/^#\/[\w\/%-]*$/.test(u)) return u;          // interne Seite, z. B. #/blog
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

/* Schlichte Linien-Icons für bekannte Plattformen. Ein eigenes Emoji im Feld "Icon"
   oder ein hochgeladenes Logo hat weiterhin Vorrang. */
const SVG_ICONS = {
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  instagram: '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
  tiktok: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  youtube: '<rect x="2" y="5" width="20" height="14" rx="4"/><path d="M10 9l5 3-5 3z"/>',
  twitch: '<path d="M21 2H3v16h5v4l4-4h5l4-4V2z"/><path d="M11 7v4M16 7v4"/>',
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-12.2 7.5L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z"/>',
  x: '<path d="M4 4l16 16M20 4L4 20"/>',
  github: '<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>',
  headphones: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>',
  gamepad: '<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 12.5h4M9 10.5v4"/><path d="M16 12h.01M18.5 13.5h.01"/>',
  facebook: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
  linkedin: '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>',
  send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'
};
const HOST_ICONS = {
  'instagram.com': 'instagram', 'tiktok.com': 'tiktok', 'youtube.com': 'youtube', 'youtu.be': 'youtube',
  'twitch.tv': 'twitch', 'kick.com': 'twitch', 'discord.gg': 'chat', 'discord.com': 'chat',
  'twitter.com': 'x', 'x.com': 'x', 'github.com': 'github', 'spotify.com': 'headphones',
  'soundcloud.com': 'headphones', 'steamcommunity.com': 'gamepad', 'steampowered.com': 'gamepad',
  'facebook.com': 'facebook', 'linkedin.com': 'linkedin', 't.me': 'send', 'telegram.org': 'send',
  'wa.me': 'chat', 'whatsapp.com': 'chat', 'threads.net': 'chat',
  'paypal.me': 'heart', 'paypal.com': 'heart', 'ko-fi.com': 'heart', 'patreon.com': 'heart',
  'buymeacoffee.com': 'heart', 'streamelements.com': 'heart', 'streamlabs.com': 'heart'
};
const svgIcon = k => `<svg class="gi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SVG_ICONS[k] || SVG_ICONS.link}</svg>`;

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

function iconGlyph(l) {
  const ic = String(l.icon || '').trim();
  if (ic && !/\.(png|jpe?g|gif|webp|svg|avif)$/i.test(ic)) return esc(ic);     // eigenes Emoji/Zeichen
  const url = String(l.url || '').trim();
  if (/^mailto:/i.test(url)) return svgIcon('mail');
  try {
    const host = new URL(safeHref(url)).hostname.replace(/^www\./, '');
    for (const k in HOST_ICONS) if (host === k || host.endsWith('.' + k)) return svgIcon(HOST_ICONS[k]);
  } catch (e) { /* ignorieren */ }
  return svgIcon('link');
}

/* Eigenes Logo/Bild (Feld "logo") ersetzt das Emoji. Lädt das Bild nicht, bleibt das Emoji sichtbar. */
function iconHtml(l) {
  const logo = String(l.logo || '').trim();
  const ic = String(l.icon || '').trim();
  const img = logo || (/\.(png|jpe?g|gif|webp|svg|avif)$/i.test(ic) ? ic : '');
  if (img) return `<span class="lg"><span class="fb">${iconGlyph(l)}</span><img src="${esc(resolveImg(img))}" alt=""${cropAttr(logo ? l.logoCrop : '')}></span>`;
  return iconGlyph(l);
}

function avatarHtml(src, name, size, crop) {
  const letter = esc(String(name || '?').trim().charAt(0).toUpperCase() || '?');
  const img = src ? `<img src="${esc(resolveImg(src))}" alt="${esc(name)}"${cropAttr(crop)}>` : '';
  return `<div class="avatar ${size || 'md'}"><span>${letter}</span>${img}</div>`;
}

/* Domain für die Zeile unter dem Kanalnamen (falls kein eigener Untertitel gesetzt ist) */
function hostOf(u) {
  const raw = String(u || '').trim();
  if (/^mailto:/i.test(raw)) return raw.replace(/^mailto:/i, '');
  try { return new URL(safeHref(raw)).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
}

/* Eine Zeile in der Linkliste (Startseite) */
function linkRow(l) {
  const sub = String(l.sub || '').trim() || hostOf(l.url);
  return `<a class="lnk" href="${esc(safeHref(l.url))}" target="_blank" rel="noopener noreferrer">
    <span class="tl">${iconHtml(l)}</span>
    <span class="lnk-t"><b>${esc(l.label || l.url)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span>
  </a>`;
}

/* Links in Gruppen: "group" steht nur beim ersten Link einer Gruppe, die folgenden gehören dazu */
function groupLinks(links) {
  const out = []; let cur = null;
  (links || []).forEach(l => {
    const g = String(l.group || '').trim();
    if (!cur || (g && g !== cur.name)) { cur = { name: g, items: [] }; out.push(cur); }
    cur.items.push(l);
  });
  return out;
}

/* Button unter dem Text: style = primary (hell) oder secondary (dunkel) */
function ctaBtn(b) {
  const href = safeHref(b.url);
  const ext = /^https?:/i.test(href);
  return `<a class="btn${b.style === 'secondary' ? '' : ' p'}" href="${esc(href)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(b.label || b.url)}</a>`;
}

/* "Gaming, Streaming" -> ['Gaming', 'Streaming'] */
function splitTags(s) {
  return String(s || '').split(/[,;\n]/).map(t => t.trim()).filter(Boolean).slice(0, 12);
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
