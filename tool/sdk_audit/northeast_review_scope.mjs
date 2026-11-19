import {sha} from './common.mjs';
export const northeastContract='Tmapv3.base.LatLngBounds#getNorthEast';
export const northeastProtectedContracts=[northeastContract,northeastContract+'->return'];
const keys=["contract","variant","sdkBodySha256","sdkEvidence","dartFile","dartMember","dartSignature","dartStatement","scope","dimensions","priorReportSearch","casesPerGetter","rowSourceHash","documentation","sourceReviewHash","sdkDependencies","dartDependencies","returnReview"];
const digest='571bead135a9d91f20072ac173542fc903fed56d87da8f89c094820b8eb61ca8';
export function validNortheastReview(review){return !!review&&sha(JSON.stringify(Object.fromEntries(keys.map(k=>[k,review[k]]))))===digest;}
