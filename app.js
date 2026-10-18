(async function () {
  const app = document.getElementById('app');
  const navEl = document.getElementById('nav');
  const brandEl = document.getElementById('brand');
  const foot = document.getElementById('foot');
  const PAGES = ['home', 'blog', 'friends', 'impressum'];
  let D;

  try {
    const res = await fetch('data.json?v=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status);
    D = await res.json();
  } catch (e) {
    app.innerHTML = '<p class="empty">Die Inhalte (data.json) konnten nicht geladen werden.<br>' +
      'Wenn du die Datei lokal öffnest: Das geht nur über einen Webserver oder direkt auf GitHub Pages.</p>';
    document.title = 'Fehler';
    return;
  }

  D.site = D.site || {}; D.nav = D.nav || {}; D.home = D.home || {};
  D.links = D.links || []; D.posts = D.posts || []; D.friends = D.friends || [];
  D.impressum = D.impressum || {};

  // Beiträge brauchen eine ID für ihre Adresse. Fehlt sie, wird sie aus Titel und Datum gebildet.
  const slugify = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const usedIds = new Set();
  D.posts.forEach((p, i) => {
    let id = p.id || [slugify(p.title) || 'beitrag', p.date || ''].filter(Boolean).join('-');
    while (usedIds.has(id)) id += '-' + (i + 1);
    p.id = id; usedIds.add(id);
  });
  D.friends.forEach(f => { f.links = f.links || []; });

  applyTheme(D.site);
  applyFonts(D.font);
  applyGlow(D.glow);
  setFavicon(D.site.favicon || D.site.avatar);   // ohne eigenes Favicon wird das Profilbild genommen

  // Hintergrundbild pro Seite, abgedunkelt damit Texte lesbar bleiben
  const bgEl = document.createElement('div');
  bgEl.id = 'bg-img';
  bgEl.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(bgEl, document.body.firstChild);
  function setBackground(page) {
    const B = D.backgrounds || {};
    const src = String(B[page] || '').trim();
    if (!src) { bgEl.classList.remove('on'); return; }
    let dim = parseInt(B.dim, 10);
    if (isNaN(dim)) dim = 55;
    dim = Math.min(90, Math.max(0, dim)) / 100;
    const url = resolveImg(src).replace(/["'\\\n\r()]/g, '');
    const shade = `rgba(13, 13, 15, ${dim})`;
    bgEl.style.backgroundImage = `linear-gradient(${shade}, ${shade}), url("${url}")`;
    // Zoom und Ausschnitt des Hintergrundbilds
    const c = parseCrop(B[page + 'Crop']);
    bgEl.style.backgroundPosition = c ? `${c.x}% ${c.y}%` : '';
    bgEl.style.transform = c ? `scale(${c.z / 100})` : '';
    bgEl.style.transformOrigin = c ? `${c.x}% ${c.y}%` : '';
    bgEl.classList.add('on');
  }

  const label = p => D.nav[p] || { home: 'Home', blog: 'Blog', friends: 'Freunde', impressum: 'Impressum' }[p];

  /* ---------- Kopfleiste und Fußzeile ---------- */
  brandEl.innerHTML = `${avatarHtml(D.site.avatar, D.site.title, 'sm', D.site.avatarCrop)}<span>${esc(D.site.title || '')}</span>`;
  navEl.innerHTML = PAGES.map(p => `<a href="#/${p}" data-page="${p}">${esc(label(p))}</a>`).join('');
  foot.innerHTML = `<div class="foot-in"><span>© ${new Date().getFullYear()} ${esc(D.site.title || '')}</span>` +
    `<nav aria-label="Fußmenü">${PAGES.map(p => `<a href="#/${p}">${esc(label(p))}</a>`).join('')}</nav></div>`;

  /* ---------- Startseite: Hero + Bausteine ---------- */
  const sortedPosts = () => [...D.posts].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const num = (v, def) => { const n = parseInt(v, 10); return n > 0 ? n : def; };
  const secHead = (title, linkLabel, href) =>
    `<div class="sh"><h2>${esc(title)}</h2>${linkLabel ? `<a href="${href}">${esc(linkLabel)}</a>` : ''}</div>`;

  function renderSection(b) {
    b = b || {};
    switch (b.type) {
      case 'channels':
        if (!D.links.length) return '';
        return `<section class="sec">${secHead(b.title || 'Meine Kanäle')}
          <div class="chan-grid">${D.links.map(channelCard).join('')}</div></section>`;

      case 'text': {
        const img = b.image
          ? `<div class="txt-img"><img src="${esc(resolveImg(b.image))}" alt="" loading="lazy"${cropAttr(b.imageCrop)}></div>` : '';
        const tags = splitTags(b.tags).map(t => `<span class="chip static">${esc(t)}</span>`).join('');
        const btn = b.buttonLabel && b.buttonUrl ? ctaBtn({ label: b.buttonLabel, url: b.buttonUrl, style: 'secondary' }) : '';
        return `<section class="sec txt${img ? ' has-img' : ''}${b.imageSide === 'right' ? ' img-right' : ''}">${img}
          <div class="txt-body">${b.title ? `<h2>${esc(b.title)}</h2>` : ''}
            ${b.text ? `<div class="prose">${md(b.text)}</div>` : ''}
            ${tags ? `<div class="chips">${tags}</div>` : ''}${btn}</div></section>`;
      }

      case 'posts': {
        const list = sortedPosts().slice(0, num(b.count, 3));
        if (!list.length) return '';
        const ll = b.linkLabel === undefined ? 'Alle Beiträge →' : b.linkLabel;
        return `<section class="sec">${secHead(b.title || 'Neueste Beiträge', ll, '#/blog')}
          <div class="grid compact">${list.map(p => postCard(p, '#/blog/' + encodeURIComponent(p.id))).join('')}</div></section>`;
      }

      case 'friends': {
        const list = D.friends.slice(0, num(b.count, 4));
        if (!list.length) return '';
        const ll = b.linkLabel === undefined ? 'Alle ansehen →' : b.linkLabel;
        return `<section class="sec">${secHead(b.title || 'Freunde', ll, '#/friends')}
          <div class="grid friends-grid">${list.map(f => friendCard(f)).join('')}</div></section>`;
      }
      default: return '';
    }
  }

  function vHome() {
    const h = D.home, s = D.site;
    const buttons = (h.buttons || []).filter(b => b && (b.label || b.url)).map(ctaBtn).join('');
    // Ohne eigene Bausteine im CMS: Kanäle, Beiträge, Freunde
    const sections = Array.isArray(h.sections) && h.sections.length
      ? h.sections : [{ type: 'channels' }, { type: 'posts' }, { type: 'friends' }];
    return `
      <section class="hero">
        <div class="hero-text">
          ${s.tagline ? `<span class="tag">${esc(s.tagline)}</span>` : ''}
          <h1>${esc(h.headline || s.title || '')}</h1>
          ${h.text ? `<div class="lead prose">${md(h.text)}</div>` : ''}
          ${buttons ? `<div class="cta">${buttons}</div>` : ''}
        </div>
        <div class="hero-av">${avatarHtml(s.avatar, s.title, 'xl', s.avatarCrop)}</div>
      </section>
      ${h.image ? `<div class="home-frame"><img class="home-image" src="${esc(resolveImg(h.image))}" alt=""${cropAttr(h.imageCrop)}></div>` : ''}
      ${sections.map(renderSection).join('')}`;
  }

  /* ---------- Blog, Freunde, Impressum ---------- */
  function vBlog(id) {
    if (id) {
      const p = D.posts.find(x => x.id === id);
      if (!p) return `<a class="back" href="#/blog">← Zurück zum Blog</a><p class="empty">Diesen Beitrag gibt es nicht (mehr).</p>`;
      document.title = `${p.title} – ${D.site.title || ''}`;
      return `
        <article class="article">
          <a class="back" href="#/blog">← Zurück zum Blog</a>
          ${p.cover ? `<div class="hero-frame"><img class="hero-img" src="${esc(resolveImg(p.cover))}" alt=""${cropAttr(p.coverCrop)}></div>` : ''}
          <time>${esc(fmtDate(p.date))}</time>
          <h1>${esc(p.title)}</h1>
          <div class="prose">${md(p.content || p.preview || '')}</div>
        </article>`;
    }
    const posts = sortedPosts();
    return `
      <h1 class="page-title">${esc(label('blog'))}</h1>
      ${posts.length
        ? `<div class="grid">${posts.map(p => postCard(p, '#/blog/' + encodeURIComponent(p.id))).join('')}</div>`
        : '<p class="empty">Noch keine Beiträge.</p>'}`;
  }

  function vFriends() {
    return `
      <h1 class="page-title">${esc(label('friends'))}</h1>
      ${D.friends.length
        ? `<div class="grid">${D.friends.map(f => friendCard(f)).join('')}</div>`
        : '<p class="empty">Noch keine Freunde eingetragen.</p>'}`;
  }

  function vImpressum() {
    const i = D.impressum;
    return `
      <article class="article">
        <h1>${esc(i.title || label('impressum'))}</h1>
        <div class="prose">${md(i.text || '')}</div>
      </article>`;
  }

  /* ---------- Routing (#/home, #/blog, #/blog/ID, …) ---------- */
  function render() {
    const raw = location.hash.replace(/^#\/?/, '') || 'home';
    const [pageRaw, argRaw] = raw.split('/');
    const page = PAGES.includes(pageRaw) ? pageRaw : 'home';
    const arg = argRaw ? decodeURIComponent(argRaw) : '';
    setBackground(page);

    document.title = `${label(page)} – ${D.site.title || ''}`;
    app.innerHTML = { home: vHome, blog: vBlog, friends: vFriends, impressum: vImpressum }[page](arg);
    navEl.querySelectorAll('a').forEach(a => {
      const on = a.dataset.page === page;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', render);
  render();
})();
