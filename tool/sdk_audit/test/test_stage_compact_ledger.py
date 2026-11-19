#!/usr/bin/env python3
import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
MODULE = Path(__file__).resolve().parents[1] / 'stage_compact_ledger.py'
spec = importlib.util.spec_from_file_location('stage_compact_ledger', MODULE)
stage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stage)


class StagingTests(unittest.TestCase):
    def test_checked_hash_and_unsafe_paths(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            (root / 'receipt').write_bytes(b'genuine')
            self.assertEqual(stage.checked(root, 'receipt', stage.digest(b'genuine')), root / 'receipt')
            with self.assertRaisesRegex(stage.StageError, 'SHA-256 mismatch'):
                stage.checked(root, 'receipt', stage.digest(b'changed'))
            with self.assertRaisesRegex(stage.StageError, 'unsafe'):
                stage.checked(root, '../receipt', stage.digest(b'genuine'))

    def test_duplicate_and_replaced_locations_fail_closed(self):
        a, b = {'channel': 'ast', 'start': 1}, {'channel': 'ast', 'start': 2}
        row = {'candidateId': 'x', 'facet': 'f', 'sourceLocations': [a, b]}
        with self.assertRaisesRegex(stage.StageError, 'removed or replaced'):
            stage.rebind([copy.deepcopy(row)], {'x': {'evidence': [0, 0]}}, [a, b])
        with self.assertRaisesRegex(stage.StageError, 'duplicate observation'):
            stage.rebind([copy.deepcopy(row), copy.deepcopy(row)], {'x': {'evidence': [0, 1]}}, [a, b])
        with self.assertRaisesRegex(stage.StageError, 'duplicate or invalid'):
            stage.unique([{'id': 'x'}, {'id': 'x'}], 'id', 'candidate')

    def test_rebind_uses_values_and_reports_additions(self):
        a, b, c = ({'channel': 'ast', 'start': n} for n in (1, 2, 3))
        rows = [{'candidateId': 'x', 'facet': 'f', 'sourceLocations': [a, b]}]
        additions = stage.rebind(rows, {'x': {'evidence': [2, 0, 1]}}, [b, c, a])
        self.assertEqual(rows[0]['sourceLocations'], [a, b, c])
        self.assertEqual(additions[0]['addedLocations'], [c])
        self.assertEqual(stage.rebind(rows, {'x': {'evidence': [1, 2, 0]}}, [c, a, b]), [])

    def test_ast_claims_require_source_id_and_full_evidence(self):
        loc = {'channel': 'ast', 'source': 'sdk', 'sha256': 'hash', 'start': 7, 'end': 8}
        claim = {'id': 'raw', 'owner': 'Owner', 'evidence': [loc, loc],
                 'sourceFlow': {'call': {'start': 1, 'end': 2},
                                'definition': {'start': 3, 'end': 4},
                                'read': {'start': 7, 'end': 8}}}
        unrelated = {**claim, 'id': 'other'}
        row = {'id': 'option', 'sourceNames': ['raw'], 'evidence': [loc]}
        found = stage.source_claims(row, {'raw': claim, 'other': unrelated})
        self.assertEqual(found, [claim])
        self.assertIsNot(found[0], claim)
        self.assertEqual(len(found[0]['evidence']), 2)
        self.assertEqual(stage.source_claims({**row, 'sourceNames': []}, {'raw': claim}), [])
        self.assertEqual(stage.source_claims({**row, 'id': 'other'}, {'raw': claim, 'other': unrelated}), [claim])
        self.assertEqual(stage.source_claims({**row, 'evidence': [{**loc, 'end': 9}]}, {'raw': claim}), [])
        self.assertEqual(stage.source_claims(row, {'raw': {**claim, 'evidence': [loc, {**loc, 'start': 3}]}}), [])

    def test_reference_disposition_preserves_scope_and_rejects_status_only(self):
        dimension = {'applicable': False, 'status': 'not applicable',
                     'applicabilityReason': 'Not a named JS member; REST remains unverified.',
                     'platforms': {p: {'status': 'not applicable'} for p in ('web', 'android', 'ios')}}
        row = {'id': 'rest-table', 'status': 'reviewed-reference-only', 'dimensions': [dimension],
               'referenceScopeReview': {'reviewType': 'current-navigation-reference-only',
                                        'scope': 'outside-named-js-sdk', 'restVerification': 'UNVERIFIED'}}
        result = stage.reference_disposition(row)
        self.assertEqual(result['restVerification'], 'UNVERIFIED')
        self.assertEqual(result['web'], 'not applicable as a named JS member')
        row['dimensions'][0]['platforms']['ios']['status'] = 'unimplemented'
        with self.assertRaises(stage.StageError):
            stage.reference_disposition(row)
        row['referenceScopeReview'] = {}
        self.assertIsNone(stage.reference_disposition(row))

    def test_repeat_publication_and_changed_or_removed_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            parent = Path(directory).resolve()
            source, out = parent / 'source', parent / 'out'
            current = source / stage.CURRENT
            current.mkdir(parents=True)
            out.mkdir()
            def write(path, value):
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(json.dumps(value))
            loc = {'channel': 'ast', 'source': 'sdk', 'sha256': 'hash', 'start': 7, 'end': 8,
                   'detail': {'path': 'options.nested'}}
            flow = {'call': {'start': 1, 'end': 2}, 'definition': {'start': 3, 'end': 4},
                    'read': {'start': 7, 'end': 8}}
            claim = {'id': 'Owner#constructor:argument[0].nested', 'owner': 'Owner',
                     'evidence': [loc, loc], 'sourceFlow': flow}
            row = {'id': 'option', 'owner': 'Owner', 'kinds': ['option'], 'channels': ['ast'],
                   'scope': 'documented', 'dartCandidates': [], 'status': 'unmapped', 'platforms': {},
                   'dimensions': [], 'sourceNames': [claim['id']], 'evidence': [loc, loc]}
            baseline = source / 'baseline.json'
            write(baseline, {'id': 'base', 'contentId': 'content', 'sources': [{'sha256': 'hash'}]})
            leaf = source / 'leaf.json'
            leaf.write_text('leaf')
            binding = {'baseline': 'base', 'leaf': 'leaf.json',
                       'currentDartLeafHash': stage.digest(leaf.read_bytes()), 'artifacts': {}}
            old = {'manifestId': 'base', 'captureContentId': 'content', 'baselinePath': 'baseline.json',
                   'dimensionNames': [], 'candidates': [{'id': 'option', 'evidence': [0, 0],
                                                         'historicalEvidence': binding}],
                   'evidenceLocations': [{k: v for k, v in loc.items() if k in stage.LOCATION_KEYS}]}
            (current / 'inventory.json.gz').write_bytes(stage.packed(old))
            status = {'baselineFileSha256': stage.digest(baseline.read_bytes()), 'manifestId': 'base',
                      'contentId': 'content', 'ledgerSha256': stage.digest((current / 'inventory.json.gz').read_bytes()),
                      'uniqueBodies': 1}
            write(current / 'status.json', status)
            index = {'officialBaselineContentId': 'content', 'rows': [], 'candidateInventory': {},
                     'publishedDeclarationIndex': {'path': 'receipt', 'sha256': stage.digest(b'receipt')}, 'artifacts': {}}
            (source / 'receipt').write_bytes(b'receipt')
            (current / 'contract-observations.json.gz').write_bytes(stage.packed(index))
            gate = {'ok': True}
            commit = 'a' * 40
            revision = {'available': True, 'commit': commit, 'trackedClean': True}
            write(out / 'run.json', {'createdAt': 'now', 'baselineId': 'base', 'artifacts': {},
                                      'sourceRevision': revision,
                                      'toolFingerprint': {'sha256': 't'}, 'bridgeFingerprint': {'sha256': 'b'},
                                      'libFingerprint': {'sha256': 'l'}})
            def raw_data(current_row, current_claims):
                write(out / 'report.json', {'baselineId': 'base', 'rows': [current_row],
                      'boundedPlatformObservations': {}, 'summary': {'issueTypes': {}, 'scopes': {}},
                      'issues': [], 'resolvedIssues': [], 'status': 'open'})
                write(out / 'inventory.json', [current_row])
                write(out / 'ast.json', {'rows': current_claims, 'parsedBytes': 10})
                write(out / 'drift.json', {'gate': gate})
            raw_data(row, [claim])
            args = types.SimpleNamespace(source=source, out=out, baseline=baseline, against=baseline,
                                         commit=commit, stage=parent / 'stage1')
            def git(command, **kwargs):
                return subprocess.CompletedProcess(command, 0, '' if 'status' in command else commit + '\n', '')
            with patch.object(stage.subprocess, 'run', side_effect=git), \
                 patch.object(stage, 'run_check', return_value=(0, gate)), \
                 patch.dict(sys.modules, {'validate_observations': types.SimpleNamespace(validate=lambda *args: None)}):
                stage.build(args)
                first = stage.read(args.stage / stage.CURRENT / 'inventory.json.gz')
                self.assertEqual(first['auditCommit'], commit)
                self.assertEqual(stage.read(args.stage / stage.CURRENT / 'status.json')['auditCommit'], commit)
                self.assertEqual(stage.read(args.stage / 'staging-review.json')['sourceRevision'], revision)
                self.assertEqual(first['candidates'][0]['astSourceClaims'], [claim])
                self.assertEqual(first['candidates'][0]['rawAstEvidence'], [loc, loc])
                self.assertEqual(first['candidates'][0]['evidence'], [0, 0])
                self.assertEqual(first['candidates'][0]['historicalEvidence'], binding)
                for name in ('inventory.json.gz', 'status.json', 'contract-observations.json.gz'):
                    (current / name).write_bytes((args.stage / stage.CURRENT / name).read_bytes())
                args.stage = parent / 'stage2'
                stage.build(args)
                second = stage.read(args.stage / stage.CURRENT / 'inventory.json.gz')
                self.assertEqual(first['candidates'], second['candidates'])
                self.assertEqual(first['evidenceLocations'], second['evidenceLocations'])
                self.assertEqual(stage.read(args.stage / 'staging-review.json')['removedAstSourceClaimsRequireReview'], [])
                for name in ('inventory.json.gz', 'status.json', 'contract-observations.json.gz'):
                    (current / name).write_bytes((args.stage / stage.CURRENT / name).read_bytes())
                changed_claim = {**claim, 'owner': 'NewOwner', 'sourceFlow': {**flow, 'call': {'start': 11, 'end': 12}}}
                raw_data(row, [changed_claim])
                args.stage = parent / 'changed-claim'
                stage.build(args)
                changed_ledger = stage.read(args.stage / stage.CURRENT / 'inventory.json.gz')
                self.assertEqual(changed_ledger['candidates'][0]['astSourceClaims'], [changed_claim])
                self.assertEqual(len(stage.read(args.stage / 'staging-review.json')['removedAstSourceClaimsRequireReview']), 1)
                changed = {**loc, 'detail': {'path': 'options.changed'}}
                changed_row = {**row, 'evidence': [changed]}
                raw_data(changed_row, [claim])
                args.stage = parent / 'stage3'
                stage.build(args)
                third = stage.read(args.stage / stage.CURRENT / 'inventory.json.gz')['candidates'][0]
                self.assertNotIn('astSourceClaims', third)
                self.assertEqual(third['rawAstEvidence'], [changed])
                removed = stage.read(args.stage / 'staging-review.json')['removedAstSourceClaimsRequireReview']
                self.assertEqual(removed[0]['removedClaims'][0]['id'], claim['id'])
                self.assertEqual(removed[0]['removedClaims'][0]['count'], 1)
                raw_data({**row, 'evidence': [], 'channels': []}, [])
                args.stage = parent / 'stage4'
                stage.build(args)
                fourth = stage.read(args.stage / stage.CURRENT / 'inventory.json.gz')['candidates'][0]
                self.assertNotIn('astSourceClaims', fourth)
                self.assertNotIn('rawAstEvidence', fourth)
                self.assertEqual(len(stage.read(args.stage / 'staging-review.json')['removedAstSourceClaimsRequireReview']), 1)
                args.stage = parent / 'changed-during-check'
                with patch.object(stage, 'checked_source_revision',
                                  side_effect=[commit, stage.StageError('tracked changes')]):
                    with self.assertRaisesRegex(stage.StageError, 'tracked changes'):
                        stage.build(args)
                self.assertFalse(args.stage.exists())

    def test_destination_outside_checkout_and_no_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            parent = Path(directory).resolve()
            source, out = parent / 'source', parent / 'out'
            source.mkdir()
            out.mkdir()
            self.assertEqual(stage.validate_destination(parent / 'new', source, out), parent / 'new')
            for path in (source / 'new', out / 'new', stage.ROOT / 'new', source, parent):
                with self.subTest(path=path), self.assertRaises(stage.StageError):
                    stage.validate_destination(path, source, out)
            existing = parent / 'existing'
            existing.mkdir()
            (existing / 'sentinel').write_text('untouched')
            with self.assertRaises(stage.StageError):
                stage.validate_destination(existing, source, out)
            self.assertEqual((existing / 'sentinel').read_text(), 'untouched')

    def test_source_clean_gate_rejects_tracked_changes(self):
        with tempfile.TemporaryDirectory() as directory:
            parent = Path(directory).resolve()
            source, out = parent / 'source', parent / 'out'
            source.mkdir()
            out.mkdir()
            baseline = parent / 'baseline'
            baseline.touch()
            args = types.SimpleNamespace(source=source, out=out, baseline=baseline, against=baseline,
                                         commit='a' * 40, stage=parent / 'stage')
            def git(command, **kwargs):
                return subprocess.CompletedProcess(command, 0, ' M pubspec.lock\n' if 'status' in command else args.commit + '\n', '')
            with patch.object(stage.subprocess, 'run', side_effect=git):
                with self.assertRaisesRegex(stage.StageError, 'tracked changes'):
                    stage.build(args)
            self.assertFalse(args.stage.exists())

    def test_captured_revision_binds_real_docs_only_commits_and_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            parent = Path(directory).resolve()
            source, out = parent / 'source', parent / 'out'
            source.mkdir()
            out.mkdir()
            def git(*args):
                return subprocess.run(['git', '-C', str(source), *args], check=True,
                                      capture_output=True, text=True).stdout.strip()
            git('init', '-q')
            git('config', 'user.name', 'Staging Test')
            git('config', 'user.email', 'staging-test@example.invalid')
            (source / 'README.md').write_text('first\n')
            git('add', 'README.md')
            git('commit', '-qm', 'first')
            first = git('rev-parse', 'HEAD')
            (source / 'README.md').write_text('documentation only\n')
            git('commit', '-qam', 'docs only')
            head = git('rev-parse', 'HEAD')
            self.assertNotEqual(first, head)
            baseline = parent / 'baseline'
            baseline.touch()
            args = types.SimpleNamespace(source=source, out=out, baseline=baseline, against=baseline,
                                         commit=head, stage=parent / 'stage')
            clean = {'available': True, 'commit': head, 'trackedClean': True}
            bad_revisions = [
                ('different docs-only commit', {**clean, 'commit': first}),
                ('dirty captured checkout', {**clean, 'trackedClean': False}),
                ('unavailable', {'available': False, 'commit': None, 'trackedClean': None}),
                ('missing', None),
                ('missing clean flag', {'available': True, 'commit': head}),
                ('non-boolean flags', {**clean, 'trackedClean': 1}),
                ('abbreviated captured SHA', {**clean, 'commit': head[:12]}),
            ]
            for label, revision in bad_revisions:
                with self.subTest(label=label):
                    run = {'toolFingerprint': {'sha256': 'unchanged'}}
                    if revision is not None:
                        run['sourceRevision'] = revision
                    (out / 'run.json').write_text(json.dumps(run))
                    with patch.object(stage, 'run_check') as run_check:
                        with self.assertRaisesRegex(stage.StageError, 'raw run must capture'):
                            stage.build(args)
                        run_check.assert_not_called()
                    self.assertFalse(args.stage.exists())
            (out / 'run.json').write_text(json.dumps({'sourceRevision': clean}))
            for explicit in (first, head[:12], 'HEAD'):
                with self.subTest(explicit=explicit):
                    args.commit = explicit
                    with self.assertRaisesRegex(stage.StageError, 'full source checkout HEAD SHA'):
                        stage.build(args)
                    self.assertFalse(args.stage.exists())

    def test_strict_check_really_runs_and_rejects_fault(self):
        failed = subprocess.CompletedProcess([], 2, '', 'invalid artifact')
        with patch.object(stage.subprocess, 'run', return_value=failed) as run:
            with self.assertRaisesRegex(stage.StageError, 'invalid artifact'):
                stage.run_check(Path('/source'), Path('/out'), Path('/baseline'), Path('/prior'), True)
            self.assertIn('--integrity-only', run.call_args.args[0])
        gate = {'ok': False, 'status': 'INCOMPLETE', 'reasons': ['unresolved']}
        incomplete = subprocess.CompletedProcess([], 1, json.dumps({'gate': gate}), '')
        with patch.object(stage.subprocess, 'run', return_value=incomplete):
            self.assertEqual(stage.run_check(Path('/source'), Path('/out'), Path('/baseline'), Path('/prior'), False), (1, gate))


if __name__ == '__main__':
    unittest.main()
