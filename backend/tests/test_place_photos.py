import unittest

from utils.place_photos import place_photo_url


class PlacePhotoUrlTests(unittest.TestCase):
    def test_uses_durable_place_id_and_keeps_reference_as_fallback(self):
        url = place_photo_url({
            "name": "Museum of Art",
            "address": "1 Main St",
            "place_id": "place-123",
            "image_url": "temporary-ref",
        })

        self.assertIn("place_id=place-123", url)
        self.assertIn("photo_reference=temporary-ref", url)
        self.assertIn("query=Museum+of+Art%2C+1+Main+St", url)

    def test_hosted_user_image_is_returned_unchanged(self):
        hosted = "https://example.supabase.co/storage/v1/object/public/photos/image.jpg"
        self.assertEqual(place_photo_url({"image_url": hosted}), hosted)

    def test_extracts_reference_from_legacy_google_url(self):
        url = place_photo_url({
            "image_url": "https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=old-ref&key=secret"
        })

        self.assertIn("photo_reference=old-ref", url)
        self.assertNotIn("secret", url)


if __name__ == "__main__":
    unittest.main()
