#!/usr/bin/env node
// scripts/check-i18n.mjs — `node scripts/check-i18n.mjs`
//
// 1. Every namespace has the same keys in every language (Arabic plural forms
//    _zero/_two/_few/_many may exist without an English twin).
// 2. Every literal key the code asks for — t('a.b'), t('ns:a.b'),
//    i18n.t('a.b', { ns }), <Trans i18nKey="a.b"> — exists in English.
//    Keys built at run time (t(`status.${s}`)) can't be checked; they're
//    listed with --dynamic.
// Exits 1 when something is missing.
import fs from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const localesDir = path.join(root, 'src/locales');
const langs = fs.readdirSync(localesDir);
const PLURAL = /_(zero|one|two|few|many|other)$/;

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );

const catalog = {};
for (const lang of langs) {
  catalog[lang] = {};
  for (const file of fs.readdirSync(path.join(localesDir, lang))) {
    if (!file.endsWith('.json')) continue;
    const ns = file.slice(0, -5);
    catalog[lang][ns] = new Set(flatten(JSON.parse(fs.readFileSync(path.join(localesDir, lang, file), 'utf8'))));
  }
}

let problems = 0;
const report = (msg) => { problems += 1; console.log(msg); };

// 1. Parity
const base = catalog.en;
for (const lang of langs.filter((l) => l !== 'en')) {
  for (const ns of new Set([...Object.keys(base), ...Object.keys(catalog[lang])])) {
    const a = base[ns] || new Set();
    const b = catalog[lang][ns] || new Set();
    const stem = (k) => k.replace(PLURAL, '');
    const aStems = new Set([...a].map(stem));
    for (const k of a) if (!b.has(k)) report(`missing in ${lang}/${ns}: ${k}`);
    for (const k of b) if (!a.has(k) && !(PLURAL.test(k) && aStems.has(stem(k)))) report(`extra in ${lang}/${ns}: ${k}`);
  }
}

// 2. Keys used in code
const exists = (ns, key) => {
  const set = base[ns];
  if (!set) return false;
  if (set.has(key)) return true;
  return ['one', 'other', 'zero'].some((f) => set.has(`${key}_${f}`)) // plural
    || [...set].some((k) => k.startsWith(`${key}.`)); // returnObjects
};
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(jsx?|tsx?)$/.test(e.name) ? [path.join(dir, e.name)] : []);

const dynamic = [];
for (const file of walk(path.join(root, 'src'))) {
  // Comments hold usage examples; drop whole-line comments before matching.
  const src = fs.readFileSync(file, 'utf8').replace(/^\s*(\/\/|\*).*$/gm, '');
  if (!/react-i18next|i18n/.test(src)) continue;
  const rel = path.relative(root, file);
  const fileNs = src.match(/useTranslation\(\s*['"]([\w-]+)['"]/)?.[1] || 'common';
  const re = /(?:\bi18n\.)?\bt\(\s*(['"`])([^'"`]+)\1\s*(,\s*\{[^}]*?\bns:\s*['"]([\w-]+)['"])?/g;
  for (const m of src.matchAll(re)) {
    const [, quote, raw, , nsOpt] = m;
    if (quote === '`' && raw.includes('${')) { dynamic.push(`${rel}: ${raw}`); continue; }
    let ns = nsOpt || fileNs;
    let key = raw;
    if (raw.includes(':') && !raw.includes(' ')) [ns, key] = raw.split(':');
    if (!exists(ns, key)) report(`unknown key ${ns}:${key} in ${rel}`);
  }
  for (const m of src.matchAll(/i18nKey=["']([^"']+)["']/g)) {
    let [ns, key] = m[1].includes(':') ? m[1].split(':') : [fileNs, m[1]];
    if (!exists(ns, key)) report(`unknown key ${ns}:${key} in ${rel} (Trans)`);
  }
}
if (process.argv.includes('--dynamic')) console.log(`dynamic keys (not checked):\n  ${dynamic.join('\n  ')}`);

const counts = Object.entries(base).map(([ns, s]) => `${ns} ${s.size}`).join(', ');
console.log(problems ? `\n${problems} problem(s).` : `OK — ${langs.join(', ')}; keys per namespace: ${counts}`);
process.exit(problems ? 1 : 0);
