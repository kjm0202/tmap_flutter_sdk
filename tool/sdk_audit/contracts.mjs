import {validEventNameAdaptation,eventNameContracts} from './event_names_verification.mjs';
import {validFiniteConstantAdaptations,finiteConstantContracts} from './finite_constants_verification.mjs';
import {validSdkEventGetterContractProofs,sdkEventGetterContracts} from './sdk_event_getter_contract_proof.mjs';
import {validSdkHtmlNativeContractProofs,htmlNativeAdaptationContracts} from './html_native_contract_proof.mjs';
import {validSdkUtilitiesNativeContractProofs} from './utilities_native_contract_proof.mjs';
import {utilitiesNativeAdaptationContracts} from './sdk_utilities_native_adaptation_verification.mjs';
import {validSdkProjectionFacetContractProofs} from './projection_facet_contract_proof.mjs';
import {projectionFacetContracts} from './sdk_projection_facet_adaptation_verification.mjs';
import {validSdkNativeEnvironmentContractProofs} from './native_environment_contract_proof.mjs';
import {nativeEnvironmentAdaptationContracts} from './sdk_native_environment_adaptation_verification.mjs';
import {validBoundsDimensionsAdaptation,boundsDimensionsContracts} from './bounds_dimensions_verification.mjs';
import {validSdkBoundsIsEmptyRow,sdkBoundsIsEmptyContract} from './sdkbounds_isempty_scope.mjs';
import {validNortheastReview} from './northeast_review_scope.mjs';
import {validNorthwestReview,northwestContract,cornerProtectedContracts} from './northwest_review_scope.mjs';
import {validDocumentationMismatch} from './documentation_mismatches.mjs';
import {validEqualsReview,equalsContracts} from './equals_review_scope.mjs';
import {validCenterReview,centerReviewScope} from './center_review_scope.mjs';
import {pointSetterScope,pointSetterDimensions,pointSetterBindings} from './point_setter_scope.mjs';
import {validInternalReview} from './scope_reviews.mjs';
import {validReferenceReview} from './reference_scope_reviews.mjs';
import {currentReferenceValidator} from './current_reference_scope.mjs';
import {sha, counts} from './common.mjs';
import { getHistoricalEvidence, loadComparisons } from './model-sample.mjs';

export const dimensions = ['inputs-defaults', 'returns-types', 'mutation-identity', 'errors', 'lifecycle-events', 'dispatch'];
export const platforms = ['web', 'android', 'ios'];

export const canonicalDimensions = [
  'options/defaults',
  'signature',
  'return',
  'error',
  'mutation',
  'event trigger/payload',
  'detach/reattach',
];

export const allGranularStatuses = [
  'unimplemented',
  'partial',
  'unverified',
  'verified',
  'intentional difference',
  'not applicable',
  'source mismatch',
];

