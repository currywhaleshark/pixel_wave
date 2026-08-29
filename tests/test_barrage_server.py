import unittest

from server import validate_pattern


def valid_pattern():
    return {
        "version": 1,
        "id": "test-pattern",
        "name": "test",
        "duration": 10,
        "emitters": [
            {
                "id": "fan-1",
                "type": "fan",
                "start": 0,
                "end": 10,
                "interval": 1,
            }
        ],
    }


class BarrageServerTest(unittest.TestCase):
    def test_valid_pattern(self):
        self.assertEqual(validate_pattern(valid_pattern()), [])

    def test_rejects_path_like_id_and_bad_timing(self):
        pattern = valid_pattern()
        pattern["id"] = "../outside"
        pattern["emitters"][0]["end"] = 11
        errors = validate_pattern(pattern)
        self.assertTrue(any("id" in error for error in errors))
        self.assertTrue(any("범위" in error for error in errors))
