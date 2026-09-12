import type { IEvidenceGraphBoundary } from "./structures/IEvidenceGraphBoundary";
import type { IEvidenceGraphExportEdge } from "./structures/IEvidenceGraphExportEdge";
import type { IEvidenceGraphExportReview } from "./structures/IEvidenceGraphExportReview";
import type { IEvidenceGraphReport } from "./structures/IEvidenceGraphReport";
import type { EvidenceGraphFormat } from "./typings/EvidenceGraphFormat";
import type { EvidenceGraphNode } from "./typings/EvidenceGraphNode";

/** Renders the authoritative graph report as JSON or injection-safe visual syntax. */
export namespace EvidenceGraphReporter {
  export function render(
    report: IEvidenceGraphReport,
    format: EvidenceGraphFormat,
  ): string {
    if (format === "json") return json(report);
    return format === "mermaid" ? mermaid(report) : dot(report);
  }

  export function json(report: IEvidenceGraphReport): string {
    return JSON.stringify(report, null, 2) + "\n";
  }

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

function nodeNames(nodes: EvidenceGraphNode[]): Map<string, string> {
  return new Map(nodes.map((node, index) => [node.id, `n${index}`]));
}

function requireNodeName(names: Map<string, string>, id: string): string {
  const name = names.get(id);
  if (name === undefined)
    throw new Error(`Graph edge names missing node '${id}'.`);
  return name;
}

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

function edgeLabel(edge: IEvidenceGraphExportEdge): string {
  return `@${edge.kind} #${edge.fingerprint}`;
}

function reviewLabel(review: IEvidenceGraphExportReview): string {
  const marker =
    review.reviews === "evidence"
      ? "@evidenceReview"
      : "@evidenceExcludeReview";
  return `${marker}${review.review.fingerprint === undefined ? "" : ` #${review.review.fingerprint}`}`;
}

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

function dotText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("\r", "\\r")
    .replaceAll("\n", "\\n");
}