export function validAdaptationProof(row, report, finiteProofs, eventGetterProofs, htmlNativeProofs, utilitiesNativeProofs, projectionFacetProofs, nativeEnvironmentProofs) {
 if(finiteConstantContracts.includes(row?.id))return !!(finiteProofs??validFiniteConstantAdaptations(report))[row.id];
 if(sdkEventGetterContracts.includes(row?.id))return !!(eventGetterProofs??validSdkEventGetterContractProofs(report))[row.id];
 if(htmlNativeAdaptationContracts.includes(row?.id))return !!(htmlNativeProofs??validSdkHtmlNativeContractProofs(report))[row.id];
 if(utilitiesNativeAdaptationContracts.includes(row?.id))return !!(utilitiesNativeProofs??validSdkUtilitiesNativeContractProofs(report))[row.id];
 if(projectionFacetContracts.includes(row?.id))return !!(projectionFacetProofs??validSdkProjectionFacetContractProofs(report))[row.id];
 if(nativeEnvironmentAdaptationContracts.includes(row?.id))return !!(nativeEnvironmentProofs??validSdkNativeEnvironmentContractProofs(report))[row.id];
 if(validEventNameAdaptation(row,report))return true;
 if(validBoundsDimensionsAdaptation(row,report))return true;
 const proof=row.verification,review=proof?.sourceReview;
 const boundsMethods={'Tmapv3.base.Bounds#setLeft':'Bounds.withLeft','Tmapv3.base.Bounds#setTop':'Bounds.withTop','Tmapv3.base.Bounds#setWidth':'Bounds.withWidth','Tmapv3.base.Bounds#setHeight':'Bounds.withHeight'};
 const pointMethods={'Tmapv3.base.Point#setX':['Point.withX',1,100],'Tmapv3.base.Point#setY':['Point.withY',1,100],'Tmapv3.base.Point#setValue':['Point.withValue',2,1000]};
 const point=pointMethods[row.id];
 const supportedVariant=(review?.variant==='immutable-setter'&&review.contract===row.id&&boundsMethods[row.id]===review.dartMember&&!!boundsMethods[row.id]&&review.casesPerGetter===100)||
  (review?.variant==='immutable-point-setter'&&review.contract===row.id&&point&&
  review.dartMember===point[0]&&review.arity===point[1]&&review.casesPerPlatform===point[2]&&
  proof.scope===pointSetterScope&&review.scope===pointSetterScope&&['fixture','probe','inputs'].every(k=>review[k]?.file===pointSetterBindings[k].file&&review[k]?.sha256===pointSetterBindings[k].sha256)&&dimensions.every(d=>review.dimensions?.[d]===pointSetterDimensions[d]));
 return !row.proofProblems?.length&&row.status==='reviewed-adaptation'&&proof?.baselineId===report.baselineId&&proof.libSha256===report.libFingerprint?.sha256&&
  supportedVariant&&!!review.sdkBodySha256&&!!review.dartFileSha256&&!!review.adaptation?.native&&!!review.adaptation?.dart&&!!review.adaptation?.rationale&&
  !!review.priorReportSearch?.filesSearched?.length&&!!row.evidence?.length&&row.scope==='documented'&&
  platforms.every(p=>row.platforms?.[p]==='verified'&&dimensions.every(d=>{
   const ids=proof.platforms?.[p]?.[d];
   return Array.isArray(ids)&&ids.length>0&&ids.every(id=>report.observations?.some(o=>o.id===id&&o.contract===row.id&&o.platform===p&&o.status==='adaptation-match'&&o.dimensions?.includes(d)));
  }));
}

function getDimensionApplicability(row, dim) {
  const kinds = row.kinds || [];
  const id = row.id || '';
  const owner = row.owner || '';

  switch (dim) {
    case 'options/defaults': {
      if (kinds.includes('constant') || kinds.includes('property') || kinds.includes('field') || id.endsWith('->return')) {
        return { applicable: false, reason: 'Property or constant does not take parameter options or default arguments.' };
      }
      return { applicable: true, reason: 'Callable constructor or method accepts arguments/options dictionary.' };
    }
    case 'signature': {
      return { applicable: true, reason: 'Applicable to all public API symbols to enforce arity, parameter typing, and return specification.' };
    }
    case 'return': {
      if (kinds.includes('setter')) {
        return { applicable: false, reason: 'Setter method does not return a value (void).' };
      }
      return { applicable: true, reason: 'Callable or property accessor returns a typed result, completion Promise, or value.' };
    }
    case 'error': {
      if (kinds.includes('constant')) {
        return { applicable: false, reason: 'Static constant property access does not produce runtime errors.' };
      }
      return { applicable: true, reason: 'Operation specifies parameter validation, bounds checking, or async error callbacks.' };
    }
    case 'mutation': {
      if (['Tmapv3.Point', 'Tmapv3.Size', 'Tmapv3.LatLng', 'Tmapv3.LatLngBounds'].some(c => id.startsWith(c))) {
        return { applicable: true, reason: 'Value object semantics: immutable in Flutter SDK; JS in-place mutations require adaptation.' };
      }
      if (id.includes('#set') || id.includes('.set') || ['Map', 'Marker', 'Polyline', 'Polygon', 'Circle', 'Rectangle', 'InfoWindow'].some(c => id.includes(c))) {
        return { applicable: true, reason: 'Operation modifies internal receiver state, visual rendering, or container cache.' };
      }
      if (kinds.includes('getter') || kinds.includes('constant')) {
        return { applicable: false, reason: 'Pure accessor or constant evaluation has no side effects on instance state.' };
      }
      return { applicable: true, reason: 'Method execution may alter instance or environment state.' };
    }
    case 'event trigger/payload': {
      if (['Map', 'Marker', 'InfoWindow', 'Drawing', 'Clusterer'].some(c => id.includes(c)) || id.includes('event') || id.includes('on') || id.includes('addListener')) {
        return { applicable: true, reason: 'Map, overlay or event subsystem dispatches asynchronous event triggers and payloads.' };
      }
      return { applicable: false, reason: 'Data structure or computational API has no asynchronous event emission lifecycle.' };
    }
    case 'detach/reattach': {
      if (['Map', 'Marker', 'Polyline', 'Polygon', 'Circle', 'Rectangle', 'InfoWindow', 'GroundOverlay', 'Clusterer'].some(c => id.includes(c)) || id.includes('destroy') || id.includes('remove') || id.includes('setMap')) {
        return { applicable: true, reason: 'Visual or lifecycle component attaches to and detaches from map canvas or container DOM.' };
      }
      return { applicable: false, reason: 'Non-visual data model or static utility does not attach to map or DOM hierarchy.' };
    }
    default:
      return { applicable: true, reason: 'General behavioral contract dimension.' };
  }
}

