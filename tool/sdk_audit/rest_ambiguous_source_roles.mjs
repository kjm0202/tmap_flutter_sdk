import fs from 'fs';
import zlib from 'zlib';
import crypto from 'crypto';
import { isDeepStrictEqual } from 'node:util';
import { verifyRoleWitness } from './rest_source_role_witness.mjs';

const RECEIPT_PATH = new URL('./rest_ambiguous_source_roles.json.gz', import.meta.url);
const RECEIPT_SHA = 'b00e86180fcaebf9df8d162e7e663231ee622dad9990073a3527b5e4cbace00b';

function loadReceipt(read) {
    try {
        const buffer = read(RECEIPT_PATH);
        const sha = crypto.createHash('sha256').update(buffer).digest('hex');
        if (sha !== RECEIPT_SHA) return null;
        const jsonString = zlib.gunzipSync(buffer).toString();
        return JSON.parse(jsonString);
    } catch (e) {
        return null;
    }
}

export function verifiedAmbiguousRoles(source, fields, bytes, read = fs.readFileSync) {
    try {
        const sourceSha = crypto.createHash('sha256').update(bytes).digest('hex');
        if (sourceSha !== source.sha256) return null;

        const data = loadReceipt(read);
        if (!data) return null;

        const doc = data.documents.find(d => d.sourceSha256 === source.sha256 && d.url === source.url);
        if (!doc) {
            return null;
        }
        if (doc.unresolved.length !== 0 || !doc.eligibleAllAmbiguousSourceRows) {
            return null;
        }

        const ambiguousFields = fields.filter(f => f.ambiguity);
        if (ambiguousFields.length !== doc.sourceQualifiers.length) {
            return null;
        }

        const qualifiers = [];
        const witnesses = [];

        for (const q of doc.sourceQualifiers) {
            const f = fields.find(field => field.id === q.field[0]);
            if (!f) return null;
            if (fields.filter(field => field.id === q.field[0]).length !== 1) return null;

            if (!isDeepStrictEqual(q.displayPath, f.displayPath) ||
                q.table !== f.tableIndex ||
                q.sourceAmbiguity !== f.ambiguity) {
                return null;
            }

            if (!verifyRoleWitness(q, f, fields, bytes)) {
                return null;
            }

            const validateTuple = (tuple) => {
                const actualField = fields.find(field => field.id === tuple[0]);
                if (!actualField) return false;

                const sha256 = crypto.createHash('sha256').update(bytes.subarray(tuple[2], tuple[3])).digest('hex');
                return tuple[1] === actualField.tableRow &&
                       tuple[2] === actualField.span.utf8StartInclusive &&
                       tuple[3] === actualField.span.utf8EndExclusive &&
                       tuple[4] === sha256 &&
                       tuple[4] === actualField.span.sha256RawSpan;
            };

            if (!validateTuple(q.field) ||
                (q.namedParent && !validateTuple(q.namedParent)) ||
                (q.blockStart && !validateTuple(q.blockStart)) ||
                (q.discriminator && !validateTuple(q.discriminator))) {
                return null;
            }

            if (q.witness) {
                const witnessSha = crypto.createHash('sha256').update(bytes.subarray(q.witness[0], q.witness[1])).digest('hex');
                if (witnessSha !== q.witness[2]) return null;
                witnesses.push(q.witness);
            }

            qualifiers.push(q);
        }

        return {
            count: ambiguousFields.length,
            receiptSha256: RECEIPT_SHA,
            roles: [...new Set(qualifiers.map(q => q.role))],
            witnesses: Array.from(new Set(witnesses.map(w => JSON.stringify(w)))).map(s => JSON.parse(s))
        };
    } catch (e) {
        return null;
    }
}
