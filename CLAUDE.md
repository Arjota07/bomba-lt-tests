# bomba-lt-tests

Playwright E2E suite for **imuzika.lt** (`https://www.imuzika.lt`). See `README.md` for
how to run it.

## ⚠️ This suite targets production

Every spec here runs against the live store. Read-only means read-only:

- Browse public pages, assert responses, capture visual baselines — fine.
- **Never** register users, submit forms, place orders, or touch checkout.
- **Never** touch admin.
- Destructive flows belong on a separate staging environment, not here.

This applies to AI-assisted work too. gstack's `/qa`, `/browse`, `/design-review`, and
`/canary` drive a real browser — against production, in this repo. Use `/qa-only`
(report-only) rather than `/qa` (finds bugs *and* auto-fixes) unless you have pointed
`BASE_URL` at a non-production environment first.

## gstack (recommended)

This project uses [gstack](https://github.com/garrytan/gstack) for AI-assisted workflows.
Install it for the best experience:

```bash
git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup --team
```

Skills like /qa, /ship, /review, /investigate, and /browse become available after install.
Use /browse for all web browsing. Use ~/.claude/skills/gstack/... for gstack file paths.

The install is global (`~/.claude/skills/gstack`), not vendored into this repo — nothing
gstack-related is committed here beyond this file. `--team` registers a SessionStart hook
so gstack auto-updates; `./setup --no-team` turns that off. Verified against 1.63.0.0.
