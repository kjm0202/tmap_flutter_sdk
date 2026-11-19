// Exercise the historical drawing adapter only when an actual handler is installed.
export async function probeDrawingPointers(page, available) {
  if (!available) return [{id:'Drawing.pointer.generic-adapter',contract:'Tmapv3.extension.Drawing',
    environment:'chrome-real-mouse',comparison:'unmeasured',status:'unresolved-unavailable-wrapper',wrapper:'generic extension dispatch',
    scope:'Pointer comparisons through the generic adapter were not run; this does not establish absence of a public drawing API.'}];
  const rows=[];
  for (const mode of ['Circle','Rectangle','Polyline','Polygon']) {
    const row={id:'Drawing.pointer.'+mode,contract:'Tmapv3.extension.Drawing#draw'+mode,environment:'chrome-real-mouse',comparison:'expected-literal',expected:{count:1,finished:true},scope:'Real pointer exercise; count and completion compared with expected literals.'};
    try {
      await page.evaluate(mode => window.__auditExtension(window.__auditMap,'Drawing','draw'+mode,{}), mode);
      await page.mouse.move(250,250);
      if (mode === 'Circle' || mode === 'Rectangle') {
        await page.mouse.down(); await page.mouse.move(350,350,{steps:10}); await page.mouse.up();
      } else {
        await page.mouse.click(250,250); await page.mouse.click(350,250);
        await page.mouse.click(350,350); await page.mouse.click(350,350,{button:'right'});
      }
      await page.waitForTimeout(200);
      row.actual = await page.evaluate(mode => {
        const map=window.__auditMap;
        const shapes=JSON.parse(window.__auditExtension(map,'Drawing','get'+(mode==='Polyline'?'Polylines':mode+'s'),{})).value;
        return {count:shapes.length,finished:JSON.parse(window.__auditExtension(map,'Drawing','isFinish',{})).value,shapes};
      },mode);
      row.status=row.actual.count===1&&row.actual.finished?'sample-match':'difference';
    } catch(e) { row.status='unresolved-exception'; row.error=String(e?.message ?? e); }
    finally {
      try {await page.evaluate(()=>window.__auditExtension(window.__auditMap,'Drawing','clear',{}));}
      catch(e) {row.cleanupError=String(e?.message ?? e); if(row.status==='sample-match') row.status='unresolved-exception';}
    }
    rows.push(row);
  }
  return rows;
}

