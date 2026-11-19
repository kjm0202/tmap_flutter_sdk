import { isDeepStrictEqual } from 'node:util';
import { genericDispatchSourceEvidence } from './generic_dispatch_source.mjs';
import { exactGenericAbsence } from './generic_dispatch_observation.mjs';

const HISTORICAL_TARGETS = [
  { id: "Map.generic-adapter", contract: "Tmapv3.Map", dedicated: true, kind: "Map" },
  { id: "DotMap.generic-adapter", contract: "Tmapv3.extension.DotMap", dedicated: false },
  { id: "SquareMap.generic-adapter", contract: "Tmapv3.extension.SquareMap", dedicated: false },
  { id: "InfoWindow.generic-adapter", contract: "Tmapv3.mapobject.InfoWindow", dedicated: true, kind: "InfoWindow" },
  { id: "Label.generic-adapter", contract: "Tmapv3.mapobject.Label", dedicated: true, kind: "Label" },
  { id: "Polyline.generic-adapter", contract: "Tmapv3.shape.Polyline", dedicated: true, kind: "Polyline" },
  { id: "Polygon.generic-adapter", contract: "Tmapv3.shape.Polygon", dedicated: true, kind: "Polygon" },
  { id: "Circle.generic-adapter", contract: "Tmapv3.shape.Circle", dedicated: true, kind: "Circle" },
  { id: "Rectangle.generic-adapter", contract: "Tmapv3.shape.Rectangle", dedicated: true, kind: "Rectangle" },
  { id: "GroundOverlay.generic-adapter", contract: "Tmapv3.shape.GroundOverlay", dedicated: false },
  { id: "Marker.generic-adapter", contract: "Tmapv3.mapobject.Marker", dedicated: true, kind: "Marker" },
  { id: "MarkerCluster.generic-adapter", contract: "Tmapv3.extension.MarkerCluster", dedicated: true, kind: "MarkerCluster" },
  { id: "Drawing.generic-adapter", contract: "Tmapv3.extension.Drawing", dedicated: false },
  { id: "Drawing.pointer.generic-adapter", contract: "Tmapv3.extension.Drawing", dedicated: false },
];

const DEDICATED_RELEASE_MAP = {
  "Map.generic-adapter": "TMap.new",
  "MarkerCluster.generic-adapter": "TMapController.addMarkerClusterer",
  "InfoWindow.generic-adapter": "TMapController.addInfoWindow",
  "Label.generic-adapter": "TMapController.addLabel",
  "Polyline.generic-adapter": "TMapController.addPolyline",
  "Polygon.generic-adapter": "TMapController.addPolygon",
  "Circle.generic-adapter": "TMapController.addCircle",
  "Rectangle.generic-adapter": "TMapController.addRectangle",
  "Marker.generic-adapter": "TMapController.addMarker",
};

export function reviewGenericDispatch({ issues, rows, manifest, runtime, libFingerprint, bridgeFingerprint }) {
  const proof = genericDispatchSourceEvidence({ manifest, runtime, libFingerprint, bridgeFingerprint });
  if (!proof) return { open: issues, resolved: [] };

  const resolved = [];
  const open = [...issues];

  for (const target of HISTORICAL_TARGETS) {
    const targetLiteral = { code: 'bridge-component-check-failed', id: target.id, status: 'unresolved-unavailable-wrapper' };
    // Filter issues by ID first
    const targetIssues = open.filter(i => i.id === target.id);
    if (targetIssues.length !== 1) continue;
    if (!isDeepStrictEqual(targetIssues[0], targetLiteral)) continue;

    const runtimeIssues = runtime.issues.filter(i => i.id === target.id);
    if (runtimeIssues.length !== 1) continue;
    if (!isDeepStrictEqual(runtimeIssues[0], targetLiteral)) continue;

    const observation = exactGenericAbsence(runtime, target);
    if (observation === null) continue;

    const rowsFound = rows.filter(r => r.id === target.contract);
    if (rowsFound.length !== 1) continue;
    const row = rowsFound[0];

    let match = false;
    if (target.dedicated) {
      if (row.status === 'candidate-unverified' && Array.isArray(row.dartCandidates) && row.dartCandidates.length === 2) {
        const [c1, c2] = row.dartCandidates;
        if (c1.kind === 'class' && c2.kind === 'class' && c1.id !== c2.id) {
          const expected = target.kind === 'Map' ? 'TMap' : target.kind === 'MarkerCluster' ? 'Clusterer' : target.id.split('.')[0];
          if ((c1.id === 'TMapController' && c2.id === expected) || (c2.id === 'TMapController' && c1.id === expected)) {
            match = true;
          }
        }
      }
    } else {
      if (row.status === 'unmapped' && Array.isArray(row.dartCandidates) && row.dartCandidates.length === 0) match = true;
    }

    if (match) {
      const dedicatedReleaseId = target.dedicated ? (DEDICATED_RELEASE_MAP[target.id] || null) : null;
      if (target.dedicated && !DEDICATED_RELEASE_MAP.hasOwnProperty(target.id)) continue;
      if (dedicatedReleaseId && !proof.publicReleaseIds?.includes(dedicatedReleaseId)) continue;

      const issueIndex = open.indexOf(targetIssues[0]);
      const issue = open.splice(issueIndex, 1)[0];

      resolved.push({
        status: 'REVIEWED_OBSOLETE_AUDIT_TARGET',
        rationale: 'Historical generic transport is absent; generic dispatch wrapper is unavailable and obsolete for current bridge infrastructure.',
        evidence: {
          ...proof,
          observation: observation,
          canonicalId: row.id,
          canonicalStatus: row.status,
          dedicatedReleaseId: dedicatedReleaseId
        },
        original: issue
      });
    }
  }

  return { open, resolved };
}
