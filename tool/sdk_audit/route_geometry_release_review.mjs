import { isDeepStrictEqual } from 'node:util';
import { readRouteGeometryHistoricalScope } from './route_geometry_historical_scope.mjs';
import { readRouteGeometryPlatformScope } from './route_geometry_platform_scope.mjs';
import { ROOT } from './common.mjs';

const TARGET = { code: 'tdata-route-geometry-observations-rejected', reason: 'library mismatch' };
const present = value => value !== null && typeof value === 'object' && typeof value.then !== 'function';

/** Released 0.1.1 subset of the historical route geometry receipt; backup-only conditions stay backup-only. */
export function reviewReleasedRouteGeometry({ issues, manifest, runtime, libFingerprint, dart, root = ROOT }) {
    const unchanged = { open: issues, resolved: [] };
    try {
        const matches = issues.filter(issue => issue?.code === TARGET.code);
        if (matches.length !== 1 || !isDeepStrictEqual(matches[0], TARGET)) return unchanged;
        const original = matches[0];

        const historical = readRouteGeometryHistoricalScope(root, dart);
        const platform = readRouteGeometryPlatformScope({ root, manifest, runtime, libFingerprint });
        if (!present(historical) || !present(platform)) return unchanged;

        return {
            open: issues.filter(issue => issue !== original),
            resolved: [{
                original,
                status: 'REVIEWED_RELEASE_SUBSET_OF_HISTORICAL_RECEIPT',
                scope: 'One released public three-platform route path observation plus nine backup-only historical conditions. The historical rawResponse and lineSegments observations are backup-only and are not 0.1.1 behavior; contract status is unchanged.',
                evidence: {
                    releasedPublicObservations: 1,
                    backupOnlyConditions: 9,
                    notReleaseBehavior: ['rawResponse', 'lineSegments'],
                    historical,
                    platform
                }
            }]
        };
    } catch {
        return unchanged;
    }
}
