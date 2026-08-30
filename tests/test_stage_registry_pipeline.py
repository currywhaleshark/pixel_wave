import json
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class StageRegistryPipelineTest(unittest.TestCase):
    def test_generated_registry_matches_checked_in_stage(self):
        source = json.loads((ROOT / 'docs/stage-editor/stage3.v1.draft.json').read_text(encoding='utf-8'))
        production = json.loads((ROOT / 'data/stages/stage3.v1.json').read_text(encoding='utf-8'))
        self.assertEqual(source['id'], production['id'])
        self.assertEqual(len(production['items']), 41)
        self.assertEqual({item['id'] for item in source['items']}, {item['id'] for item in production['items']})
        before_stage = (ROOT / 'data/stages/stage3.v1.json').read_bytes()
        before_registry = (ROOT / 'js/stages.generated.js').read_bytes()
        subprocess.run([
            __import__('sys').executable, str(ROOT / 'tools/build_stage_registry.py'),
        ], cwd=ROOT, check=True)
        self.assertEqual((ROOT / 'data/stages/stage3.v1.json').read_bytes(), before_stage)
        self.assertEqual((ROOT / 'js/stages.generated.js').read_bytes(), before_registry)


if __name__ == '__main__':
    unittest.main()
