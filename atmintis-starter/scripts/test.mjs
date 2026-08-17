#!/usr/bin/env node
/**
 * Linterio testai.
 *
 * Linteris yra vienintelis dalykas, skiriantis atmintį git'e nuo atminties,
 * kurią vėl teks išmesti iš git'o. Jei jis tyliai sugenda, apie tai sužinotum
 * tik po kito nutekėjimo — todėl jis tikrinamas.
 *
 * KIEKVIENAS atvejis tikrina ir radinių kodus, IR proceso exit kodą. Be exit
 * kodo tikrinimo testai praeitų net tada, kai linteris nustotų ką nors
 * blokuoti — būtent tokia klaida čia ir buvo.
 *
 *   node scripts/test.mjs
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = dirname(fileURLToPath(import.meta.url));
const LINT = join(SCRIPTS, 'lint.mjs');

const FM = (papildomai = {}) => {
  const laukai = {
    sritis: 'it-infra',
    atnaujinta: '2026-08-01',
    'galioja-iki': '2099-01-01',
    saltinis: 'testas',
    tikrumas: 'patvirtinta',
    ...papildomai,
  };
  return `---\n${Object.entries(laukai)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')}\n---\n`;
};

/** Švarus turinio failas — kad struktūros patikra visada turėtų ką tikrinti. */
const SVARUS = { 'sritys/ok.md': `${FM()}# Tvarkingas\nEilinis sakinys apie serverio konfigūraciją.\n` };

const A = (turinys, papildomi = {}) => ({ ...SVARUS, 'sritys/a.md': turinys, ...papildomi });

/**
 * [pavadinimas, failai, { laukiami, nelaukiami, blokuoja }]
 * blokuoja: true = linteris privalo grąžinti exit 1.
 */
