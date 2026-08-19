"""Read-only PrestaShop 9 webservice client.

Stdlib only — no pip install needed to run the audit. Every request is a GET;
the client has no code path that writes to the shop.
"""

from __future__ import annotations

import base64
import json
import urllib.error
import urllib.parse
import urllib.request

DEFAULT_TIMEOUT = 30


class PS9Error(RuntimeError):
    """Webservice call failed in a way worth explaining to the operator."""


class PS9Client:
    def __init__(self, base_url: str, ws_key: str, timeout: int = DEFAULT_TIMEOUT):
        if not base_url:
            raise PS9Error("PS9_URL is not set (e.g. https://www.imuzika.lt)")
        if not ws_key:
            raise PS9Error("PS9_WS_KEY is not set (PrestaShop webservice key)")
        self.base_url = base_url.rstrip("/")
        self.ws_key = ws_key
        self.timeout = timeout
        self._country_iso: dict[str, str] = {}
        self._states: dict[str, str] | None = None

    # -- transport ---------------------------------------------------------

    def _get(self, resource: str, params: dict[str, str] | None = None) -> dict:
        query = {"output_format": "JSON", **(params or {})}
        url = f"{self.base_url}/api/{resource}?{urllib.parse.urlencode(query)}"
        # PrestaShop takes the webservice key as the Basic-auth username, no password.
        token = base64.b64encode(f"{self.ws_key}:".encode()).decode()
        req = urllib.request.Request(url, headers={"Authorization": f"Basic {token}"})
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                body = resp.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as exc:
            raise PS9Error(self._explain(exc, resource)) from exc
        except urllib.error.URLError as exc:
            raise PS9Error(f"Cannot reach {self.base_url}: {exc.reason}") from exc
        if not body.strip():
            # PrestaShop answers an empty body when a filtered list matches nothing.
            return {}
        try:
            return json.loads(body)
        except json.JSONDecodeError as exc:
            raise PS9Error(f"{resource}: response was not JSON ({body[:120]!r})") from exc

    @staticmethod
    def _explain(exc: urllib.error.HTTPError, resource: str) -> str:
        if exc.code == 401:
            return (
                "401 Unauthorized — the webservice key is wrong, or the key has no "
                "permission on this resource. In PS admin: Advanced Parameters → "
                f"Webservice → your key → tick GET for '{resource}'."
            )
        if exc.code == 404:
            return (
                f"404 on /api/{resource} — either the webservice is disabled "
                "(Advanced Parameters → Webservice → Enable) or the resource name is wrong."
            )
        return f"HTTP {exc.code} on /api/{resource}: {exc.reason}"

    # -- resources ---------------------------------------------------------

    def order_states(self) -> dict[str, str]:
        """Map state id -> human name, in the shop's default language."""
        if self._states is None:
            data = self._get("order_states", {"display": "[id,name]"})
            self._states = {
                str(s["id"]): _first_lang(s.get("name")) for s in data.get("order_states", [])
            }
        return self._states

    def orders(
        self,
        states: list[str] | None = None,
        since: str | None = None,
        limit: int | None = None,
    ) -> list[dict]:
        params = {
            "display": "[id,reference,current_state,id_address_delivery,id_customer,"
            "total_paid,date_add]",
            "sort": "[id_DESC]",
        }
        if states:
            params["filter[current_state]"] = "[" + "|".join(states) + "]"
        if since:
            params["filter[date_add]"] = f"[{since} 00:00:00,2099-12-31 23:59:59]"
            params["date"] = "1"
        if limit:
            params["limit"] = str(limit)
        return self._get("orders", params).get("orders", [])

    def order(self, order_id: str) -> dict:
        data = self._get(f"orders/{order_id}")
        order = data.get("order")
        if not order:
            raise PS9Error(f"order {order_id} not found or not readable")
        return order

    def address(self, address_id: str) -> dict:
        data = self._get(f"addresses/{address_id}")
        addr = data.get("address")
        if not addr:
            raise PS9Error(f"address {address_id} not found or not readable")
        return addr

    def country_iso(self, country_id: str) -> str | None:
        country_id = str(country_id)
        if country_id not in self._country_iso:
            try:
                data = self._get(f"countries/{country_id}", {"display": "[iso_code]"})
                self._country_iso[country_id] = data.get("country", {}).get("iso_code", "")
            except PS9Error:
                self._country_iso[country_id] = ""
        return self._country_iso[country_id] or None


def _first_lang(value) -> str:
    """PrestaShop returns translatable fields as [{"id": "1", "value": "..."}]."""
    if isinstance(value, list) and value:
        return str(value[0].get("value", ""))
    return str(value or "")
