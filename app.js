(async function () {
  const app = document.getElementById('app');
  const navEl = document.getElementById('nav');
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

  const label = p => D.nav[p] || { home: 'Home', blog: 'Blog', friends: 'Freunde', impressum: 'Impressum' }[p];

  navEl.innerHTML = PAGES
    .map(p => `<a href="#/${p}" data-page="${p}">${esc(label(p))}</a>`).join('');

  const year = new Date().getFullYear();
  foot.innerHTML = `© ${year} ${esc(D.site.title || '')} · <a href="#/impressum">${esc(label('impressum'))}</a>`;

  /* ---------- Ansichten ---------- */
  function vHome() {
    const h = D.home;
    return `
      <section class="hero">
        ${avatarHtml(D.site.avatar, D.site.title, 'lg')}
        <h1>${esc(h.headline || D.site.title || '')}</h1>
        ${D.site.tagline ? `<p class="tagline">${esc(D.site.tagline)}</p>` : ''}
      </section>
      ${h.text ? `<div class="intro prose">${md(h.text)}</div>` : ''}
      ${h.image ? `<img class="home-image" src="${esc(resolveImg(h.image))}" alt="">` : ''}
      <section class="links" aria-label="Meine Links">
        ${D.links.length ? D.links.map(l => linkBtn(l)).join('') : '<p class="empty">Noch keine Links.</p>'}
      </section>`;
  }

  function sortedPosts() {
    return [...D.posts].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }

  function vBlog(id) {
    if (id) {
      const p = D.posts.find(x => x.id === id);
      if (!p) return `<a class="back" href="#/blog">← Zurück zum Blog</a><p class="empty">Diesen Beitrag gibt es nicht (mehr).</p>`;
      document.title = `${p.title} – ${D.site.title || ''}`;
      return `
        <article class="article">
          <a class="back" href="#/blog">← Zurück zum Blog</a>
          ${p.cover ? `<img class="hero-img" src="${esc(resolveImg(p.cover))}" alt="">` : ''}
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
