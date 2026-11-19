#!/usr/bin/env python3
"""Build a reviewable compact ledger from an independently verified audit run."""
import argparse
from collections import Counter
import copy
import gzip
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
CURRENT = Path('docs/sdk-audit/current')
LOCATION_KEYS = {'channel', 'source', 'sha256', 'line', 'start', 'end', 'anchor',
                 'codeStart', 'codeEnd', 'phase'}
DYNAMIC_CODES = {'dynamic-code', 'reflective-property-definition', 'dynamic-property-write'}


class StageError(Exception):
    pass


def require(value, message):
    if not value:
        raise StageError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def packed(value):
    data = bytearray(gzip.compress((canonical(value) + '\n').encode(), compresslevel=6, mtime=0))
    data[9] = 255
    return bytes(data)


def read(path):
    data = path.read_bytes()
    return json.loads(gzip.decompress(data) if path.name.endswith('.gz') else data)


def checked(root, name, expected):
    require(isinstance(name, str) and name and '\\' not in name, 'invalid receipt path')
    parts = name.split('/')
    require(not PurePosixPath(name).is_absolute() and all(x not in ('', '.', '..') for x in parts),
            f'unsafe receipt path: {name}')
    path = (root / name).resolve(strict=True)
    require(path.is_relative_to(root) and path.is_file(), f'invalid receipt: {name}')
    require(digest(path.read_bytes()) == expected, f'SHA-256 mismatch: {name}')
    return path


def unique(rows, key, label):
    result = {}
    for row in rows:
        ident = row[key]
        require(isinstance(ident, str) and ident and ident not in result, f'duplicate or invalid {label}: {ident}')
        result[ident] = row
    return result


def rebind(rows, candidates, locations):
    additions = []
    seen = set()
    for row in rows:
        cid, facet = row['candidateId'], row['facet']
        require((cid, facet) not in seen, f'duplicate observation facet: {cid} / {facet}')
        seen.add((cid, facet))
        require(cid in candidates, f'observed candidate removed: {cid}')
        current = [locations[i] for i in candidates[cid]['evidence']]
        old_count = Counter(map(canonical, row['sourceLocations']))
        new_count = Counter(map(canonical, current))
        require(not old_count - new_count, f'observation source removed or replaced: {cid} / {facet}')
        extra = new_count - old_count
        if extra:
            additions.append({'candidateId': cid, 'facet': facet,
                              'addedLocations': [json.loads(x) for x in sorted(extra.elements())]})
        row['sourceLocations'] = copy.deepcopy(current)
    return additions


def source_claims(row, ast_rows):
    # Reconciliation records the source IDs that actually contributed to a row.
    # A location alone is not a join key: distinct claims can share a span.
    names = set(row.get('sourceNames', []))
    evidence = {canonical(e) for e in row['evidence'] if e.get('channel') == 'ast'}
    claims = []
    for name in sorted(names & ast_rows.keys()):
        claim = ast_rows[name]
        sources = claim.get('evidence', [])
        # Reconciliation deduplicates full evidence objects, whereas AST rows can
        # contain duplicates. Check membership, then preserve the original multiset.
        if sources and all(e.get('channel') == 'ast' and canonical(e) in evidence for e in sources):
            claims.append(copy.deepcopy(claim))
    return claims


def removed_claims(old_candidate, candidate):
    old = Counter(canonical(c) for c in old_candidate.get('astSourceClaims', []))
    current = Counter(canonical(c) for c in candidate.get('astSourceClaims', []))
    return [{'id': json.loads(value)['id'], 'sha256': digest(value.encode()), 'count': count}
            for value, count in sorted((old - current).items())]


def reference_disposition(row):
    if row.get('referenceScopeReview', {}).get('reviewType') != 'current-navigation-reference-only':
        return None
    # build() calls this only after the integrity check rebuilt all artifacts.
    proof = row['referenceScopeReview']
    require(row.get('status') == 'reviewed-reference-only' and
            proof.get('restVerification') == 'UNVERIFIED' and
            proof.get('scope') == 'outside-named-js-sdk' and row['dimensions'] and
            all(not d['applicable'] and d['status'] == 'not applicable' and
                set(d['platforms']) == {'web', 'android', 'ios'} and
                all(p['status'] == 'not applicable' for p in d['platforms'].values())
                for d in row['dimensions']), f"invalid reference disposition: {row['id']}")
    return {'web': 'not applicable as a named JS member',
            'android': 'not applicable as a named JS member',
            'ios': 'not applicable as a named JS member',
            'restVerification': 'UNVERIFIED',
            'reason': row['dimensions'][0]['applicabilityReason']}


