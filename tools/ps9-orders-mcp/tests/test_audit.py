"""Rule tests — stdlib unittest, no network, no credentials, no pip install.

    python3 -m unittest discover -s tools/ps9-orders-mcp/tests
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from ps9_orders.audit import (  # noqa: E402
    audit_address,
    has_house_number,
    is_plausible_lt_mobile,
    mask_name,
    summarize,
)

COMPLETE = {
    "firstname": "Andrius",
    "lastname": "Šarmaitis",
    "address1": "Pušaloto g. 12-3",
    "city": "Vilnius",
    "postcode": "LT-08217",
    "phone": "",
    "phone_mobile": "+370 612 34567",
    "id_country": "124",
}


def addr(**overrides):
    return {**COMPLETE, **overrides}


class HouseNumber(unittest.TestCase):
    def test_street_with_number(self):
        self.assertTrue(has_house_number("Pušaloto g. 12-3"))

    def test_street_without_number(self):
        self.assertFalse(has_house_number("Vivo centras, paštomatas"))

    def test_empty(self):
        self.assertFalse(has_house_number(""))


class LtMobile(unittest.TestCase):
    def test_international_format(self):
        self.assertTrue(is_plausible_lt_mobile("+370 612 34567"))

    def test_national_format(self):
        self.assertTrue(is_plausible_lt_mobile("861234567"))

    def test_landline_is_not_mobile(self):
        self.assertFalse(is_plausible_lt_mobile("+370 5 2101234"))

    def test_too_short(self):
        self.assertFalse(is_plausible_lt_mobile("61234"))


class MaskName(unittest.TestCase):
    def test_initials(self):
        self.assertEqual(mask_name("Andrius", "Šarmaitis"), "A. Š.")

    def test_missing_parts(self):
        self.assertEqual(mask_name("", ""), "—")
        self.assertEqual(mask_name("Andrius", ""), "A.")


class AuditAddress(unittest.TestCase):
    def test_complete_address_has_no_gaps(self):
        self.assertEqual(audit_address(addr(), "LT")["missing"], [])

    def test_missing_phone_is_flagged(self):
        result = audit_address(addr(phone="", phone_mobile=""), "LT")
        self.assertEqual(result["missing"], ["phone"])
        self.assertFalse(result["phone_is_mobile"])

    def test_landline_counts_as_present_but_not_mobile(self):
        result = audit_address(addr(phone="+370 5 2101234", phone_mobile=""), "LT")
        self.assertEqual(result["missing"], [])
        self.assertFalse(result["phone_is_mobile"])

    def test_street_without_number(self):
        result = audit_address(addr(address1="Vivo centras"), "LT")
        self.assertEqual(result["missing"], ["house_number"])

    def test_unresolved_country(self):
        self.assertIn("country", audit_address(addr(), None)["missing"])

    def test_empty_address_reports_every_field(self):
        result = audit_address(
            {"firstname": "", "lastname": "", "address1": "", "city": "", "postcode": ""}, None
        )
        self.assertEqual(
            result["missing"],
            ["name", "street", "house_number", "city", "postcode", "country", "phone"],
        )

    def test_name_is_masked_not_reproduced(self):
        self.assertEqual(audit_address(addr(), "LT")["masked_name"], "A. Š.")


class Summary(unittest.TestCase):
    def test_counts(self):
        rows = [
            {"missing": [], "phone_is_mobile": True},
            {"missing": ["phone"], "phone_is_mobile": False},
            {"missing": ["house_number"], "phone_is_mobile": True},
            {"missing": [], "phone_is_mobile": False},
            {"missing": ["city", "postcode"], "phone_is_mobile": True},
        ]
        self.assertEqual(
            summarize(rows),
            {
                "total": 5,
                "complete": 2,
                "no_phone": 1,
                "phone_not_mobile": 1,
                "no_house_number": 1,
                "other_gaps": 1,
            },
        )


if __name__ == "__main__":
    unittest.main()
