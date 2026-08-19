# PS9 orders — address audit

Answers one question about imuzika.lt (PrestaShop 9) orders: **are the delivery
addresses complete enough to put on a courier label, and do they have a phone
number?**

The Discogs side of that question is answered by the Discogs MCP and needs
nothing from here — Discogs and PrestaShop are separate systems with separate
APIs, and a Discogs order never appears in the shop database. This tool covers
the shop half.

Two ways to use it, same rules underneath:

- **CLI** — `python3 -m ps9_orders.audit`, stdlib only, nothing to install.
- **MCP server** — `ps9_orders/server.py`, for asking the same thing inside a
  Claude session. Needs `pip install mcp`.

## Read-only

The client issues `GET` requests and nothing else. There is no code path here
that edits an order, an address, stock, or a price.

## Setup

### 1. Webservice key

PrestaShop admin → **Advanced Parameters → Webservice** → enable the
webservice, then **Add new key**. Grant **GET only**, on exactly these
resources:

| Resource | Why |
|---|---|
| `orders` | the order list and its delivery-address id |
| `addresses` | the address fields being audited |
| `countries` | resolve `id_country` → ISO code |
| `order_states` | tell open states from shipped/cancelled ones |

Nothing else needs to be ticked. A key with only these boxes cannot write.

### 2. Environment

```bash
cp .env.example .env      # then fill it in
export PS9_URL=https://www.imuzika.lt
export PS9_WS_KEY=...     # the key from step 1
```

Keep the key out of git — the repo's `.gitignore` already covers `.env`.

## Usage

```bash
cd tools/ps9-orders-mcp

python3 -m ps9_orders.audit                      # all open orders
python3 -m ps9_orders.audit --since 2026-08-01   # only recent ones
python3 -m ps9_orders.audit --limit 50
python3 -m ps9_orders.audit --states 2,3         # explicit state ids
python3 -m ps9_orders.audit --json               # machine-readable
python3 -m ps9_orders.audit --reveal             # full names + phone values
```

Output:

```
Būsenos: Mokėjimas gautas, Vykdomas
Užsakymų: 3

Užsakymas        Data        Šalis  Gavėjas    Trūksta
------------------------------------------------------------------------------
ABCDEFGHI        2026-08-15  LT     J. J.      —
JKLMNOPQR        2026-08-16  LT     O. O.      house_number, phone
STUVWXYZA        2026-08-17  ??     —          name, street, ... (no delivery address on order)

Pilnų adresų:            1/3
BE TELEFONO:             2
Telefonas ne LT mobilus: 0  (LP Express SMS neateis)
Gatvė be namo numerio:   2  (patikrinti ranka — gali būti paštomatas)
Kiti trūkumai:           1
```

By default names are printed as initials and phone numbers are not printed at
all — the audit is about which fields exist, not about the data itself. Use
`--reveal` when you are actually fixing specific orders.

## As an MCP server

```bash
pip install mcp
claude mcp add-json ps9-orders --scope user "$(cat <<'JSON'
{"command":"python3","args":["-m","ps9_orders.server"],
 "cwd":"/absolute/path/to/tools/ps9-orders-mcp",
 "env":{"PS9_URL":"https://www.imuzika.lt","PS9_WS_KEY":"..."}}
JSON
)"
```

Tools: `ps9_list_open_orders`, `ps9_get_order_address`, `ps9_audit_addresses`.

## Rules being applied

| Field | Rule |
|---|---|
| `name` | firstname or lastname non-empty |
| `street` | `address1` non-empty |
| `house_number` | `address1` contains a digit — heuristic; parcel-locker lines legitimately have none, so this is a "look at it" flag, not a verdict |
| `city`, `postcode` | non-empty |
| `country` | `id_country` resolves to an ISO code |
| `phone` | `phone` **or** `phone_mobile` non-empty |

A phone that is present but not a plausible LT mobile (`+3706…` / `86…`) is
counted separately: LP Express sends the locker code by SMS, so a landline
does not do the job.

Which order states count as "open" is derived from the shop's own state names
rather than hardcoded ids — anything matching shipped / delivered / cancelled /
refunded / error (LT or EN) is excluded. The states actually audited are
printed on every run, so nothing is silently skipped. Override with `--states`.

## Tests

```bash
python3 -m unittest discover -s tools/ps9-orders-mcp/tests
```

17 tests over the audit rules. No network, no credentials, no installs. The
webservice client itself is not covered — it needs a live shop.

## A note on where this lives

This repo is the imuzika.lt E2E test suite, which is deliberately production
read-only and never touches admin. This tool does talk to the admin API, so it
sits in its own directory, is not wired into the Playwright suite, and is not
run by CI. `imuzika-ops` is the more natural long-term home for it.
