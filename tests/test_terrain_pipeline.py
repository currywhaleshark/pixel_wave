import hashlib
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PYTHON = Path(__import__('sys').executable)


class TerrainPipelineTest(unittest.TestCase):
    def test_checked_in_profile_and_generator_are_deterministic(self):
        source = ROOT / 'assets/backgrounds/stage1-near-strip.png'
        mask = ROOT / 'assets/backgrounds/stage1-near-terrain-mask.png'
        profile_path = ROOT / 'data/terrain-profiles/stage1-near-v1.json'
        overrides = ROOT / 'data/terrain-overrides/stage1-near-v1.overrides.json'
        profile = json.loads(profile_path.read_text(encoding='utf-8'))
        with Image.open(source) as image:
            self.assertEqual(image.size, (1440, 128))
        with Image.open(mask) as image:
            self.assertEqual(image.size, (1440, 128))
        self.assertEqual(profile['binding']['assetSha256'], hashlib.sha256(source.read_bytes()).hexdigest())
        self.assertEqual(profile['binding']['structuralMaskSha256'], hashlib.sha256(mask.read_bytes()).hexdigest())
        self.assertEqual(profile['review']['status'], 'approved')
        self.assertEqual(profile['review']['pendingSocketCount'], 0)
        self.assertEqual([socket['x'] for socket in profile['sockets']], [461, 507, 1320])

        with tempfile.TemporaryDirectory() as directory:
            generated_mask = Path(directory) / 'mask.png'
            generated_profile = Path(directory) / 'profile.json'
            subprocess.run([
                str(PYTHON), str(ROOT / 'tools/generate_terrain_profile.py'),
                '--source', 'assets/backgrounds/stage1-near-strip.png',
                '--mask-output', str(generated_mask),
                '--profile-output', str(generated_profile),
                '--overrides', 'data/terrain-overrides/stage1-near-v1.overrides.json',
            ], cwd=ROOT, check=True)
            generated = json.loads(generated_profile.read_text(encoding='utf-8'))
            self.assertEqual(generated['surfaces'], profile['surfaces'])
            self.assertEqual(generated['sockets'], profile['sockets'])
            self.assertEqual(hashlib.sha256(generated_mask.read_bytes()).hexdigest(), hashlib.sha256(mask.read_bytes()).hexdigest())


if __name__ == '__main__':
    unittest.main()