export function buildContractDimensions(row, contractItem, report) {
  const candidates = row.dartCandidates || [];
  const observations = row.observations || [];
  const boundedObs = row.boundedPlatformObservations || [];
  const hasCandidates = candidates.length > 0;
  const docsMismatch = !!contractItem.documentationMismatch;
  const isAdapted = contractItem.status === 'REVIEWED_ADAPTATION';
  const isVerified = contractItem.status === 'VERIFIED';
  const isDiv = row.id === 'Tmapv3.Map#getDiv';

  return canonicalDimensions.map((dim) => {
    const { applicable, reason } = contractItem.referenceScopeReview?.reviewType === 'current-navigation-reference-only'
      ? {applicable:false, reason:'Linked REST table metadata is not a named JS member; REST field and service behavior remain UNVERIFIED.'}
      : getDimensionApplicability(row, dim);
    const dimId = `${row.id}::${dim}`;

    const platformStatus = {};
    for (const p of platforms) {
      if (!applicable) {
        platformStatus[p] = { counterpart: null, evidence: null, status: 'not applicable' };
      } else if (docsMismatch) {
        platformStatus[p] = { counterpart: candidates[0]?.id || null, evidence: null, status: 'source mismatch' };
      } else if (!hasCandidates) {
        platformStatus[p] = { counterpart: null, evidence: null, status: 'unimplemented' };
      } else if (isDiv) {
        platformStatus[p] = {
          counterpart: candidates[0]?.id || null,
          evidence: null,
          status: p === 'web' ? 'unverified' : 'intentional difference',
        };
      } else if (isAdapted) {
        platformStatus[p] = {
          counterpart: contractItem.verifiedDartMember || candidates[0]?.id || null,
          evidence: observations.find((o) => o.platform === p) || null,
          status: 'intentional difference',
        };
      } else if (isVerified && row.platforms?.[p] === 'verified') {
        platformStatus[p] = {
          counterpart: contractItem.verifiedDartMember || candidates[0]?.id || null,
          evidence: observations.find((o) => o.platform === p) || null,
          status: 'verified',
        };
      } else {
        const hasEvidence =
          observations.some((o) => o.platform === p) ||
          boundedObs.some((o) => o.platforms?.[p]);
        platformStatus[p] = {
          counterpart: candidates[0]?.id || null,
          evidence: observations.find((o) => o.platform === p) || null,
          status: hasEvidence ? 'partial' : 'unverified',
        };
      }
    }

    let status = 'unverified';
    if (!applicable) {
      status = 'not applicable';
    } else if (docsMismatch) {
      status = 'source mismatch';
    } else if (!hasCandidates) {
      status = 'unimplemented';
    } else if (isDiv || isAdapted) {
      status = 'intentional difference';
    } else if (isVerified && platforms.every((p) => platformStatus[p].status === 'verified')) {
      status = 'verified';
    } else if (platforms.some((p) => ['partial', 'verified', 'intentional difference'].includes(platformStatus[p].status))) {
      status = 'partial';
    } else {
      status = 'unverified';
    }

    return {
      id: `${contractItem.id}::${dim}`,
      dimensionId: dimId,
      contractId: contractItem.id,
      api: row.id,
      dimension: dim,
      applicable,
      applicabilityReason: reason,
      source: row.evidence || [],
      platforms: platformStatus,
      status,
    };
  });
}