const ATVEJAI = [
  // ---- kredencialų aptikimas -------------------------------------------
  [
    'sshpass su slaptažodžiu',
    A(`${FM()}# A\nSSH: sshpass -p 'Slaptas123' ssh vartotojas@hostas\n`),
    { laukiami: ['SECRET/sshpass'], blokuoja: true },
  ],
  [
    'slaptažodis su reikšme',
    A(`${FM()}# A\nAdmin slaptažodis: TikrasSlaptas2026\n`),
    { laukiami: ['SECRET/reiksme'], blokuoja: true },
  ],
  [
    'APĖJIMAS: „.env" toje pačioje eilutėje nebenutildo',
    A(`${FM()}# A\nAdmin slaptažodis: TikrasSlaptas2026! (kiti — .env faile)\n`),
    { laukiami: ['SECRET/reiksme'], blokuoja: true },
  ],
  [
    'APĖJIMAS: „1Password" toje pačioje eilutėje nebenutildo',
    A(`${FM()}# A\nDB slaptažodis: Xk7mQz9Wufd (o SSH — 1Password įraše)\n`),
    { laukiami: ['SECRET/reiksme'], blokuoja: true },
  ],
  [
    'APĖJIMAS: kredencialas markdown lentelėje',
    A(`${FM()}# A\n\n| Sistema | Vartotojas | Slaptažodis |\n|---|---|---|\n| DirectAdmin | naudotojas | Xk7@mQz9Wufd |\n`),
    { laukiami: ['SECRET/lentele'], blokuoja: true },
  ],
  [
    'APĖJIMAS: kredencialas ne atminties kataloge (README.md)',
    { ...SVARUS, 'README.md': '# Repo\nSMTP password: Tikras2026Slaptas\n' },
    { laukiami: ['SECRET/reiksme'], blokuoja: true },
  ],
  [
    'APĖJIMAS: kredencialas .txt faile',
    { ...SVARUS, 'prieigos.txt': 'admin / Tikras2026Slaptas\n' },
    { laukiami: ['SECRET/be-raktazodzio'], blokuoja: true },
  ],
  [
    'APĖJIMAS: perkelta lentelė (raktažodis pirmame langelyje, ne antraštėje)',
    A(`${FM()}# A\n\n| Laukas | Reiksme |\n|---|---|\n| Hostas | srv12.hostas.lt |\n| Slaptazodis | Bomba2026Vinilas |\n`),
    { laukiami: ['SECRET/lentele'], blokuoja: true },
  ],
  [
    'APĖJIMAS: markdown paryškinimas `**Slaptažodis:** X`',
    A(`${FM()}# A\n**Slaptažodis:** Tikras2026Aa\n`),
    { laukiami: ['SECRET/reiksme'], blokuoja: true },
  ],
  [
    'APĖJIMAS: reikšmė kitoje eilutėje po `slaptažodis:`',
    A(`${FM()}# A\nDirectAdmin slaptažodis:\n\nTikras2026Aa\n`),
    { laukiami: ['SECRET/daugiaeilis'], blokuoja: true },
  ],
  [
    'APĖJIMAS: nežinomo vardo frontmatter laukas',
    A(`${FM({ prieiga: 'Bomba2026Vinilas' })}# A\ntekstas\n`),
    { laukiami: ['SECRET/frontmatter'], blokuoja: true },
  ],
  [
    'kredencialas be raktažodžio dabar BLOKUOJA, ne įspėja',
    A(`${FM()}# A\n**Admin:** \`https://x.lt/admin/login\` / \`naudotojas\` / \`Admin2026!\`\n`),
    { laukiami: ['SECRET/be-raktazodzio'], blokuoja: true },
  ],
  [
    'GitHub token, Bearer, Basic auth, URL kredencialai',
    A(
      `${FM()}# A\n` +
        'Token: ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ012345\n' +
        'Auth: Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\n' +
        'Basic: Authorization: Basic YWRtaW46c3VwZXJzZWNyZXQxMjM=\n' +
        'DSN: mysql://root:Slaptas123@localhost/db\n',
    ),
    { laukiami: ['SECRET/gh-token', 'SECRET/bearer', 'SECRET/basic-auth', 'SECRET/url-creds'], blokuoja: true },
  ],

  // ---- ko NETURI blokuoti ----------------------------------------------
  [
    'nuoroda į 1Password praeina',
    A(`${FM()}# A\nDB slaptažodis: 1Password\nSSH prisijungimas — 1Password įraše \`serveris\`.\n`),
    { nelaukiami: ['SECRET/reiksme', 'SECRET/be-raktazodzio', 'SECRET/lentele'], blokuoja: false },
  ],
  [
    'aplinkos kintamasis ir vietaženklis praeina',
    A(`${FM()}# A\nSMTP password: \${SMTP_PASSWORD}\nPvz.: sshpass -p "$SSH_PASSWORD" ssh hostas\nAdmin slaptažodis: <slaptazodis>\n`),
    { nelaukiami: ['SECRET/reiksme', 'SECRET/sshpass'], blokuoja: false },
  ],
  [
    'proza apie slaptažodžių taisyklę nėra kredencialas',
    A(
      `${FM()}# A\nLinteris blokuoja commitą radęs \`slaptažodis: reikšmė\`, \`sshpass -p\`, API raktus.\n` +
        'Slaptažodžių saugykla yra 1Password.\n',
    ),
    { nelaukiami: ['SECRET/reiksme', 'SECRET/sshpass', 'SECRET/be-raktazodzio'], blokuoja: false },
  ],
  [
    'antraštė „Slaptažodžiai:" su tekstu žemiau nėra kredencialas',
    A(`${FM()}# A\nSlaptažodžiai:\n\n- niekada nerašomi atmintyje, tik nuoroda į saugyklą.\n`),
    { nelaukiami: ['SECRET/daugiaeilis'], blokuoja: false },
  ],
  [
    'ERP dokumento numeris ir versija prisijungimų eilutėje praeina',
    A(`${FM()}# A\nAdmin skydelis veikia PrestaShop1789 versijoje, dokumentas MLV-2026-P00123.\n`),
    { nelaukiami: ['SECRET/be-raktazodzio'], blokuoja: false },
  ],
  [
    'git sha commito kontekste praeina',
    A(`${FM()}# A\nAdmin modulio commit sha: a1b2c3d4e5f6789.\n`),
    { nelaukiami: ['SECRET/be-raktazodzio'], blokuoja: false },
  ],
  [
    'nutildymo komentaras veikia',
    A(`${FM()}# A\n**Admin:** \`naudotojas\` / \`Pavyzdys2026X\` <!-- lint:ne-secret -->\n`),
    { nelaukiami: ['SECRET/be-raktazodzio'], blokuoja: false },
  ],
  [
    'markdown nuoroda kodo bloke nėra tikra nuoroda',
    A(`${FM()}# A\n\n\`\`\`md\n[pavyzdys](../nera/failo.md)\n\`\`\`\n`),
    { nelaukiami: ['NUORODA'], blokuoja: false },
  ],
  [
    'vienodas saltinis dviejuose failuose nėra dublikatas',
    {
      ...SVARUS,
      'sritys/a.md': `${FM({ saltinis: 'Bertus 2026 dilerių kainynas, gautas elektroniniu paštu 2026-08-12' })}# A\nPirmas turinys.\n`,
      'sritys/b.md': `${FM({ saltinis: 'Bertus 2026 dilerių kainynas, gautas elektroniniu paštu 2026-08-12' })}# B\nAntras turinys.\n`,
    },
    { nelaukiami: ['DUBLIKATAS'], blokuoja: false },
  ],
  [
    'ilga lentelė neviršija ILGIS ribos',
    A(`${FM()}# A\n\n| Kodas | Reikšmė |\n|---|---|\n${Array.from({ length: 250 }, (_, i) => `| K${i} | reikšmė ${i} |`).join('\n')}\n`),
    { nelaukiami: ['ILGIS'], blokuoja: false },
  ],

  // ---- struktūra --------------------------------------------------------
  ['be frontmatter', A('# A\nTekstas.\n'), { laukiami: ['FM/nera'], blokuoja: true }],
  ['trūksta lauko', A(`${FM({ saltinis: null })}# A\nTekstas.\n`), { laukiami: ['FM/laukas'], blokuoja: true }],
  ['blogas tikrumas', A(`${FM({ tikrumas: 'gal_but' })}# A\nTekstas.\n`), { laukiami: ['FM/tikrumas'], blokuoja: true }],
  [
    'galioja-iki anksčiau už atnaujinta',
    A(`${FM({ 'galioja-iki': '2026-07-01' })}# A\nTekstas.\n`),
    { laukiami: ['FM/data'], blokuoja: true },
  ],
  [
    'pasenęs įrašas — įspėjimas, NEblokuoja',
    A(`${FM({ atnaujinta: '2026-01-01', 'galioja-iki': '2026-02-01' })}# A\nTekstas.\n`),
    { laukiami: ['PASENE'], nelaukiami: ['FM/data'], blokuoja: false },
  ],
  [
    'inbox privalo būti juodraštis',
    { ...SVARUS, 'inbox/a.md': `${FM({ sritis: 'discogs' })}# A\nTekstas.\n` },
    { laukiami: ['INBOX/tikrumas'], blokuoja: true },
  ],
  [
    'inbox su juodraščiu praeina',
    { ...SVARUS, 'inbox/a.md': `${FM({ sritis: 'discogs', tikrumas: 'juodrastis', saltinis: null })}# A\nTekstas.\n` },
    { nelaukiami: ['INBOX/tikrumas', 'FM/laukas'], blokuoja: false },
  ],
  [
    'archyve galioja-iki neprivalomas',
    { ...SVARUS, 'archyvas/a.md': `${FM({ 'galioja-iki': null, saltinis: null })}# A\nTekstas.\n` },
    { nelaukiami: ['FM/laukas', 'PASENE'], blokuoja: false },
  ],
  [
    'per ilgas failas',
    A(`${FM()}# A\n${Array.from({ length: 210 }, (_, i) => `Eilute ${i}`).join('\n')}\n`),
    { laukiami: ['ILGIS'], blokuoja: true },
  ],
  ['lūžusi nuoroda', A(`${FM()}# A\n[nera](../nera/failo.md)\n`), { laukiami: ['NUORODA'], blokuoja: true }],
  [
    'dublikatas dviejuose failuose',
    {
      ...SVARUS,
      'sritys/a.md': `${FM()}# A\nŠitas pakankamai ilgas teiginys turi kartotis dviejuose failuose, kad būtų pagautas.\n`,
      'sritys/b.md': `${FM()}# B\nŠitas pakankamai ilgas teiginys turi kartotis dviejuose failuose, kad būtų pagautas.\n`,
    },
    { laukiami: ['DUBLIKATAS'], blokuoja: false },
  ],
  [
    'CRLF failas tikrinamas normaliai',
    A(`${FM()}# A\nAdmin slaptažodis: TikrasSlaptas2026\n`.replace(/\n/g, '\r\n')),
    { laukiami: ['SECRET/reiksme'], blokuoja: true },
  ],
  [
    'tvarkingas failas neduoda nieko',
    A(`${FM()}# A\nServerio slaptažodis — 1Password įraše \`serveris\`.\n`),
    {
      nelaukiami: ['SECRET/reiksme', 'SECRET/be-raktazodzio', 'FM/nera', 'FM/laukas', 'PASENE', 'DUBLIKATAS'],
      blokuoja: false,
    },
  ],
];

