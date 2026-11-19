#!/usr/bin/env python3
"""Validate the checked-in observation links, without changing audit results."""

import gzip
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import sys
import tarfile

ROOT = Path(__file__).resolve().parents[2]
INDEX = 'docs/sdk-audit/current/contract-observations.json.gz'
MEASURED = {'sample-match', 'observed-difference', 'observed-in-port',
            'argument-absent-and-renderer-differs'}
UNMEASURED = {'unknown', 'unmeasured'}
REVISION_POINTERS = {'/commit', '/testedCommit', '/candidate/revision', '/revision'}
SHA256 = re.compile(r'[0-9a-f]{64}\Z')
COMMIT = re.compile(r'[0-9a-f]{40}\Z')


class Invalid(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise Invalid(message)


def safe_path(root, name):
    require(isinstance(name, str) and name and '\\' not in name, 'invalid path')
    path = PurePosixPath(name)
    require(not path.is_absolute() and all(part not in ('.', '..') for part in name.split('/')),
            f'unsafe path: {name}')
    result = (root / name).resolve(strict=True)
    require(result.is_relative_to(root.resolve()) and result.is_file(), f'path outside repository or not a file: {name}')
    return result


def load_json(path):
    with (gzip.open(path, 'rt', encoding='utf-8') if path.name.endswith('.gz')
          else path.open(encoding='utf-8')) as stream:
        return json.load(stream)


def pointer_value(value, pointer):
    require(isinstance(pointer, str) and (pointer == '' or pointer.startswith('/')),
            f'invalid JSON pointer: {pointer!r}')
    if pointer == '':
        return value
    for token in pointer[1:].split('/'):
        require(not re.search(r'~(?![01])', token), f'invalid JSON pointer escape: {pointer}')
        token = token.replace('~1', '/').replace('~0', '~')
        if isinstance(value, dict):
            require(token in value, f'JSON pointer not found: {pointer}')
            value = value[token]
        elif isinstance(value, list):
            require(re.fullmatch(r'0|[1-9][0-9]*', token) is not None and int(token) < len(value),
                    f'JSON pointer not found: {pointer}')
            value = value[int(token)]
        else:
            raise Invalid(f'JSON pointer not found: {pointer}')
    return value


def unique_ids(rows, label):
    result = {}
    for row in rows:
        identifier = row['id']
        require(isinstance(identifier, str) and identifier and identifier not in result,
                f'duplicate or invalid {label} ID: {identifier!r}')
        result[identifier] = row
    return result


def validate(root, index):
    root = Path(root).resolve()
    require(index['schemaVersion'] == 1, 'unsupported observation schema')
    cache = {}

    def checked_file(entry, label):
        expected = entry['sha256']
        require(isinstance(expected, str) and SHA256.fullmatch(expected), f'{label}: invalid SHA-256')
        path = safe_path(root, entry['path'])
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        require(actual == expected, f'{label}: SHA-256 mismatch for {entry["path"]}')
        return path

    inventory = load_json(checked_file(index['candidateInventory'], 'candidate inventory'))
    declarations = load_json(checked_file(index['publishedDeclarationIndex'], 'published declaration index'))
    require(index['officialBaselineContentId'] == inventory['captureContentId'], 'baseline content ID mismatch')
    candidates = unique_ids(inventory['candidates'], 'candidate')
    dart = unique_ids(declarations['rows'], 'Dart declaration')
    artifacts = {name: checked_file(entry, f'artifact {name}')
                 for name, entry in index['artifacts'].items()}

    def evidence_json(item):
        name = item['artifact']
        require(name in artifacts, f'unknown artifact: {name}')
        path = artifacts[name]
        member = item.get('tarMember')
        require((member is not None) == path.name.endswith(('.tar.gz', '.tgz')),
                f'{name}: tarMember must be present only for tar archives')
        key = (name, member)
        if key not in cache:
            if member is None:
                cache[key] = load_json(path)
            else:
                require(isinstance(member, str) and member and '\\' not in member
                        and not PurePosixPath(member).is_absolute()
                        and all(p not in ('', '.', '..') for p in member.split('/')),
                        f'unsafe archive member: {member!r}')
                with tarfile.open(path, 'r:gz') as archive:
                    matches = [m for m in archive.getmembers() if m.name == member]
                    require(len(matches) == 1 and matches[0].isfile(),
                            f'{name}: missing, duplicate or non-file archive member: {member}')
                    with archive.extractfile(matches[0]) as stream:
                        cache[key] = json.load(stream)
        return cache[key]

    rows = index['rows']
    require(isinstance(rows, list) and rows, 'observation rows missing')
    platform_count = 0
    for row in rows:
        cid = row['candidateId']
        require(cid in candidates, f'unknown candidate ID: {cid}')
        require(isinstance(row['facet'], str) and row['facet'].strip(), f'{cid}: empty facet')
        require(isinstance(row['publishedDart'], list) and row['publishedDart'], f'{cid}: no Dart declarations')
        for identifier in row['publishedDart']:
            require(identifier in dart, f'{cid}: unknown Dart declaration ID: {identifier}')
        indices = candidates[cid]['evidence']
        require(isinstance(indices, list) and indices, f'{cid}: candidate has no evidence locations')
        locations = inventory['evidenceLocations']
        for number in indices:
            require(type(number) is int and 0 <= number < len(locations), f'{cid}: invalid candidate evidence index')
        require(isinstance(row['sourceLocations'], list) and row['sourceLocations'], f'{cid}: no source locations')
        candidate_locations = [locations[n] for n in indices]
        for location in row['sourceLocations']:
            require(location in candidate_locations, f'{cid}: source location not in candidate evidence: {location}')
        require(len(row['sourceLocations']) == len(candidate_locations)
                and all(row['sourceLocations'].count(location) == candidate_locations.count(location)
                        for location in candidate_locations),
                f'{cid}: candidate evidence locations missing or duplicated')
        commit = row.get('testedProductCommit')
        if commit is not None:
            require(isinstance(commit, str) and COMMIT.fullmatch(commit), f'{cid}: invalid testedProductCommit')
        platforms = row['platforms']
        require(isinstance(platforms, dict) and set(platforms) == {'web', 'android', 'ios'},
                f'{cid}: expected web, android and ios platform records')
        for platform, record in platforms.items():
            platform_count += 1
            context = f'{cid} / {platform}'
            require(platform in ('web', 'android', 'ios'), f'{context}: unknown platform')
            status = record['status']
            require(status in MEASURED | UNMEASURED, f'{context}: unknown status {status!r}')
            evidence = record.get('evidence', [])
            require(isinstance(evidence, list), f'{context}: invalid evidence')
            if status in UNMEASURED:
                require(not evidence, f'{context}: unmeasured status must not claim measurement evidence')
                continue
            require(evidence, f'{context}: measured status requires evidence')
            has_actual, has_revision = False, False
            for item in evidence:
                value = evidence_json(item)
                pointers = item['jsonPointers']
                require(isinstance(pointers, list) and pointers, f'{context}: evidence needs JSON pointers')
                for pointer in pointers:
                    found = pointer_value(value, pointer)
                    if pointer in REVISION_POINTERS and commit is not None:
                        require(found == commit, f'{context}: receipt revision mismatch at {pointer}')
                        has_revision = True
                    elif pointer and pointer not in REVISION_POINTERS and found is not None and found != '' and found != [] and found != {}:
                        has_actual = True
            require(has_actual, f'{context}: measured status requires actual evidence beyond revision metadata')
            if commit is not None:
                require(has_revision, f'{context}: testedProductCommit needs a linked receipt revision')
    return len(rows), platform_count


def main():
    try:
        require(len(sys.argv) == 1, 'this command takes no arguments')
        rows, platforms = validate(ROOT, load_json(safe_path(ROOT, INDEX)))
    except (Invalid, OSError, ValueError, KeyError, TypeError, tarfile.TarError, EOFError) as exc:
        print(f'observation integrity failed: {exc}', file=sys.stderr)
        return 1
    print(f'observation integrity OK: {rows} facets, {platforms} platform records')
    return 0


if __name__ == '__main__':
    sys.exit(main())
