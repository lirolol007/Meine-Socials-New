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
  if (img) return `<span class="fb">${emojiFor(l)}</span><img src="${esc(resolveImg(img))}" alt="">`;
  return emojiFor(l);
}

function avatarHtml(src, name, size) {
  const letter = esc(String(name || '?').trim().charAt(0).toUpperCase() || '?');
  const img = src ? `<img src="${esc(resolveImg(src))}" alt="${esc(name)}">` : '';
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
    ? `<img src="${esc(resolveImg(p.cover))}" alt="" loading="lazy">`
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
    <div class="friend-head">${avatarHtml(f.avatar, f.name, 'md')}<h3>${esc(f.name || 'Name')}</h3></div>
    ${f.bio ? `<p>${esc(f.bio)}</p>` : ''}
    <div class="chips">${links}</div>
  </article>`;
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