def run_check(source, out, baseline, prior, integrity):
    command = ['node', str(source / 'tool/sdk_audit/cli.mjs'), 'check', '--out', str(out),
               '--snapshot', str(baseline), '--against', str(prior)]
    if integrity:
        command.append('--integrity-only')
    result = subprocess.run(command, cwd=source, text=True, capture_output=True)
    require(result.returncode in ((0,) if integrity else (0, 1)),
            f"{'integrity' if integrity else 'strict'} check failed ({result.returncode}): {result.stderr.strip()}")
    try:
        proof = json.loads(result.stdout)
    except ValueError as exc:
        raise StageError('check did not return JSON proof') from exc
    require(not integrity or proof.get('integrity') == 'VERIFIED', 'missing integrity proof')
    return result.returncode, proof['gate']


def validate_destination(stage, source, out):
    # Refuse all repository paths, including ignored/untracked directories and symlink aliases.
    require(not stage.is_symlink(), f'stage already exists: {stage}')
    stage = stage.resolve()
    require(not stage.exists(), f'stage already exists: {stage}')
    for protected in (ROOT.resolve(), source, out):
        require(not stage.is_relative_to(protected) and not protected.is_relative_to(stage),
                f'stage overlaps protected directory: {protected}')
    return stage


def checked_source_revision(source, commit):
    git_env = {**os.environ, 'GIT_OPTIONAL_LOCKS': '0'}
    head = subprocess.run(['git', '-C', str(source), 'rev-parse', '--verify', 'HEAD'],
                          capture_output=True, text=True, check=True, env=git_env).stdout.strip()
    requested = subprocess.run(['git', '-C', str(source), 'rev-parse', '--verify', commit + '^{commit}'],
                               capture_output=True, text=True, check=True, env=git_env).stdout.strip()
    require(head == requested == commit, 'explicit commit must be the full source checkout HEAD SHA')
    dirty = subprocess.run(['git', '-C', str(source), 'status', '--porcelain', '--untracked-files=no'],
                           capture_output=True, text=True, check=True, env=git_env).stdout
    require(not dirty, 'source checkout has tracked changes; commit them before staging')
    return head


