import unittest
from unittest import mock

from utils import listing_import as li


class ValidateListingUrlTests(unittest.TestCase):
    def test_accepts_supported_hosts(self):
        for url in (
            'https://www.airbnb.com/rooms/12345',
            'airbnb.co.uk/rooms/12345',
            'https://www.vrbo.com/1234567',
            'https://abnb.me/abc123',
        ):
            self.assertTrue(li.validate_listing_url(url).startswith('https://'))

    def test_rejects_lookalike_and_other_hosts(self):
        for url in (
            'https://airbnb.xyz/rooms/1',
            'https://airbnb.com.evil.com/rooms/1',
            'https://notairbnb.com/rooms/1',
            'https://evil.com/?u=airbnb.com',
            'http://169.254.169.254/latest/meta-data',
            'https://www.airbnb.com:8080/rooms/1',
            'ftp://www.airbnb.com/rooms/1',
            '',
        ):
            with self.assertRaises(li.ListingImportError, msg=url):
                li.validate_listing_url(url)


class FetchTests(unittest.TestCase):
    def test_redirect_to_unsupported_host_is_refused(self):
        resp = mock.Mock(is_redirect=True, status_code=302, headers={'Location': 'http://169.254.169.254/'})
        with mock.patch.object(li, '_resolves_to_public_ip', return_value=True), \
                mock.patch.object(li.requests, 'get', return_value=resp):
            with self.assertRaises(li.ListingImportError):
                li.fetch_listing_html('https://www.airbnb.com/rooms/1')

    def test_host_resolving_to_private_ip_is_refused(self):
        with mock.patch.object(li, '_resolves_to_public_ip', return_value=False), \
                mock.patch.object(li.requests, 'get') as get:
            with self.assertRaises(li.ListingImportError):
                li.fetch_listing_html('https://www.airbnb.com/rooms/1')
            get.assert_not_called()

    def test_blocked_status_gives_friendly_error(self):
        resp = mock.Mock(is_redirect=False, status_code=403, headers={})
        with mock.patch.object(li, '_resolves_to_public_ip', return_value=True), \
                mock.patch.object(li.requests, 'get', return_value=resp):
            with self.assertRaises(li.ListingImportError) as ctx:
                li.fetch_listing_html('https://www.airbnb.com/rooms/1')
            self.assertEqual(ctx.exception.code, 'blocked')


class ExtractContextTests(unittest.TestCase):
    def test_collects_title_meta_jsonld_and_visible_text_only(self):
        html = (
            '<html><head><title>Cozy Cabin</title>'
            '<meta property="og:description" content="Quiet cabin by the lake">'
            '<script type="application/ld+json">{"@type":"Product","name":"Cozy Cabin"}</script>'
            '<script>var secret = "ignore me";</script><style>.x{}</style></head>'
            '<body><h1>Welcome</h1><p>No smoking</p></body></html>'
        )
        ctx = li.extract_listing_context(html)
        self.assertIn('TITLE: Cozy Cabin', ctx)
        self.assertIn('og:description: Quiet cabin by the lake', ctx)
        self.assertIn('"name": "Cozy Cabin"', ctx)
        self.assertIn('No smoking', ctx)
        self.assertNotIn('ignore me', ctx)


class SanitizeTests(unittest.TestCase):
    def test_clamps_types_and_lengths(self):
        out = li.sanitize_extracted_fields({
            'property_name': 'A' * 500,
            'welcome_message': 123,
            'check_in_time': '3pm',
            'check_out_time': '11:00',
            'house_rules': [{'name': 'No pets', 'description': 'x' * 5000}, 'Quiet hours', None, 7] * 20,
            'house_manual': 'not a list',
        })
        self.assertEqual(len(out['property_name']), 100)
        self.assertEqual(out['welcome_message'], '')
        self.assertIsNone(out['check_in_time'])
        self.assertEqual(out['check_out_time'], '11:00')
        self.assertLessEqual(len(out['house_rules']), 20)
        self.assertEqual(len(out['house_rules'][0]['description']), 800)
        self.assertEqual(out['house_manual'], [])

    def test_non_dict_input_gives_empty_fields(self):
        out = li.sanitize_extracted_fields(None)
        self.assertEqual(out['house_rules'], [])
        self.assertEqual(out['property_name'], '')


if __name__ == '__main__':
    unittest.main()
