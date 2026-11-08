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
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(EV.date));
    // Jour seul : interprété en heure locale (et non en UTC comme le ferait new Date()).
    var d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(EV.date);
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

  /* ---------------- Convives (lecture seule : la liste vient de la configuration) ---------------- */
  function normName(s) { return String(s).trim().replace(/\s+/g, ' '); }
  function people() {
    var seen = {}, out = [];
    (CFG.participants || []).forEach(function (n) {
      var name = normName(n || ''), k = name.toLocaleLowerCase('fr');
      if (name && !seen[k]) { seen[k] = true; out.push(name); }
    });
    return out;
  }
  function roman(n) {
    var map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']], out = '';
    map.forEach(function (p) { while (n >= p[0]) { out += p[1]; n -= p[0]; } });
    return out;
  }
  function renderRoll() {
    var list = $('[data-roll]'), names = people();
    list.replaceChildren();
    $('[data-roll-count]').textContent = names.length
      ? names.length + (names.length > 1 ? ' convives inscrits' : ' convive inscrit')
      : '';
    if (!names.length) {
      list.hidden = true;
      list.parentNode.insertBefore(h('p', { class: 'roll-empty', text: 'La liste des convives sera bientôt publiée.' }), list);
      return;
    }
    names.forEach(function (name, i) {
      list.appendChild(h('li', null,
        h('span', { class: 'roll__num', text: roman(i + 1) + '.' }),
        h('span', { class: 'roll__name', text: name })
      ));
    });
  }

  /* ---------------- Tirage : simple information ----------------
     Le tirage est fait par l'organisateur hors du site (outils/tirage.mjs) ;
     chacun reçoit son lien personnel en message privé. */
  function renderDraw() {
    var box = $('[data-draw]'), t = CFG.tirage || {}, done = !!t.effectue;
    var when = t.date ? ' le ' + t.date : '';
    box.replaceChildren(h('div', { class: 'draw-ready' },
      h('p', { class: 'draw-status', text: done ? 'Le sort en est jeté.' : 'Le tirage approche.' }),
      h('p', { text: done
        ? 'Le tirage a été effectué' + when + '. Chaque convive a reçu, en message privé, un lien personnel vers sa missive scellée. Ouvre-la à l’abri des regards : elle te dira qui tu gâtes.'
        : 'L’organisateur procédera bientôt au tirage. Chaque convive recevra alors, en message privé, un lien personnel vers sa missive scellée, que lui seul ouvrira.' }),
      h('p', { class: 'fine', text: 'Pas reçu ton lien, ou lien illisible ? Demande à l’organisateur de te le renvoyer.' })
    ));
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

  /* ---------------- Neige ----------------
     Une seule couche de neige, au-dessus de la page. Les flocons « persistants »
     reviennent en haut de l'écran quand ils sortent en bas : la neige reste. */
  var Snow = (function () {
    var cv, ctx, W = 0, H = 0, flakes = [], target = 0, running = false, t = 0;

    function setup() {
      if (ctx) return true;
      cv = $('#snow');
      if (!cv || !cv.getContext) return false;
      ctx = cv.getContext('2d');
      window.addEventListener('resize', resize);
      resize();
      return true;
    }
    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      target = Math.round(Math.min(90, W * H / 15000));
    }
    function flake(persist) {
      var r = Math.random();
      return {
        r: 0.7 + r * r * 2.3, term: 0.3 + r * 0.8, a: 0.6 + r * 0.4,
        phase: Math.random() * 6.28, sway: 0.2 + Math.random() * 0.5,
        x: 0, y: 0, vx: 0, vy: 0, persist: persist
      };
    }
    function persistent() {
      var n = 0;
      for (var i = 0; i < flakes.length; i++) if (flakes[i].persist) n++;
      return n;
    }
    function loop() {
      t += 0.01;
      ctx.clearRect(0, 0, W, H);
      for (var i = flakes.length - 1; i >= 0; i--) {
        var f = flakes[i];
        f.vx *= 0.965;
        f.vy = f.vy < f.term ? f.vy * 0.985 + 0.14 : Math.max(f.term, f.vy * 0.97);
        f.x += f.vx + Math.sin(t * 1.3 + f.phase) * f.sway * 0.5;
        f.y += f.vy;
        if (f.y > H + 8 || f.x < -40 || f.x > W + 40) {
          if (!f.persist) { flakes.splice(i, 1); continue; }
          f.x = Math.random() * W; f.y = -6; f.vx = 0; f.vy = f.term;
        }
        // léger contour sombre : le flocon reste visible sur le papier crème
        ctx.globalAlpha = f.a * 0.28; ctx.fillStyle = '#26332b';
        ctx.beginPath(); ctx.arc(f.x + 0.4, f.y + 0.7, f.r + 0.7, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = f.a; ctx.fillStyle = '#fffdf7';
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.2832); ctx.fill();
      }
      requestAnimationFrame(loop);
    }
    function run() { if (!running) { running = true; requestAnimationFrame(loop); } }

    return {
      // Neige d'ambiance, déjà répartie sur l'écran.
      ambient: function () {
        if (!setup()) return;
        for (var k = target - persistent(); k > 0; k--) {
          var f = flake(true);
          f.x = Math.random() * W; f.y = Math.random() * H; f.vy = f.term;
          flakes.push(f);
        }
        run();
      },
      // Gerbe de neige projetée depuis un point de l'écran.
      burst: function (x, y, n) {
        if (!setup()) return;
        var need = target - persistent();
        for (var k = 0; k < n; k++) {
          var f = flake(k < need);
          var ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5;
          var sp = 5 + Math.random() * Math.random() * 22;
          f.x = x + (Math.random() - 0.5) * 12; f.y = y;
          f.vx = Math.cos(ang) * sp; f.vy = Math.sin(ang) * sp * 0.9;
          flakes.push(f);
        }
        run();
      }
    };
  })();

  /* ---------------- Son (synthétisé, aucun fichier) ---------------- */
  function fartSound(ac, t0) {
    // Un pet en trois temps : couinement aigu, crachotements qui descendent,
    // puis fin grave, grasse et mouillée. Tiré au hasard : jamais deux fois le même.
    var R = Math.random;
    function lerp(a, b, p) { return a + (b - a) * p; }

    var limiter = ac.createDynamicsCompressor();
    limiter.threshold.value = -12; limiter.knee.value = 6; limiter.ratio.value = 12;
    limiter.attack.value = 0.003; limiter.release.value = 0.12;
    limiter.connect(ac.destination);
    var out = ac.createGain(); out.gain.value = 0.9; out.connect(limiter);
    var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 5; lp.connect(out);
    var amp = ac.createGain(); amp.gain.setValueAtTime(0, t0); amp.connect(lp);   // voix
    var wet = ac.createGain(); wet.gain.setValueAtTime(0, t0); wet.connect(lp);   // souffle mouillé

    // voix : dent de scie + créneau à l'octave basse, hachés par un « brrr »
    var saw = ac.createOscillator(); saw.type = 'sawtooth';
    var sq = ac.createOscillator(); sq.type = 'square';
    var sqGain = ac.createGain(); sqGain.gain.setValueAtTime(0.15, t0);
    var vca = ac.createGain(); vca.gain.value = 0.5;
    var flutter = ac.createOscillator(); flutter.type = 'square';
    var fDepth = ac.createGain(); fDepth.gain.setValueAtTime(0.3, t0);
    flutter.connect(fDepth); fDepth.connect(vca.gain);
    saw.connect(vca); sq.connect(sqGain); sqGain.connect(vca); vca.connect(amp);

    // souffle : bruit filtré
    var total = 2.2, len = Math.floor(ac.sampleRate * total);
    var buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = R() * 2 - 1;
    var noise = ac.createBufferSource(); noise.buffer = buf;
    var bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
    noise.connect(bp); bp.connect(wet);

    function pitch(f1, f2, at, dur) {
      saw.frequency.setValueAtTime(f1, at); saw.frequency.linearRampToValueAtTime(f2, at + dur);
      sq.frequency.setValueAtTime(f1 / 2, at); sq.frequency.linearRampToValueAtTime(f2 / 2, at + dur);
    }
    function bubble(at, hi, lo, vol) {
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(hi, at); o.frequency.exponentialRampToValueAtTime(lo, at + 0.04);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(vol, at + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
      o.connect(g); g.connect(lp);
      o.start(at); o.stop(at + 0.06);
    }

    // 1. couinement aigu
    var t = t0, sq0 = 0.2 + R() * 0.12;
    pitch(560 + R() * 120, 400 + R() * 60, t, sq0);
    flutter.frequency.setValueAtTime(70, t);
    lp.frequency.setValueAtTime(4200, t);
    bp.frequency.setValueAtTime(2200, t);
    amp.gain.setTargetAtTime(0.55, t, 0.01);
    wet.gain.setTargetAtTime(0.06, t, 0.02);
    t += sq0;

    // 2 et 3. crachotements de plus en plus graves, gras et mouillés
    var segs = 11 + Math.floor(R() * 4);
    for (var k = 0; k < segs; k++) {
      var p = (k + 1) / segs, wetP = p * p;
      var dur = lerp(0.05, 0.11, p) + R() * 0.07;
      var gap = R() < lerp(0.25, 0.55, p) ? 0.012 + R() * lerp(0.03, 0.07, p) : 0;
      var f1 = lerp(400, 72, Math.pow(p, 0.8)) * (0.85 + R() * 0.3);
      var vol = (0.6 + R() * 0.4) * lerp(0.55, 1, p);

      pitch(f1, f1 * (0.75 + R() * 0.35), t, dur);
      flutter.frequency.setValueAtTime(lerp(60, 17, p) + R() * 10, t);
      fDepth.gain.setValueAtTime(lerp(0.3, 0.5, p), t);
      sqGain.gain.setValueAtTime(lerp(0.15, 0.6, p), t);          // plus de graves = plus gras
      lp.frequency.setTargetAtTime(lerp(3500, 480, p), t, 0.03);  // de plus en plus étouffé
      bp.frequency.setTargetAtTime(lerp(1800, 380, p), t, 0.03);

      amp.gain.setTargetAtTime(vol, t, 0.006);
      wet.gain.setTargetAtTime(lerp(0.08, 0.6, wetP) * (0.7 + R() * 0.6), t, 0.01);
      if (gap) {
        amp.gain.setTargetAtTime(0, t + dur, 0.005);
        wet.gain.setTargetAtTime(lerp(0, 0.2, wetP), t + dur, 0.008);
      }
      // bulles : rares au début, nombreuses et graves à la fin
      var nb = Math.floor(wetP * 4 + R() * 1.5);
      for (var b = 0; b < nb; b++) {
        bubble(t + R() * dur, lerp(1400, 520, p) * (0.8 + R() * 0.4), lerp(500, 90, p), lerp(0.12, 0.38, p) * (0.6 + R() * 0.4));
      }
      t += dur + gap;
    }

    // finale : un dernier « pfff » mouillé qui s'éteint
    amp.gain.setTargetAtTime(0, t, 0.03);
    wet.gain.setTargetAtTime(0.4, t, 0.01);
    wet.gain.setTargetAtTime(0, t + 0.12, 0.06);
    for (var e = 0; e < 4; e++) bubble(t + 0.02 + R() * 0.18, 380 + R() * 200, 80, 0.25 + R() * 0.15);

    var end = t + 0.5;
    [saw, sq, flutter, noise].forEach(function (n) { n.start(t0); n.stop(end); });
    return end - t0;
  }

  /* ---------------- Rennes volants (SVG dessinés à la main) ----------------
     Dessinés de profil, tournés vers la droite ; un sucre d'orge sous le ventre. */
  function reindeerSVG() {
    var ink = '#3a2318', fur = '#8a5a35', light = '#c99b6d', antler = '#e1c08f';
    var S = ' stroke="' + ink + '" stroke-width="2" stroke-linejoin="round"';
    function line(d, color, w, extra) { return '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"' + (extra || '') + '/>'; }
    function limb(d, w, color) { return line(d, ink, w + 3) + line(d, color, w); }
    var g = '';
    // pattes arrière et avant, tendues comme au galop
    g += limb('M52 86 Q34 98 14 102', 8, fur) + limb('M62 90 Q46 106 28 114', 8, fur);
    g += limb('M126 84 Q146 92 166 88', 8, fur) + limb('M118 90 Q138 104 156 106', 8, fur);
    g += '<ellipse cx="12" cy="102" rx="5" ry="4" fill="' + ink + '"/><ellipse cx="26" cy="115" rx="5" ry="4" fill="' + ink + '"/>';
    g += '<ellipse cx="168" cy="88" rx="5" ry="4" fill="' + ink + '"/><ellipse cx="158" cy="107" rx="5" ry="4" fill="' + ink + '"/>';
    // le sucre d'orge
    var cane = 'M100 94 L116 122 Q121 131 129 127 Q136 123 131 115';
    g += line(cane, ink, 9) + line(cane, '#fbf6ec', 6.5) + line(cane, '#b3242a', 6.5, ' stroke-dasharray="4 4"');
    // queue
    g += '<circle cx="38" cy="64" r="8" fill="#fbf6ec"' + S + '/>';
    // corps
    g += '<path d="M40 70 C40 52 70 46 100 48 C126 50 140 58 142 72 C144 88 128 98 100 98 C70 98 40 92 40 70 Z" fill="' + fur + '"' + S + '/>';
    g += '<path d="M60 89 C80 97 116 97 132 85 C126 94 112 97 98 97 C82 97 70 94 60 89 Z" fill="' + light + '"/>';
    // cou, oreille, tête
    g += '<path d="M122 62 C128 46 136 36 146 30 L162 40 C154 48 148 60 142 72 Z" fill="' + fur + '"' + S + '/>';
    g += '<path d="M150 22 Q138 14 134 20 Q138 28 152 28 Z" fill="' + fur + '"' + S + '/>';
    g += '<ellipse cx="162" cy="32" rx="19" ry="13" fill="' + fur + '"' + S + ' transform="rotate(14 162 32)"/>';
    g += '<ellipse cx="178" cy="40" rx="11" ry="8" fill="' + light + '"' + S + '/>';
    g += '<ellipse cx="188" cy="37" rx="5" ry="4.2" fill="' + ink + '"/>';
    g += line('M157 27 Q161 23 165 27', ink, 2.2) + line('M173 46 Q178 50 183 46', ink, 1.6);
    // bois
    var a1 = 'M155 21 Q149 6 139 0 M150 10 L142 8 M146 4 Q147 -3 151 -5';
    var a2 = 'M165 21 Q169 6 179 0 M170 10 L178 9 M174 4 Q176 -3 172 -6';
    g += line(a1, ink, 6.5) + line(a2, ink, 6.5) + line(a1, antler, 4) + line(a2, antler, 4);
    // collier à grelot
    g += line('M127 64 Q137 57 146 66', '#b01f26', 6) + '<circle cx="137" cy="69" r="4.5" fill="#d9a73a"' + S + '/>';
    return '<svg viewBox="-6 -10 204 150"><g filter="url(#diecut)">' + g + '</g></svg>';
  }

  /* ---------------- Pin-ups de la carte (SVG dessinés à la main) ----------------
     Même silhouette pour les deux : la Mère Noël est la version miroir, autrement habillée.
     Seins nus, chaque téton caché par une petite tête de lutin. */
  function pinupSVG(kind) {
    var elf = kind === 'elf';
    var id = 'pin-' + kind;
    var ink = '#3a2318', skin = '#f5c8a8', skinS = '#e2a585', gold = '#d9a73a';
    var dress = elf ? '#2f7040' : '#b01f26';
    var dressS = elf ? '#225532' : '#861419';
    var trim = elf ? '#b3242a' : '#fbf6ec';
    var hair = elf ? '#a9441c' : '#f3e3b3';
    var hairS = elf ? '#7a2c10' : '#cdb57d';
    var S = ' stroke="' + ink + '" stroke-width="2" stroke-linejoin="round"';
    function line(d, color, w) { return '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"/>'; }
    function limb(d, w, color) { return line(d, ink, w + 3) + line(d, color, w); }
    function elfHead(x, y, k) {
      var s1 = ' stroke="' + ink + '" stroke-width="1.1" stroke-linejoin="round"', face = '#f9d2b6';
      return '<g transform="translate(' + x + ' ' + y + ') scale(' + (k || 1) + ')">' +
        '<path d="M-5 -1 L-11 -5 L-6 3 Z" fill="' + face + '"' + s1 + '/><path d="M5 -1 L11 -5 L6 3 Z" fill="' + face + '"' + s1 + '/>' +
        '<circle r="6.6" fill="' + face + '"' + s1 + '/>' +
        '<path d="M-7 -2 Q-2 -15 9 -16 Q6 -10 7 -2 Z" fill="#2f7040"' + s1 + '/>' +
        '<path d="M-7.2 -2 Q0 -5 7.2 -2" fill="none" stroke="#b3242a" stroke-width="2.6" stroke-linecap="round"/>' +
        '<circle cx="9.5" cy="-16" r="2" fill="' + gold + '"' + s1 + '/>' +
        '<circle cx="-2.3" cy="1" r=".95" fill="' + ink + '"/><circle cx="2.3" cy="1" r=".95" fill="' + ink + '"/>' +
        '<path d="M-2.2 3.3 Q0 5.2 2.2 3.3" fill="none" stroke="' + ink + '" stroke-width=".9" stroke-linecap="round"/>' +
        '<circle cx="-4.2" cy="3" r="1.3" fill="#ec8f86" opacity=".7"/><circle cx="4.2" cy="3" r="1.3" fill="#ec8f86" opacity=".7"/>' +
        '</g>';
    }

    var defs = elf
      ? '<pattern id="' + id + '-stripes" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(-10)">' +
        '<rect width="12" height="12" fill="#fbf6ec"/><rect width="12" height="6" fill="#b3242a"/></pattern>'
      : '';
    var legFill = elf ? 'url(#' + id + '-stripes)' : skin;

    var g = '';
    // jambes : une droite, l'autre croisée devant
    g += '<path d="M80 256 C77 300 82 344 86 390 L97 390 C99 344 104 300 106 256 Z" fill="' + legFill + '"' + S + '/>';
    g += '<path d="M108 256 L134 256 C136 292 120 314 110 328 C114 352 119 372 121 390 L110 391 C104 370 97 348 97 328 C100 300 104 280 108 256 Z" fill="' + legFill + '"' + S + '/>';
    if (elf) {
      // chaussures de lutin à bout recourbé, avec grelots
      g += '<path d="M83 386 L99 386 C104 393 112 395 119 386 C122 396 113 404 98 404 C87 404 81 399 83 386 Z" fill="' + dress + '"' + S + '/>';
      g += '<path d="M108 387 L122 387 C127 394 135 396 142 387 C145 397 136 405 121 405 C110 405 105 400 108 387 Z" fill="' + dress + '"' + S + '/>';
      g += '<circle cx="120" cy="385" r="3.5" fill="' + gold + '"' + S + '/><circle cx="143" cy="386" r="3.5" fill="' + gold + '"' + S + '/>';
    } else {
      // bottes noires à revers de fourrure
      g += '<path d="M83 332 L101 332 C100 352 98 372 98 390 L104 398 Q92 404 80 400 L84 390 C84 370 83 352 83 332 Z" fill="#1d1a17"' + S + '/>';
      g += '<path d="M98 334 L114 330 C116 352 120 372 122 390 L130 399 Q117 405 108 400 L108 390 C104 370 99 352 98 334 Z" fill="#1d1a17"' + S + '/>';
      g += '<rect x="79" y="324" width="26" height="11" rx="5" fill="' + trim + '"' + S + '/>';
      g += '<rect x="94" y="322" width="24" height="11" rx="5" fill="' + trim + '"' + S + ' transform="rotate(-8 106 327)"/>';
    }
    // jupe
    if (elf) {
      g += '<path d="M86 182 L122 182 C138 200 154 228 160 258 L150 268 L140 256 L129 270 L118 258 L106 272 L94 258 L82 270 L70 256 L58 268 L48 258 C56 228 70 200 86 182 Z" fill="' + dress + '"' + S + '/>';
      g += '<circle cx="150" cy="268" r="3.5" fill="' + gold + '"' + S + '/><circle cx="106" cy="272" r="3.5" fill="' + gold + '"' + S + '/><circle cx="58" cy="268" r="3.5" fill="' + gold + '"' + S + '/>';
    } else {
      g += '<path d="M86 182 L122 182 C140 202 156 232 160 258 Q104 274 48 258 C54 232 68 202 86 182 Z" fill="' + dress + '"' + S + '/>';
      g += limb('M48 258 Q104 274 160 258', 11, trim);
    }
    g += line('M104 192 L103 258', dressS, 2) + line('M93 196 Q80 228 72 254', dressS, 2) + line('M116 196 Q128 228 138 254', dressS, 2);
    // buste nu : une tête de lutin sur chaque téton
    g += '<path d="M72 128 C72 120 136 120 136 128 C138 150 126 162 122 184 L86 184 C82 162 70 150 72 128 Z" fill="' + skin + '"' + S + '/>';
    // poitrine généreuse, façon pin-up
    g += '<ellipse cx="87" cy="151" rx="20" ry="19" fill="' + skin + '"' + S + '/>';
    g += '<ellipse cx="121" cy="151" rx="20" ry="19" fill="' + skin + '"' + S + '/>';
    g += '<ellipse cx="80" cy="142" rx="7" ry="4" fill="#fff" opacity=".35" transform="rotate(-25 80 142)"/>';
    g += '<ellipse cx="114" cy="142" rx="7" ry="4" fill="#fff" opacity=".35" transform="rotate(-25 114 142)"/>';
    g += line('M74 160 Q86 172 100 164', skinS, 1.6) + line('M108 164 Q122 172 134 160', skinS, 1.6);
    g += elfHead(88, 155, 1.25) + elfHead(120, 155, 1.25);
    // ceinture
    g += '<rect x="84" y="174" width="40" height="10" fill="#1d1a17"' + S + '/>';
    g += '<rect x="97" y="172" width="14" height="14" rx="2" fill="none" stroke="' + gold + '" stroke-width="3"/>';
    // bras sur la hanche
    g += limb('M74 132 Q50 150 54 170 Q64 182 84 181', 9, skin);
    g += '<ellipse cx="85" cy="181" rx="6" ry="5" fill="' + skin + '"' + S + '/>';
    // bras levé, avec un accessoire
    g += limb('M134 132 Q166 114 161 92 Q157 68 150 50', 9, skin);
    if (elf) {
      // sucre d'orge
      g += line('M150 74 L150 24 Q150 10 162 10 Q174 10 174 22', ink, 10);
      g += line('M150 74 L150 24 Q150 10 162 10 Q174 10 174 22', '#fbf6ec', 7);
      g += '<path d="M150 74 L150 24 Q150 10 162 10 Q174 10 174 22" fill="none" stroke="#b3242a" stroke-width="7" stroke-dasharray="4 5" stroke-linecap="butt"/>';
    } else {
      // brin de gui
      g += line('M150 46 L150 18', '#4a6b2e', 2.5);
      g += '<ellipse cx="142" cy="22" rx="10" ry="4.5" fill="#5f8a3a" transform="rotate(-35 142 22)"' + S + '/>';
      g += '<ellipse cx="158" cy="22" rx="10" ry="4.5" fill="#5f8a3a" transform="rotate(35 158 22)"' + S + '/>';
      g += '<ellipse cx="143" cy="33" rx="9" ry="4" fill="#4f7a30" transform="rotate(-20 143 33)"' + S + '/>';
      g += '<ellipse cx="157" cy="33" rx="9" ry="4" fill="#4f7a30" transform="rotate(20 157 33)"' + S + '/>';
      g += '<circle cx="150" cy="26" r="3.2" fill="#fbf6ec"' + S + '/><circle cx="146" cy="30" r="3" fill="#fbf6ec"' + S + '/><circle cx="154" cy="30" r="3" fill="#fbf6ec"' + S + '/>';
    }
    g += '<ellipse cx="150" cy="49" rx="6.5" ry="6" fill="' + skin + '"' + S + '/>';
    // cou, cheveux, visage
    g += '<path d="M97 100 L111 100 L112 122 Q104 126 96 122 Z" fill="' + skin + '"' + S + '/>';
    g += '<path d="M74 80 C70 46 90 36 106 36 C126 36 140 50 136 82 C140 100 134 112 126 114 C120 104 88 104 80 114 C70 110 70 96 74 80 Z" fill="' + hair + '"' + S + '/>';
    g += '<circle cx="80" cy="112" r="9" fill="' + hair + '"' + S + '/><circle cx="128" cy="112" r="9" fill="' + hair + '"' + S + '/>';
    if (elf) {
      g += '<path d="M86 80 L68 62 L82 92 Z" fill="' + skin + '"' + S + '/><path d="M122 80 L140 62 L126 92 Z" fill="' + skin + '"' + S + '/>';
    }
    g += '<path d="M84 76 C84 58 124 58 124 76 C124 94 114 104 104 104 C94 104 84 94 84 76 Z" fill="' + skin + '"' + S + '/>';
    // boucles « victory rolls » et frange
    g += '<circle cx="90" cy="56" r="11" fill="' + hair + '"' + S + '/><circle cx="118" cy="54" r="11" fill="' + hair + '"' + S + '/>';
    g += line('M84 57 Q90 49 96 57', hairS, 2) + line('M112 55 Q118 47 124 55', hairS, 2);
    g += '<path d="M85 66 Q100 58 112 63 Q120 59 125 67 Q112 65 104 71 Q94 67 85 66 Z" fill="' + hair + '"' + S + '/>';
    // visage : clin d'œil, cils, bouche rouge, grain de beauté
    g += line('M90 71 Q95 68 100 71', ink, 1.8) + line('M108 70 Q113 67 118 70', ink, 1.8);
    g += line('M90 79 Q95 83 100 79', ink, 2.2) + line('M90 79 L87 77', ink, 1.6) + line('M92 81 L90 84', ink, 1.6);
    g += '<ellipse cx="113" cy="79" rx="3" ry="3.8" fill="' + ink + '"/><circle cx="114" cy="77.8" r="1" fill="#fff"/>';
    g += line('M110 75 L109 72 M113 74.5 L113 71 M116 75 L117.5 72', ink, 1.4);
    g += line('M104 83 Q102 89 105 90', skinS, 1.6);
    g += '<circle cx="93" cy="89" r="4.5" fill="#ec8f86" opacity=".45"/><circle cx="117" cy="89" r="4.5" fill="#ec8f86" opacity=".45"/>';
    g += '<path d="M98 95 Q101 92 104 94 Q107 92 110 95 Q104 101 98 95 Z" fill="#c4262d" stroke="#8d1a1f" stroke-width="1"/>';
    g += '<circle cx="114.5" cy="93" r=".9" fill="' + ink + '"/>';
    // chapeau
    if (elf) {
      g += '<path d="M80 60 Q96 18 142 6 Q160 2 166 14 Q150 10 138 22 Q124 40 130 58 Z" fill="' + dress + '"' + S + '/>';
      g += limb('M77 62 Q104 50 133 58', 9, trim);
      g += '<circle cx="167" cy="17" r="6" fill="' + gold + '"' + S + '/>';
    } else {
      g += '<path d="M80 62 Q92 22 128 18 Q156 16 168 40 Q150 32 136 40 Q128 50 130 60 Z" fill="' + dress + '"' + S + '/>';
      g += limb('M77 63 Q104 50 134 58', 11, trim);
      g += '<circle cx="169" cy="44" r="9" fill="' + trim + '"' + S + '/>';
    }

    // le haut, qu'elles jettent juste avant le pet
    var top = '<path d="M66 150 C66 133 79 128 87 132 Q104 141 121 132 C129 128 142 133 142 150 C142 163 133 172 125 178 L83 178 C75 172 66 163 66 150 Z" fill="' + dress + '"' + S + '/>';
    top += line('M104 141 L104 176', dressS, 1.6) + line('M80 160 Q86 170 96 172', dressS, 1.4) + line('M128 160 Q122 170 112 172', dressS, 1.4);
    top += limb('M76 133 L78 120', 3.5, dress) + limb('M132 133 L130 120', 3.5, dress);
    top += limb('M67 143 C70 130 83 128 104 139 C125 128 138 130 141 143', elf ? 4.5 : 6, trim);
    if (elf) top += '<circle cx="104" cy="152" r="2.6" fill="' + gold + '"' + S + '/><circle cx="104" cy="164" r="2.6" fill="' + gold + '"' + S + '/>';

    function mirror(x) { return elf ? x : '<g transform="translate(200 0) scale(-1 1)">' + x + '</g>'; }
    var vb = elf ? '36 -6 148 418' : '16 -6 148 418';
    return '<svg viewBox="' + vb + '"><defs>' + defs + '</defs>' +
      '<g filter="url(#diecut)">' + mirror(g) + '</g>' +
      mirror('<g class="pin__top" filter="url(#diecut)">' + top + '</g>') + '</svg>';
  }

  function hohoho(ac, t0) {
    // « Oh oh oh » de Père Noël : voix grave synthétisée (impulsions glottiques
    // passées dans les formants de la voyelle « o »), trois syllabes qui descendent.
    var comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 8; comp.connect(ac.destination);
    var master = ac.createGain(); master.gain.value = 1.4; master.connect(comp);
    // un peu d'espace : écho court et sourd
    var dl = ac.createDelay(); dl.delayTime.value = 0.085;
    var fb = ac.createGain(); fb.gain.value = 0.22;
    var dlp = ac.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 1400;
    dl.connect(dlp); dlp.connect(fb); fb.connect(dl); dlp.connect(master);
    var bus = ac.createGain(); bus.connect(master); bus.connect(dl);

    var formants = [[480, 1, 7], [820, 0.55, 8], [2600, 0.08, 10]]; // fréquence, gain, Q
    var pitches = [124, 112, 98], step = 0.43, dur = 0.34;
    var end = t0;
    pitches.forEach(function (f0, i) {
      var t = t0 + i * step, syl = dur + (i === 2 ? 0.14 : 0);
      var filt = ac.createGain(); filt.connect(bus);
      var bank = formants.map(function (f) {
        var bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f[0]; bp.Q.value = f[2];
        var g = ac.createGain(); g.gain.value = f[1]; bp.connect(g); g.connect(filt);
        return bp;
      });
      // voix
      var osc = ac.createOscillator(); osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f0 * 1.08, t);
      osc.frequency.linearRampToValueAtTime(f0, t + 0.08);
      osc.frequency.linearRampToValueAtTime(f0 * 0.82, t + syl);
      var vib = ac.createOscillator(); vib.frequency.value = 5.5;
      var vibD = ac.createGain(); vibD.gain.value = 2.5; vib.connect(vibD); vibD.connect(osc.frequency);
      var vEnv = ac.createGain(); vEnv.gain.setValueAtTime(0.0001, t);
      vEnv.gain.setValueAtTime(0.0001, t + 0.045);
      vEnv.gain.exponentialRampToValueAtTime(0.9, t + 0.1);
      vEnv.gain.setValueAtTime(0.9, t + syl * 0.6);
      vEnv.gain.exponentialRampToValueAtTime(0.0001, t + syl);
      osc.connect(vEnv);
      bank.forEach(function (bp) { vEnv.connect(bp); });
      // « h » aspiré en attaque
      var len = Math.floor(ac.sampleRate * 0.14), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      for (var k = 0; k < len; k++) d[k] = Math.random() * 2 - 1;
      var nz = ac.createBufferSource(); nz.buffer = buf;
      var hEnv = ac.createGain(); hEnv.gain.setValueAtTime(0.0001, t);
      hEnv.gain.exponentialRampToValueAtTime(0.35, t + 0.03);
      hEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      nz.connect(hEnv); bank.forEach(function (bp) { hEnv.connect(bp); });
      osc.start(t); vib.start(t); nz.start(t);
      osc.stop(t + syl + 0.05); vib.stop(t + syl + 0.05); nz.stop(t + 0.14);
      end = t + syl;
    });
    return end + 0.3 - t0;
  }

  /* ---------------- Ouverture : la carte pop-up du Père Noël ---------------- */
  var Intro = (function () {
    var el, card, santa, openTimer, laughTimer, stripTimer, turnTimer, fartTimer, opened = false, turned = false, fired = false, audio = null;
    function clearTimers() { [openTimer, laughTimer, stripTimer, turnTimer, fartTimer].forEach(clearTimeout); }

    function snowcap() { document.body.classList.add('has-snowcap'); }
    // L'animation se déroule seule. Le son, lui, n'est autorisé par les navigateurs qu'après
    // un geste de l'utilisateur : un toucher n'importe où l'active, sans changer le rythme.
    function ensureAudio() {
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audio = audio || new AC();
        if (audio.state === 'suspended') {
          var p = audio.resume();
          if (p && p.then) p.then(syncHint, function () {});
        }
      } catch (e) { audio = null; }
      syncHint();
    }
    function soundOn() { return !!audio && audio.state === 'running'; }

    // Sons enregistrés, chargés dès l'ouverture. Repli sur les sons synthétisés si besoin.
    var SOUNDS = { hoho: 'audio/oh-oh-oh.mp3?v=18', fart: 'audio/prout-de-noel.mp3?v=12' };
    var buffers = {}, loading = {};
    function loadSounds() {
      if (!audio || !window.fetch) return;
      Object.keys(SOUNDS).forEach(function (k) {
        if (buffers[k] || loading[k]) return;
        loading[k] = true;
        fetch(SOUNDS[k])
          .then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
          .then(function (ab) {
            // forme à callbacks : compatible avec les anciens Safari
            audio.decodeAudioData(ab, function (buf) { buffers[k] = buf; }, function () { loading[k] = false; });
          })
          .catch(function () { loading[k] = false; });
      });
    }
    function playBuffer(buf, when) {
      var src = audio.createBufferSource();
      src.buffer = buf; src.connect(audio.destination); src.start(when);
    }
    function playFart(when) { if (buffers.fart) playBuffer(buffers.fart, when); else fartSound(audio, when); }
    function syncHint() { if (el) el.classList.toggle('is-sound-on', soundOn()); }

    function show() {
      opened = turned = fired = false;
      clearTimers();
      el.className = 'intro';
      card.classList.remove('is-open', 'is-stripped');
      santa.classList.remove('is-turned', 'is-laughing');
      el.hidden = false;
      document.documentElement.classList.add('intro-open');
      window.scrollTo(0, 0);
      ensureAudio(); // déjà autorisé si le visiteur a touché la page auparavant
      loadSounds();
      openTimer = setTimeout(open, 1500); // laisse le temps de toucher l'écran pour avoir le son
    }
    function end() {
      el.hidden = true;
      el.className = 'intro';
      card.classList.remove('is-open', 'is-stripped');
      santa.classList.remove('is-turned', 'is-laughing');
      document.documentElement.classList.remove('intro-open');
    }
    function open() {
      if (opened) return;
      opened = true;
      clearTimeout(openTimer);
      card.classList.add('is-open');
      el.classList.add('is-opened');
      laughTimer = setTimeout(laugh, 950); // dès que le Père Noël est debout
    }
    function laugh() {
      santa.classList.add('is-laughing');
      // le rire dure le temps de l'enregistrement (≈ 4 s), ou 1,45 s pour la voix synthétisée
      var dur = buffers.hoho ? buffers.hoho.duration - 0.1 : 1.45;
      try {
        if (soundOn()) {
          if (buffers.hoho) playBuffer(buffers.hoho, audio.currentTime + 0.02);
          else hohoho(audio, audio.currentTime + 0.02);
        }
      } catch (e) { /* pas de son */ }
      stripTimer = setTimeout(strip, Math.round(dur * 1000)); // à la fin du « oh oh oh »
    }
    function strip() {
      santa.classList.remove('is-laughing');
      card.classList.add('is-stripped');
      turnTimer = setTimeout(turn, 750);
    }
    function turn() {
      if (turned) return;
      turned = true;
      clearTimeout(turnTimer);
      santa.classList.add('is-turned');
      fartTimer = setTimeout(fart, 600); // pète dès la fin du demi-tour
    }
    function fart() {
      if (fired) return;
      if (!turned) { turn(); return; }
      fired = true;
      clearTimeout(fartTimer);
      try { if (soundOn()) playFart(audio.currentTime + 0.12); } catch (e) { /* pas de son, tant pis */ }

      el.classList.add('is-tension');
      setTimeout(function () {
        el.classList.remove('is-tension');
        el.classList.add('is-farting');
        var o = $('.butt__origin', el).getBoundingClientRect();
        var x = o.left + o.width / 2, y = o.top + o.height / 2;
        [[0, 80], [150, 60], [320, 45], [520, 35], [760, 30], [1000, 25]].forEach(function (w) {
          setTimeout(function () { Snow.burst(x, y, w[1]); }, w[0]);
        });
      }, 120);
      // l'extrait dure 5 s : la carte tombe pendant ses dernières notes
      setTimeout(function () { el.classList.add('is-leaving'); snowcap(); }, 5000);
      setTimeout(end, 6000);
    }
    function skip() {
      clearTimers();
      opened = turned = fired = true;
      end();
      Snow.ambient();
      snowcap();
    }

    return {
      init: function () {
        el = $('#intro');
        card = $('[data-pcard]', el);
        santa = $('[data-santa]', el);
        $$('[data-pinup]', el).forEach(function (n) { n.innerHTML = pinupSVG(n.getAttribute('data-pinup')); });
        $$('[data-reindeer]', el).forEach(function (n) { n.innerHTML = reindeerSVG(); });
        el.addEventListener('click', function (e) {
          if (e.target.closest('.intro__skip')) skip(); else ensureAudio();
        });
        el.addEventListener('touchend', ensureAudio, { passive: true });
        document.addEventListener('keydown', function (e) {
          if (el.hidden) return;
          if (e.key === 'Escape') skip(); else ensureAudio();
        });
      },
      // À chaque ouverture de la gazette, y compris si le téléphone a les animations réduites.
      shouldPlay: function () { return true; },
      show: show,
      skip: skip
    };
  })();

  /* ---------------- Initialisation ---------------- */
  function init() {
    renderFacts();
    startCountdown();
    renderAll();

    window.addEventListener('hashchange', route);
    route();

    Intro.init();
    $('[data-replay-intro]').addEventListener('click', function () { Intro.show(); });
    if (!/^#\/m\//.test(location.hash) && Intro.shouldPlay()) Intro.show();
    else Intro.skip();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
