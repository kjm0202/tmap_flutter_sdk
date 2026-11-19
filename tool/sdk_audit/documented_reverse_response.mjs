import { load } from "cheerio";

export function extractDocumentedReverseResponse(sources) {
  const rows = [];
  const rs = sources.find(s => s.kind === 'reference' && s.url === 'https://tmapapi.tmapmobility.com/webservice/docs/reverseGeocoding.html');
  const ws = sources.find(s => s.kind === 'document' && s.url === 'https://tmapapi.tmapmobility.com/webv3VSM/docs/WebDocs.html');
  if (!rs || !ws) return rows;
  
  // Find method anchor from documentation
  let parentId = null;
  let linkLine = 0;
  const $doc = load(ws.text, { sourceCodeLocationInfo: true });
  
  let currentClass = '';
  let currentAnchor = '';
  
  $doc('h2,h4[id],a[href]').each((i, el) => {
    const $el = $doc(el);
    if ($el.is('h2')) {
        currentClass = $el.text().trim();
        currentAnchor = '';
    } else if ($el.is('h4[id]')) {
        currentAnchor = $el.attr('id');
    } else if ($el.is('a[href="#webservice/docs/reverseGeocoding"]')) {
        if (currentClass === 'Tmapv3.Tdata' && currentAnchor === 'Tdata_getAddressFromGeoJson') {
            parentId = 'Tmapv3.Tdata#' + currentAnchor.split('_').slice(1).join('_');
            linkLine = $el[0].sourceCodeLocation?.startLine ?? 0;
            return false; // Break the each loop
        }
    }
  });
  
  if (!parentId) return [];

  const $rest = load(rs.text, { sourceCodeLocationInfo: true });
  
  // Requirement 3: Use application/json table under nearest preceding sibling div.li_title with trim exactly Response Sample code:
  // Requirement 2: Under official 'Response Parameter' title require selected table exists and its first header row's normalized direct cells exactly ['Name','Date Type','Mandatory','Example','Description']
  
  const schemaTitle = $rest('div.li_title').filter((i, el) => $rest(el).text().trim() === 'Response Parameter').first();
  const schemaTable = schemaTitle.next('div.table01').find('table').first();
  
  const headers = schemaTable.find('tr').first().find('td,th').map((i, el) => $rest(el).text().trim()).get();
  if (JSON.stringify(headers) !== JSON.stringify(['Name', 'Date Type', 'Mandatory', 'Example', 'Description'])) {
      return [];
  }

  // Requirement 3: Use application/json table under nearest preceding sibling div.li_title with trim exactly Response Sample code
  const sampleTables = $rest('table').filter((i, el) => {
    const th = $rest(el).find('th').first();
    if (th.text().trim() !== 'Code type : application/json') return false;
    
    const container = $rest(el).closest('div.table01');
    const prevTitle = container.prevAll('div.li_title').first();
    return prevTitle.text().trim() === 'Response Sample code';
  });

  if (sampleTables.length !== 1) return []; // Require exactly one matching table
  
  const samplePre = sampleTables.find('pre');
  if (samplePre.length !== 1) return []; // Require exactly one matching pre
  
  const samplePreLine = samplePre[0].sourceCodeLocation?.startLine ?? 0;
  
  if (!schemaTable || !samplePre) {
      return rows;
  }
  
  const stack = [];
  const formal = {};
  
  $rest(schemaTable).find('tr').slice(1).each((i, tr) => {
    const cells = $rest(tr).find('td,th').toArray();
    const paddingCellsCount = cells.length - 5;
    
    if (paddingCellsCount < 1) return; // Ignore malformed
    
    // Check if preceding padding cells are empty
    for (let j = 0; j < paddingCellsCount; j++) {
        if ($rest(cells[j]).text().trim() !== '') return; // Reject/ignore
    }
    
    const dataCells = cells.slice(-5);
    const name = $rest(dataCells[0]).text().trim();
    if (!name) return; // Only process rows with a name
    
    const depth = paddingCellsCount - 1;
    if (depth > stack.length) return; // Reject/ignore
    
    stack.splice(depth);
    stack.push(name);
    
    const path = stack.join('.');
    formal[path] = {
      type: $rest(dataCells[1]).text().trim(),
      mandatory: $rest(dataCells[2]).text().trim(),
      line: dataCells[0].sourceCodeLocation?.startLine ?? 0
    };
  });
  
  const examples = {};
  try {
    const obj = JSON.parse(samplePre.text());
    
    function walk(o, p = '') {
      if (typeof o === 'object' && o !== null) {
        for (const [k, v] of Object.entries(o)) {
          const path = p ? p + '.' + k : k;
          // Requirement 1: Sample actual JS null must classify as 'null'
          if (v === null) {
            examples[path] = 'null';
          } else {
            examples[path] = Array.isArray(v) ? 'array' : typeof v;
          }
          walk(v, path);
        }
      }
    }
    walk(obj);
  } catch (e) {
    return [];
  }
  
  const restResponseBaseId = parentId + '->restResponse';
  const acceptedPaths = new Set();
  
  for (const path of Object.keys(formal)) {
      // Requirement 1: if expected type missing, reject.
      // Normalize types
      let expectedType = ({Node:'object',String:'string',Number:'number',Boolean:'boolean'})[formal[path].type] || formal[path].type.toLowerCase();
      

      if (examples[path] !== expectedType) continue;
      
      // Require parent path if any has already been accepted in matched set
      const parts = path.split('.');
      if (parts.length > 1) {
          const parentPath = parts.slice(0, -1).join('.');
          if (!acceptedPaths.has(parentPath)) continue;
      }
      acceptedPaths.add(path);
      
      let fieldParentId;
      if (parts.length === 1) {
        fieldParentId = parentId;
      } else {
        fieldParentId = restResponseBaseId + '.' + parts.slice(0, -1).join('.');
      }
      
      const ev = [];
      ev.push({ channel: 'docs', source: rs.url, sha256: rs.sha256, line: formal[path].line });
      ev.push({ channel: 'docs', source: rs.url, sha256: rs.sha256, line: samplePreLine });
      if (ws) {
          ev.push({ channel: 'docs', source: ws.url, sha256: ws.sha256, line: linkLine }); 
      }
      
      // Requirement 4: Returned row must include kind:'documented-response-field', full path member 'path'
      rows.push({
        kind: 'documented-response-field',
        path: path,
        id: restResponseBaseId + '.' + path,
        name: parts[parts.length - 1],
        type: formal[path].type,
        parentId: fieldParentId,
        observedSampleType: examples[path],
        contract: `${formal[path].type} / ${restResponseBaseId}.${path}`,
        evidence: ev
      });
  }
  
  return rows;
}
