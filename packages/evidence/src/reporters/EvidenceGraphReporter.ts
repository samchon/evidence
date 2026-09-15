import type { IEvidenceGraphBoundary } from "../structures/IEvidenceGraphBoundary";
import type { IEvidenceGraphExportEdge } from "../structures/IEvidenceGraphExportEdge";
import type { IEvidenceGraphExportReview } from "../structures/IEvidenceGraphExportReview";
import type { IEvidenceGraphReport } from "../structures/IEvidenceGraphReport";
import type { EvidenceGraphFormat } from "../typings/EvidenceGraphFormat";
import type { EvidenceGraphNode } from "../typings/EvidenceGraphNode";

/**
 * Serializes the authoritative graph report as JSON, Mermaid, or DOT.
 *
 * Visual formats escape authored labels before embedding them in their
 * respective grammars. They are projections of an already evaluated graph and
 * never change graph membership, coverage, or review resolution.
 */
export namespace EvidenceGraphReporter {
  /**
   * Chooses the requested graph serialization.
   *
   * JSON preserves the report object, while Mermaid and DOT encode its
   * boundaries, nodes, evidence edges, and review edges for visualization
   * tools.
   */
  export function render(
    report: IEvidenceGraphReport,
    format: EvidenceGraphFormat,
  ): string {
    if (format === "json") return json(report);
    return format === "mermaid" ? mermaid(report) : dot(report);
  }

  /**
   * Serializes the complete graph report as indented JSON.
   *
   * This format keeps stable identifiers and every exported property available
   * to programmatic consumers without visual-format escaping.
   */
  export function json(report: IEvidenceGraphReport): string {
    return JSON.stringify(report, null, 2) + "\n";
  }

  /**
   * Emits a Mermaid flowchart with one subgraph per configured boundary.
   *
   * Synthetic node names avoid treating semantic IDs as Mermaid syntax; labels
   * carry the authored values after escaping text-sensitive characters.
   */
  export function mermaid(report: IEvidenceGraphReport): string {
    const names = nodeNames(report.nodes);
    const lines: string[] = ["flowchart LR"];
    report.boundaries.forEach((entry, index) => {
      lines.push(
        `  subgraph b${index}["${mermaidText(boundaryLabel(entry))}"]`,
      );
      for (const node of report.nodes.filter(
        (candidate) => candidate.boundaryId === entry.id,
      ))
        lines.push(
          `    ${requireNodeName(names, node.id)}["${mermaidText(nodeLabel(node))}"]`,
        );
      lines.push("  end");
    });
    for (const edge of report.edges)
      for (const source of edge.sourceNodeIds)
        lines.push(
          `  ${requireNodeName(names, source)} ${edge.kind === "evidence" ? "-->" : "-.->"}|${mermaidText(edgeLabel(edge))}| ${requireNodeName(names, edge.targetNodeId)}`,
        );
    for (const review of report.reviews)
      for (const source of review.sourceNodeIds)
        for (const target of review.targetNodeIds)
          lines.push(
            `  ${requireNodeName(names, source)} -.->|${mermaidText(reviewLabel(review))}| ${requireNodeName(names, target)}`,
          );
    return lines.join("\n") + "\n";
  }

  /**
   * Emits a DOT directed graph with clusters for configuration boundaries.
   *
   * Evidence Graph exclusion and review relations use distinct line styles so
   * their meaning remains visible when a viewer does not expose edge metadata.
   */
  export function dot(report: IEvidenceGraphReport): string {
    const names = nodeNames(report.nodes);
    const lines: string[] = ["digraph Evidence {", "  rankdir=LR;"];
    report.boundaries.forEach((entry, index) => {
      lines.push(
        `  subgraph cluster_${index} {`,
        `    label="${dotText(boundaryLabel(entry))}";`,
      );
      for (const node of report.nodes.filter(
        (candidate) => candidate.boundaryId === entry.id,
      ))
        lines.push(
          `    ${requireNodeName(names, node.id)} [label="${dotText(nodeLabel(node))}"];`,
        );
      lines.push("  }");
    });
    for (const edge of report.edges)
      for (const source of edge.sourceNodeIds)
        lines.push(
          `  ${requireNodeName(names, source)} -> ${requireNodeName(names, edge.targetNodeId)} [label="${dotText(edgeLabel(edge))}"${edge.kind === "evidenceExclude" ? ', style="dashed"' : ""}];`,
        );
    for (const review of report.reviews)
      for (const source of review.sourceNodeIds)
        for (const target of review.targetNodeIds)
          lines.push(
            `  ${requireNodeName(names, source)} -> ${requireNodeName(names, target)} [label="${dotText(reviewLabel(review))}", style="dotted"];`,
          );
    lines.push("}");
    return lines.join("\n") + "\n";
  }
}

