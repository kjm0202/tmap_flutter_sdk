import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';
import * as cheerio from 'cheerio';
import { isDeepStrictEqual } from 'util';
import { ROOT, HERE } from './common.mjs';
import { extractRestFields } from './rest_fields.mjs';
import { verifiedAmbiguousRoles } from './rest_ambiguous_source_roles.mjs';

const CACHE_SOURCES = path.join(HERE, '.cache/sources');
const LAYOUT_PATH = path.join(ROOT, "docs/sdk-audit/checkpoints/2026-11-19/rest-field-table-layout.json.gz");

export function verifiedDocumentSources(source, suppliedFields, read = fs.readFileSync) {
    try {
        // Authenticated input
        const compressedBytes = read(LAYOUT_PATH);
        const compressedSha256 = crypto.createHash('sha256').update(compressedBytes).digest('hex');

        if (compressedSha256 !== '61b01dad0ae855f3e9333768e547588133c12a53f9ae6ea6247d38c4a3a00ce0') {
            return null;
        }

        const layoutSha256 = compressedSha256;
        const layout = JSON.parse(zlib.gunzipSync(compressedBytes).toString());

        // Find matching record
        const docLayout = layout.documents.find(d => d.url === source.url && d.sourceSha256 === source.sha256);
        if (!docLayout) return null;

        // Read source bytes
        const sourcePath = path.join(CACHE_SOURCES, source.sha256);
        const sourceBytes = read(sourcePath);
        const sourceActualSha256 = crypto.createHash('sha256').update(sourceBytes).digest('hex');
        if (sourceActualSha256 !== source.sha256) return null;

        // Extract real fields
        const text = sourceBytes.toString('utf8');
        const $ = cheerio.load(text, { sourceCodeLocationInfo: true });
        const tables = $("table").toArray();
        const { fields, diagnostics } = extractRestFields({ ...source, text }, $, tables);

        // Reject diagnostics, empty fields, ambiguous entries, not matching suppliedFields
        if ((diagnostics && diagnostics.length > 0) || !fields || fields.length === 0) return null;
        if (!isDeepStrictEqual(fields, suppliedFields)) return null;

        // Check field ambiguity and unique IDs
        const fieldIds = new Set();
        let ambiguityEvidence = null;

        for (const f of fields) {
            if (f.ambiguity) {
                if (ambiguityEvidence === null) {
                    ambiguityEvidence = verifiedAmbiguousRoles(source, fields, sourceBytes, read);
                    if (ambiguityEvidence === null) return null;
                }
            }
            if (fieldIds.has(f.id)) return null;
            fieldIds.add(f.id);
        }

        // Existing table iteration
        if (tables.length !== docLayout.tables.length) return null;

        const tableIds = [];

        for (let i = 0; i < tables.length; i++) {
            const tableId = `rest-reference:${source.url}:table-${i}`;
            tableIds.push(tableId);

            // rawSpan calculation
            const loc = tables[i].sourceCodeLocation;
            if (!loc) return null;
            const raw = text.slice(loc.startOffset, loc.endOffset);
            const sha256RawSpan = crypto.createHash('sha256').update(raw).digest('hex');
            const rawSpan = [loc.startLine, loc.endLine, Buffer.byteLength(text.slice(0, loc.startOffset)), Buffer.byteLength(text.slice(0, loc.endOffset)), sha256RawSpan];

            // Check equality of ordered ID and rawSpan
            const layoutTable = docLayout.tables[i];
            if (layoutTable.candidateId !== tableId) return null;
            if (!layoutTable.rawSpan || !isDeepStrictEqual(rawSpan, layoutTable.rawSpan)) return null;

            const expectedRows = layoutTable.rows || [];
            const actualRows = fields.filter(f => f.tableIndex === i);

            if (expectedRows.length !== actualRows.length) return null;

            for (let j = 0; j < expectedRows.length; j++) {
                const exp = expectedRows[j];
                const act = actualRows[j];

                // Compare each independent receipt row against actual
                if (exp.tableRow !== act.tableRow ||
                    !isDeepStrictEqual(exp.displayPath, act.displayPath) ||
                    exp.sourceType !== act.sourceType ||
                    exp.mandatory !== act.mandatory ||
                    layoutTable.section !== act.section ||
                    layoutTable.group !== act.group ||
                    !isDeepStrictEqual(exp.span, [act.span.firstLine, act.span.lastLine, act.span.utf8StartInclusive, act.span.utf8EndExclusive, act.span.sha256RawSpan])) {
                    return null;
                }
            }
        }

        const result = {
            tableIds,
            fieldCount: fields.length,
            layoutSha256,
            documentSha256: sourceActualSha256,
            fieldsSha256: crypto.createHash('sha256').update(JSON.stringify(fields)).digest('hex')
        };
        if (ambiguityEvidence) {
            result.ambiguityEvidence = ambiguityEvidence;
        }
        return result;

    } catch (e) {
        return null;
    }
}