// Every inventory row remains addressable; no internal/public or N/A inference
// is made from names, documentation absence, or one passing sample.
export function contractWorklist(report, referenceValidator = currentReferenceValidator(report)) {
 const comparisons = loadComparisons(report);
 const finiteProofs=validFiniteConstantAdaptations(report);
 const eventGetterProofs=validSdkEventGetterContractProofs(report);
 const htmlNativeProofs=validSdkHtmlNativeContractProofs(report);
 const utilitiesNativeProofs=validSdkUtilitiesNativeContractProofs(report);
 const projectionFacetProofs=validSdkProjectionFacetContractProofs(report);
 const nativeEnvironmentProofs=validSdkNativeEnvironmentContractProofs(report);
 const items=report.rows.map(row=>{
  const docsMismatch=validDocumentationMismatch(row,report);
   const historicalEvidence = getHistoricalEvidence(row, comparisons);
  const internal=validInternalReview(row,report);
  const referenceOnly=referenceValidator(row)||validReferenceReview(row,report);
  const adapted=validAdaptationProof(row,report,finiteProofs,eventGetterProofs,htmlNativeProofs,utilitiesNativeProofs,projectionFacetProofs,nativeEnvironmentProofs);
  const proof=row.verification;
  const bound=!!proof&&!!report.baselineId&&!!report.libFingerprint?.sha256&&proof.baselineId===report.baselineId && proof?.libSha256===report.libFingerprint?.sha256;
  const missing={};
  for(const platform of platforms) missing[platform]=(internal||referenceOnly)?[]:dimensions.filter(dimension=>{
   const refs=bound && proof.platforms?.[platform]?.[dimension];
   return !Array.isArray(refs)||!refs.length||refs.some(id=>!report.observations?.some(o=>o.id===id && o.contract===row.id && o.platform===platform && o.status===(adapted?'adaptation-match':'sample-match') && o.dimensions?.includes(dimension)));
  });
  const scopeReview=['undocumented-review-required','engine-export-review-required'].includes(row.scope);
  const centerRequired=[centerReviewScope.contract,centerReviewScope.contract+'->return'].includes(row.id);
  const centerAllowed=(!centerRequired&&proof?.sourceReview?.variant!=='center')||(validCenterReview(proof?.sourceReview)&&proof.scope===proof.sourceReview.scope&&[proof.sourceReview.contract,proof.sourceReview.contract+'->return'].includes(row.id));
  const equalsRequired=equalsContracts.some(id=>row.id===id||row.id===id+'->return');
  const equalsAllowed=(!equalsRequired&&proof?.sourceReview?.variant!=='equals')||(validEqualsReview(proof?.sourceReview)&&proof.scope===proof.sourceReview.scope&&row.id===proof.sourceReview.contract);
  const cornerRequired=cornerProtectedContracts.includes(row.id);
  const cornerAllowed=(!cornerRequired&&proof?.sourceReview?.variant!=='northwest')||(validNorthwestReview(proof?.sourceReview)&&proof.scope===proof.sourceReview.scope&&[northwestContract,northwestContract+'->return'].includes(row.id));
  const neIds=['Tmapv3.base.LatLngBounds#getNorthEast','Tmapv3.base.LatLngBounds#getNorthEast->return'];
  const northeastAllowed=(!neIds.includes(row.id)&&proof?.sourceReview?.variant!=='northeast')||(validNortheastReview(proof?.sourceReview)&&proof.scope===proof.sourceReview.scope&&neIds.includes(row.id));
  const stateIds=[sdkBoundsIsEmptyContract,sdkBoundsIsEmptyContract+'->return'];
  const stateAllowed=(!stateIds.includes(row.id)&&proof?.sourceReview?.variant!=='bounds-is-empty')||validSdkBoundsIsEmptyRow(row,report);
  const dimensionsProtected=boundsDimensionsContracts.some(id=>row.id===id||row.id===id+'->return');
  const eventGetterProtected=sdkEventGetterContracts.some(id=>row.id===id||row.id.startsWith(id+'->')||row.id.startsWith(id+':'));
  const nativeDelegateProtected=htmlNativeAdaptationContracts.includes(row.id)||utilitiesNativeAdaptationContracts.includes(row.id)||projectionFacetContracts.includes(row.id)||nativeEnvironmentAdaptationContracts.includes(row.id);
  const verified=!eventNameContracts.includes(row.id)&&!finiteConstantContracts.includes(row.id)&&!eventGetterProtected&&!nativeDelegateProtected&&!dimensionsProtected&&stateAllowed&&northeastAllowed&&cornerAllowed&&equalsAllowed&&centerAllowed&&!row.proofProblems?.length&&row.status==='verified' && platforms.every(p=>row.platforms?.[p]==='verified' && !missing[p].length) && row.evidence?.length>0 && !scopeReview;

  const contractItem = {
    id:'U111-'+sha(row.id).slice(0,16),
    api:row.id,
    sourceNames:row.sourceNames||[row.id],
    owner:row.owner,
    scope:row.scope,
    status:referenceOnly?'REVIEWED_REFERENCE_ONLY':internal?'REVIEWED_INTERNAL_STATE':adapted?'REVIEWED_ADAPTATION':verified?'VERIFIED':'OPEN',
    independentReferenceStatus:referenceOnly?'UNVERIFIED':null,
    scopeReviewRequired:scopeReview&&!internal&&!referenceOnly&&!adapted,
    scopeReview:row.scopeReview||null,
    referenceScopeReview:referenceOnly?row.referenceScopeReview:null,
    adaptation:adapted?proof.sourceReview.adaptation:null,
    candidates:row.dartCandidates?.map(c=>c.id)||[],
    sourceEvidence:row.evidence,
    ...(historicalEvidence ? {historicalEvidence} : {}),
    missing,
    documentationMismatch:docsMismatch?row.documentationMismatch:null,
    proofProblems:row.proofProblems||[],
    verificationScope:row.verification?.scope||null,
    verifiedDartMember:row.verification?.sourceReview?.dartMember||null,
    observations:row.observations||[],
    bridgeObservations:row.bridgeObservations||[],
    boundedPlatformObservations:row.boundedPlatformObservations||[],
    nextAction:referenceOnly?'Reference retained outside the named endpoint-specific JS SDK wrapper scope. Independent REST service verification remains UNVERIFIED; generic SDK network contracts remain separately OPEN.':docsMismatch?'Pinned documentation conflicts with the source-reviewed equality behavior. Original declaration and missing dimensions remain OPEN; see the linked parent scope.':adapted?'Source-reviewed typed adaptation is validated within its stated scope; inspect the recorded differences. Reopen on changed source or execution evidence.':internal?'No separate Flutter operation is required for reviewed SDK storage. Reopen on changed source evidence.':scopeReview?'Trace public exposure and prior reports before scope adjudication.':!row.dartCandidates?.length?'Inspect implementation and source; implement actual missing behavior or record a source-bound difference.':'Execute missing dimensions on each platform; record differences and regression coverage.'
  };

  const dims = buildContractDimensions(row, contractItem, report);
  contractItem.dimensions = dims;
  contractItem.dimensionIds = dims.map(d => d.dimensionId);

  // Compute granular status from dimensions & row facts
  if (contractItem.referenceScopeReview?.reviewType === 'current-navigation-reference-only') {
    contractItem.granularStatus = 'not applicable';
  } else if (docsMismatch) {
    contractItem.granularStatus = 'source mismatch';
  } else if (row.id === 'Tmapv3.Map#getDiv' || adapted) {
    contractItem.granularStatus = 'intentional difference';
  } else if (verified) {
    contractItem.granularStatus = 'verified';
  } else if (!row.dartCandidates?.length) {
    contractItem.granularStatus = 'unimplemented';
  } else if (dims.every(d => d.status === 'not applicable')) {
    contractItem.granularStatus = 'not applicable';
  } else if (dims.some(d => ['partial', 'verified', 'intentional difference'].includes(d.status))) {
    contractItem.granularStatus = 'partial';
  } else {
    contractItem.granularStatus = 'unverified';
  }

  return contractItem;
 });

 const allDims = items.flatMap(i => i.dimensions || []);
 const aliasIndex=Object.entries(report.exactEventNameAliases||{}).map(([api,canonicalApi])=>({id:'U111-'+sha(api).slice(0,16),api,canonicalId:'U111-'+sha(canonicalApi).slice(0,16),canonicalApi,status:'ALIAS_OF',scope:'Source- and runtime-identity-proven duplicate; no support or event behavior claim.'}));

 return {
   schemaVersion:1,
   aliasIndex,
   parent:'U111',
   baselineId:report.baselineId,
   libSha256:report.libFingerprint?.sha256,
   status:items.length>0 && items.every(i=>i.status!=='OPEN')?'COMPLETE':'INCOMPLETE',
   summary:{
     items:items.length,
     aliasIdsRetained:aliasIndex.length,
     independentReferenceUnverified:items.filter(i=>i.independentReferenceStatus==='UNVERIFIED').length,
     documentationMismatches:items.filter(i=>i.documentationMismatch).length,
     statuses:counts(items,'status'),
     granularStatuses:counts(items,'granularStatus'),
     dimensionStatuses:counts(allDims,'status'),
     scopes:counts(items,'scope')
   },
   items
 };
}