/**
 * Assigns syntax-safe local names to graph nodes in report order.
 *
 * Exported node IDs may contain target punctuation, so formats refer to these
 * generated names and reserve IDs for labels and lookup only.
 */
function nodeNames(nodes: EvidenceGraphNode[]): Map<string, string> {
  return new Map(nodes.map((node, index) => [node.id, `n${index}`]));
}

/**
 * Retrieves a generated node name and detects an inconsistent graph export.
 *
 * An edge without a listed endpoint is a report-construction failure, not an
 * opportunity to emit invalid visualization syntax.
 */
function requireNodeName(names: Map<string, string>, id: string): string {
  const name = names.get(id);
  if (name === undefined)
    throw new Error(`Graph edge names missing node '${id}'.`);
  return name;
}

/**
 * Summarizes a claim/reference boundary and its resolved policy state.
 *
 * The label makes inactive and incomplete boundaries visible even when they
 * have no ordinary evidence edges in the graph export.
 */
function boundaryLabel(boundary: IEvidenceGraphBoundary): string {
  const policies = [
    boundary.policy.noEvidenceExclude ? "no-exclude" : undefined,
    boundary.policy.uniqueEvidence ? "unique" : undefined,
    boundary.policy.singleEvidencePerSymbol ? "single" : undefined,
    boundary.policy.checklist ? "checklist" : undefined,
    boundary.policy.requireReview ? "review" : undefined,
  ].filter((value) => value !== undefined);
  const status = !boundary.active
    ? "inactive"
    : boundary.complete
      ? "complete"
      : "incomplete";
  return `claim[${boundary.claim.claim}] (${boundary.claim.type}) -> reference[${boundary.reference.reference ?? -1}] (${boundary.reference.type}); ${status}, ${boundary.policy.severity}${policies.length === 0 ? "" : `, ${policies.join(", ")}`}`;
}

/**
 * Produces a concise label for a graph node.
 *
 * Hosts identify their physical source location; unit nodes identify their
 * role, target, symbol, and selection or coverage state.
 */
function nodeLabel(node: EvidenceGraphNode): string {
  if (node.role === "host")
    return `host ${node.location.file}:${node.location.range?.start?.line ?? 1}`;
  const state = node.missing
    ? "missing"
    : node.covered
      ? "covered"
      : node.selection;
  return `${node.role} ${node.symbol} ${node.target} (${state})`;
}

/**
 * Labels an acknowledgement edge with its tag kind and fingerprint.
 *
 * Fingerprints connect rendered edges to their persistent review identifiers.
 */
function edgeLabel(edge: IEvidenceGraphExportEdge): string {
  return `@${edge.kind} #${edge.fingerprint}`;
}

/**
 * Labels a review relation with its review-tag spelling and optional
 * fingerprint.
 *
 * Missing fingerprints remain explicit because their absence affects review
 * matching rather than meaning that the review edge has no source data.
 */
function reviewLabel(review: IEvidenceGraphExportReview): string {
  const marker =
    review.reviews === "evidence"
      ? "@evidenceReview"
      : "@evidenceExcludeReview";
  return `${marker}${review.review.fingerprint === undefined ? "" : ` #${review.review.fingerprint}`}`;
}

/**
 * Escapes text embedded inside Mermaid quoted labels and edge labels.
 *
 * Entity encodings prevent authored markup, quotes, separators, and line breaks
 * from changing the surrounding flowchart grammar.
 */
function mermaidText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("|", "&#124;")
    .replaceAll("\r", "&#13;")
    .replaceAll("\n", "&#10;");
}

/**
 * Escapes text embedded in a DOT quoted string literal.
 *
 * Backslashes are handled first so later quote and line-break substitutions
 * cannot create an escape sequence with a different meaning.
 */
function dotText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("\r", "\\r")
    .replaceAll("\n", "\\n");
}
