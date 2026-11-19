import {getterExecutionBindings} from './getter_execution_bindings.mjs';
const base=['example/integration_test/getter_contracts.dart','example/integration_test/getter_contract_inputs.dart','tool/sdk_audit/getter_probe.mjs','tool/sdk_audit/getter_inputs.json'];
const specific={
 numeric:[],clone:[],'immutable-setter':[],
 center:['example/integration_test/latlngbounds_center_contracts.dart','tool/sdk_audit/latlngbounds_center_probe.mjs'],
 northwest:['example/integration_test/latlngbounds_corner_contracts.dart','tool/sdk_audit/latlngbounds_corner_probe.mjs'],
 northeast:['example/integration_test/latlngbounds_northeast_contracts.dart','tool/sdk_audit/latlngbounds_northeast_probe.mjs'],
 equals:['example/integration_test/geometry_equals_contracts.dart','example/integration_test/geographic_equals_contracts.dart','tool/sdk_audit/point_size_equals_probe.mjs','tool/sdk_audit/geographic_equals_probe.mjs'],
 'bounds-is-empty':['example/integration_test/sdk_latlngbounds_state_contracts.dart','tool/sdk_audit/sdk_latlngbounds_state_probe.mjs'],
};
export function executionBindingsCover(reviews,bindings=getterExecutionBindings){
 if(!Array.isArray(reviews)||!Array.isArray(bindings))return false;
 return reviews.every(review=>{
  const variant=review?.variant??'numeric';
  if(!Object.hasOwn(specific,variant))return false;
  return [...base,...specific[variant]].every(file=>{
   const matches=bindings.filter(b=>b?.file===file);
   return matches.length===1&&/^[a-f0-9]{64}$/.test(matches[0].sha256);
  });
 });
}
