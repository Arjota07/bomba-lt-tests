#!/usr/bin/env node
/**
 * Atminties linteris.
 *
 * Tikrina, kad atmintis nesidubliuotų, nepasentų ir kad į ją niekada
 * nepatektų kredencialai. Be priklausomybių — tik node.
 *
 *   node scripts/lint.mjs            # klaidos blokuoja, įspėjimai rodomi
 *   node scripts/lint.mjs --strict   # įspėjimai irgi blokuoja
 *   node scripts/lint.mjs --json     # mašinai skaitomas išvedimas
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, relative, resolve, dirname } from 'node:path';

const ROOT = resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '.');
const STRICT = process.argv.includes('--strict');
const JSON_OUT = process.argv.includes('--json');

/** Katalogai, kuriuose gyvena atmintis. Viskas kita netikrinama. */
const TURINIO_KATALOGAI = ['sritys', 'faktai', 'sprendimai', 'inbox', 'archyvas'];

const MAX_EILUCIU = 200;
const MIN_DUBLIKATO_ILGIS = 60;

const TIKRUMO_REIKSMES = ['patvirtinta', 'juodrastis', 'spejimas'];

/** Sritys, kurių `galioja-iki` numatytoji trukmė skiriasi — tik informacijai. */
const REKOMENDUOJAMA_TRUKME = {
  buhalterija: '12 mėn.',
  tiekejai: '3 mėn.',
  'it-infra': '3 mėn.',
};

// ---------------------------------------------------------------- secrets

/**
 * Kredencialų šablonai. Kiekvienas — [kodas, regex, paaiškinimas].
 * Vienintelė leidžiama forma atmintyje yra NUORODA į saugyklą, ne reikšmė.
 */
