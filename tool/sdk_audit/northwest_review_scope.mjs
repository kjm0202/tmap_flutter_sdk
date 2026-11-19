import {sha} from './common.mjs';
export const northwestContract='Tmapv3.base.LatLngBounds#getNorthWest';
export const cornerProtectedContracts=[northwestContract,northwestContract+'->return','Tmapv3.base.LatLngBounds#getSouthEast','Tmapv3.base.LatLngBounds#getSouthEast->return'];
const keys=["contract","variant","sdkBodySha256","sdkEvidence","dartFile","dartMember","dartSignature","dartStatement","scope","dimensions","priorReportSearch","casesPerGetter","rowSourceHash","documentation","sourceReviewHash","sdkDependencies","dartDependencies","returnReview"];
const digest='5d9266a87257fe95b506f7ec62a26a09fd47d461f302c6b5f239fd24abe86cc8';
export function validNorthwestReview(review){return !!review&&sha(JSON.stringify(Object.fromEntries(keys.map(k=>[k,review[k]]))))===digest;}