def build(args):
    source = args.source.resolve(strict=True)
    out = args.out.resolve(strict=True)
    baseline = args.baseline.resolve(strict=True)
    prior = args.against.resolve(strict=True)
    stage = validate_destination(args.stage, source, out)
    head = checked_source_revision(source, args.commit)
    run_bytes = (out / 'run.json').read_bytes()
    run_sha = digest(run_bytes)
    run = json.loads(run_bytes)
    revision = run.get('sourceRevision')
    require(isinstance(revision, dict) and revision.get('available') is True and
            revision.get('trackedClean') is True and revision.get('commit') == head,
            'raw run must capture an available, tracked-clean source revision matching the explicit commit and checkout HEAD')
    old = read(source / CURRENT / 'inventory.json.gz')
    status = read(source / CURRENT / 'status.json')
    index = read(source / CURRENT / 'contract-observations.json.gz')
    pin = read(baseline)
    require(digest(baseline.read_bytes()) == status['baselineFileSha256'], 'baseline file hash mismatch')
    checked(source, old['baselinePath'], status['baselineFileSha256'])
    require(pin['id'] == old['manifestId'] == status['manifestId'] and
            pin['contentId'] == old['captureContentId'] == status['contentId'] == index['officialBaselineContentId'],
            'baseline ID or contentId mismatch')
    require(digest((source / CURRENT / 'inventory.json.gz').read_bytes()) == status['ledgerSha256'],
            'published ledger hash mismatch')
    # The existing validator checks all published observation receipts and links before rebinding.
    sys.path.insert(0, str(ROOT / 'tool/sdk_audit'))
    import validate_observations
    validate_observations.validate(source, index)
    integrity_code, integrity_gate = run_check(source, out, baseline, prior, True)
    strict_code, strict_gate = run_check(source, out, baseline, prior, False)
    require(digest((out / 'run.json').read_bytes()) == run_sha, 'run manifest changed during verification')
    raw, inv, ast, drift = (read(out / n) for n in
                            ('report.json', 'inventory.json', 'ast.json', 'drift.json'))
    for name, expected in run['artifacts'].items():
        checked(out, name, expected)
    require(run['baselineId'] == raw['baselineId'] == pin['id'], 'raw baseline mismatch')
    require(inv == raw['rows'], 'inventory and report rows differ')
    require(strict_gate == integrity_gate == drift['gate'] and strict_code == (0 if strict_gate['ok'] else 1),
            'strict gate and check result disagree')
    require(raw.get('platformEvidence') is None and raw.get('boundedPlatformObservations') == {},
            'new platform evidence needs a reviewed summary before staging')
    old_by_id = unique(old['candidates'], 'id', 'published candidate')
    unique(inv, 'id', 'raw candidate')
    hist = {k: v['historicalEvidence'] for k, v in old_by_id.items() if 'historicalEvidence' in v}
    receipts = {}
    for cid, binding in hist.items():
        require(binding['baseline'] == pin['id'], f'historical baseline mismatch: {cid}')
        receipts[binding['leaf']] = checked(source, binding['leaf'], binding['currentDartLeafHash'])
        for artifact in binding['artifacts'].values():
            # Locate by value, not by a release directory or a fixture name.
            name = artifact['file']
            require(Path(name).name == name, f'invalid historical artifact name: {name}')
            matches = [p for p in (source / 'docs/sdk-audit/checkpoints').rglob(name)
                       if p.is_file() and digest(p.read_bytes()) == artifact['sha256']]
            require(len(matches) == 1, f'missing or ambiguous historical artifact: {name}')
            rel = matches[0].relative_to(source).as_posix()
            receipts[rel] = checked(source, rel, artifact['sha256'])
    require(set(hist) <= {r['id'] for r in inv}, 'historical candidate removed; manual review required')
    ast_rows = unique(ast['rows'], 'id', 'AST row')
    ledger = copy.deepcopy(old)
    pool, loc_index, rows, stale_claims = [], {}, [], []
    for row in inv:
        indices = []
        for evidence in row['evidence']:
            location = {k: v for k, v in evidence.items() if k in LOCATION_KEYS}
            require(all(location.get(k) for k in ('source', 'channel', 'sha256')), f"invalid location: {row['id']}")
            signature = canonical(location)
            if signature not in loc_index:
                loc_index[signature] = len(pool)
                pool.append(location)
            indices.append(loc_index[signature])
        candidate = {'id': row['id'], 'owner': row['owner'], 'kinds': row['kinds'],
                     'channels': row['channels'], 'scopeCandidate': row['scope'],
                     'dartDeclarationCandidates': row['dartCandidates'], 'mappingStatus': row['status'],
                     'platforms': row['platforms'], 'evidence': indices,
                     'proposedApplicableDimensionIndexes': [ledger['dimensionNames'].index(d['dimension'])
                                                            for d in row['dimensions'] if d['applicable']]}
        disposition = reference_disposition(row)
        if disposition:
            candidate['referenceScopeReview'] = copy.deepcopy(row['referenceScopeReview'])
            candidate['referenceDisposition'] = disposition
        if row['id'] in hist:
            candidate['historicalEvidence'] = copy.deepcopy(hist[row['id']])
        # Recompute supplemental fields from the current raw run on every stage.
        # This retains nested source-flow data and all duplicate raw evidence.
        claims = source_claims(row, ast_rows)
        if claims:
            candidate['astSourceClaims'] = claims
        extra = [copy.deepcopy(e) for e in row['evidence'] if e.get('channel') == 'ast']
        if extra:
            candidate['rawAstEvidence'] = extra
        removed = removed_claims(old_by_id.get(row['id'], {}), candidate)
        if removed:
            stale_claims.append({'candidateId': row['id'], 'removedClaims': removed})
        rows.append(candidate)
    for cid in sorted(set(old_by_id) - {r['id'] for r in inv}):
        removed = removed_claims(old_by_id[cid], {})
        if removed:
            stale_claims.append({'candidateId': cid, 'removedClaims': removed})
    coverage = {'candidateIds': len(inv), 'dartDeclarationCandidates': sum(bool(r['dartCandidates']) for r in inv),
                'directChannelCombinations': dict(Counter(','.join(sorted(r['channels'])) for r in inv)),
                'issuesByCode': raw['summary']['issueTypes'], 'scope': raw['summary']['scopes'],
                'sourceInputs': len(pin['sources'])}
    ledger.update(auditCommit=head, runAt=run['createdAt'], candidates=rows, evidenceLocations=pool,
                  coverage=coverage, dynamicUnresolvedSites=[v for v in raw['issues'] if v['code'] in DYNAMIC_CODES],
                  resolvedExtractionIssues=raw['resolvedIssues'], gate=strict_gate, status=raw['status'],
                  inputs={'auditToolsFingerprint': run['toolFingerprint']['sha256'],
                          'platformSourceFingerprintBridge': run['bridgeFingerprint']['sha256'],
                          'platformSourceFingerprintLib': run['libFingerprint']['sha256'],
                          'runArtifactSha256': digest((out / 'run.json').read_bytes())})
    require(status['uniqueBodies'] == len({s['sha256'] for s in pin['sources']}), 'baseline source count mismatch')
    ledger_bytes = packed(ledger)
    status.update(ledgerSha256=digest(ledger_bytes), runAt=ledger['runAt'], auditExitCode=None,
                  checkExitCode=strict_code, integrityExitCode=integrity_code, strictGate=strict_gate,
                  status=raw['status'], declaredCandidateRows=len(rows),
                  rowsWithDartDeclarationCandidate=coverage['dartDeclarationCandidates'],
                  reportedIssues=len(raw['issues']), dynamicSitesRecorded=len(ledger['dynamicUnresolvedSites']),
                  parsedSdkBytes=ast['parsedBytes'], auditCommit=head,
                  observedProjectionInitializers=sum(x.get('original', {}).get('code') == 'dynamic-property-write'
                                                     for x in ledger['resolvedExtractionIssues']))
    index['candidateInventory']['sha256'] = status['ledgerSha256']
    additions = rebind(index['rows'], unique(rows, 'id', 'candidate'), pool)
    for entry in [index['publishedDeclarationIndex'], *index['artifacts'].values()]:
        receipts[entry['path']] = checked(source, entry['path'], entry['sha256'])
    receipts[old['baselinePath']] = baseline
    require(digest((out / 'run.json').read_bytes()) == run_sha, 'run manifest changed while staging')
    for name, expected in run['artifacts'].items():
        checked(out, name, expected)
    # Check again after verification so changes during checks cannot be staged.
    require(checked_source_revision(source, args.commit) == head, 'source checkout HEAD changed while staging')
    # Only a brand-new directory is ever written. Remove partial output on failure.
    stage.mkdir(parents=True, exist_ok=False)
    try:
        dest = stage / CURRENT
        dest.mkdir(parents=True)
        (dest / 'inventory.json.gz').write_bytes(ledger_bytes)
        (dest / 'contract-observations.json.gz').write_bytes(packed(index))
        (dest / 'status.json').write_text(json.dumps(status, indent=2, ensure_ascii=False) + '\n')
        for name, path in receipts.items():
            target = stage / name
            target.parent.mkdir(parents=True, exist_ok=True)
            require(not target.exists(), f'receipt collides with staged output: {name}')
            shutil.copyfile(path, target)
        (stage / 'staging-review.json').write_text(json.dumps({
            'sourceCommit': head, 'sourceRevision': copy.deepcopy(revision), 'runSha256': run_sha,
            'integrityExitCode': integrity_code, 'strictExitCode': strict_code, 'strictGate': strict_gate,
            'auditExitCode': None, 'auditExitCodeReason': 'audit was not executed by this command',
            'observationSourceAdditionsRequireReview': additions,
            'removedAstSourceClaimsRequireReview': stale_claims,
            'addedCandidateIds': sorted(set(r['id'] for r in rows) - set(old_by_id)),
            'removedCandidateIds': sorted(set(old_by_id) - set(r['id'] for r in rows)),
        }, indent=2, ensure_ascii=False) + '\n')
        validate_observations.validate(stage, index)
    except BaseException:
        shutil.rmtree(stage)
        raise
    return stage, strict_gate


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('out', 'baseline', 'against', 'source', 'stage'):
        parser.add_argument('--' + name, type=Path, required=True)
    parser.add_argument('--commit', required=True, help='full Git SHA of the expected committed source revision')
    args = parser.parse_args()
    try:
        stage, gate = build(args)
    except (StageError, OSError, ValueError, KeyError, TypeError, IndexError, subprocess.SubprocessError) as exc:
        print(f'staging failed: {exc}', file=sys.stderr)
        return 2
    print(json.dumps({'stage': str(stage), 'gate': gate}, ensure_ascii=False))
    return 0 if gate['ok'] else 1


if __name__ == '__main__':
    sys.exit(main())
