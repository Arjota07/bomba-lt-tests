#!/usr/bin/env node
/**
 * INDEX.md generatorius.
 *
 * INDEX.md niekada nerašomas ranka — jis atkuriamas iš failų frontmatter.
 * Tai vienintelis būdas turėti indeksą, kuris nemeluoja.
 *
 *   node scripts/index.mjs           # perrašo INDEX.md
 *   node scripts/index.mjs --check   # tik patikrina, ar nepasenęs (CI)
 */

import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const argumentai = process.argv.slice(2);
const ROOT = resolve(argumentai.find((a) => !a.startsWith('--')) ?? '.');
const CHECK = argumentai.includes('--check');

const KATALOGAI = ['sritys', 'faktai', 'sprendimai', 'inbox'];

const TIKRUMO_ZYME = {
  patvirtinta: '✓',
  juodrastis: '~',
  spejimas: '?',
};

async function surinktiFailus(katalogas) {
  const rezultatas = [];
  async function eiti(dabartinis) {
    let irasai;
    try {
      irasai = await readdir(dabartinis, { withFileTypes: true });
    } catch {
      return;
    }
    for (const irasas of irasai) {
      if (irasas.name.startsWith('.')) continue;
      const kelias = join(dabartinis, irasas.name);
      if (irasas.isDirectory()) await eiti(kelias);
      else if (irasas.name.endsWith('.md')) rezultatas.push(kelias);
    }
  }
  await eiti(katalogas);
  return rezultatas;
}

function skaitytiFrontmatter(tekstas) {
  if (!tekstas.startsWith('---')) return {};
  const pabaiga = tekstas.indexOf('\n---', 3);
  if (pabaiga === -1) return {};
  const laukai = {};
  for (const eilute of tekstas.slice(4, pabaiga).split('\n')) {
    const m = eilute.match(/^([a-ząčęėįšųūž0-9_-]+)\s*:\s*(.*)$/i);
    if (m) laukai[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '').replace(/\s+#.*$/, '');
  }
  return laukai;
}

function pavadinimas(tekstas, kelias) {
  const m = tekstas.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : kelias.split('/').pop().replace(/\.md$/, '');
}

const irasai = [];

for (const katalogas of KATALOGAI) {
  const kelias = join(ROOT, katalogas);
  if (!existsSync(kelias) || !statSync(kelias).isDirectory()) continue;
  for (const failas of await surinktiFailus(kelias)) {
    const tekstas = readFileSync(failas, 'utf8');
    const fm = skaitytiFrontmatter(tekstas);
    const santykinis = relative(ROOT, failas).split('\\').join('/');
    irasai.push({
      kelias: santykinis,
      sritis: fm.sritis || '(be srities)',
      pavadinimas: pavadinimas(tekstas, santykinis),
      atnaujinta: fm.atnaujinta || '—',
      galiojaIki: fm['galioja-iki'] || '',
      tikrumas: fm.tikrumas || '',
      inbox: santykinis.startsWith('inbox/'),
    });
  }
}

irasai.sort((a, b) => a.sritis.localeCompare(b.sritis) || a.kelias.localeCompare(b.kelias));

const pagalSriti = new Map();
for (const irasas of irasai) {
  if (!pagalSriti.has(irasas.sritis)) pagalSriti.set(irasas.sritis, []);
  pagalSriti.get(irasas.sritis).push(irasas);
}

const laukiantys = irasai.filter((i) => i.inbox);

const eilutes = [];
eilutes.push('<!-- GENERUOTA: scripts/index.mjs. Ranka neredaguoti. -->');
eilutes.push('');
eilutes.push('# Atminties indeksas');
eilutes.push('');
eilutes.push(`${irasai.length} įrašų · ${pagalSriti.size} sričių · ${laukiantys.length} laukia patvirtinimo`);
eilutes.push('');
eilutes.push('Žymos: `✓` patvirtinta · `~` juodraštis · `?` spėjimas');
eilutes.push('');
eilutes.push('Kas pasenę — rodo `npm run tikrinti`, ne šis failas: indeksas turi priklausyti');
eilutes.push('tik nuo failų turinio, kitaip `--check` CI\'uje imtų kristi pats savaime.');
eilutes.push('');

if (laukiantys.length > 0) {
  eilutes.push('## Laukia patvirtinimo (`inbox/`)');
  eilutes.push('');
  for (const i of laukiantys) {
    eilutes.push(`- [${i.pavadinimas}](${i.kelias}) — ${i.atnaujinta}`);
  }
  eilutes.push('');
}

eilutes.push('## Pagal sritis');
eilutes.push('');

for (const [sritis, sarasas] of [...pagalSriti].sort()) {
  eilutes.push(`### ${sritis}`);
  eilutes.push('');
  eilutes.push('| | Įrašas | Atnaujinta | Galioja iki |');
  eilutes.push('|---|---|---|---|');
  for (const i of sarasas) {
    const zyme = TIKRUMO_ZYME[i.tikrumas] || '·';
    eilutes.push(`| ${zyme} | [${i.pavadinimas}](${i.kelias}) | ${i.atnaujinta} | ${i.galiojaIki || '—'} |`);
  }
  eilutes.push('');
}

const turinys = eilutes.join('\n');
const indeksoKelias = join(ROOT, 'INDEX.md');

if (CHECK) {
  const dabartinis = existsSync(indeksoKelias) ? readFileSync(indeksoKelias, 'utf8') : '';
  if (dabartinis.trim() !== turinys.trim()) {
    console.error('INDEX.md pasenęs — paleisk `npm run indeksas` ir įtrauk į commitą.');
    process.exit(1);
  }
  console.log('INDEX.md šviežias.');
} else {
  writeFileSync(indeksoKelias, `${turinys}\n`, 'utf8');
  console.log(`INDEX.md atnaujintas — ${irasai.length} įrašų.`);
}