export function contractDimensions(report) {
  const work = contractWorklist(report);
  return (work.items || []).flatMap(i => i.dimensions || []);
}

export function renderContractWorklist(work) {
 return [
   '# U111 API별 검증 작업 목록',
   '',
   '각 ID는 API 식별자에서 생성하므로 재실행해도 유지된다. OPEN은 기능 누락 확정이 아니라 근거 미충족을 뜻한다. 원본 근거·대응 후보·플랫폼별 누락 차원은 contracts.json에 보존한다. REVIEWED_REFERENCE_ONLY는 명명된 SDK 서비스 wrapper 밖의 참조 자료이며 해당 REST 서비스 검증은 UNVERIFIED다. 플랫폼 차원 0은 이 범위에서 적용 대상이 아니라는 뜻이며 성공 검증을 뜻하지 않는다.',
   '',
   `상태: ${work.status} · ${work.items.length}개 항목`,
   `별도 REST 참조 필드: ${work.restReferenceFieldSummary?.total || 0}개 (모두 미검증; 상세 및 모호성은 contracts.json 참조).`,
   '',
   '| ID | API | 범위 | 상태 | 상세 분류 | 검증된 Dart API | Web/Android/iOS 미충족 차원 수 |',
   '| --- | --- | --- | --- | --- | --- | --- |',
   ...work.items.map(i=>`| ${i.id} | ${i.api.replaceAll('|','\\|')} | ${i.scope} | ${i.status} | ${i.granularStatus || i.status} | ${i.verifiedDartMember||''} | ${platforms.map(p=>i.missing[p].length).join('/')} |`),
   '',
   '## 원본 별칭 ID 보존',
   '',
   '동일 객체라는 원문·런타임 근거로 중복만 합쳤다. 아래 관계는 기능 검증 완료가 아니며 정규 ID의 판정을 따른다.',
   '',
   '| 원본 ID | 원본 API | 정규 ID |',
   '| --- | --- | --- |',
   ...(work.aliasIndex||[]).map(a=>`| ${a.id} | ${a.api} | ${a.canonicalId} |`),
   ''
 ].join('\n');
}
