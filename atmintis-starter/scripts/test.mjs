#!/usr/bin/env node
/**
 * Linterio testai.
 *
 * Linteris yra vienintelis dalykas, skiriantis atmintį git'e nuo atminties,
 * kurią vėl teks išmesti iš git'o. Jei jis tyliai sugenda, apie tai
 * sužinotum tik po kito nutekėjimo — todėl jis tikrinamas.
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

/** [pavadinimas, failai, laukiami kodai, nelaukiami kodai] */
const ATVEJAI = [
  [
    'sshpass su slaptažodžiu',
    { 'sritys/a.md': `${FM()}# A\nSSH: sshpass -p 'Slaptas123' ssh vartotojas@hostas\n` },
    ['SECRET/sshpass'],
    [],
  ],
  [
    'slaptažodis su reikšme',
    { 'sritys/a.md': `${FM()}# A\nAdmin slaptažodis: TikrasSlaptas2026\n` },
    ['SECRET/reiksme'],
    [],
  ],
  [
    'nuoroda į 1Password praeina',
    { 'sritys/a.md': `${FM()}# A\nDB slaptažodis — 1Password įraše \`milvid-db\`.\n` },
    [],
    ['SECRET/reiksme', 'GALIMAS-SECRET'],
  ],
  [
    'aplinkos kintamasis praeina',
    { 'sritys/a.md': `${FM()}# A\nSMTP password: \${SMTP_PASSWORD}\n` },
    [],
    ['SECRET/reiksme'],
  ],
  [
    'GitHub token, Basic auth, URL kredencialai',
    {
      'sritys/a.md':
        `${FM()}# A\n` +
        'Token: ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ012345\n' +
        'Auth: Authorization: Basic YWRtaW46c3VwZXJzZWNyZXQxMjM=\n' +
        'DSN: mysql://root:Slaptas123@localhost/db\n',
    },
    ['SECRET/gh-token', 'SECRET/basic-auth', 'SECRET/url-creds'],
    [],
  ],
  [
    'kredencialas be raktažodžio — įspėjimas',
    { 'sritys/a.md': `${FM()}# A\n**Admin:** \`https://x.lt/admin/login\` / \`vartotojas\` / \`Admin2026!\`\n` },
    ['GALIMAS-SECRET'],
    [],
  ],
  [
    'technologijos versija ir git sha nėra slaptažodžiai',
    {
      'sritys/a.md': `${FM()}# A\nAdmin skydelis veikia PrestaShop1789 versijoje.\nDB commit: a1b2c3d4e5f6789.\n`,
    },
    [],
    ['GALIMAS-SECRET'],
  ],
  ['be frontmatter', { 'sritys/a.md': '# A\nTekstas.\n' }, ['FM/nera'], []],
  [
    'trūksta lauko',
    { 'sritys/a.md': `${FM({ saltinis: null })}# A\nTekstas.\n` },
    ['FM/laukas'],
    [],
  ],
  [
    'blogas tikrumas',
    { 'sritys/a.md': `${FM({ tikrumas: 'gal_but' })}# A\nTekstas.\n` },
    ['FM/tikrumas'],
    [],
  ],
  [
    'galioja-iki anksčiau už atnaujinta',
    { 'sritys/a.md': `${FM({ 'galioja-iki': '2026-07-01' })}# A\nTekstas.\n` },
    ['FM/data'],
    [],
  ],
  [
    'pasenęs įrašas — įspėjimas',
    { 'sritys/a.md': `${FM({ 'galioja-iki': '2026-02-01' })}# A\nTekstas.\n` },
    ['PASENE'],
    [],
  ],
  [
    'inbox privalo būti juodraštis',
    { 'inbox/a.md': `${FM({ sritis: 'discogs' })}# A\nTekstas.\n` },
    ['INBOX/tikrumas'],
    [],
  ],
  [
    'inbox su juodraščiu praeina',
    { 'inbox/a.md': `${FM({ sritis: 'discogs', tikrumas: 'juodrastis', saltinis: null })}# A\nTekstas.\n` },
    [],
    ['INBOX/tikrumas', 'FM/laukas'],
  ],
  [
    'archyve galioja-iki neprivalomas',
    { 'archyvas/a.md': `${FM({ 'galioja-iki': null, saltinis: null })}# A\nTekstas.\n` },
    [],
    ['FM/laukas', 'PASENE'],
  ],
  [
    'per ilgas failas',
    { 'sritys/a.md': `${FM()}# A\n${Array.from({ length: 210 }, (_, i) => `Eilute ${i}`).join('\n')}\n` },
    ['ILGIS'],
    [],
  ],
  ['lūžusi nuoroda', { 'sritys/a.md': `${FM()}# A\n[nera](../nera/failo.md)\n` }, ['NUORODA'], []],
  [
    'dublikatas dviejuose failuose',
    {
      'sritys/a.md': `${FM()}# A\nŠitas pakankamai ilgas teiginys turi kartotis dviejuose failuose, kad būtų pagautas.\n`,
      'sritys/b.md': `${FM()}# B\nŠitas pakankamai ilgas teiginys turi kartotis dviejuose failuose, kad būtų pagautas.\n`,
    },
    ['DUBLIKATAS'],
    [],
  ],
  [
    'tvarkingas failas neduoda nieko',
    { 'sritys/a.md': `${FM()}# A\nServerio slaptažodis — 1Password įraše \`milvid-hostingas\`.\n` },
    [],
    ['SECRET/reiksme', 'FM/nera', 'FM/laukas', 'PASENE', 'DUBLIKATAS', 'GALIMAS-SECRET'],
  ],
];

function paleisti(failai) {
  const saknis = mkdtempSync(join(tmpdir(), 'atmintis-'));
  try {
    for (const [kelias, turinys] of Object.entries(failai)) {
      const pilnas = join(saknis, kelias);
      mkdirSync(dirname(pilnas), { recursive: true });
      writeFileSync(pilnas, turinys, 'utf8');
    }
    let isvestis;
    try {
      isvestis = execFileSync('node', [LINT, saknis, '--json'], { encoding: 'utf8' });
    } catch (klaida) {
      isvestis = klaida.stdout || '';
    }
    const r = JSON.parse(isvestis);
    return [...r.klaidos, ...r.ispejimai].map((x) => x.kodas);
  } finally {
    rmSync(saknis, { recursive: true, force: true });
  }
}

let praejo = 0;
const nepraejo = [];

for (const [pavadinimas, failai, laukiami, nelaukiami] of ATVEJAI) {
  const kodai = paleisti(failai);
  const truksta = laukiami.filter((k) => !kodai.includes(k));
  const pertekliniai = nelaukiami.filter((k) => kodai.includes(k));

  if (truksta.length === 0 && pertekliniai.length === 0) {
    praejo += 1;
    console.log(`  ok   ${pavadinimas}`);
  } else {
    const detales = [
      truksta.length ? `nerado: ${truksta.join(', ')}` : '',
      pertekliniai.length ? `neteisingai rado: ${pertekliniai.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('; ');
    nepraejo.push(pavadinimas);
    console.log(`  KLAIDA ${pavadinimas} — ${detales} (grąžino: ${kodai.join(', ') || 'nieko'})`);
  }
}

console.log(`\n${praejo}/${ATVEJAI.length} testų praėjo.`);
process.exit(nepraejo.length > 0 ? 1 : 0);
