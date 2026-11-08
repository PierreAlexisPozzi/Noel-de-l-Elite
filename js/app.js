/* Le Noël de l'Élite : logique du site (aucune dépendance) */
(function () {
  'use strict';

  var CFG = window.NOEL_CONFIG || {};
  var EV = CFG.evenement || {};
  var EDITION = CFG.edition || new Date().getFullYear();
  var STORE_KEY = 'noel-elite:v1:' + EDITION;
  var MIN_PEOPLE = 3;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- Utilitaires DOM ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function h(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }

  var toastTimer;
  function toast(msg) {
    var t = $('[data-toast]');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-on'); }, 2200);
  }

  /* ---------------- Hasard (crypto) ---------------- */
  function randInt(n) {
    var lim = Math.floor(0x100000000 / n) * n, buf = new Uint32Array(1), x;
    do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= lim);
    return x % n;
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = randInt(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function uid() {
    var b = new Uint8Array(6); crypto.getRandomValues(b);
    return Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
  }

  /* ---------------- Liens scellés ----------------
     Le destinataire est brouillé (XOR + nonce) dans le fragment #, qui
     n'est jamais envoyé au serveur. Ce n'est pas du chiffrement fort :
     cela empêche simplement de lire le nom « par accident ». */
  var SALT = 'noel-de-l-elite/' + (CFG.secret || '');
  function hash32(str) {
    var hsh = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) { hsh ^= str.charCodeAt(i); hsh = Math.imul(hsh, 16777619) >>> 0; }
    return hsh || 1;
  }
  function keystream(nonce, n) {
    var x = hash32(SALT + '|' + Array.prototype.join.call(nonce, '.')), out = new Uint8Array(n);
    for (var i = 0; i < n; i++) {
      x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
      out[i] = x & 255;
    }
    return out;
  }
  function b64e(bytes) {
    var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64d(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    var s = atob(str), out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  function sealToken(obj) {
    var data = new TextEncoder().encode(JSON.stringify(obj));
    var nonce = new Uint8Array(4); crypto.getRandomValues(nonce);
    var ks = keystream(nonce, data.length), out = new Uint8Array(4 + data.length);
    out.set(nonce, 0);
    for (var i = 0; i < data.length; i++) out[4 + i] = data[i] ^ ks[i];
    return b64e(out);
  }
  function openToken(tok) {
    try {
      var bytes = b64d(tok);
      if (bytes.length < 8) return null;
      var nonce = bytes.subarray(0, 4), body = bytes.subarray(4), ks = keystream(nonce, body.length);
      var dec = new Uint8Array(body.length);
      for (var i = 0; i < body.length; i++) dec[i] = body[i] ^ ks[i];
      var obj = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(dec));
      if (!obj || typeof obj.f !== 'string' || typeof obj.t !== 'string') return null;
      return obj;
    } catch (e) { return null; }
  }

  /* ---------------- Informations de la soirée ---------------- */
  function eventDate() {
    if (!EV.date) return null;
    var d = new Date(EV.date);
    return isNaN(d) ? null : d;
  }
  function factValue(key) {
    if (key === 'date') {
      var d = eventDate();
      if (!d) return null;
      var s = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
      var hasTime = /T\d{2}:\d{2}/.test(String(EV.date));
      if (hasTime) s += ', ' + new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(d).replace(':', ' h ');
      return s;
    }
    var v = EV[key];
    return v && String(v).trim() ? String(v).trim() : null;
  }
  function renderFacts() {
    $$('[data-fact]').forEach(function (node) {
      var v = factValue(node.getAttribute('data-fact'));
      node.textContent = v || 'à définir';
      node.classList.toggle('is-tbd', !v);
    });
    var b = factValue('budget');
    $$('[data-budget-inline]').forEach(function (n) { n.textContent = b || 'à définir'; });
    $$('[data-edition]').forEach(function (n) { n.textContent = EDITION; });
  }

  /* ---------------- Compte à rebours ---------------- */
  function countdownTarget() {
    var d = eventDate();
    if (d) return { date: d, label: 'avant le grand soir', done: 'C’est le grand soir !' };
    var now = new Date(), y = now.getFullYear();
    var xmas = new Date(y, 11, 25);
    if (now >= new Date(y, 11, 26)) xmas = new Date(y + 1, 11, 25);
    return { date: xmas, label: 'avant Noël', done: 'Joyeux Noël !' };
  }
  function startCountdown() {
    var tgt = countdownTarget();
    var cells = { d: $('[data-cd="d"]'), h: $('[data-cd="h"]'), m: $('[data-cd="m"]'), s: $('[data-cd="s"]') };
    var label = $('[data-cd-label]');
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function tick() {
      var diff = tgt.date - new Date();
      if (diff <= 0) {
        cells.d.textContent = cells.h.textContent = cells.m.textContent = cells.s.textContent = '00';
        label.textContent = tgt.done;
        return;
      }
      var s = Math.floor(diff / 1000);
      cells.d.textContent = Math.floor(s / 86400);
      cells.h.textContent = pad(Math.floor(s % 86400 / 3600));
      cells.m.textContent = pad(Math.floor(s % 3600 / 60));
      cells.s.textContent = pad(s % 60);
      label.textContent = tgt.label;
      setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
    }
    tick();
  }

  /* ---------------- État (localStorage) ---------------- */
  function normName(s) { return String(s).trim().replace(/\s+/g, ' '); }
  function keyName(s) { return normName(s).toLocaleLowerCase('fr'); }

  function seedState() {
    var people = [], seen = {};
    (CFG.participants || []).forEach(function (n) {
      var name = normName(n || '');
      if (!name || seen[keyName(name)]) return;
      seen[keyName(name)] = true;
      people.push({ id: uid(), name: name });
    });
    function idOf(n) {
      var k = keyName(n || '');
      for (var i = 0; i < people.length; i++) if (keyName(people[i].name) === k) return people[i].id;
      return null;
    }
    var ex = [];
    (CFG.exclusions || []).forEach(function (pair) {
      if (!pair || pair.length !== 2) return;
      var a = idOf(pair[0]), b = idOf(pair[1]);
      if (a && b && a !== b) ex.push([a, b]);
    });
    return { people: people, exclusions: ex, noCross: CFG.interdireEchangesCroises !== false, draw: null };
  }
  function loadState() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && Array.isArray(s.people)) return s;
      }
    } catch (e) { /* stockage indisponible */ }
    return seedState();
  }
  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  var state;

  /* ---------------- Chiffres romains ---------------- */
  function roman(n) {
    var map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']], out = '';
    map.forEach(function (p) { while (n >= p[0]) { out += p[1]; n -= p[0]; } });
    return out;
  }
  function personById(id) {
    for (var i = 0; i < state.people.length; i++) if (state.people[i].id === id) return state.people[i];
    return null;
  }

  /* ---------------- Convives ---------------- */
  var justAdded = {};
  function renderRoll() {
    var locked = !!state.draw;
    var list = $('[data-roll]');
    list.replaceChildren();
    var n = state.people.length;

    $('[data-roll-count]').textContent = n === 0
      ? ''
      : n + (n > 1 ? ' convives inscrits' : ' convive inscrit') + (locked ? ' · liste close' : '');

    if (n === 0) {
      list.hidden = true;
      if (!$('.roll-empty')) list.parentNode.insertBefore(h('p', { class: 'roll-empty', text: 'Aucun convive inscrit pour l’heure. La liste reste à arrêter.' }), list);
    } else {
      list.hidden = false;
      var empty = $('.roll-empty'); if (empty) empty.remove();
      state.people.forEach(function (p, i) {
        list.appendChild(h('li', { class: justAdded[p.id] ? 'is-new' : null },
          h('span', { class: 'roll__num', text: roman(i + 1) + '.' }),
          h('span', { class: 'roll__name', text: p.name }),
          locked ? null : h('button', {
            type: 'button', class: 'roll__del', text: 'rayer',
            'aria-label': 'Rayer ' + p.name + ' de la liste',
            onclick: function () { removePerson(p.id); }
          })
        ));
      });
    }
    justAdded = {};

    $('[data-roll-tools]').hidden = locked;
    $('[data-locked-note]').hidden = !locked;
    renderExclusions();
  }

  function addPeople(raw) {
    var names = String(raw).split(/[,;\n]+/).map(normName).filter(Boolean);
    if (!names.length) return;
    var added = 0, dupes = [];
    names.forEach(function (name) {
      if (name.length > 40) name = name.slice(0, 40).trim();
      var exists = state.people.some(function (p) { return keyName(p.name) === keyName(name); });
      if (exists) { dupes.push(name); return; }
      var p = { id: uid(), name: name };
      state.people.push(p);
      justAdded[p.id] = true;
      added++;
    });
    saveState();
    renderAll();
    if (dupes.length) toast(dupes.join(', ') + (dupes.length > 1 ? ' figurent' : ' figure') + ' déjà sur la liste');
    else if (added > 1) toast(added + ' convives inscrits');
  }

  function removePerson(id) {
    state.people = state.people.filter(function (p) { return p.id !== id; });
    state.exclusions = state.exclusions.filter(function (e) { return e[0] !== id && e[1] !== id; });
    saveState();
    renderAll();
  }

  /* ---------------- Incompatibilités ---------------- */
  function renderExclusions() {
    var a = $('#ex-a'), b = $('#ex-b');
    [a, b].forEach(function (sel, idx) {
      var prev = sel.value;
      sel.replaceChildren(h('option', { value: '', text: idx === 0 ? 'Choisir…' : 'Choisir…' }));
      state.people.forEach(function (p) { sel.appendChild(h('option', { value: p.id, text: p.name })); });
      if (personById(prev)) sel.value = prev;
    });
    var dis = state.people.length < 2;
    a.disabled = b.disabled = dis;
    $('[data-ex-form] button').disabled = dis;

    var ul = $('[data-ex-list]');
    ul.replaceChildren();
    state.exclusions.forEach(function (pair, i) {
      var pa = personById(pair[0]), pb = personById(pair[1]);
      if (!pa || !pb) return;
      ul.appendChild(h('li', null,
        h('span', null, pa.name, ' ', h('i', { text: '&' }), ' ', pb.name),
        h('button', {
          type: 'button', 'aria-label': 'Retirer l’incompatibilité ' + pa.name + ' et ' + pb.name, text: '×',
          onclick: function () { state.exclusions.splice(i, 1); saveState(); renderAll(); }
        })
      ));
    });
    $('[data-no-cross]').checked = !!state.noCross;
  }

  function addExclusion(a, b) {
    if (!a || !b) { toast('Choisissez deux convives'); return; }
    if (a === b) { toast('Choisissez deux convives différents'); return; }
    var exists = state.exclusions.some(function (e) { return (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a); });
    if (exists) { toast('Cette incompatibilité existe déjà'); return; }
    state.exclusions.push([a, b]);
    saveState();
    renderAll();
  }

  /* ---------------- Algorithme du tirage ---------------- */
  // Renvoie p tel que le convive g offre à p[g], ou null si impossible.
  function solve(n, forbid, noCross) {
    function bad(g, r, p) { return r === g || forbid[g * n + r] || (noCross && p[r] === g); }
    var base = [];
    for (var i = 0; i < n; i++) base.push(i);

    // 1) Tirage uniforme par rejet : chaque répartition valide est équiprobable.
    for (var t = 0; t < 30000; t++) {
      var p = shuffle(base.slice()), ok = true;
      for (var g = 0; g < n && ok; g++) if (bad(g, p[g], p)) ok = false;
      if (ok) return p;
    }
    // 2) Repli : recherche aléatoire avec retour arrière (contraintes très serrées).
    var q = new Array(n).fill(-1), used = new Array(n).fill(false), steps = 0;
    function dfs(g) {
      if (g === n) return true;
      if (++steps > 400000) return false;
      var cands = shuffle(base.slice());
      for (var k = 0; k < cands.length; k++) {
        var r = cands[k];
        if (used[r] || bad(g, r, q)) continue;
        q[g] = r; used[r] = true;
        if (dfs(g + 1)) return true;
        q[g] = -1; used[r] = false;
      }
      return false;
    }
    return dfs(0) ? q : null;
  }

  function performDraw() {
    var people = state.people, n = people.length;
    var idx = {}; people.forEach(function (p, i) { idx[p.id] = i; });
    var forbid = {};
    state.exclusions.forEach(function (e) {
      var a = idx[e[0]], b = idx[e[1]];
      if (a == null || b == null) return;
      forbid[a * n + b] = forbid[b * n + a] = true;
    });
    var perm = solve(n, forbid, !!state.noCross);
    if (!perm) return false;
    state.draw = {
      at: Date.now(),
      mail: people.map(function (p, g) {
        return { id: p.id, name: p.name, token: sealToken({ v: 1, f: p.name, t: people[perm[g]].name, y: EDITION }), sent: false };
      })
    };
    saveState();
    return true;
  }

  /* ---------------- Rendu du tirage ---------------- */
  function linkFor(token) {
    return location.href.split('#')[0] + '#/m/' + token;
  }

  function renderDraw() {
    var box = $('[data-draw]');
    box.replaceChildren();
    var n = state.people.length;

    if (!state.draw) {
      var enough = n >= MIN_PEOPLE;
      var msg = enough
        ? 'La liste compte ' + n + ' convives. Une fois le tirage effectué, chacun recevra un lien personnel menant à sa missive scellée.'
        : (n === 0
          ? 'Le tirage sera ouvert dès que la liste des convives sera arrêtée.'
          : 'Il faut au moins ' + MIN_PEOPLE + ' convives pour procéder au tirage (' + n + ' pour l’heure).');
      box.appendChild(h('div', { class: 'draw-ready' },
        h('p', { text: msg }),
        h('button', { type: 'button', class: 'stamp', disabled: !enough, onclick: onDrawClick, text: 'Procéder au tirage' }),
        h('p', { class: 'fine', text: 'Le résultat n’est affiché à personne ici : vous n’obtiendrez que des enveloppes fermées, une par convive.' })
      ));
      return;
    }

    var mail = state.draw.mail, sent = mail.filter(function (m) { return m.sent; }).length;
    var when = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(state.draw.at)).replace(':', ' h ');

    box.appendChild(h('div', { class: 'draw-done__head' },
      h('h3', { text: 'Le sort en est jeté.' }),
      h('p', { text: 'Tirage effectué le ' + when + '. Faites parvenir à chacun son enveloppe, et à lui seul.' }),
      h('p', { class: 'progress-line', text: sent + ' / ' + mail.length + ' expédiée' + (sent > 1 ? 's' : '') })
    ));

    var ul = h('ul', { class: 'mailbag' });
    mail.forEach(function (m) {
      var link = linkFor(m.token);
      var wa = 'https://wa.me/?text=' + encodeURIComponent(m.name + ', ta missive secrète pour le Noël de l’Élite t’attend. Ouvre-la à l’abri des regards : ' + link);
      var actions = h('div', { class: 'mail__actions' },
        h('button', { type: 'button', class: 'btn btn--ghost btn--small', text: 'Copier le lien', onclick: function () { copy(link).then(function (ok) { toast(ok ? 'Lien de ' + m.name + ' copié' : 'Copie impossible : sélectionnez le lien manuellement'); if (ok) markSent(m); }); } }),
        h('a', { class: 'btn btn--ghost btn--small', href: wa, target: '_blank', rel: 'noopener', text: 'WhatsApp', onclick: function () { markSent(m); } }),
        navigator.share ? h('button', { type: 'button', class: 'btn btn--ghost btn--small', text: 'Partager', onclick: function () {
          navigator.share({ title: 'Le Noël de l’Élite', text: m.name + ', ta missive secrète t’attend.', url: link }).then(function () { markSent(m); }).catch(function () {});
        } }) : null
      );
      ul.appendChild(h('li', { class: 'mail' + (m.sent ? ' is-sent' : ''), 'data-mail': m.id },
        h('p', { class: 'mail__to', text: 'À l’attention de' }),
        h('p', { class: 'mail__name', text: m.name }),
        actions,
        h('span', { class: 'mail__postmark', 'aria-hidden': 'true', text: 'Expédiée' })
      ));
    });
    box.appendChild(ul);

    box.appendChild(h('div', { class: 'draw-done__foot' },
      h('button', { type: 'button', class: 'link-btn', text: 'Annuler le tirage (les liens déjà envoyés deviendront caducs)', onclick: function () {
        if (!confirm('Annuler le tirage ? Les liens déjà envoyés ne correspondront plus à rien et il faudra tout renvoyer.')) return;
        state.draw = null; saveState(); renderAll();
        toast('Tirage annulé');
      } })
    ));
  }

  function markSent(m) {
    if (m.sent) return;
    m.sent = true;
    saveState();
    var card = $('[data-mail="' + m.id + '"]');
    if (card) card.classList.add('is-sent');
    var sent = state.draw.mail.filter(function (x) { return x.sent; }).length;
    var line = $('.progress-line');
    if (line) line.textContent = sent + ' / ' + state.draw.mail.length + ' expédiée' + (sent > 1 ? 's' : '');
  }

  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallbackCopy(text); });
    }
    return Promise.resolve(fallbackCopy(text));
  }
  function fallbackCopy(text) {
    var ta = h('textarea', { readonly: true, style: 'position:fixed;top:-1000px;opacity:0' });
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }

  function onDrawClick() {
    if (state.people.length < MIN_PEOPLE) return;
    var ok = performDraw();
    if (!ok) {
      toast('Tirage impossible avec ces incompatibilités : assouplissez les contraintes');
      return;
    }
    var box = $('[data-draw]');
    if (reduceMotion) { renderAll(); return; }

    // Petite mise en scène : les noms défilent dans l'urne.
    var nameEl = h('div', { class: 'drum__name', 'aria-hidden': 'true' });
    box.replaceChildren(h('div', { class: 'drum' }, h('p', { class: 'drum__label', text: 'Brassage de l’urne' }), nameEl));
    var names = state.people.map(function (p) { return p.name; });
    var start = Date.now(), last = -1;
    (function spin() {
      var el = Date.now() - start;
      if (el > 1700) { renderAll(); $('#tirage').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      var i; do { i = randInt(names.length); } while (names.length > 1 && i === last);
      last = i;
      nameEl.textContent = names[i];
      setTimeout(spin, 60 + el / 18);
    })();
  }

  function renderAll() { renderRoll(); renderDraw(); }

  /* ---------------- Vue missive ---------------- */
  function showReveal(token) {
    $('#view-home').hidden = true;
    var view = $('#view-reveal');
    view.hidden = false;
    window.scrollTo(0, 0);
    var data = openToken(token);
    $('[data-reveal-ok]').hidden = !data;
    $('[data-reveal-error]').hidden = !!data;
    if (!data) { document.title = 'Missive illisible · Le Noël de l’Élite'; return; }

    document.title = 'Une missive pour ' + data.f + ' · Le Noël de l’Élite';
    $$('[data-from]', view).forEach(function (n) { n.textContent = data.f; });
    $('[data-to]', view).textContent = data.t;

    var env = $('[data-envelope]'), seal = $('[data-seal]');
    env.classList.remove('is-open');
    $('[data-reveal-details]').hidden = true;
    $('[data-reveal-hint]').style.opacity = '';
    seal.onclick = function () {
      env.classList.add('is-open');
      $('[data-reveal-hint]').style.opacity = '0';
      setTimeout(function () { $('[data-reveal-details]').hidden = false; }, reduceMotion ? 0 : 1700);
    };
  }

  function showHome() {
    $('#view-reveal').hidden = true;
    $('#view-home').hidden = false;
    document.title = 'Le Noël de l’Élite';
  }

  function route() {
    var m = location.hash.match(/^#\/m\/([A-Za-z0-9_-]+)/);
    if (m) showReveal(m[1]); else showHome();
  }

  /* ---------------- Neige ---------------- */
  function snow() {
    var cv = $('#snow');
    if (!cv || !cv.getContext || reduceMotion) return;
    var ctx = cv.getContext('2d'), flakes = [], W, H, dpr;
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var target = Math.round(Math.min(110, W * H / 14000));
      while (flakes.length < target) flakes.push(make(true));
      flakes.length = target;
    }
    function make(anywhere) {
      var r = Math.random();
      return {
        x: Math.random() * W, y: anywhere ? Math.random() * H : -6,
        r: 0.6 + r * r * 2.4, vy: 0.25 + r * 0.9, phase: Math.random() * 6.28, sway: 0.2 + Math.random() * 0.5,
        a: 0.35 + r * 0.5
      };
    }
    var t = 0;
    function frame() {
      t += 0.01;
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < flakes.length; i++) {
        var f = flakes[i];
        f.y += f.vy;
        f.x += Math.sin(t * 1.3 + f.phase) * f.sway * 0.5;
        if (f.y > H + 6) { flakes[i] = make(false); continue; }
        ctx.globalAlpha = f.a;
        ctx.fillStyle = '#f6f1e6';
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.2832); ctx.fill();
      }
      requestAnimationFrame(frame);
    }
    window.addEventListener('resize', resize);
    resize();
    requestAnimationFrame(frame);
  }

  /* ---------------- Initialisation ---------------- */
  function init() {
    state = loadState();
    renderFacts();
    startCountdown();
    renderAll();

    $('[data-add-form]').addEventListener('submit', function (e) {
      e.preventDefault();
      var input = $('#new-name');
      addPeople(input.value);
      input.value = '';
      input.focus();
    });
    $('[data-ex-form]').addEventListener('submit', function (e) {
      e.preventDefault();
      addExclusion($('#ex-a').value, $('#ex-b').value);
    });
    $('[data-no-cross]').addEventListener('change', function (e) {
      state.noCross = e.target.checked; saveState();
    });
    $('[data-reset-all]').addEventListener('click', function () {
      if (!confirm('Effacer la liste actuelle et repartir de celle définie dans la configuration ?')) return;
      state = seedState(); saveState(); renderAll();
      toast('Liste réinitialisée');
    });

    window.addEventListener('hashchange', route);
    route();
    snow();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
