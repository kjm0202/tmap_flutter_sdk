import { readFileSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { ROOT } from './common.mjs';

const COMP_DIGEST = '3cf692013963033df4754ff33982657a9f08c44daa2f56ec895d5bf75e0575cb';

export function loadComparisons(actualReport, rootPath = ROOT) {
  try {
    const p = path.join(rootPath, 'docs/sdk-audit/checkpoints/2026-11-19/paired-runtime/comparisons.json');
    const content = readFileSync(p);
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    if (hash !== COMP_DIGEST) return null;

    const comparisons = JSON.parse(content.toString('utf8'));
    
    if (actualReport.baselineId !== comparisons.baselineManifestId) return null;
    if (actualReport.sdkSha256 !== comparisons.sdkSha256) return null;
    if (!actualReport.libFingerprint?.files) return null;

    if (!validateArtifacts(comparisons, rootPath)) return null;
    if (!validateModelSources(comparisons, actualReport, rootPath)) return null;

    return comparisons;
  } catch (e) {
    return null;
  }
}

export function validateArtifacts(comparisons, rootPath = ROOT) {
  for (const platform of ['web', 'android', 'ios']) {
    const artifact = comparisons.artifacts[platform];
    const p = path.join(rootPath, 'docs/sdk-audit/checkpoints/2026-11-19/paired-runtime', artifact.file);
    const content = readFileSync(p);
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    if (hash !== artifact.sha256) return false;
    
    // Gzip validation
    try {
        const decompressed = zlib.gunzipSync(content);
        const json = JSON.parse(decompressed.toString());
        if (json.platform !== platform) return false;
    } catch (e) {
        return false;
    }
  }
  return true;
}


export function validateModelSources(comparisons, actualReport, rootPath = ROOT) {
    for (const [file, info] of Object.entries(comparisons.publishedFlutterModelSources)) {
        const p = path.join(rootPath, file);
        const content = readFileSync(p);
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        if (hash !== info.testedSha256) return false;
        if (hash !== actualReport.libFingerprint.files[file]) return false;
    }
    return true;
}

export function getHistoricalEvidence(row, comparisons) {
  if (!comparisons) return null;

  const api = row.id;
  const nineCases = [
    'Tmapv3.base.Point#getX',
    'Tmapv3.base.Point#getY',
    'Tmapv3.base.Point#toString',
    'Tmapv3.base.LatLng#lat',
    'Tmapv3.base.LatLng#lng',
    'Tmapv3.base.LatLng#toString',
    'Tmapv3.base.Point#setX',
    'Tmapv3.base.Point#offset',
    'Tmapv3.base.Point#clone'
  ];

  if (!nineCases.includes(api)) {
    return null;
  }

  const isMutation = api.includes('#set') || api.includes('#offset') || api.includes('#clone');
  const obs = isMutation ? comparisons.memberAndMutationObservations?.[api] : comparisons.returnObservations?.[api];
  
  if (!obs) return null;

  const result = {
    sourceFingerprint: comparisons.sourceFingerprint,
    currentSourceScope: 'same model leaf only',
    baseline: comparisons.baselineManifestId,
    artifacts: comparisons.artifacts,
    currentDartLeafHash: null,
    sourcePosition: comparisons.sourcePositions?.[api],
    observed: obs
  };

  if (api.includes('Tmapv3.base.Point')) {
      const leaf = 'lib/src/models/point.dart';
      if (comparisons.publishedFlutterModelSources[leaf]) {
          result.currentDartLeafHash = comparisons.publishedFlutterModelSources[leaf].testedSha256;
          result.leaf = leaf;
          result.digest = comparisons.publishedFlutterModelSources[leaf].testedSha256;
      }
  } else if (api.includes('Tmapv3.base.LatLng')) {
      const leaf = 'lib/src/models/lat_lng.dart';
      if (comparisons.publishedFlutterModelSources[leaf]) {
          result.currentDartLeafHash = comparisons.publishedFlutterModelSources[leaf].testedSha256;
          result.leaf = leaf;
          result.digest = comparisons.publishedFlutterModelSources[leaf].testedSha256;
      }
  } else {
      const file = comparisons.sourcePositions?.[api]?.file;
      if (file && comparisons.publishedFlutterModelSources[file]) {
          result.currentDartLeafHash = comparisons.publishedFlutterModelSources[file].testedSha256;
      }
  }

  if (api === 'Tmapv3.base.Point#offset' && comparisons.upstreamConflict?.id === api + '::mutation') {
    result.upstreamConflict = comparisons.upstreamConflict;
  }

  return result;
}