function paleisti(failai, papildomiArgumentai = []) {
  const saknis = mkdtempSync(join(tmpdir(), 'atmintis-'));
  try {
    for (const [kelias, turinys] of Object.entries(failai)) {
      const pilnas = join(saknis, kelias);
      mkdirSync(dirname(pilnas), { recursive: true });
      writeFileSync(pilnas, turinys, 'utf8');
    }
    let isvestis = '';
    let exitCode = 0;
    try {
      isvestis = execFileSync('node', [LINT, ...papildomiArgumentai, saknis, '--json'], { encoding: 'utf8' });
    } catch (klaida) {
      isvestis = klaida.stdout || '';
      exitCode = typeof klaida.status === 'number' ? klaida.status : 1;
    }
    let r;
    try {
      r = JSON.parse(isvestis);
    } catch {
      return { kodai: [], exitCode, jsonKlaida: true, isvestis };
    }
    return {
      kodai: [...r.klaidos, ...r.ispejimai].map((x) => x.kodas),
      klaiduKodai: r.klaidos.map((x) => x.kodas),
      exitCode,
      jsonKlaida: false,
    };
  } finally {
    rmSync(saknis, { recursive: true, force: true });
  }
}

let praejo = 0;
const nepraejo = [];

for (const [pavadinimas, failai, { laukiami = [], nelaukiami = [], blokuoja }] of ATVEJAI) {
  const r = paleisti(failai);
  const bedos = [];

  if (r.jsonKlaida) bedos.push(`--json grąžino nevalidų JSON: ${String(r.isvestis).slice(0, 80)}`);

  const truksta = laukiami.filter((k) => !r.kodai.includes(k));
  if (truksta.length) bedos.push(`nerado: ${truksta.join(', ')}`);

  const pertekliniai = nelaukiami.filter((k) => r.kodai.includes(k));
  if (pertekliniai.length) bedos.push(`neteisingai rado: ${pertekliniai.join(', ')}`);

  const laukiamasExit = blokuoja ? 1 : 0;
  if (r.exitCode !== laukiamasExit) bedos.push(`exit ${r.exitCode}, laukta ${laukiamasExit}`);

  // Blokuoti privalantis radinys turi būti KLAIDA, ne įspėjimas.
  if (blokuoja) {
    const neKlaidos = laukiami.filter((k) => r.kodai.includes(k) && !r.klaiduKodai.includes(k));
    if (neKlaidos.length) bedos.push(`tik įspėjimas, turi blokuoti: ${neKlaidos.join(', ')}`);
  }

  if (bedos.length === 0) {
    praejo += 1;
    console.log(`  ok    ${pavadinimas}`);
  } else {
    nepraejo.push(pavadinimas);
    console.log(`  KLAIDA ${pavadinimas} — ${bedos.join('; ')} (grąžino: ${r.kodai.join(', ') || 'nieko'})`);
  }
}

// Atskirai: vėliavėlė PRIEŠ kelią neturi tyliai ignoruoti kelio.
{
  const r = paleisti(A(`${FM()}# A\nAdmin slaptažodis: TikrasSlaptas2026\n`), ['--strict']);
  if (r.kodai.includes('SECRET/reiksme') && r.exitCode === 1) {
    praejo += 1;
    console.log('  ok    vėliavėlė prieš kelią nenulemia tikrinamo katalogo');
  } else {
    nepraejo.push('vėliavėlė prieš kelią');
    console.log(`  KLAIDA vėliavėlė prieš kelią — grąžino: ${r.kodai.join(', ') || 'nieko'}, exit ${r.exitCode}`);
  }
}

const viso = ATVEJAI.length + 1;
console.log(`\n${praejo}/${viso} testų praėjo.`);
if (nepraejo.length) process.exitCode = 1;
