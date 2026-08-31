import json
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class StageRegistryPipelineTest(unittest.TestCase):
    def test_generated_registry_matches_checked_in_stage(self):
        converted_stage_ids = ['stage4', 'stage5', 'stage6', 'stage7']
        before_drafts = {
            stage_id: (ROOT / f'docs/stage-editor/{stage_id}.v1.draft.json').read_bytes()
            for stage_id in converted_stage_ids
        }
        subprocess.run(['node', str(ROOT / 'tools/convert_legacy_stages.js')], cwd=ROOT, check=True)
        for stage_id, before_draft in before_drafts.items():
            self.assertEqual((ROOT / f'docs/stage-editor/{stage_id}.v1.draft.json').read_bytes(), before_draft)
        before_stages = {}
        for stage_number in range(1, 8):
            stage_id = f'stage{stage_number}'
            source = json.loads((ROOT / f'docs/stage-editor/{stage_id}.v1.draft.json').read_text(encoding='utf-8'))
            production = json.loads((ROOT / f'data/stages/{stage_id}.v1.json').read_text(encoding='utf-8'))
            self.assertEqual(source['id'], production['id'])
            self.assertEqual({item['id'] for item in source['items']}, {item['id'] for item in production['items']})
            before_stages[stage_id] = (ROOT / f'data/stages/{stage_id}.v1.json').read_bytes()
        before_registry = (ROOT / 'js/stages.generated.js').read_bytes()
        subprocess.run([
            __import__('sys').executable, str(ROOT / 'tools/build_stage_registry.py'),
        ], cwd=ROOT, check=True)
        for stage_id, before_stage in before_stages.items():
            self.assertEqual((ROOT / f'data/stages/{stage_id}.v1.json').read_bytes(), before_stage)
        self.assertEqual((ROOT / 'js/stages.generated.js').read_bytes(), before_registry)


if __name__ == '__main__':
    unittest.main()
