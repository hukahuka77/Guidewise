import unittest

from utils.rules import normalize_rules, rules_as_text


class RulesAsTextTests(unittest.TestCase):
    def test_rules_json_dicts_become_name_and_description_lines(self):
        rules = [
            {"name": "No smoking", "description": "Anywhere on the property"},
            {"name": "Quiet hours", "description": ""},
        ]
        self.assertEqual(
            rules_as_text(rules),
            ["No smoking: Anywhere on the property", "Quiet hours"],
        )

    def test_empty_and_missing_rules_return_empty_list(self):
        self.assertEqual(rules_as_text(None), [])
        self.assertEqual(rules_as_text([]), [])

    def test_legacy_formats_are_normalized(self):
        raw = [
            "No parties: Max 6 guests",
            "{'name': 'Recycle', 'description': 'Blue bin'}",
            {"name": {"name": "Pets", "description": "Ask first"}, "description": ""},
        ]
        self.assertEqual(
            normalize_rules(raw),
            [
                {"name": "No parties", "description": "Max 6 guests"},
                {"name": "Recycle", "description": "Blue bin"},
                {"name": "Pets", "description": "Ask first"},
            ],
        )


if __name__ == "__main__":
    unittest.main()
