"""Integrity checker regressions; these do not execute the SDK."""
import copy
import gzip
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'validate_observations.py'
SPEC = importlib.util.spec_from_file_location('observation_integrity', SCRIPT)
validator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(validator)


class IntegrityTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with gzip.open(validator.ROOT / validator.INDEX, 'rt', encoding='utf-8') as stream:
            cls.original = json.load(stream)

    def setUp(self):
        self.index = copy.deepcopy(self.original)

    def rejected(self, pattern):
        with self.assertRaisesRegex(validator.Invalid, pattern):
            validator.validate(validator.ROOT, self.index)

    def test_checked_in_index_and_cli(self):
        rows, platforms = validator.validate(validator.ROOT, self.index)
        self.assertGreater(rows, 0)
        self.assertGreaterEqual(platforms, rows)
        result = subprocess.run([sys.executable, str(SCRIPT)], cwd=validator.ROOT,
                                capture_output=True, text=True, check=False)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('observation integrity OK', result.stdout)

    def test_source_index_hashes(self):
        for field in ('candidateInventory', 'publishedDeclarationIndex'):
            with self.subTest(field=field):
                self.setUp()
                self.index[field]['sha256'] = '0' * 64
                self.rejected('SHA-256 mismatch')

    def test_artifact_hash(self):
        self.index['artifacts'][next(iter(self.index['artifacts']))]['sha256'] = '0' * 64
        self.rejected('SHA-256 mismatch')

    def test_candidate_and_dart_ids(self):
        self.index['rows'][0]['candidateId'] = 'bogus-candidate'
        self.rejected('unknown candidate ID')
        self.setUp()
        self.index['rows'][0]['publishedDart'][0] = 'Bogus.declaration'
        self.rejected('unknown Dart declaration ID')

    def test_candidate_source_location(self):
        self.index['rows'][0]['sourceLocations'][0]['line'] += 1
        self.rejected('source location not in candidate evidence')
        self.setUp()
        row = next(row for row in self.index['rows'] if len(row['sourceLocations']) > 1)
        row['sourceLocations'].pop()
        self.rejected('candidate evidence locations missing')

    def test_missing_pointer_and_member(self):
        evidence = self.index['rows'][0]['platforms']['web']['evidence'][0]
        evidence['jsonPointers'] = ['/does-not-exist']
        self.rejected('JSON pointer not found')
        self.setUp()
        self.index['rows'][0]['platforms']['web']['evidence'][0]['tarMember'] = 'not-there.json'
        self.rejected('missing, duplicate or non-file archive member')

    def test_pointer_decoding_and_array_indices(self):
        self.assertEqual(validator.pointer_value({'a/b': {'~key': [3]}}, '/a~1b/~0key/0'), 3)
        for pointer in ('/a~2b', '/a~1b/~0key/00', '/a~1b/~0key/-'):
            with self.subTest(pointer=pointer), self.assertRaises(validator.Invalid):
                validator.pointer_value({'a/b': {'~key': [3]}}, pointer)

    def test_paths_cannot_escape(self):
        for path in ('../outside', '/tmp/outside', 'foo/../outside', 'foo\\outside'):
            with self.subTest(path=path), self.assertRaises(validator.Invalid):
                validator.safe_path(validator.ROOT, path)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'link').symlink_to(SCRIPT)
            with self.assertRaises(validator.Invalid):
                validator.safe_path(root, 'link')
        self.index['rows'][0]['platforms']['web']['evidence'][0]['tarMember'] = '../scope.json'
        self.rejected('unsafe archive member')

    def test_measured_and_unmeasured_honesty(self):
        record = self.index['rows'][0]['platforms']['web']
        record['evidence'] = []
        self.rejected('measured status requires evidence')
        self.setUp()
        self.index['rows'][0]['platforms']['web']['status'] = 'unknown'
        self.rejected('unmeasured status')
        self.setUp()
        self.index['rows'][0]['platforms']['web']['status'] = 'typo'
        self.rejected('unknown status')

    def test_receipt_revision_is_per_measured_platform(self):
        row = next(row for row in self.index['rows'] if 'testedProductCommit' in row)
        row['testedProductCommit'] = '0' * 40
        self.rejected('receipt revision mismatch')
        self.setUp()
        row = next(row for row in self.index['rows'] if 'testedProductCommit' in row)
        pointers = row['platforms']['web']['evidence'][0]['jsonPointers']
        pointers.remove('/candidate/revision')
        self.rejected('needs a linked receipt revision')
        self.setUp()
        row = next(row for row in self.index['rows'] if 'testedProductCommit' in row)
        row['platforms']['web']['evidence'][0]['jsonPointers'] = ['/candidate/revision']
        self.rejected('requires actual evidence')

    def test_archived_top_level_revision_and_platform_measurements(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)

            def write(name, data):
                (root / name).write_bytes(data)
                return {'path': name, 'sha256': hashlib.sha256(data).hexdigest()}

            def write_json(name, value):
                return write(name, json.dumps(value).encode())

            def write_receipt(revision):
                data = json.dumps({'revision': revision, 'platforms': {
                    platform: {'actual': platform} for platform in ('web', 'android', 'ios')
                }}).encode()
                output = io.BytesIO()
                with tarfile.open(fileobj=output, mode='w:gz') as archive:
                    member = tarfile.TarInfo('verification.json')
                    member.size = len(data)
                    archive.addfile(member, io.BytesIO(data))
                return write('receipt.tar.gz', output.getvalue())

            commit = 'a' * 40
            location = {'source': 'source', 'sha256': 'b' * 64}
            inventory = write_json('inventory.json', {
                'captureContentId': 'baseline', 'evidenceLocations': [location],
                'candidates': [{'id': 'candidate', 'evidence': [0]}],
            })
            declarations = write_json('declarations.json', {'rows': [{'id': 'Dart.id'}]})
            row = {'candidateId': 'candidate', 'facet': 'zIndex', 'publishedDart': ['Dart.id'],
                   'sourceLocations': [location], 'testedProductCommit': commit,
                   'platforms': {platform: {'status': 'sample-match', 'evidence': [{
                       'artifact': 'receipt', 'tarMember': 'verification.json',
                       'jsonPointers': ['/revision', f'/platforms/{platform}/actual'],
                   }]} for platform in ('web', 'android', 'ios')}}
            index = {'schemaVersion': 1, 'officialBaselineContentId': 'baseline',
                     'candidateInventory': inventory, 'publishedDeclarationIndex': declarations,
                     'artifacts': {'receipt': write_receipt(commit)}, 'rows': [row]}
            self.assertEqual(validator.validate(root, index), (1, 3))

            for revision in ('not-a-sha', 'c' * 40):
                with self.subTest(revision=revision):
                    index['artifacts']['receipt'] = write_receipt(revision)
                    with self.assertRaisesRegex(validator.Invalid, 'receipt revision mismatch'):
                        validator.validate(root, index)
            index['artifacts']['receipt'] = write_receipt(commit)
            row['testedProductCommit'] = 'not-a-sha'
            with self.assertRaisesRegex(validator.Invalid, 'invalid testedProductCommit'):
                validator.validate(root, index)
            row['testedProductCommit'] = commit

            for platform in ('web', 'android', 'ios'):
                with self.subTest(platform=platform):
                    pointers = row['platforms'][platform]['evidence'][0]['jsonPointers']
                    pointers[:] = ['/revision']
                    with self.assertRaisesRegex(validator.Invalid, 'requires actual evidence'):
                        validator.validate(root, index)
                    pointers[:] = [f'/platforms/{platform}/actual']
                    with self.assertRaisesRegex(validator.Invalid, 'needs a linked receipt revision'):
                        validator.validate(root, index)
                    pointers[:] = ['/revision', f'/platforms/{platform}/missing']
                    with self.assertRaisesRegex(validator.Invalid, 'JSON pointer not found'):
                        validator.validate(root, index)
                    pointers[:] = ['/revision', f'/platforms/{platform}/actual']

            # Metadata alone is not a measurement even when no commit is claimed.
            del row['testedProductCommit']
            row['platforms']['web']['evidence'][0]['jsonPointers'] = ['/revision']
            with self.assertRaisesRegex(validator.Invalid, 'requires actual evidence'):
                validator.validate(root, index)

    def test_unrelated_and_historical_receipts_are_independent(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)

            def write(name, content):
                data = json.dumps(content).encode()
                (root / name).write_bytes(data)
                return {'path': name, 'sha256': hashlib.sha256(data).hexdigest()}

            location = {'source': 'historical-source', 'sha256': 'a' * 64}
            inventory = write('inventory.json', {
                'captureContentId': 'baseline', 'evidenceLocations': [location],
                'candidates': [{'id': 'candidate', 'evidence': [0]}],
            })
            declarations = write('declarations.json', {'rows': [{'id': 'Dart.id'}]})
            artifacts = {}
            rows = []
            for number, commit in enumerate(('1' * 40, '2' * 40, None)):
                name = f'receipt{number}.json'
                artifacts[name] = write(name, {'commit': commit or '3' * 40, 'actual': number})
                evidence = [{'artifact': name, 'jsonPointers': ['/commit', '/actual']}]
                row = {'candidateId': 'candidate', 'facet': str(number), 'publishedDart': ['Dart.id'],
                       'sourceLocations': [location], 'platforms': {
                           platform: {'status': 'sample-match', 'evidence': evidence}
                           for platform in ('web', 'android', 'ios')}}
                if commit:
                    row['testedProductCommit'] = commit
                rows.append(row)
            index = {'schemaVersion': 1, 'officialBaselineContentId': 'baseline',
                     'candidateInventory': inventory, 'publishedDeclarationIndex': declarations,
                     'artifacts': artifacts, 'rows': rows}
            self.assertEqual(validator.validate(root, index), (3, 9))


if __name__ == '__main__':
    unittest.main()
