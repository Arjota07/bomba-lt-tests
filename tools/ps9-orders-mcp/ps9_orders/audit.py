"""Address-completeness rules for PS9 orders, plus a CLI that prints the audit.

The question this answers: are the delivery addresses on open orders complete
enough to put on a courier label — and do they carry a phone number at all?
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys

from .client import PS9Client, PS9Error

# Fields a courier label needs. Order matters — this is the report column order.
FIELDS = ("name", "street", "house_number", "city", "postcode", "country", "phone")

# States that mean "this order is done" — excluded unless --states says otherwise.
CLOSED_STATE_PATTERNS = re.compile(
    r"ship|deliver|cancel|refund|error|išsiųs|issiys|pristat|atšauk|atsauk|grąžin|grazin|klaid",
    re.IGNORECASE,
)

_DIGIT = re.compile(r"\d")
_NON_DIGIT = re.compile(r"\D")


def has_house_number(address1: str) -> bool:
    """A street line with no digit anywhere is almost never a deliverable address.

    Heuristic, not proof: parcel-locker lines ("Vivo centras, PLC") legitimately
    lack a number, so a hit here is a flag to look at, not a verdict.
    """
    return bool(_DIGIT.search(address1 or ""))


def normalize_phone(value: str) -> str:
    return _NON_DIGIT.sub("", value or "")


def is_plausible_lt_mobile(value: str) -> bool:
    """LP Express sends the locker code by SMS, so a landline is not enough."""
    digits = normalize_phone(value)
    if digits.startswith("370"):
        digits = digits[3:]
    elif digits.startswith("8") and len(digits) == 9:
        digits = digits[1:]
    return len(digits) == 8 and digits.startswith("6")


def mask_name(first: str, last: str) -> str:
    """Report identity as initials — the audit is about field presence, not people."""
    parts = [p for p in (first or "", last or "") if p.strip()]
    return " ".join(f"{p.strip()[0].upper()}." for p in parts) or "—"


def audit_address(addr: dict, country_iso: str | None = None) -> dict:
    """Return which required fields are missing from one PrestaShop address."""
    phone = (addr.get("phone") or "").strip()
    mobile = (addr.get("phone_mobile") or "").strip()
    any_phone = phone or mobile
    street = (addr.get("address1") or "").strip()

    present = {
        "name": bool((addr.get("firstname") or "").strip() or (addr.get("lastname") or "").strip()),
        "street": bool(street),
        "house_number": has_house_number(street),
        "city": bool((addr.get("city") or "").strip()),
        "postcode": bool((addr.get("postcode") or "").strip()),
        "country": bool(country_iso),
        "phone": bool(any_phone),
    }
    return {
        "missing": [f for f in FIELDS if not present[f]],
        "phone_value": any_phone,
        "phone_is_mobile": is_plausible_lt_mobile(any_phone) if any_phone else False,
        "masked_name": mask_name(addr.get("firstname", ""), addr.get("lastname", "")),
        "full_name": f"{addr.get('firstname', '')} {addr.get('lastname', '')}".strip() or "—",
        "country": country_iso or "??",
    }


def summarize(rows: list[dict]) -> dict:
    total = len(rows)
    return {
        "total": total,
        "complete": sum(1 for r in rows if not r["missing"]),
        "no_phone": sum(1 for r in rows if "phone" in r["missing"]),
        "phone_not_mobile": sum(
            1 for r in rows if "phone" not in r["missing"] and not r["phone_is_mobile"]
        ),
        "no_house_number": sum(1 for r in rows if "house_number" in r["missing"]),
        "other_gaps": sum(
            1 for r in rows if set(r["missing"]) - {"phone", "house_number"}
        ),
    }


def open_states(client: PS9Client) -> tuple[list[str], list[str]]:
    """Split the shop's order states into open (audit these) and closed."""
    names = client.order_states()
    open_ids = [i for i, n in names.items() if not CLOSED_STATE_PATTERNS.search(n)]
    return open_ids, [names[i] for i in open_ids]


def run_audit(
    client: PS9Client,
    states: list[str] | None = None,
    since: str | None = None,
    limit: int | None = None,
) -> dict:
    if states:
        state_names = [client.order_states().get(s, s) for s in states]
    else:
        states, state_names = open_states(client)

    rows = []
    for order in client.orders(states=states, since=since, limit=limit):
        address_id = str(order.get("id_address_delivery") or "")
        row = {
            "order": order.get("reference") or f"#{order.get('id')}",
            "order_id": str(order.get("id")),
            "date": (order.get("date_add") or "")[:10],
        }
        if not address_id or address_id == "0":
            row.update(
                missing=list(FIELDS), phone_value="", phone_is_mobile=False,
                masked_name="—", full_name="—", country="??",
                note="no delivery address on order",
            )
        else:
            addr = client.address(address_id)
            row.update(audit_address(addr, client.country_iso(addr.get("id_country", ""))))
            row["note"] = ""
        rows.append(row)

    return {"states_audited": state_names, "rows": rows, "summary": summarize(rows)}


# -- CLI -------------------------------------------------------------------


def format_report(result: dict, reveal: bool = False) -> str:
    rows, s = result["rows"], result["summary"]
    out = [
        "Būsenos: " + (", ".join(result["states_audited"]) or "—"),
        f"Užsakymų: {s['total']}",
        "",
        f"{'Užsakymas':<16} {'Data':<11} {'Šalis':<6} {'Gavėjas':<10} Trūksta",
        "-" * 78,
    ]
    for r in rows:
        who = r["masked_name"] if not reveal else r.get("full_name", r["masked_name"])
        missing = ", ".join(r["missing"]) if r["missing"] else "—"
        if r.get("note"):
            missing = f"{missing} ({r['note']})"
        out.append(f"{r['order']:<16} {r['date']:<11} {r['country']:<6} {who:<10} {missing}")
    out += [
        "",
        f"Pilnų adresų:            {s['complete']}/{s['total']}",
        f"BE TELEFONO:             {s['no_phone']}",
        f"Telefonas ne LT mobilus: {s['phone_not_mobile']}  (LP Express SMS neateis)",
        f"Gatvė be namo numerio:   {s['no_house_number']}  (patikrinti ranka — gali būti paštomatas)",
        f"Kiti trūkumai:           {s['other_gaps']}",
    ]
    return "\n".join(out)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Audit PS9 order delivery addresses (read-only).")
    p.add_argument("--since", help="only orders created on/after this date (YYYY-MM-DD)")
    p.add_argument("--states", help="comma-separated state ids; default = all open states")
    p.add_argument("--limit", type=int, help="cap the number of orders")
    p.add_argument("--reveal", action="store_true", help="print full names instead of initials")
    p.add_argument("--json", action="store_true", help="machine-readable output")
    args = p.parse_args(argv)

    try:
        client = PS9Client(os.environ.get("PS9_URL", ""), os.environ.get("PS9_WS_KEY", ""))
        result = run_audit(
            client,
            states=args.states.split(",") if args.states else None,
            since=args.since,
            limit=args.limit,
        )
    except PS9Error as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    if not args.reveal:
        # Presence is the answer; the personal data itself stays in the shop.
        for row in result["rows"]:
            row.pop("full_name", None)
            row.pop("phone_value", None)

    print(json.dumps(result, ensure_ascii=False, indent=2) if args.json
          else format_report(result, reveal=args.reveal))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
