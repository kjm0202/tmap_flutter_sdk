// Run only after the SDK bytes have been independently pinned. Numeric rows
// correspond to geometry_equals_contracts.dart, but are native observations;
// extras deliberately describe JS-only behavior outside the typed Dart scope.
export function probePointSizeEquals(inputs) {
  const decode = v => typeof v === 'number' ? v : ({'-0':-0,NaN:NaN,Infinity:Infinity,'-Infinity':-Infinity})[v.special];
  const encode = v => v === undefined ? {special:'undefined'} : Number.isNaN(v) ? {special:'NaN'} : v === Infinity ? {special:'Infinity'} : v === -Infinity ? {special:'-Infinity'} : Object.is(v,-0) ? {special:'-0'} : v;
  const values=inputs.map(decode), numeric=[], extras=[];
  for (const type of ['Point','Size']) {
    const make = (x,y) => {
      if (type === 'Point') return new Tmapv3.Point(x,y);
      const value=new Tmapv3.Size(0,0);
      value.setSize(x,y); // Size constructor normalizes NaN and signed zero.
      return value;
    };
    const state = obj => (type === 'Point' ? [obj.x,obj.y] : [obj.getWidth(),obj.getHeight()]).map(encode);
    const observe = (suffix,x,y,ox,oy,sameReceiver) => {
      const receiver=make(x,y),other=sameReceiver?receiver:make(ox,oy);
      const row={id:`geometry-equals:${type}:${suffix}`,contract:`Tmapv3.base.${type}#equals`,before:state(receiver),otherBefore:state(other),sameReceiver};
      try {
        row.result=receiver.equals(other);row.repeat=receiver.equals(other);
        row.status='observed';row.after=state(receiver);row.otherAfter=state(other);
      } catch (error) {row.status='threw';row.errorType=error?.name||'Error';row.error=String(error);}
      numeric.push(row);
    };
    for(let a=0;a<values.length;a++) {
      const x=values[a],y=values[(a+3)%values.length];
      for(let b=0;b<values.length;b++)for(let c=0;c<values.length;c++) observe(`distinct:${a}:${b}:${c}`,x,y,values[b],values[c],false);
      observe(`identity:${a}`,x,y,x,y,true);
    }
    const first=type==='Point'?'getX':'getWidth',second=type==='Point'?'getY':'getHeight';
    const add=(id,receiver,arg)=>{
      const calls=[];
      try {
        const other=typeof arg==='function'?arg(calls):arg;
        const result=receiver.equals(other);
        extras.push({id:`geometry-equals:${type}:extra:${id}`,contract:`Tmapv3.base.${type}#equals`,status:'observed',result,calls});
      } catch(error) {extras.push({id:`geometry-equals:${type}:extra:${id}`,contract:`Tmapv3.base.${type}#equals`,status:'threw',errorType:error?.name||'Error',calls});}
    };
    add('duck-string-coercion',make(1,2),calls=>({[first](){calls.push(first);return '1';},[second](){calls.push(second);return '2';}}));
    add('short-circuit',make(1,2),calls=>({[first](){calls.push(first);return 9;},[second](){calls.push(second);throw Error('second getter called');}}));
    add('null',make(1,2),null);
    add('undefined',make(1,2),undefined);
    add('different-class',make(1,2),type==='Point'?new Tmapv3.Size(1,2):new Tmapv3.Point(1,2));
    if(type==='Size') {
      const ctor=new Tmapv3.Size(NaN,-0);
      extras.push({id:'geometry-equals:Size:extra:constructor-normalization',contract:'Tmapv3.base.Size#constructor',state:state(ctor)});
    }
  }
  return {numeric,extras};
}
