# REST reference field inventory

`audit` and `check` run the same HTML extractor. `docs.json` contains
`restReferenceFields` and its summary; `contracts.json` repeats that separate
inventory. It does not add entries to the JS/Flutter contract worklist or
change its status. Each field is unverified. Existing table rows and diagnostics
remain in place.

Fields identify their source URL, source digest, table index and physical row
index. `span` and `tableSpan` contain inclusive-start, exclusive-end UTF-8 byte
positions and a digest of the exact source bytes. `displayPath` is only the
hierarchy suggested by leading blank cells. Row identity, not the displayed path,
distinguishes duplicates. A missing parent gives a null path and a diagnostic;
an unrecognized section has an unknown direction. Neither the path nor the
source type establishes a wire schema, endpoint ownership, SDK support, or
runtime behavior.

The extractor recognizes ordered Name, Date Type (or Data Type), Mandatory,
Example, optional Default, Description headers. It handles leading blank cells,
colspan-based name bands, multi-row headers and metadata rowspans in fixed-width
name bands. Malformed field-like headers and rows are reported as ambiguous;
variable-indentation rows with spans are left unresolved. Other table layouts,
JSON/XML examples, inferred parentage of flat rows, conditional semantics and
sections whose direction is not explicit require separate review. Navigation
and sample tables are not field candidates. The checkpoint layout is design
context only; generation always reads and hashes the supplied HTML.

A cell-free row with no inherited metadata or other content is treated as a
separator and does not reset the display hierarchy, including when HTML
implicitly closes it. Rows with cells or inherited metadata are not separators;
incomplete rows are diagnosed and reset the hierarchy. A header-only reference
can yield no fields without a field-specific diagnostic: a recognized header has
no body to report, and a header with fewer than two recognized metadata labels
is not considered a candidate. The general schema-review issue still appears
for reference documents, but does not establish that fields were extracted.
