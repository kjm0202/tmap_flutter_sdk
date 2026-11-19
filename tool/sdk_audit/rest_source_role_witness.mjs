import * as cheerio from 'cheerio';

export function verifyRoleWitness(q, field, fields, bytes) {
    if (q.disposition !== 'source-described-variable-role' && q.disposition !== 'source-described-feature-variant') {
        return false;
    }

    if (field.tableIndex !== q.table) {
        return false;
    }

    const [start, end, sha] = q.witness;
    const content = new TextDecoder().decode(bytes.subarray(start, end));

    if (q.disposition === 'source-described-variable-role') {
        if (!q.namedParent) return false;
        const parent = fields.find(f => f.id === q.namedParent[0]);
        if (!parent) return false;

        if (parent.name !== q.role) return false;

        if (!parent.description?.includes(q.descriptionRole)) return false;
        if (!field.description?.includes(q.descriptionRole)) return false;

        // Navigation
        let value = null;

        // Distinguish JSON vs XML
        if (content.includes('<routesInfo>')) {
             // XML
             const $xml = cheerio.load(content, { xmlMode: true });
             let node = $xml('routesInfo').first();
             if (node.length > 0) {
                 for (const tag of q.targetPath.slice(1)) {
                     node = node.children(tag).first();
                     if (node.length === 0) break;
                 }
                 if (node.length > 0) value = node; // Presence is length > 0
             }
        } else {
             // JSON
             const $ = cheerio.load(content);
             const preContent = $('pre').text().trim();
             try {
                 const json = JSON.parse(preContent);

                 // For permitted missing Matrix name case
                 if (q.sameGroupSampleContainsField === false && ['origins', 'destinations'].includes(q.role) && field.name === 'name') {
                   // Check if parsed JSON contains nonempty [role] ARRAY with actual lon/lat.
                   const arr = json[q.role];
                   const hasNonemptyWithLonLat = arr && Array.isArray(arr) && arr.length > 0 && arr.every(o => o.lon !== undefined && o.lat !== undefined);
                   if (!hasNonemptyWithLonLat) return false;
                 }

                 // For valid-json check
                 value = navigateJson(json, q.targetPath);
             } catch (e) {
                 return false;
             }
        }

        const actualPresent = value !== null && value !== undefined;

        // "sameGroupSampleContainsField false allowed only q.role in origins,destinations and field.name==="name" where containing JSON group exists."
        if (q.sameGroupSampleContainsField !== undefined) {
            let allowed = !!q.sameGroupSampleContainsField === actualPresent;
            if (!allowed) return false;
        }


    } else if (q.disposition === 'source-described-feature-variant') {
        if (!q.discriminator) return false;
        const disc = fields.find(f => f.id === q.discriminator[0]);
        if (!disc) return false;

        if (disc.example !== q.geometryTypeExample) return false;

        if (!q.blockStart) return false;
        const blockStart = fields.find(f => f.id === q.blockStart[0]);
        if (!blockStart) return false;

        if (field.tableRow < blockStart.tableRow || field.tableIndex !== blockStart.tableIndex) return false;
        if (disc.tableIndex !== field.tableIndex) return false;
        if (JSON.stringify(disc.displayPath) !== JSON.stringify(["features", "geometry", "type"])) return false;
        if (!['Point', 'LineString'].includes(q.geometryTypeExample)) return false;

        const description = blockStart.description || '';
        if (q.geometryTypeExample === 'Point' && !description.includes('출발점')) return false;
        if (q.geometryTypeExample === 'LineString' && !description.includes('구간')) return false;

        // Illustrative excerpt check and Valid JSON
        if (q.sampleKind === undefined || !['valid-json', 'illustrative-excerpt'].includes(q.sampleKind)) {
            return false;
        }

        if (q.sampleKind === 'illustrative-excerpt') {
            if (!content.includes('…')) return false; // Unicode ellipsis
            const isPoint = content.includes('"Point"');
            const isLineString = content.includes('"LineString"');
            if (!isPoint && !isLineString) return false;
        } else if (q.sampleKind === 'valid-json') {
            const $ = cheerio.load(content);
            const preContent = $('pre').text().trim();
            try {
                const json = JSON.parse(preContent);
                const features = json.features;
                if (!features || !Array.isArray(features) || features.length === 0) return false;

                const matchingFeatures = features.filter(f => f.geometry && f.geometry.type === q.geometryTypeExample);
                if (matchingFeatures.length === 0) return false;

                if (field.displayPath) {
                    const keys = field.displayPath.slice(1);
                    const hasMatchingFeatureWithKeys = matchingFeatures.some(f => {
                            return navigateJson(f, keys) !== null;
                    });
                    if (!hasMatchingFeatureWithKeys) return false;
                }
            } catch (e) {
                return false;
            }
        }

        // Table row check
        const nextFeatureBlock = fields.find(f =>
            f.tableIndex === field.tableIndex &&
            f.tableRow > blockStart.tableRow &&
            f.name === "type" &&
            JSON.stringify(f.displayPath) === JSON.stringify(["features", "type"]) &&
            f.example === "Feature"
        );
        if (nextFeatureBlock && field.tableRow >= nextFeatureBlock.tableRow) return false;
    }

    return true;
}

function navigateJson(obj, path) {
    let current = obj;
    for (const p of path) {
        if (current === null || current === undefined) return null;
        if (Array.isArray(current)) {
             current = current[0];
        }

        if (current && typeof current === 'object' && p in current) {
            current = current[p];
        } else {
            return null;
        }
    }
    return current;
}
