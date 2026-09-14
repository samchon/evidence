import type { IEvidenceDiagnostic } from "../structures/IEvidenceDiagnostic";
import type { IEvidenceInspection } from "../structures/IEvidenceInspection";
import type { IEvidenceInspectReport } from "../structures/IEvidenceInspectReport";
import type { IEvidenceLanguagesReport } from "../structures/IEvidenceLanguagesReport";
import type { IEvidenceListItem } from "../structures/IEvidenceListItem";
import type { IEvidenceListReport } from "../structures/IEvidenceListReport";
import type { IEvidenceQueryScope } from "../structures/IEvidenceQueryScope";
import type { EvidenceQueryReport } from "../typings/EvidenceQueryReport";
import type { EvidenceReportFormat } from "../typings/EvidenceReportFormat";

/** Renders target discovery, inspection, and language reports. */
export namespace EvidenceQueryReporter {
  export function render(
    report: EvidenceQueryReport,
    format: EvidenceReportFormat,
  ): string {
    return format === "json" ? json(report) : text(report);
  }

  export function json(report: EvidenceQueryReport): string {
    return JSON.stringify(report, null, 2) + "\n";
  }

  export function text(report: EvidenceQueryReport): string {
    if (report.command === "languages") return languages(report);
    if (report.command === "list") return list(report);
    return inspect(report);
  }
}

function list(report: IEvidenceListReport): string {
  const filters = [
    report.language === undefined ? undefined : `language=${report.language}`,
    report.kind === undefined ? undefined : `kind=${report.kind}`,
  ].filter((value) => value !== undefined);
  const lines: string[] = [
    `Evidence list ${report.status}.`,
    `Config: ${report.configFile}`,
    `Targets: ${report.total}${filters.length === 0 ? "" : ` (${filters.join(", ")})`}.`,
  ];
  for (const item of report.items) lines.push("", ...listItem(item));
  appendDiagnostics(lines, report.diagnostics);
  return lines.join("\n") + "\n";
}

function listItem(item: IEvidenceListItem): string[] {
  const lines = [
    `${scope(item.scope)} ${item.symbol} ${item.selection} ${JSON.stringify(item.target)}`,
    `  Identity: ${item.unitId}`,
  ];
  if (item.aliases.length > 1)
    lines.push(
      `  Aliases: ${item.aliases.map((alias) => JSON.stringify(alias)).join(", ")}`,
    );
  for (const location of item.locations)
    lines.push(
      `  Declaration: ${location.file}:${location.range?.start?.line ?? 1}:${location.range?.start?.column ?? 1}`,
    );
  return lines;
}

function inspect(report: IEvidenceInspectReport): string {
  const lines: string[] = [
    `Evidence inspect ${report.status}.`,
    `Config: ${report.configFile}`,
    `Target: ${JSON.stringify(report.target)}`,
    `Populations: ${report.inspections.length}.`,
  ];
  for (const inspection of report.inspections)
    lines.push("", ...inspectionLines(inspection));
  appendDiagnostics(lines, report.diagnostics);
  return lines.join("\n") + "\n";
}

function inspectionLines(inspection: IEvidenceInspection): string[] {
  const lines = [`${scope(inspection.scope)} ${inspection.status}`];
  if (inspection.addresses.length !== 0)
    lines.push(
      `  Candidates: ${inspection.addresses
        .map((address) => JSON.stringify(address))
        .join(", ")}`,
    );
  for (const unit of inspection.units) {
    lines.push(...listItem(unit.item));
    if (unit.children.length !== 0)
      lines.push(
        `  Children: ${unit.children.map((child) => JSON.stringify(child.target)).join(", ")}`,
      );
    for (const host of unit.hosts)
      lines.push(
        `  Host: ${host.file}:${host.range.start.line}:${host.range.start.column}`,
      );
    if (unit.fingerprint !== undefined)
      lines.push(`  Fingerprint: #${unit.fingerprint.fingerprint}`);
  }
  for (const obligation of inspection.obligations)
    lines.push(
      `  Obligation: claim[${obligation.claim}] -> reference[${obligation.reference}] ${obligation.policy.severity}, ${obligation.selection}, ${obligation.covered ? "covered" : obligation.missing ? "missing" : "aggregate"}`,
      `  Policies: exclusion=${obligation.policy.noEvidenceExclude ? "forbidden" : "allowed"}, unique=${obligation.policy.uniqueEvidence}, single=${obligation.policy.singleEvidencePerSymbol}, checklist=${obligation.policy.checklist}, review=${obligation.policy.requireReview}`,
    );
  for (const acknowledgement of inspection.acknowledgements)
    lines.push(
      `  Incoming: @${acknowledgement.declaration.kind} from ${acknowledgement.declaration.location.file} in host ${acknowledgement.host.file}:${acknowledgement.host.range.start.line}:${acknowledgement.host.range.start.column} #${acknowledgement.fingerprint}`,
    );
  for (const review of inspection.reviews)
    lines.push(
      `  Review: @${review.review.reviews === "evidence" ? "evidenceReview" : "evidenceExcludeReview"} ${review.review.fingerprint === undefined ? "without fingerprint" : `#${review.review.fingerprint}`} in host ${review.host.file}:${review.host.range.start.line}:${review.host.range.start.column} (${review.status})`,
    );
  return lines;
}

function languages(report: IEvidenceLanguagesReport): string {
  const lines: string[] = [
    "Evidence certified languages.",
    `Languages: ${report.total}.`,
  ];
  for (const language of report.languages) {
    const grammars = language.grammars.map((grammar) => {
      const patterns = [...grammar.extensions, ...grammar.filenames];
      return `${grammar.id} (${patterns.join(", ")})`;
    });
    lines.push(
      "",
      `${language.type}: ${language.name}`,
      `  Grammars: ${grammars.join(", ")}`,
      `  Symbols: ${language.adapter.symbols.join(", ")}`,
      `  Surface: ${language.adapter.publicSurface}`,
      `  Addressing: ${language.adapter.addressing}`,
      `  Documentation: ${language.adapter.comments.join(", ")}`,
      `  Unsupported: ${language.adapter.unsupported.join(", ")}`,
    );
  }
  return lines.join("\n") + "\n";
}

function appendDiagnostics(
  lines: string[],
  diagnostics: IEvidenceDiagnostic[],
): void {
  for (const diagnostic of diagnostics) {
    const location = diagnostic.location;
    lines.push(
      "",
      `${diagnostic.severity.toUpperCase()} [${diagnostic.code}]`,
      ...(location === undefined
        ? []
        : [
            `  Location: ${location.file}:${location.range?.start?.line ?? 1}:${location.range?.start?.column ?? 1}`,
          ]),
      `  ${diagnostic.message}`,
      `  Repair: ${diagnostic.repair}`,
    );
  }
}

function scope(value: IEvidenceQueryScope): string {
  const claim = `claim[${value.claim}]${value.name === undefined ? "" : ` '${value.name}'`}`;
  return value.reference === undefined
    ? `${claim} (${value.type})`
    : `${claim} -> reference[${value.reference}] (${value.type})`;
}
