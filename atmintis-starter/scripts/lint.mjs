#!/usr/bin/env node
/**
 * Atminties linteris.
 *
 * Viena svarbiausia paskirtis: NELEISTI kredencialui patekti į git. Visa kita
 * (šviežumas, dublikatai, ilgis) yra antraeiliai.
 *
 *   node scripts/lint.mjs [kelias]   # klaidos blokuoja, įspėjimai rodomi
 *   node scripts/lint.mjs --strict   # įspėjimai irgi blokuoja
 *   node scripts/lint.mjs --json     # mašinai skaitomas išvedimas
 *
 * Eilutę, kurioje radinys yra klaidingas, galima nutildyti komentaru
 * `<!-- lint:ne-secret -->` toje pačioje eilutėje. Nutildymas taikomas TIK
 * kredencialų taisyklėms ir tik tai vienai eilutei.
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, relative, resolve, dirname, extname } from 'node:path';

const argumentai = process.argv.slice(2);
const veliaveles = new Set(argumentai.filter((a) => a.startsWith('--')));
const kelioArg = argumentai.find((a) => !a.startsWith('--'));

const ROOT = resolve(kelioArg ?? '.');
const STRICT = veliaveles.has('--strict');
const JSON_OUT = veliaveles.has('--json');

/** Katalogai, kuriems taikomos STRUKTŪROS taisyklės (frontmatter, ilgis, nuorodos). */
const TURINIO_KATALOGAI = ['sritys', 'faktai', 'sprendimai', 'inbox', 'archyvas'];

/**
 * Kredencialai ieškomi VISUOSE tekstiniuose repo failuose, ne tik atminties
 * kataloguose — slaptažodis README.md ar routines/ faile yra lygiai taip pat
 * nutekėjęs.
 */
const NESKENUOJAMI_KATALOGAI = new Set(['.git', 'node_modules', '.github']);
const TEKSTINIAI_PLEĮTINIAI = new Set([
  '.md', '.txt', '.yml', '.yaml', '.json', '.sh', '.bash', '.zsh',
  '.env', '.cfg', '.conf', '.ini', '.toml', '.csv', '.sql', '.mjs', '.js', '.ts',
]);

/** Failai, kuriuose kredencialų šablonai ir netikri pavyzdžiai yra pagal paskirtį. */
const SAVI_FAILAI = new Set(['scripts/lint.mjs', 'scripts/test.mjs']);

const MAX_EILUCIU = 200;
const MIN_DUBLIKATO_ILGIS = 60;
const TIKRUMO_REIKSMES = ['patvirtinta', 'juodrastis', 'spejimas'];

const REKOMENDUOJAMA_TRUKME = {
  buhalterija: '12 mėn.',
  tiekejai: '3 mėn.',
  'it-infra': '3 mėn.',
};

const NUTILDYMAS = /<!--\s*lint:ne-secret\s*-->/;

// ---------------------------------------------------------------- secrets

