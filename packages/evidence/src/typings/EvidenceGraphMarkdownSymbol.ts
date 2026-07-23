/**
 * A Markdown node kind that can become an evidence unit or host an evidence
 * declaration.
 *
 * `"file"` treats the document as one node. `"h1"` through `"h4"` select ATX
 * heading sections at that exact level; Setext headings and H5/H6 headings are
 * outside this contract.
 *
 * A file evidence target is its project-relative path. A heading target appends
 * its anchor, such as `docs/orders.md#create-order`. An explicit `{#anchor}`
 * suffix wins. Its anchor must start with an ASCII letter or digit and may then
 * contain ASCII letters, digits, `.`, `_`, `:`, and `-`.
 *
 * Without an explicit anchor, the heading becomes a lowercase slug: letters,
 * numbers, and `_` remain; whitespace and `-` collapse to `-`; other
 * punctuation is removed. Two selected headings that produce the same target
 * are ambiguous and need distinct explicit anchors.
 */
export type EvidenceGraphMarkdownSymbol = "file" | "h1" | "h2" | "h3" | "h4";
