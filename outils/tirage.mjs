#!/usr/bin/env node
/*
 * Tirage au sort du Noël de l'Élite (à lancer par l'organisateur, hors du site).
 *
 *   node outils/tirage.mjs [adresse-du-site]
 *
 * Lit js/config.js (convives, incompatibilités, échanges croisés, secret),
 * tire au sort et affiche UNIQUEMENT les liens personnels à envoyer :
 * personne, pas même l'organisateur, ne voit qui offre à qui.
 *
 * Le brouillage des liens est identique à celui du site (js/app.js, openToken) :
 * changer `secret` dans la config après l'envoi rend les liens illisibles.
 */
import { readFileSync } from 'node:fs';
import { webcrypto as crypto } from 'node:crypto';
import vm from 'node:vm';

const SITE = (process.argv[2] || 'https://pierrealexispozzi.github.io/Noel-de-l-Elite/').replace(/#.*$/, '');

// --- configuration (même fichier que le site)
const sandbox = { window: {} };
vm.runInNewContext(readFileSync(new URL('../js/config.js', import.meta.url), 'utf8'), sandbox);
const CFG = sandbox.window.NOEL_CONFIG;
const EDITION = CFG.edition || new Date().getFullYear();

const norm = (s) => String(s).trim().replace(/\s+/g, ' ');
const key = (s) => norm(s).toLocaleLowerCase('fr');
const names = [];
for (const n of CFG.participants || []) {
  const name = norm(n || '');
  if (!name) continue;
  if (names.some((x) => key(x) === key(name))) throw new Error(`Convive en double : ${name}`);
  names.push(name);
}
const N = names.length;
if (N < 3) throw new Error('Il faut au moins 3 convives.');
const index = (n) => {
  const i = names.findIndex((x) => key(x) === key(n));
  if (i < 0) throw new Error(`Incompatibilité avec un nom absent de la liste : ${n}`);
  return i;
};
const forbid = new Set();
for (const [a, b] of CFG.exclusions || []) {
  const i = index(a), j = index(b);
  forbid.add(i * N + j); forbid.add(j * N + i);
}
const noCross = CFG.interdireEchangesCroises !== false;

// --- hasard cryptographique et tirage (même algorithme que l'ancien tirage du site)
function randInt(n) {
  const lim = Math.floor(0x100000000 / n) * n, buf = new Uint32Array(1);
  let x;
  do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= lim);
  return x % n;
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = randInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const bad = (g, r, p) => r === g || forbid.has(g * N + r) || (noCross && p[r] === g);
function solve() {
  const base = [...Array(N).keys()];
  // tirage uniforme par rejet : chaque répartition valide est équiprobable
  for (let t = 0; t < 200000; t++) {
    const p = shuffle(base.slice());
    if (p.every((r, g) => !bad(g, r, p))) return p;
  }
  return null;
}
const perm = solve();
if (!perm) throw new Error('Tirage impossible avec ces incompatibilités : il faut assouplir les contraintes.');

// --- contrôle (sans rien afficher du résultat)
const ok = new Set(perm).size === N && perm.every((r, g) => !bad(g, r, perm));
if (!ok) throw new Error('Contrôle du tirage en échec.');

// --- liens scellés (identique à js/app.js)
const SALT = 'noel-de-l-elite/' + (CFG.secret || '');
function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h || 1;
}
function keystream(nonce, n) {
  let x = hash32(SALT + '|' + Array.prototype.join.call(nonce, '.'));
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; out[i] = x & 255; }
  return out;
}
function seal(obj) {
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const nonce = new Uint8Array(4); crypto.getRandomValues(nonce);
  const ks = keystream(nonce, data.length), out = new Uint8Array(4 + data.length);
  out.set(nonce, 0);
  for (let i = 0; i < data.length; i++) out[4 + i] = data[i] ^ ks[i];
  return Buffer.from(out).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

console.log(`Tirage OK : ${N} convives, ${(CFG.exclusions || []).length} incompatibilité(s), échanges croisés ${noCross ? 'interdits' : 'autorisés'}.\n`);
names.forEach((name, g) => {
  console.log(`${name} : ${SITE}#/m/${seal({ v: 1, f: name, t: names[perm[g]], y: EDITION })}`);
});