const SECRET_SABLONAI = [
  ['sshpass', /sshpass\s+-p\s*(\S+)/i, 'sshpass su slaptažodžiu komandinėje eilutėje'],
  ['private-key', /(-----BEGIN [A-Z ]*PRIVATE KEY-----)/, 'privatus raktas'],
  ['gh-token', /\b((?:ghp|gho|ghs|ghu)_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/, 'GitHub token'],
  ['stripe', /\b((?:sk|rk)_live_[A-Za-z0-9]{10,})/, 'Stripe live raktas'],
  ['aws', /\b(AKIA[0-9A-Z]{16})\b/, 'AWS access key'],
  ['bearer', /\b(?:Authorization:\s*)?Bearer\s+([A-Za-z0-9._~+/-]{16,}=*)/i, 'Bearer token'],
  ['basic-auth', /Authorization:\s*Basic\s+([A-Za-z0-9+/]{16,}={0,2})/i, 'Basic auth antraštė su reikšme'],
  ['url-creds', /\b[a-z][a-z0-9+.-]*:\/\/[^\s/@:]+:([^\s@]{3,})@/i, 'kredencialai URL viduje'],
];

/**
 * Raktažodis + reikšmė toje pačioje eilutėje (`slaptažodis: xyz`).
 * Sąrašas apima lietuviškus linksnius ir dažniausias kitakalbes formas.
 */
const RAKTAZODZIO_SABLONAS = new RegExp(
  '\\b(' +
    [
      'slapta[žz]od(?:is|[žz]io|[žz]iai|[žz]i[ųu])',
      'password', 'passwd', 'pass', 'pwd', 'pw',
      'secret', 'api[_-]?key', 'apikey', 'access[_-]?token', 'auth[_-]?token',
      'tenant[_-]?key', 'client[_-]?secret', 'private[_-]?key', 'raktas', 'token',
      'kennwort', 'haslo', 'parol',
    ].join('|') +
    ')\\b\\s*[:=]\\s*(\\S+)',
  'i',
);

const PRISIJUNGIMO_KONTEKSTAS =
  /(\badmin\w*|\blogin\b|prisijungim\w*|vartotoj\w*|paskyr\w*|\baccount\b|\bsmtp\b|\bftp\b|\bssh\b|directadmin|phpmyadmin|\bdb\b|duomen[ųu] baz\w*|credential\w*)/i;

/** Reikšmė, atrodanti kaip slaptažodis: 8–40 simbolių, mažoji + didžioji + skaitmuo. */
const SLAPTAZODZIO_FORMA =
  /^(?=.{8,40}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z0-9!@#$%^&*_+=./:~?-]+$/;

/** Formos, kurios yra NUORODA į saugyklą ar vietaženklis, o ne pati paslaptis. */
const NUORODOS_ZYMES = [
  /^1password/i,
  /^op:\/\//i,
  /^bitwarden/i,
  /^keychain/i,
  /^\.env\b/i,
  /^\$\{[^}]*\}$/,
  /^"?\$[A-Za-z_][A-Za-z0-9_]*"?$/,
  /^<[^>]*>$/,
  /^\{\{.*\}\}$/,
  /^\*{2,}$/,
  /^…$|^\.\.\.$/,
  /^«.*»$/,
  /^(TODO|xxx+|REDACTED|REMOVED|CHANGEME|YOUR[_-]?\w*|例)$/i,
  /^[-–—]$/,
  // Bendriniai vietaženkliai iš dokumentacijos — niekada nebūna tikra reikšmė.
  /^(reik[šs]m[ėe]|value|slapta[žz]odis|password|pass|secret|token|raktas)$/i,
];

/** Nekaltos formos, atitinkančios „slaptažodžio" šabloną, bet nesančios paslaptimi. */
const NE_SLAPTAZODIS = [
  /^v?\d+[.\d]*$/,
  /^(PrestaShop|Laravel|MySQL|MariaDB|PHP|Node|Python|Ubuntu|Debian)[\d.]*$/i,
  /^[A-Z]{2,5}-\d{4}-[A-Z]?\d+$/, // ERP dokumentų numeracija, pvz. MLV-2026-P00123
];

function svarusZodis(gabalas) {
  return gabalas.replace(/^[('"`*\[\u201e\u201c]+/, '').replace(/[)'"`*\],.;:!?\u201c]+$/, '');
}

/** Ar REIKŠMĖ (ne eilutė!) yra nuoroda į saugyklą arba vietaženklis. */
function yraNuoroda(reiksme) {
  const svarus = svarusZodis(String(reiksme));
  if (svarus === '') return true;
  return NUORODOS_ZYMES.some((r) => r.test(svarus));
}

/** Ar tai git sha — tikrinama tik ten, kur kontekstas iš tikrųjų apie commitą. */
function yraShaKontekste(eilute, reiksme) {
  return /^[0-9a-f]{7,40}$/i.test(reiksme) && /\b(commit|sha|revision|git|hash)\b/i.test(eilute);
}

// ------------------------------------------------------------- frontmatter

function skaitytiFrontmatter(tekstas) {
  const svarus = tekstas.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  if (!svarus.startsWith('---')) return null;
  const pabaiga = svarus.indexOf('\n---', 3);
  if (pabaiga === -1) return null;
  const laukai = {};
  for (const eilute of svarus.slice(4, pabaiga).split('\n')) {
    const m = eilute.match(/^([a-ząčęėįšųūž0-9_-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const reiksme = m[2].trim().replace(/^['"]|['"]$/g, '').replace(/\s+#.*$/, '');
    if (reiksme === '|' || reiksme === '>') continue; // daugiaeilė reikšmė — nepalaikoma
    laukai[m[1]] = reiksme;
  }
  return laukai;
}

const DATOS_FORMATAS = /^\d{4}-\d{2}-\d{2}$/;

function arGaliojaData(s) {
  if (!DATOS_FORMATAS.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// --------------------------------------------------------------- vaikščiojimas

async function surinktiFailus(katalogas, filtras) {
  const rezultatas = [];
  async function eiti(dabartinis) {
    let irasai;
    try {
      irasai = await readdir(dabartinis, { withFileTypes: true });
    } catch {
      return;
    }
    for (const irasas of irasai) {
      if (NESKENUOJAMI_KATALOGAI.has(irasas.name)) continue;
      const kelias = join(dabartinis, irasas.name);
      let katalogas_;
      try {
        katalogas_ = statSync(kelias).isDirectory(); // statSync seka simlinkus
      } catch {
        continue;
      }
      if (katalogas_) await eiti(kelias);
      else if (filtras(kelias)) rezultatas.push(kelias);
    }
  }
  await eiti(katalogas);
  return rezultatas;
}

// ------------------------------------------------------------------ tikrinimai

const radiniai = [];

function pridėti(lygis, kodas, failas, eilute, zinute) {
  radiniai.push({
    lygis,
    kodas,
    failas: relative(ROOT, failas).split('\\').join('/'),
    eilute,
    zinute,
  });
}

function beKodoBloku(eilutes) {
  let bloke = false;
  return eilutes.map((e) => {
    if (/^\s*(```|~~~)/.test(e)) {
      bloke = !bloke;
      return '';
    }
    return bloke ? '' : e;
  });
}

const LENTELES_SKIRTUKAS = /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/;
const KREDENCIALO_STULPELIS =
  /(slapta[žz]od|password|\bpass\b|\bpw\b|\bpwd\b|secret|token|raktas|\bkey\b|prisijungim)/i;

function langeliai(eilute) {
  return eilute
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((c) => c.trim());
}

/**
 * Kredencialai lentelėse. Būtent tokia forma jie ir pasislepia:
 * raktažodis lieka antraštėje, o reikšmė — duomenų eilutėje, tad taisyklės,
 * dirbančios vienoje eilutėje, jos nemato.
 */
function tikrintiLenteles(failas, eilutes) {
  let stulpeliai = null;
  let kontekstas = false;

  eilutes.forEach((eilute, i) => {
    const lentelesEilute = /^\s*\|/.test(eilute);
    if (!lentelesEilute) {
      stulpeliai = null;
      kontekstas = false;
      return;
    }
    if (LENTELES_SKIRTUKAS.test(eilute)) return;

    const celes = langeliai(eilute);

    if (stulpeliai === null) {
      stulpeliai = celes.map((c) => KREDENCIALO_STULPELIS.test(c));
      kontekstas = celes.some((c) => PRISIJUNGIMO_KONTEKSTAS.test(c));
      return;
    }
    if (NUTILDYMAS.test(eilute)) return;

    celes.forEach((cele, stulpelis) => {
      const reiksme = svarusZodis(cele);
      if (!reiksme) return;
      const kredencialoStulpelis = stulpeliai[stulpelis];
      if (!kredencialoStulpelis && !kontekstas) return;
      if (yraNuoroda(reiksme)) return;
      if (NE_SLAPTAZODIS.some((r) => r.test(reiksme))) return;
      if (yraShaKontekste(eilute, reiksme)) return;
      if (!kredencialoStulpelis && !SLAPTAZODZIO_FORMA.test(reiksme)) return;
      if (kredencialoStulpelis && /\s/.test(reiksme)) return; // sakinys, ne reikšmė

      pridėti(
        'klaida',
        'SECRET/lentele',
        failas,
        i + 1,
        `lentelės langelis \`${reiksme}\` atrodo kaip kredencialas — vietoj jo rašyk nuorodą į saugyklą`,
      );
    });
  });
}

function tikrintiSecrets(failas, eilutes) {
  eilutes.forEach((eilute, i) => {
    if (NUTILDYMAS.test(eilute)) return;
    let rasta = false;

    for (const [kodas, regex, paaiskinimas] of SECRET_SABLONAI) {
      const m = eilute.match(regex);
      if (!m) continue;
      if (yraNuoroda(m[1])) continue; // dokumentacijos vietaženklis, ne paslaptis
      pridėti('klaida', `SECRET/${kodas}`, failas, i + 1, `${paaiskinimas} — atmintyje leidžiama tik nuoroda į saugyklą`);
      rasta = true;
    }

    const m = eilute.match(RAKTAZODZIO_SABLONAS);
    if (m && !yraNuoroda(m[2])) {
      pridėti(
        'klaida',
        'SECRET/reiksme',
        failas,
        i + 1,
        `„${m[1]}" su reikšme — vietoj jos rašyk nuorodą (pvz. „1Password įrašas \`vardas\`")`,
      );
      rasta = true;
    }

    if (rasta || !PRISIJUNGIMO_KONTEKSTAS.test(eilute)) return;

    for (const gabalas of eilute.split(/[\s`|]+/)) {
      const reiksme = svarusZodis(gabalas);
      if (!SLAPTAZODZIO_FORMA.test(reiksme)) continue;
      if (NE_SLAPTAZODIS.some((r) => r.test(reiksme))) continue;
      if (yraShaKontekste(eilute, reiksme)) continue;
      if (yraNuoroda(reiksme)) continue;
      pridėti(
        'klaida',
        'SECRET/be-raktazodzio',
        failas,
        i + 1,
        `\`${reiksme}\` prisijungimų eilutėje atrodo kaip kredencialas — pasuk jį ir palik tik nuorodą` +
          ' (klaidingai pažymėta? pridėk `<!-- lint:ne-secret -->` toje eilutėje)',
      );
      return;
    }
  });
}

function tikrintiFrontmatter(failas, tekstas, santykinis) {
  const laukai = skaitytiFrontmatter(tekstas);
  if (!laukai) {
    pridėti('klaida', 'FM/nera', failas, 1, 'nėra frontmatter bloko — atmintis be metaduomenų nepatikrinama');
    return;
  }
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
}

/** Lentelių ir frontmatter eilutės į ilgio ribą neįskaitomos — jos nėra „tekstas". */
function tikrintiIlgi(failas, eilutes) {
  const proza = eilutes.filter((e) => !/^\s*\|/.test(e)).length;
  if (proza > MAX_EILUCIU) {
    pridėti('klaida', 'ILGIS', failas, MAX_EILUCIU, `${proza} eilutės teksto (riba ${MAX_EILUCIU}) — laikas skelti į kelis failus`);
  }
}

function tikrintiNuorodas(failas, eilutes) {
  beKodoBloku(eilutes).forEach((eilute, i) => {
    const beInline = eilute.replace(/`[^`]*`/g, '');
    for (const m of beInline.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const tikslas = m[1];
      if (/^(https?:|mailto:|#|<)/.test(tikslas)) continue;
      const [kelias] = tikslas.split('#');
      if (!kelias) continue;
      let dekoduotas = kelias;
      try {
        dekoduotas = decodeURIComponent(kelias);
      } catch {
        /* paliekam kaip yra */
      }
      const kandidatai = [
        resolve(dirname(failas), dekoduotas),
        resolve(ROOT, dekoduotas),
        resolve(dirname(failas), kelias),
      ];
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
      zemelapis.get(raktas).add(relative(ROOT, failas).split('\\').join('/'));
    }
  });
}

function turinys(failas) {
  return readFileSync(failas, 'utf8').replace(/^\uFEFF/, '');
}

function eiluteMis(tekstas) {
  return tekstas.replace(/\r\n/g, '\n').split('\n');
}

// ------------------------------------------------------------------ paleidimas

// 1. Kredencialai — visame repo.
const visiTekstiniai = await surinktiFailus(ROOT, (k) => {
  const pl = extname(k).toLowerCase();
  return TEKSTINIAI_PLEĮTINIAI.has(pl) || pl === '';
});

for (const failas of visiTekstiniai) {
  const santykinis = relative(ROOT, failas).split('\\').join('/');
  if (SAVI_FAILAI.has(santykinis)) continue;
  let eilutes;
  try {
    eilutes = eiluteMis(turinys(failas));
  } catch {
    continue;
  }
  tikrintiSecrets(failas, eilutes);
  if (failas.endsWith('.md')) tikrintiLenteles(failas, eilutes);
}

// 2. Struktūra — tik atminties kataloguose.
const turinioFailai = [];
for (const katalogas of TURINIO_KATALOGAI) {
  const kelias = join(ROOT, katalogas);
  if (existsSync(kelias) && statSync(kelias).isDirectory()) {
    turinioFailai.push(...(await surinktiFailus(kelias, (k) => k.endsWith('.md'))));
  }
}

if (turinioFailai.length === 0) {
  console.error(`Nerasta nė vieno .md failo kataloguose: ${TURINIO_KATALOGAI.join(', ')} (šaknis: ${ROOT})`);
  process.exitCode = 1;
}

const sakiniuZemelapis = new Map();

for (const failas of turinioFailai) {
  const tekstas = turinys(failas);
  const eilutes = eiluteMis(tekstas);
  const santykinis = relative(ROOT, failas).split('\\').join('/');

  tikrintiFrontmatter(failas, tekstas, santykinis);
  tikrintiIlgi(failas, eilutes);
  tikrintiNuorodas(failas, eilutes);

  // Dublikatams frontmatter neįskaitomas — vienodas `saltinis` nėra dublikatas.
  const pabaiga = eilutes.indexOf('---', 1);
  surinktiSakinius(failas, pabaiga > 0 ? eilutes.slice(pabaiga + 1) : eilutes, sakiniuZemelapis);
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
  console.log(JSON.stringify({ failai: turinioFailai.length, skenuota: visiTekstiniai.length, klaidos, ispejimai }, null, 2));
} else {
  const pagalFaila = new Map();
  for (const r of radiniai) {
    if (!pagalFaila.has(r.failas)) pagalFaila.set(r.failas, []);
    pagalFaila.get(r.failas).push(r);
  }
  for (const [failas, sarasas] of [...pagalFaila].sort()) {
    console.log(`\n${failas}`);
    for (const r of sarasas.sort((a, b) => a.eilute - b.eilute)) {
      const zyme = r.lygis === 'klaida' ? 'KLAIDA' : 'ĮSPĖJ.';
      const vieta = r.eilute ? `:${r.eilute}` : '';
      console.log(`  ${zyme}  ${r.kodas.padEnd(20)} ${failas}${vieta}  ${r.zinute}`);
    }
  }
  console.log(
    `\nSkenuota ${visiTekstiniai.length} failų dėl kredencialų, ${turinioFailai.length} atminties failų dėl struktūros` +
      ` — ${klaidos.length} klaid(a/os), ${ispejimai.length} įspėjim(as/ai).`,
  );
  if (klaidos.length === 0 && ispejimai.length === 0) console.log('Atmintis tvarkinga.');
}

// process.exit() nutrauktų dar neišrašytą stdout, kai jis yra pipe.
if (klaidos.length > 0 || (STRICT && ispejimai.length > 0)) process.exitCode = 1;
