#!/usr/bin/env node
/**
 * Savaitinė atminties ataskaita (GitHub Action `schedule`).
 *
 * Atskiras failas, o ne `node -e '…'` YAML viduje: dvidešimt eilučių JS,
 * įdėtų į shell vienguolių kavučių eilutę, sulūžta nuo vieno apostrofo.
 *
 *   node scripts/ataskaita.mjs [kelias]
 */

import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '.');

let isvestis = '';
try {
  isvestis = execFileSync('node', [join(SCRIPTS, 'lint.mjs'), ROOT, '--json'], { encoding: 'utf8' });
} catch (klaida) {
  // Linteris grąžina exit 1 radęs klaidų — tai normalu, JSON vis tiek yra.
  isvestis = klaida.stdout || '';
}

let r;
try {
  r = JSON.parse(isvestis);
} catch {
  console.log('Linterio nepavyko paleisti — ataskaita nesudaryta.');
  process.exitCode = 1;
  process.exit();
}

const pasene = r.ispejimai.filter((i) => i.kodas === 'PASENE');
const dublikatai = r.ispejimai.filter((i) => i.kodas === 'DUBLIKATAS');
const secrets = r.klaidos.filter((k) => k.kodas.startsWith('SECRET/'));
const kitos = r.klaidos.filter((k) => !k.kodas.startsWith('SECRET/'));

const eil = [`Patikrinta ${r.failai} atminties failų (skenuota ${r.skenuota} dėl kredencialų).`, ''];

// Kredencialai — pirmiausia. Ankstesnė versija skaitė tik įspėjimus ir rašė
// „Atmintis švari" net tada, kai atmintyje gulėjo atviro teksto slaptažodis.
if (secrets.length) {
  eil.push(`## ⛔ KREDENCIALAI ATMINTYJE (${secrets.length})`, '');
  for (const k of secrets) eil.push(`- \`${k.failas}:${k.eilute}\` — ${k.zinute}`);
  eil.push('', 'Šiuos kredencialus reikia **pasukti**, o ne tik ištrinti iš failo:', 'jie jau yra git istorijoje.', '');
}

if (kitos.length) {
  eil.push(`## Struktūros klaidos (${kitos.length})`, '');
  for (const k of kitos) eil.push(`- \`${k.failas}:${k.eilute}\` — ${k.zinute}`);
  eil.push('');
}

if (pasene.length) {
  eil.push(`## Pasenę (${pasene.length})`, '');
  for (const p of pasene) eil.push(`- \`${p.failas}\` — ${p.zinute}`);
  eil.push('');
}

if (dublikatai.length) {
  eil.push(`## Galimi dublikatai (${dublikatai.length})`, '');
  for (const d of dublikatai) eil.push(`- \`${d.failas}\` — ${d.zinute}`);
  eil.push('');
}

if (!secrets.length && !kitos.length && !pasene.length && !dublikatai.length) {
  eil.push('Atmintis švari — kredencialų nėra, nieko pasenusio, dublikatų nėra.');
}

console.log(eil.join('\n'));

// Kredencialas atmintyje turi nudažyti ataskaitą raudonai, ne tik būti paminėtas.
if (secrets.length) process.exitCode = 1;
