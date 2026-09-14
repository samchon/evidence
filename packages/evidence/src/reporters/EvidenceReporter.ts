import type { IEvidenceCheckReport } from "../structures/IEvidenceCheckReport";
import type { IEvidenceDiagnostic } from "../structures/IEvidenceDiagnostic";
import type { EvidenceReportFormat } from "../typings/EvidenceReportFormat";

/** Renders the same deterministic check report as human or machine output. */
export namespace EvidenceReporter {
  export function render(
    report: IEvidenceCheckReport,
    format: EvidenceReportFormat,
  ): string {
    return format === "json" ? json(report) : text(report);
  }

  export function json(report: IEvidenceCheckReport): string {
    return JSON.stringify(report, null, 2) + "\n";
  }

  export function text(report: IEvidenceCheckReport): string {
    const counts = report.counts;
    const lines: string[] = [
      `Evidence check ${report.status}.`,
      `Config: ${report.configFile}`,
      `Claims: ${counts.activeClaims}/${counts.claims} active.`,
      `Obligations: ${counts.activeObligations}/${counts.obligations} active, ${counts.incompleteObligations} incomplete.`,
      `Coverage: ${counts.coveredUnits}/${counts.units} units covered, ${counts.missingUnits} missing.`,
      `Diagnostics: ${counts.errors} errors, ${counts.warnings} warnings.`,
    ];
    for (const diagnostic of report.diagnostics)
      lines.push("", ...diagnosticLines(report, diagnostic));
    return lines.join("\n") + "\n";
  }
}

function diagnosticLines(
  report: IEvidenceCheckReport,
  diagnostic: IEvidenceDiagnostic,
): string[] {
  return [
    `${diagnostic.severity.toUpperCase()} [${diagnostic.code}] ${context(report, diagnostic)}`,
    `Location: ${location(diagnostic)}`,
    `Subject: ${subject(diagnostic)}`,
    diagnostic.message,
    `Repair: ${diagnostic.repair}`,
  ];
}

function context(
  report: IEvidenceCheckReport,
  diagnostic: IEvidenceDiagnostic,
): string {
  const claim = report.claims.find(
    (candidate) => candidate.claim === diagnostic.claim,
  );
  if (claim === undefined) return "unscoped analysis";
  const claimText = `claim[${claim.claim}]${claim.name === undefined ? "" : ` '${claim.name}'`} (${claim.type})`;
  if (diagnostic.reference === undefined) return claimText;
  const reference = claim.obligations.find(
    (candidate) => candidate.reference === diagnostic.reference,
  );
  return reference === undefined
    ? `${claimText} -> reference[${diagnostic.reference}]`
    : `${claimText} -> reference[${reference.reference}] (${reference.type})`;
}

function location(diagnostic: IEvidenceDiagnostic): string {
  const location = diagnostic.location;
  if (location === undefined) return "configuration or aggregate graph";
  const start = location.range?.start;
  return start === undefined
    ? location.file
    : `${location.file}:${start.line}:${start.column}`;
}

function subject(diagnostic: IEvidenceDiagnostic): string {
  const values: string[] = [];
  if (diagnostic.hostId !== undefined) values.push(`host ${diagnostic.hostId}`);
  if (diagnostic.target !== undefined)
    values.push(`target ${JSON.stringify(diagnostic.target)}`);
  return values.length === 0 ? "configured population" : values.join(", ");
}
