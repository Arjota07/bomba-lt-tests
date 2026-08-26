"""MCP server exposing the PS9 order-address audit as tools.

Optional layer — the CLI in audit.py answers the same question without it.
Needs `pip install mcp`; everything else in this package is stdlib only.

Read-only by construction: the client underneath issues GET requests only,
so there is no tool here that can change an order, an address, or stock.
"""

from __future__ import annotations

import os

from mcp.server.fastmcp import FastMCP

from .audit import audit_address, open_states, run_audit
from .client import PS9Client

mcp = FastMCP("ps9-orders")

# Personal data the audit does not need to report — presence is the answer.
_PRIVATE = ("full_name", "phone_value")


def _client() -> PS9Client:
    return PS9Client(os.environ.get("PS9_URL", ""), os.environ.get("PS9_WS_KEY", ""))


def _strip_private(row: dict) -> dict:
    for key in _PRIVATE:
        row.pop(key, None)
    return row


@mcp.tool()
def ps9_list_open_orders(since: str | None = None, limit: int | None = 100) -> dict:
    """List orders in states that are not shipped/delivered/cancelled/refunded.

    since: optional YYYY-MM-DD lower bound on order date.
    """
    client = _client()
    states, names = open_states(client)
    orders = client.orders(states=states, since=since, limit=limit)
    return {"states": names, "count": len(orders), "orders": orders}


@mcp.tool()
def ps9_get_order_address(order_id: str) -> dict:
    """Return one order's delivery address, audited field by field."""
    if not order_id:
        raise ValueError("order_id is required")
    client = _client()
    address_id = str(client.order(order_id).get("id_address_delivery") or "")
    if not address_id or address_id == "0":
        return {"order_id": order_id, "note": "no delivery address on order"}
    addr = client.address(address_id)
    audited = audit_address(addr, client.country_iso(addr.get("id_country", "")))
    return {"order_id": order_id, **_strip_private(audited)}


@mcp.tool()
def ps9_audit_addresses(
    since: str | None = None, states: str | None = None, limit: int | None = None
) -> dict:
    """Audit every open order's delivery address for label-readiness.

    Reports, per order, which of name/street/house_number/city/postcode/country/
    phone are missing, plus totals — including how many orders carry no phone
    number at all and how many phones are not LT mobiles (LP Express SMS).
    """
    result = run_audit(
        _client(),
        states=states.split(",") if states else None,
        since=since,
        limit=limit,
    )
    result["rows"] = [_strip_private(row) for row in result["rows"]]
    return result


if __name__ == "__main__":
    mcp.run()
