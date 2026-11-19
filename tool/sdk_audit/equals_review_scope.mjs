import {sha} from './common.mjs';
const canonical={
  "Tmapv3.base.Point#equals": {
    "keys": [
      "contract",
      "variant",
      "sdkBodySha256",
      "sdkEvidence",
      "dartFile",
      "dartMember",
      "dartSignature",
      "dartStatement",
      "scope",
      "dimensions",
      "priorReportSearch",
      "casesPerGetter",
      "rowSourceHash",
      "documentation",
      "sourceReviewHash",
      "sdkDependencies",
      "dartDependencies",
      "unresolvedReturn"
    ],
    "digest": "deb600eb175a21a8a82f40aba1992b1c4673c0c6b677351a65821e85891d020a"
  },
  "Tmapv3.base.Size#equals": {
    "keys": [
      "contract",
      "variant",
      "sdkBodySha256",
      "sdkEvidence",
      "dartFile",
      "dartMember",
      "dartSignature",
      "dartStatement",
      "scope",
      "dimensions",
      "priorReportSearch",
      "casesPerGetter",
      "rowSourceHash",
      "documentation",
      "sourceReviewHash",
      "sdkDependencies",
      "dartDependencies",
      "unresolvedReturn"
    ],
    "digest": "98e0d02565404b29f748619ae2a5c2df82514b4cf0a654cf7b8587e51713667c"
  },
  "Tmapv3.base.LatLng#equals": {
    "keys": [
      "contract",
      "variant",
      "sdkBodySha256",
      "sdkEvidence",
      "dartFile",
      "dartMember",
      "dartSignature",
      "dartStatement",
      "scope",
      "dimensions",
      "priorReportSearch",
      "casesPerGetter",
      "rowSourceHash",
      "documentation",
      "sourceReviewHash",
      "sdkDependencies",
      "dartDependencies",
      "unresolvedReturn"
    ],
    "digest": "70662f9860ac8a59d51fbae9f89d1abf75618cd6bb78a0310cad25ea862be781"
  },
  "Tmapv3.base.LatLngBounds#equals": {
    "keys": [
      "contract",
      "variant",
      "sdkBodySha256",
      "sdkEvidence",
      "dartFile",
      "dartMember",
      "dartSignature",
      "dartStatement",
      "scope",
      "dimensions",
      "priorReportSearch",
      "casesPerGetter",
      "rowSourceHash",
      "documentation",
      "sourceReviewHash",
      "sdkDependencies",
      "dartDependencies",
      "unresolvedReturn"
    ],
    "digest": "501697e98a1ed7babc5727ca5146c12901c9672bdf5426a9563c662e2c246cfd"
  }
};
export const equalsContracts=Object.freeze(Object.keys(canonical));
export function validEqualsReview(review){const c=canonical[review?.contract];return !!c && sha(JSON.stringify(Object.fromEntries(c.keys.map(k=>[k,review[k]]))))===c.digest;}