const SECRET_SABLONAI = [
  ['sshpass', /sshpass\s+-p\s*['"]?[^\s'"]{3,}/i, 'sshpass su slaptažodžiu komandinėje eilutėje'],
  ['private-key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'privatus raktas'],
  ['gh-token', /\b(ghp|gho|ghs|ghu)_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}/, 'GitHub token'],
  ['stripe', /\b(sk|rk)_live_[A-Za-z0-9]{10,}/, 'Stripe live raktas'],
  ['aws', /\bAKIA[0-9A-Z]{16}\b/, 'AWS access key'],
  ['basic-auth', /Authorization:\s*Basic\s+[A-Za-z0-9+/]{16,}={0,2}/i, 'Basic auth antraštė su reikšme'],
  ['url-creds', /\b[a-z][a-z0-9+.-]*:\/\/[^\s/@:]+:[^\s/@]{3,}@/i, 'kredencialai URL viduje'],
];

/** Raktažodis + reikšmė (`slaptažodis: xyz`). Atskirai, nes reikia nuorodų išimties. */
const RAKTAZODZIO_SABLONAS =
  /\b(slaptažodis|slaptazodis|password|passwd|pwd|pw|secret|api[_-]?key|apikey|access[_-]?token|auth[_-]?token|tenant[_-]?key|client[_-]?secret)\b\s*[:=]\s*(\S+)/i;

/**
 * Kredencialas BE raktažodžio — būtent taip jie ir pasislepia:
 * `**Admin:** https://.../login / vartotojas / Slaptas2026!`
 *
 * Tikslaus šablono čia nėra, todėl tai tik ĮSPĖJIMAS: reikia ir prisijungimo
 * konteksto eilutėje, ir reikšmės, kuri atrodo kaip slaptažodis.
 */
const PRISIJUNGIMO_KONTEKSTAS =
  /\b(admin|login|prisijungim|vartotoj|paskyr|account|smtp|ftp|ssh|directadmin|phpmyadmin|db|duomenų baz)/i;

const SLAPTAZODZIO_FORMA = /(?<![\w/.-])(?=[^\s]{8,40}(?![\w!@#$%^&*+=-]))(?=[^\s]*[a-z])(?=[^\s]*[A-Z])(?=[^\s]*\d)[A-Za-z0-9!@#$%^&*_+=-]{8,40}/;

/** Nekaltos formos, kurios atitinka „slaptažodžio" šabloną, bet nėra paslaptis. */
const NE_SLAPTAZODIS = [
  /^[0-9a-f]{7,40}$/i, // git sha
  /^v?\d+[.\d]*$/, // versija
  /^(PrestaShop|Laravel|MySQL|PHP|Node)\d/i, // technologija + versija
];

/** Formos, kurios yra NUORODA į saugyklą, o ne pati paslaptis. */
const NUORODOS_ZYMES = [
  /1password/i,
  /\bop:\/\//i,
  /bitwarden/i,
  /keychain/i,
  /\.env\b/i,
  /\$\{[^}]+\}/,
  /^\$[A-Z_]+$/,
  /^<[^>]+>$/,
  /^\*{3,}/,
  /^…$|^\.\.\.$/,
  /^«.*»$/,
  /^`?(TODO|xxx|REDACTED|REMOVED)`?$/i,
];

function yraNuoroda(eilute, reiksme) {
  const svarus = reiksme.replace(/^['"`]|['",`;]+$/g, '');
  return NUORODOS_ZYMES.some((r) => r.test(svarus) || r.test(eilute));
}

// ------------------------------------------------------------- frontmatter

function skaitytiFrontmatter(tekstas) {
  if (!tekstas.startsWith('---')) return null;
  const pabaiga = tekstas.indexOf('\n---', 3);
  if (pabaiga === -1) return null;
  const blokas = tekstas.slice(4, pabaiga);
  const laukai = {};
  for (const eilute of blokas.split('\n')) {
    const m = eilute.match(/^([a-ząčęėįšųūž0-9_-]+)\s*:\s*(.*)$/i);
    if (m) laukai[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '').replace(/\s+#.*$/, '');
  }
  return { laukai, eiluciu: blokas.split('\n').length + 2 };
}

const DATOS_FORMATAS = /^\d{4}-\d{2}-\d{2}$/;

function arGaliojaData(s) {
  if (!DATOS_FORMATAS.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// --------------------------------------------------------------- vaikščiojimas

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
      if (irasas.name.startsWith('.') || irasas.name === 'node_modules') continue;
      const kelias = join(dabartinis, irasas.name);
      if (irasas.isDirectory()) await eiti(kelias);
      else if (irasas.name.endsWith('.md')) rezultatas.push(kelias);
    }
  }
  await eiti(katalogas);
  return rezultatas;
}

// ------------------------------------------------------------------ tikrinimai

const radiniai = [];

function pridėti(lygis, kodas, failas, eilute, zinute) {
  radiniai.push({ lygis, kodas, failas: relative(ROOT, failas), eilute, zinute });
}

function beKodoBloku(eilutes) {
  let bloke = false;
  return eilutes.map((e) => {
    if (/^\s*```/.test(e)) {
      bloke = !bloke;
      return '';
    }
    return bloke ? '' : e;
  });
}

function tikrintiSecrets(failas, eilutes) {
  eilutes.forEach((eilute, i) => {
    for (const [kodas, regex, paaiskinimas] of SECRET_SABLONAI) {
      if (regex.test(eilute)) {
        pridėti('klaida', `SECRET/${kodas}`, failas, i + 1, `${paaiskinimas} — atmintyje leidžiama tik nuoroda į saugyklą`);
        return;
      }
    }
    const m = eilute.match(RAKTAZODZIO_SABLONAS);
    if (m && !yraNuoroda(eilute, m[2])) {
      pridėti(
        'klaida',
        'SECRET/reiksme',
        failas,
        i + 1,
        `„${m[1]}" su reikšme — vietoj jos rašyk nuorodą (pvz. „1Password įrašas \`vardas\`")`,
      );
      return;
    }

    if (PRISIJUNGIMO_KONTEKSTAS.test(eilute)) {
      for (const gabalas of eilute.split(/[\s`|]+/)) {
        const svarus = gabalas.replace(/^[('"*]+|[)'"*,.;:]+$/g, '');
        if (!SLAPTAZODZIO_FORMA.test(svarus)) continue;
        if (NE_SLAPTAZODIS.some((r) => r.test(svarus))) continue;
        if (yraNuoroda(eilute, svarus)) continue;
        pridėti(
          'ispejimas',
          'GALIMAS-SECRET',
          failas,
          i + 1,
          `\`${svarus}\` prisijungimų eilutėje atrodo kaip kredencialas — jei taip, pasuk jį ir palik tik nuorodą`,
        );
        return;
      }
    }
  });
}

function tikrintiFrontmatter(failas, tekstas, santykinis) {
  const fm = skaitytiFrontmatter(tekstas);
  if (!fm) {
    pridėti('klaida', 'FM/nera', failas, 1, 'nėra frontmatter bloko — atmintis be metaduomenų nepatikrinama');
    return null;
  }
  const { laukai } = fm;
  const archyve = santykinis.startsWith('archyvas/');
  const inbox = santykinis.startsWith('inbox/');

  const butini = ['sritis', 'atnaujinta', 'tikrumas'];
  if (!archyve) butini.push('galioja-iki');
  if (!inbox && !archyve) butini.push('saltinis');

  for (const laukas of butini) {
    if (!laukai[laukas]) pridėti('klaida', 'FM/laukas', failas, 1, `trūksta lauko \`${laukas}\``);
  }

  for (const laukas of ['atnaujinta', 'galioja-iki']) {
    if (laukai[laukas] && !arGaliojaData(laukai[laukas])) {
      pridėti('klaida', 'FM/data', failas, 1, `\`${laukas}: ${laukai[laukas]}\` — reikia YYYY-MM-DD`);
    }
  }

  if (laukai.tikrumas && !TIKRUMO_REIKSMES.includes(laukai.tikrumas)) {
    pridėti('klaida', 'FM/tikrumas', failas, 1, `\`tikrumas: ${laukai.tikrumas}\` — galima tik: ${TIKRUMO_REIKSMES.join(', ')}`);
  }

  if (inbox && laukai.tikrumas && laukai.tikrumas !== 'juodrastis') {
    pridėti('klaida', 'INBOX/tikrumas', failas, 1, 'inbox/ įrašas privalo būti `tikrumas: juodrastis` iki patvirtinimo');
  }

  if (
    laukai.atnaujinta &&
    laukai['galioja-iki'] &&
    arGaliojaData(laukai.atnaujinta) &&
    arGaliojaData(laukai['galioja-iki']) &&
    laukai['galioja-iki'] <= laukai.atnaujinta
  ) {
    pridėti('klaida', 'FM/data', failas, 1, '`galioja-iki` turi būti vėlesnė už `atnaujinta`');
  }

  if (!archyve && laukai['galioja-iki'] && arGaliojaData(laukai['galioja-iki'])) {
    const siandien = new Date().toISOString().slice(0, 10);
    if (laukai['galioja-iki'] < siandien) {
      const patarimas = REKOMENDUOJAMA_TRUKME[laukai.sritis];
      pridėti(
        'ispejimas',
        'PASENE',
        failas,
        1,
        `galiojimas baigėsi ${laukai['galioja-iki']} — peržiūrėk ir pratęsk${patarimas ? ` (šiai sričiai įprasta ${patarimas})` : ''}`,
      );
    }
  }

  return laukai;
}

function tikrintiIlgi(failas, eilutes) {
  if (eilutes.length > MAX_EILUCIU) {
    pridėti(
      'klaida',
      'ILGIS',
      failas,
      MAX_EILUCIU,
      `${eilutes.length} eilučių (riba ${MAX_EILUCIU}) — laikas skelti į kelis failus`,
    );
  }
}

function tikrintiNuorodas(failas, eilutes) {
  eilutes.forEach((eilute, i) => {
    for (const m of eilute.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const tikslas = m[1];
      if (/^(https?:|mailto:|#)/.test(tikslas)) continue;
      const [kelias] = tikslas.split('#');
      if (!kelias) continue;
      const kandidatai = [resolve(dirname(failas), kelias), resolve(ROOT, kelias)];
      if (!kandidatai.some((k) => existsSync(k))) {
        pridėti('klaida', 'NUORODA', failas, i + 1, `nuoroda į neegzistuojantį \`${kelias}\``);
      }
    }
  });
}

function normalizuoti(sakinys) {
  return sakinys
    .toLowerCase()
    .replace(/[`*_>#\[\]()]/g, '')
    .replace(/[.,;:!?"'—–-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function surinktiSakinius(failas, eilutes, zemelapis) {
  const svarios = beKodoBloku(eilutes);
  svarios.forEach((eilute) => {
    if (/^\s*(#|\||---)/.test(eilute)) return;
    for (const gabalas of eilute.split(/(?<=[.!?])\s+/)) {
      const raktas = normalizuoti(gabalas);
      if (raktas.length < MIN_DUBLIKATO_ILGIS) continue;
      if (!zemelapis.has(raktas)) zemelapis.set(raktas, new Set());
      zemelapis.get(raktas).add(relative(ROOT, failas));
    }
  });
}

// ------------------------------------------------------------------ paleidimas

const failai = [];
for (const katalogas of TURINIO_KATALOGAI) {
  const kelias = join(ROOT, katalogas);
  if (existsSync(kelias) && statSync(kelias).isDirectory()) {
    failai.push(...(await surinktiFailus(kelias)));
  }
}

if (failai.length === 0) {
  console.error(`Nerasta nė vieno .md failo kataloguose: ${TURINIO_KATALOGAI.join(', ')} (šaknis: ${ROOT})`);
  process.exit(1);
}

const sakiniuZemelapis = new Map();

for (const failas of failai) {
  const tekstas = readFileSync(failas, 'utf8');
  const eilutes = tekstas.split('\n');
  const santykinis = relative(ROOT, failas).split('\\').join('/');

  tikrintiSecrets(failas, eilutes);
  tikrintiFrontmatter(failas, tekstas, santykinis);
  tikrintiIlgi(failas, eilutes);
  tikrintiNuorodas(failas, eilutes);
  surinktiSakinius(failas, eilutes, sakiniuZemelapis);
}

for (const [raktas, failuAibe] of sakiniuZemelapis) {
  if (failuAibe.size < 2) continue;
  const sarasas = [...failuAibe].sort();
  radiniai.push({
    lygis: 'ispejimas',
    kodas: 'DUBLIKATAS',
    failas: sarasas[0],
    eilute: 0,
    zinute: `tas pats teiginys yra ir čia: ${sarasas.slice(1).join(', ')} — „${raktas.slice(0, 70)}…"`,
  });
}

// ------------------------------------------------------------------ išvedimas

const klaidos = radiniai.filter((r) => r.lygis === 'klaida');
const ispejimai = radiniai.filter((r) => r.lygis === 'ispejimas');

if (JSON_OUT) {
  console.log(JSON.stringify({ failai: failai.length, klaidos, ispejimai }, null, 2));
} else {
  const pagalFaila = new Map();
  for (const r of radiniai) {
    if (!pagalFaila.has(r.failas)) pagalFaila.set(r.failas, []);
    pagalFaila.get(r.failas).push(r);
  }
  for (const [failas, sarasas] of [...pagalFaila].sort()) {
    console.log(`\n${failas}`);
    for (const r of sarasas.sort((a, b) => a.eilute - b.eilute)) {
      const zyme = r.lygis === 'klaida' ? 'KLAIDA ' : 'ĮSPĖJ. ';
      const vieta = r.eilute ? `:${r.eilute}` : '';
      console.log(`  ${zyme} ${r.kodas.padEnd(16)} ${failas}${vieta}  ${r.zinute}`);
    }
  }
  console.log(
    `\nPatikrinta ${failai.length} failų — ${klaidos.length} klaid(a/os), ${ispejimai.length} įspėjim(as/ai).`,
  );
  if (klaidos.length === 0 && ispejimai.length === 0) console.log('Atmintis tvarkinga.');
}

process.exit(klaidos.length > 0 || (STRICT && ispejimai.length > 0) ? 1 : 0);
