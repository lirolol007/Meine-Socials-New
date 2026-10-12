/* Admin-Bereich
   Funktionsweise: Die Seite liest und schreibt deine Dateien (data.json und images/…)
   direkt in deinem GitHub-Repository über die GitHub-API. Dafür brauchst du einen Token,
   der nur in DEINEM Browser gespeichert wird. Ohne Token kann niemand etwas ändern. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const LS = 'socialseite-admin';
  const TABS = [
    ['general', 'Allgemein'], ['links', 'Links'], ['blog', 'Blog'],
    ['friends', 'Freunde'], ['impressum', 'Impressum'], ['media', 'Bilder'], ['access', 'Zugang']
  ];

  const DEFAULT = {
    site: { title: 'Dein Name', tagline: '', avatar: '', accent: '#d0d0d6' },
    nav: { home: 'Home', blog: 'Blog', friends: 'Freunde', impressum: 'Impressum' },
    home: { headline: 'Hey, schön dass du da bist.', text: '' },
    links: [], posts: [], friends: [],
    impressum: { title: 'Impressum', text: '' }
  };

  let cfg = null;
  try { cfg = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { /* ignorieren */ }
  let data = null, sha = null, dirty = false, tab = 'general', editPost = null, media = [];
  let keyBlob = null; // verschlüsselter Zugang (admin-key.json)

  /* ---------- Hilfsfunktionen ---------- */
  let toastTimer;
  function toast(msg, bad = false, ms = 3500) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'show' + (bad ? ' bad' : '');
    clearTimeout(toastTimer);
    if (ms) toastTimer = setTimeout(() => { t.className = ''; }, ms);
  }

  const getP = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const setP = (o, p, v) => {
    const ks = p.split('.'); const last = ks.pop();
    ks.reduce((a, k) => a[k], o)[last] = v;
  };
  const slug = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

  const b64ToUtf8 = b => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\s/g, '')), c => c.charCodeAt(0)));
  const utf8ToB64 = s => {
    let bin = ''; new TextEncoder().encode(s).forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin);
  };
  const blobToB64 = blob => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });

  function niceError(e) {
    if (e.status === 401) return 'Der Token ist ungültig oder abgelaufen.';
    if (e.status === 403) return 'Der Token hat keine Berechtigung (Contents: Read and write fehlt).';
    if (e.status === 404) return 'Repository nicht gefunden. Prüfe: (1) Schreibweise benutzername/repo – NICHT deine Domain, (2) der Token wurde genau für dieses Repository erstellt, (3) der Branch-Name stimmt (main oder master).';
    if (e.status === 409 || e.status === 422) return 'Die Datei wurde zwischenzeitlich geändert (z. B. auf einem anderen Gerät). Lade den Admin neu und versuche es nochmal.';
    return e.message || 'Unbekannter Fehler';
  }

  /* ---------- GitHub-API ---------- */
  async function gh(path, opts = {}) {
    let res;
    try {
      res = await fetch(`https://api.github.com/repos/${cfg.repo}/${path}`, {
        ...opts,
        headers: {
          'Authorization': `Bearer ${cfg.token}`,
          'Accept': 'application/vnd.github+json',
          ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
          ...(opts.headers || {})
        }
      });
    } catch (netErr) {
      // Diagnose: Ist GitHub überhaupt erreichbar (ohne Token)?
      let reachable = false;
      try { const z = await fetch('https://api.github.com/zen'); reachable = z.status < 500; } catch (e2) { /* nicht erreichbar */ }
      const err = new Error(reachable
        ? 'GitHub ist erreichbar, aber die Anfrage mit deinem Token wurde vom Browser abgebrochen. Der Token ist vermutlich unvollständig oder mit Sonderzeichen eingefügt. Kopiere ihn neu (nur Buchstaben, Zahlen und _).'
        : 'Dein Browser erreicht api.github.com nicht. Meist blockiert ein Werbeblocker, Brave Shields, ein VPN oder ein Netzwerkfilter (Schule/Arbeit) die Adresse. Schalte den Blocker für diese Seite aus, trenne das VPN oder probiere ein anderes Netz (z. B. mobile Daten) oder einen anderen Browser.');
      err.status = 0;
      throw err;
    }
    let json = null;
    try { json = await res.json(); } catch (e) { /* leere Antwort */ }
    if (!res.ok) {
      const err = new Error((json && json.message) || res.statusText);
      err.status = res.status;
      throw err;
    }
    return json;
  }

  function normalize() {
    data = Object.assign(structuredClone(DEFAULT), data);
    data.site = Object.assign({}, DEFAULT.site, data.site);
    data.nav = Object.assign({}, DEFAULT.nav, data.nav);
    data.home = Object.assign({}, DEFAULT.home, data.home);
    data.impressum = Object.assign({}, DEFAULT.impressum, data.impressum);
    data.links = data.links || []; data.posts = data.posts || []; data.friends = data.friends || [];
    data.posts.forEach(p => { if (!p.id) p.id = slug(p.title) + '-' + Date.now().toString(36); });
    data.friends.forEach(f => { f.links = f.links || []; });
  }

  async function loadData() {
    try {
      const j = await gh(`contents/data.json?ref=${encodeURIComponent(cfg.branch)}&t=${Date.now()}`);
      sha = j.sha;
      const text = j.content ? b64ToUtf8(j.content) : await (await fetch(j.download_url)).text();
      data = JSON.parse(text);
    } catch (e) {
      if (e.status === 404) { data = {}; sha = null; } else throw e;
    }
    normalize();
  }

  async function loadMedia() {
    try {
      const list = await gh(`contents/images?ref=${encodeURIComponent(cfg.branch)}&t=${Date.now()}`);
      media = list
        .filter(f => f.type === 'file' && /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(f.name))
        .map(f => ({ name: f.name, path: f.path, sha: f.sha, url: f.download_url }));
    } catch (e) {
      if (e.status === 404) media = []; else throw e;
    }
  }

  async function save() {
    const btn = $('#save');
    btn.disabled = true; btn.textContent = 'Speichere …';
    try {
      const body = {
        message: 'Inhalte aktualisiert (Admin)',
        content: utf8ToB64(JSON.stringify(data, null, 2) + '\n'),
        branch: cfg.branch
      };
      if (sha) body.sha = sha;
      const r = await gh('contents/data.json', { method: 'PUT', body: JSON.stringify(body) });
      sha = r.content.sha;
      dirty = false; updateDirty();
      toast('Gespeichert. Auf der Seite sichtbar in etwa 1 Minute.');
    } catch (e) {
      toast('Speichern fehlgeschlagen: ' + niceError(e), true, 7000);
    } finally {
      btn.disabled = false; btn.textContent = 'Speichern';
    }
  }

  /* ---------- Bilder ---------- */
  async function processImage(file) {
    if (/image\/(gif|svg)/.test(file.type)) {
      return { blob: file, ext: file.type.includes('gif') ? 'gif' : 'svg' };
    }
    const bmp = await createImageBitmap(file);
    const max = 1600;
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const png = file.type === 'image/png';
    const blob = await new Promise(r => c.toBlob(r, png ? 'image/png' : 'image/jpeg', 0.86));
    return { blob, ext: png ? 'png' : 'jpg' };
  }

  async function uploadFiles(files) {
    const added = [];
    for (const f of files) {
      try {
        toast(`Lade hoch: ${f.name} …`, false, 0);
        const { blob, ext } = await processImage(f);
        const name = `${slug(f.name.replace(/\.[^.]+$/, '')) || 'bild'}-${Date.now().toString(36)}.${ext}`;
        const r = await gh(`contents/images/${name}`, {
          method: 'PUT',
          body: JSON.stringify({
            message: `Bild hochgeladen: ${name}`,
            content: await blobToB64(blob),
            branch: cfg.branch
          })
        });
        const item = { name, path: `images/${name}`, sha: r.content.sha, url: r.content.download_url };
        media.unshift(item); added.push(item);
      } catch (e) {
        toast(`Fehler bei ${f.name}: ${niceError(e)}`, true, 7000);
      }
    }
    if (added.length) toast(`${added.length} Bild${added.length > 1 ? 'er' : ''} hochgeladen.`);
    return added;
  }

  async function delMedia(i) {
    const it = media[i];
    if (!confirm(`„${it.name}“ wirklich löschen?\nStellen, an denen das Bild benutzt wird, zeigen dann kein Bild mehr.`)) return;
    try {
      await gh(`contents/${it.path}`, {
        method: 'DELETE',
        body: JSON.stringify({ message: `Bild gelöscht: ${it.name}`, sha: it.sha, branch: cfg.branch })
      });
      media.splice(i, 1); renderPanel(); toast('Bild gelöscht.');
    } catch (e) { toast(niceError(e), true, 6000); }
  }

  /* Fenster zum Auswählen (und Hochladen) eines Bildes */
  function pickImage() {
    return new Promise(resolve => {
      const m = document.createElement('div');
      m.className = 'modal';
      document.body.appendChild(m);
      const close = v => { m.remove(); resolve(v); };
      const draw = () => {
        m.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true" aria-label="Bild auswählen">
          <div class="modal-head"><h3>Bild auswählen</h3><button class="btn ghost small" data-x>Schließen</button></div>
          <div class="modal-tools"><label class="btn">Neues Bild hochladen<input type="file" accept="image/*" multiple hidden data-up></label></div>
          ${media.length
            ? `<div class="media-grid">${media.map(it => `<button class="media-item" data-path="${esc(it.path)}"><img src="${esc(it.url)}" alt=""><span class="nm">${esc(it.name)}</span></button>`).join('')}</div>`
            : '<p class="muted">Noch keine Bilder hochgeladen.</p>'}
        </div>`;
      };
      draw();
      m.addEventListener('click', e => {
        if (e.target === m || e.target.closest('[data-x]')) return close(null);
        const b = e.target.closest('[data-path]');
        if (b) close(b.dataset.path);
      });
      m.addEventListener('change', async e => {
        if (!e.target.matches('[data-up]')) return;
        const files = [...e.target.files];
        if (files.length && (await uploadFiles(files)).length) draw();
      });
    });
  }

  /* ---------- Formularfelder ---------- */
  const val = p => { const v = getP(data, p); return v == null ? '' : v; };
  const F = {
    text: (label, p, ph = '', type = 'text') =>
      `<label class="field"><span>${label}</span><input type="${type}" data-bind="${p}" value="${esc(val(p))}" placeholder="${esc(ph)}" autocomplete="off"></label>`,
    area: (label, p, rows = 4, ph = '') =>
      `<label class="field"><span>${label}</span><textarea data-bind="${p}" rows="${rows}" placeholder="${esc(ph)}">${esc(val(p))}</textarea></label>`,
    img: (label, p) =>
      `<div class="field"><span>${label}</span><div class="img-field">
        <img class="thumb" data-thumb="${p}" alt="">
        <input data-bind="${p}" value="${esc(val(p))}" placeholder="Kein Bild gewählt" autocomplete="off">
        <button class="btn" data-pick="${p}">Auswählen</button></div></div>`
  };

  const arrows = (list, i) =>
    `<button class="btn small" data-act="up" data-list="${list}" data-i="${i}" aria-label="Nach oben">↑</button>
     <button class="btn small" data-act="down" data-list="${list}" data-i="${i}" aria-label="Nach unten">↓</button>
     <button class="btn small danger" data-act="del" data-list="${list}" data-i="${i}">Löschen</button>`;

  /* ---------- Tabs ---------- */
  function tGeneral() {
    return `<h2>Allgemein</h2>
      <div class="box">
        ${F.text('Dein Name / Seitenname', 'site.title')}
        ${F.text('Untertitel unter dem Namen', 'site.tagline')}
        ${F.img('Profilbild', 'site.avatar')}
        <label class="field"><span>Akzentfarbe (Rahmen, aktiver Menü-Button)</span>
          <input type="color" data-bind="site.accent" value="${esc(val('site.accent') || '#d0d0d6')}"></label>
      </div>
      <h3>Startseite</h3>
      <div class="box">
        ${F.text('Überschrift', 'home.headline')}
        ${F.area('Begrüßungstext', 'home.text', 4)}
      </div>
      <h3>Beschriftung der Menü-Buttons</h3>
      <div class="box row2">
        ${F.text('Button 1', 'nav.home')}${F.text('Button 2', 'nav.blog')}
        ${F.text('Button 3', 'nav.friends')}${F.text('Button 4', 'nav.impressum')}
      </div>`;
  }

  function tLinks() {
    return `<h2>Meine Links</h2>
      <p class="hint" style="margin-top:0">Diese Buttons erscheinen auf der Startseite. Das Icon wird automatisch erkannt (Instagram, TikTok, YouTube …). Du kannst auch ein eigenes Emoji eintragen.</p>
      ${data.links.map((l, i) => `<div class="box">
        <div class="box-head"><strong>${esc(l.label || 'Neuer Link')}</strong>${arrows('links', i)}</div>
        <div class="row2">${F.text('Name', `links.${i}.label`, 'z. B. Instagram')}${F.text('Icon (optional)', `links.${i}.icon`, 'Emoji, leer = automatisch')}</div>
        ${F.text('Adresse', `links.${i}.url`, 'https://…')}
      </div>`).join('')}
      <button class="btn primary" data-act="add" data-list="links">+ Link hinzufügen</button>`;
  }

  function tBlog() {
    if (editPost !== null && data.posts[editPost]) return tPostEditor();
    const rows = data.posts.map((p, i) => ({ p, i })).sort((a, b) => String(b.p.date || '').localeCompare(String(a.p.date || '')));
    return `<h2>Blog</h2>
      <p class="hint" style="margin-top:0">Beiträge werden auf der Seite nach Datum sortiert (neueste zuerst).</p>
      ${rows.map(({ p, i }) => `<div class="box post-row">
        ${p.cover ? `<img src="${esc(resolveImg(p.cover))}" alt="">` : '<div class="noimg"></div>'}
        <div class="info"><b>${esc(p.title || 'Ohne Titel')}</b><span>${esc(fmtDate(p.date))}</span></div>
        <button class="btn small" data-act="editPost" data-i="${i}">Bearbeiten</button>
        <button class="btn small danger" data-act="delPost" data-i="${i}">Löschen</button>
      </div>`).join('') || '<p class="empty">Noch keine Beiträge.</p>'}
      <button class="btn primary" data-act="newPost">+ Neuer Beitrag</button>`;
  }

  function tPostEditor() {
    const b = `posts.${editPost}`;
    return `<button class="btn ghost small" data-act="backPost">← Zur Liste</button>
      <h2 style="margin-top:14px">Beitrag bearbeiten</h2>
      <div class="box">
        ${F.text('Titel', `${b}.title`)}
        ${F.text('Datum', `${b}.date`, '', 'date')}
        ${F.img('Titelbild', `${b}.cover`)}
        ${F.area('Vorschau-Text (kurz, erscheint auf der Karte)', `${b}.preview`, 3)}
        ${F.area('Beitragstext', `${b}.content`, 14)}
        <p class="hint">Leerzeile = neuer Absatz · **fett** · [Linktext](https://…)</p>
        <button class="btn small" data-insert="${b}.content">Bild in den Text einfügen</button>
      </div>
      <h3>So sieht die Karte in der Blog-Übersicht aus</h3>
      <div class="preview-wrap" id="postPreview"></div>`;
  }

  function tFriends() {
    return `<h2>Freunde</h2>
      ${data.friends.map((f, i) => `<div class="box">
        <div class="box-head"><strong>${esc(f.name || 'Neue Person')}</strong>${arrows('friends', i)}</div>
        ${F.text('Name', `friends.${i}.name`)}
        ${F.img('Profilbild', `friends.${i}.avatar`)}
        ${F.area('Kurztext (optional)', `friends.${i}.bio`, 2)}
        <div class="sub">
          <span class="muted" style="font-size:.88rem;font-weight:600">Social-Media-Links</span>
          <div style="margin:10px 0">${f.links.map((l, j) => `<div class="mini-row">
            <input data-bind="friends.${i}.links.${j}.label" value="${esc(l.label)}" placeholder="Name, z. B. Instagram" autocomplete="off">
            <input data-bind="friends.${i}.links.${j}.url" value="${esc(l.url)}" placeholder="https://…" autocomplete="off">
            <button class="btn small danger" data-act="delFLink" data-i="${i}" data-j="${j}" aria-label="Link entfernen">✕</button>
          </div>`).join('')}</div>
          <button class="btn small" data-act="addFLink" data-i="${i}">+ Link hinzufügen</button>
        </div>
      </div>`).join('')}
      <button class="btn primary" data-act="add" data-list="friends">+ Freund hinzufügen</button>`;
  }

  function tImpressum() {
    return `<h2>Impressum</h2>
      <div class="box">
        ${F.text('Überschrift', 'impressum.title')}
        ${F.area('Text', 'impressum.text', 16)}
        <p class="hint">Leerzeile = neuer Absatz · **fett** · [Linktext](https://…). Das Impressum musst du selbst richtig ausfüllen (Name, Anschrift, Kontakt). Das ist keine Rechtsberatung.</p>
      </div>`;
  }

  function tMedia() {
    return `<h2>Bilder</h2>
      <div class="box">
        <label class="btn primary">Bilder hochladen<input id="fileUp" type="file" accept="image/*" multiple hidden></label>
        <p class="hint" style="margin:12px 0 0">Bilder werden automatisch auf max. 1600 px verkleinert und direkt in dein Repository gespeichert. Danach wählst du sie bei Profilbild, Blog und Freunden aus.</p>
      </div>
      ${media.length ? `<div class="media-grid">${media.map((it, i) => `<div class="media-item">
        <img src="${esc(it.url)}" alt="">
        <div class="nm" title="${esc(it.path)}">${esc(it.name)}</div>
        <div class="acts"><button class="btn small" data-copy="${esc(it.path)}">Pfad</button><button class="btn small danger" data-delmedia="${i}">Löschen</button></div>
      </div>`).join('')}</div>` : '<p class="empty">Noch keine Bilder hochgeladen.</p>'}`;
  }

  /* ---------- Zugang: Benutzername + Passwort ---------- */
  const toB64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const fromB64 = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));

  async function deriveKey(user, pass, salt, iter) {
    const base = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(user.trim().toLowerCase() + '\u0000' + pass),
      'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function encryptCreds(user, pass, creds) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const iter = 600000;
    const key = await deriveKey(user, pass, salt, iter);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(creds)));
    return { v: 1, iter, salt: toB64(salt), iv: toB64(iv), data: toB64(ct) };
  }
  async function decryptCreds(user, pass, blob) {
    const key = await deriveKey(user, pass, fromB64(blob.salt), blob.iter);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(blob.iv) }, key, fromB64(blob.data));
    return JSON.parse(new TextDecoder().decode(pt));
  }
  async function fetchKey() {
    try {
      const r = await fetch('admin-key.json?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return null;
      const j = await r.json();
      return j && j.data && j.salt && j.iv ? j : null;
    } catch (e) { return null; }
  }

  async function saveAccess() {
    const u = $('#aUser').value.trim(), p = $('#aPass').value, p2 = $('#aPass2').value;
    if (u.length < 3) return toast('Benutzername: mindestens 3 Zeichen.', true);
    if (p.length < 12) return toast('Passwort: mindestens 12 Zeichen.', true);
    if (p !== p2) return toast('Die beiden Passwörter sind nicht gleich.', true);
    const btn = $('#saveAccess'); btn.disabled = true;
    try {
      toast('Verschlüssele …', false, 0);
      const blob = await encryptCreds(u, p, { token: cfg.token, repo: cfg.repo, branch: cfg.branch });
      let oldSha = null;
      try { oldSha = (await gh(`contents/admin-key.json?ref=${encodeURIComponent(cfg.branch)}&t=${Date.now()}`)).sha; }
      catch (e) { if (e.status !== 404) throw e; }
      const body = {
        message: 'Zugang aktualisiert (Admin)',
        content: utf8ToB64(JSON.stringify(blob) + '\n'),
        branch: cfg.branch
      };
      if (oldSha) body.sha = oldSha;
      await gh('contents/admin-key.json', { method: 'PUT', body: JSON.stringify(body) });
      keyBlob = blob;
      $('#aPass').value = ''; $('#aPass2').value = '';
      toast('Zugang gespeichert. Auf anderen Geräten gilt er nach etwa 1 Minute.', false, 6000);
    } catch (e) {
      toast('Speichern fehlgeschlagen: ' + niceError(e), true, 7000);
    } finally { btn.disabled = false; }
  }

  function tAccess() {
    return `<h2>Zugang</h2>
      <div class="box">
        <p class="hint" style="margin-top:0">Lege Benutzername und Passwort fest. Damit meldest du dich künftig auf jedem Gerät an, ohne den Token einzutippen. Dein Token wird dafür mit dem Passwort verschlüsselt (AES-256) und als <b>admin-key.json</b> im Repository gespeichert.</p>
        <label class="field"><span>Benutzername</span><input id="aUser" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
        <label class="field"><span>Passwort (mindestens 12 Zeichen)</span><input id="aPass" type="password" autocomplete="new-password"></label>
        <label class="field"><span>Passwort wiederholen</span><input id="aPass2" type="password" autocomplete="new-password"></label>
        <button class="btn primary" id="saveAccess">Zugang speichern</button>
        <p class="hint" style="margin:14px 0 0">${keyBlob ? 'Es ist bereits ein Zugang eingerichtet. Speichern überschreibt ihn.' : 'Noch kein Zugang eingerichtet.'}
        Die verschlüsselte Datei ist öffentlich sichtbar, dein Passwort ist also der einzige Schutz. Nimm deshalb einen langen Satz, den man nicht erraten kann. Läuft der Token ab, melde dich einmal mit einem neuen Token an und speichere den Zugang hier erneut.</p>
      </div>`;
  }

  /* ---------- Rendern ---------- */
  function updateDirty() {
    const d = $('#dirty');
    if (d) d.textContent = dirty ? 'Ungespeicherte Änderungen' : '';
  }
  function markDirty() { dirty = true; updateDirty(); }

  function renderTabs() {
    $('#tabs').innerHTML = TABS.map(([k, n]) =>
      `<button data-tab="${k}" class="${k === tab ? 'on' : ''}">${n}</button>`).join('');
  }

  function refreshPreviews() {
    document.querySelectorAll('[data-thumb]').forEach(img => {
      const v = getP(data, img.dataset.thumb);
      img.classList.remove('broken');
      if (v) { img.src = resolveImg(v); img.style.display = ''; }
      else { img.removeAttribute('src'); img.style.display = 'none'; }
    });
    const pv = $('#postPreview');
    if (pv && editPost !== null && data.posts[editPost]) pv.innerHTML = postCard(data.posts[editPost], '#');
  }

  function renderPanel() {
    const fn = { general: tGeneral, links: tLinks, blog: tBlog, friends: tFriends, impressum: tImpressum, media: tMedia, access: tAccess }[tab];
    $('#panel').innerHTML = fn();
    refreshPreviews();
  }

  function showApp() {
    $('#root').innerHTML = `
      <header class="abar">
        <strong>Admin</strong>
        <span class="dirty" id="dirty"></span>
        <a class="btn ghost small" href="index.html" target="_blank" rel="noopener">Seite ansehen ↗</a>
        <button class="btn primary" id="save">Speichern</button>
        <button class="btn ghost small" id="logout">Abmelden</button>
      </header>
      <nav class="tabs" id="tabs" aria-label="Bereiche"></nav>
      <section class="panel" id="panel"></section>`;
    renderTabs(); renderPanel(); updateDirty();
  }

  function showLogin(msg = '', pre = null, mode = '') {
    if (mode !== 'token' && keyBlob) {
      $('#root').innerHTML = `<div class="login">
        <h1>Admin</h1>
        <p>Melde dich mit Benutzername und Passwort an.</p>
        <label class="field"><span>Benutzername</span>
          <input id="lUser" autocomplete="username" autocapitalize="off" spellcheck="false"></label>
        <label class="field"><span>Passwort</span>
          <input id="lPass" type="password" autocomplete="current-password"></label>
        <button class="btn primary" id="lGoPw">Anmelden</button>
        <div class="err" id="lErr">${esc(msg)}</div>
        <p style="margin-top:22px"><button class="btn ghost small" id="lToToken">Stattdessen mit GitHub-Token anmelden</button></p>
      </div>`;
      return;
    }
    const keep = pre || cfg || {};
    let repo = keep.repo || '';
    if (!repo && location.hostname.endsWith('.github.io')) {
      const owner = location.hostname.split('.')[0];
      const first = location.pathname.split('/')[1];
      repo = `${owner}/${first && !first.endsWith('.html') ? first : owner + '.github.io'}`;
    }
    $('#root').innerHTML = `<div class="login">
      <h1>Admin</h1>
      <p>${keyBlob
        ? 'Anmeldung mit GitHub-Token.'
        : 'Erste Einrichtung: Melde dich einmal mit deinem GitHub-Token an. Danach legst du unter „Zugang“ Benutzername und Passwort fest.'}</p>
      <label class="field"><span>Repository (benutzername/repo)</span>
        <input id="lRepo" value="${esc(repo)}" placeholder="meinname/meine-seite" autocapitalize="off" spellcheck="false"></label>
      <label class="field"><span>Branch</span>
        <input id="lBranch" value="${esc(keep.branch || 'main')}" autocapitalize="off" spellcheck="false"></label>
      <label class="field"><span>Token</span>
        <input id="lToken" type="password" value="${esc(keep.token || '')}" autocomplete="off" placeholder="github_pat_…"></label>
      <button class="btn primary" id="lGo">Verbinden</button>
      <div class="err" id="lErr">${esc(msg)}</div>
      ${keyBlob ? '<p style="margin-top:22px"><button class="btn ghost small" id="lToPw">Zurück zu Benutzername und Passwort</button></p>' : ''}
    </div>`;
  }

  async function connect(c) {
    cfg = c;
    const repo = await gh('');
    if (repo.permissions && repo.permissions.push === false) {
      const e = new Error('Dieser Token darf nicht ins Repository schreiben (Contents: Read and write fehlt).');
      throw e;
    }
    await loadData();
    await loadMedia();
    localStorage.setItem(LS, JSON.stringify(cfg));
    window.IMG_BASE = `https://raw.githubusercontent.com/${cfg.repo}/${cfg.branch}/`;
    applyTheme(data.site);
    showApp();
  }

  /* ---------- Aktionen ---------- */
  const NEW = {
    links: () => ({ label: '', url: '', icon: '' }),
    friends: () => ({ name: '', avatar: '', bio: '', links: [] })
  };

  function onAct(el) {
    const { act, list } = el.dataset;
    const i = +el.dataset.i, j = +el.dataset.j;
    switch (act) {
      case 'add': data[list].push(NEW[list]()); break;
      case 'up': if (i > 0) [data[list][i - 1], data[list][i]] = [data[list][i], data[list][i - 1]]; break;
      case 'down': if (i < data[list].length - 1) [data[list][i + 1], data[list][i]] = [data[list][i], data[list][i + 1]]; break;
      case 'del': if (!confirm('Wirklich löschen?')) return; data[list].splice(i, 1); break;
      case 'addFLink': data.friends[i].links.push({ label: '', url: '', icon: '' }); break;
      case 'delFLink': data.friends[i].links.splice(j, 1); break;
      case 'newPost':
        data.posts.push({
          id: 'beitrag-' + Date.now().toString(36), title: '',
          date: new Date().toISOString().slice(0, 10), cover: '', preview: '', content: ''
        });
        editPost = data.posts.length - 1; break;
      case 'editPost': editPost = i; renderPanel(); window.scrollTo(0, 0); return;
      case 'backPost': editPost = null; renderPanel(); return;
      case 'delPost':
        if (!confirm('Diesen Beitrag wirklich löschen?')) return;
        data.posts.splice(i, 1); break;
    }
    markDirty(); renderPanel();
  }

  async function insertImage(path) {
    const ta = document.querySelector(`textarea[data-bind="${path}"]`);
    const p = await pickImage();
    if (!p || !ta) return;
    const s = ta.selectionStart == null ? ta.value.length : ta.selectionStart;
    const e = ta.selectionEnd == null ? s : ta.selectionEnd;
    ta.value = ta.value.slice(0, s) + `\n\n![](${p})\n\n` + ta.value.slice(e);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    toast('Bild eingefügt.');
  }

  /* ---------- Events ---------- */
  document.addEventListener('input', e => {
    const b = e.target.dataset && e.target.dataset.bind;
    if (!b) return;
    setP(data, b, e.target.value);
    if (b === 'site.accent') applyTheme(data.site);
    markDirty(); refreshPreviews();
  });

  document.addEventListener('click', async e => {
    const t = e.target;
    if (t.closest('#postPreview a')) { e.preventDefault(); return; }

    const tabBtn = t.closest('[data-tab]');
    if (tabBtn) { tab = tabBtn.dataset.tab; if (tab !== 'blog') editPost = null; renderTabs(); renderPanel(); return; }

    if (t.closest('#save')) return save();
    if (t.closest('#logout')) {
      if (dirty && !confirm('Es gibt ungespeicherte Änderungen. Trotzdem abmelden?')) return;
      localStorage.removeItem(LS); cfg = null; dirty = false; showLogin(); return;
    }
    if (t.closest('#lGo')) return doLogin();
    if (t.closest('#lGoPw')) return doLoginPw();
    if (t.closest('#lToToken')) return showLogin('', null, 'token');
    if (t.closest('#lToPw')) return showLogin();
    if (t.closest('#saveAccess')) return saveAccess();

    const act = t.closest('[data-act]');
    if (act) return onAct(act);

    const pick = t.closest('[data-pick]');
    if (pick) {
      const p = await pickImage();
      if (p) {
        const inp = document.querySelector(`input[data-bind="${pick.dataset.pick}"]`);
        inp.value = p; inp.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return;
    }

    const ins = t.closest('[data-insert]');
    if (ins) return insertImage(ins.dataset.insert);

    const copy = t.closest('[data-copy]');
    if (copy) {
      try { await navigator.clipboard.writeText(copy.dataset.copy); toast('Pfad kopiert.'); }
      catch (err) { toast(copy.dataset.copy); }
      return;
    }

    const del = t.closest('[data-delmedia]');
    if (del) return delMedia(+del.dataset.delmedia);
  });

  document.addEventListener('change', async e => {
    if (e.target.id !== 'fileUp') return;
    const files = [...e.target.files];
    if (files.length) { await uploadFiles(files); renderPanel(); }
  });

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && data) { e.preventDefault(); save(); }
    if (e.key === 'Enter' && /^l(Repo|Branch|Token|User|Pass)$/.test(e.target.id || '')) { if ($('#lGoPw')) doLoginPw(); else doLogin(); }
  });

  window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  async function doLogin() {
    const repo = $('#lRepo').value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
    const branch = $('#lBranch').value.trim() || 'main';
    const token = $('#lToken').value.replace(/[\s"'“”‘’]/g, '');
    const err = $('#lErr'), btn = $('#lGo');
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) { err.textContent = 'Bitte das Repository so eintragen: benutzername/repo'; return; }
    if (!token) { err.textContent = 'Bitte den Token einfügen.'; return; }
    if (/[^\x21-\x7E]/.test(token)) { err.textContent = 'Der Token enthält ungültige Zeichen. Kopiere ihn bitte neu aus GitHub.'; return; }
    btn.disabled = true; btn.textContent = 'Verbinde …'; err.textContent = '';
    try { await connect({ token, repo, branch }); }
    catch (e) { cfg = null; showLogin(niceError(e), { repo, branch, token }, 'token'); }
  }

  async function doLoginPw() {
    const user = $('#lUser').value, pass = $('#lPass').value;
    const err = $('#lErr'), btn = $('#lGoPw');
    if (!user.trim() || !pass) { err.textContent = 'Bitte Benutzername und Passwort eingeben.'; return; }
    btn.disabled = true; btn.textContent = 'Prüfe …'; err.textContent = '';
    let creds;
    try { creds = await decryptCreds(user, pass, keyBlob); }
    catch (e) { showLogin('Benutzername oder Passwort falsch.'); return; }
    try { await connect(creds); }
    catch (e) {
      cfg = null;
      const extra = e.status === 401 ? ' Melde dich einmal mit einem neuen Token an und speichere unter „Zugang“ erneut.' : '';
      showLogin(niceError(e) + extra);
    }
  }

  /* ---------- Start ---------- */
  (async function init() {
    keyBlob = await fetchKey();
    if (cfg && cfg.token && cfg.repo) {
      $('#root').innerHTML = '<div class="login"><p>Verbinde mit GitHub …</p></div>';
      try { await connect(cfg); }
      catch (e) { showLogin(niceError(e)); }
    } else {
      showLogin();
    }
  })();
})();
