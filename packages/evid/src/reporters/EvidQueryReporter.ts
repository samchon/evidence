import type { IEvidDiagnostic } from "../structures/IEvidDiagnostic";
import type { IEvidInspection } from "../structures/IEvidInspection";
import type { IEvidInspectReport } from "../structures/IEvidInspectReport";
import type { IEvidLanguagesReport } from "../structures/IEvidLanguagesReport";
import type { IEvidListItem } from "../structures/IEvidListItem";
import type { IEvidListReport } from "../structures/IEvidListReport";
import type { IEvidQueryScope } from "../structures/IEvidQueryScope";
import type { EvidQueryReport } from "../typings/EvidQueryReport";
import type { EvidReportFormat } from "../typings/EvidReportFormat";

/**
 * Serializes query projections for people and automation.
 *
 * Query commands share their analysis boundary with checks, but expose selected
 * targets, one target's explanation, or the shipped language catalog. These
 * renderers preserve that structured data without triggering configuration or
 * source I/O.
 */
export namespace EvidQueryReporter {
  /**
   * Selects the text or JSON representation for a query result.
   *
   * Every representation ends with a newline so callers can write it directly to
   * stdout or a report file. The command discriminator selects the text layout.
   */
  export function render(
    report: EvidQueryReport,
    format: EvidReportFormat,
  ): string {
    return format === "json" ? json(report) : text(report);
  }

  /**
   * Serializes the complete query report as indented JSON.
   *
   * JSON retains all diagnostics and inspection details for tools that should not
   * infer structure from terminal-oriented text.
   */
  export function json(report: EvidQueryReport): string {
    return JSON.stringify(report, null, 2) + "\n";
  }

  /**
   * Renders the human-readable layout appropriate to the query command.
   *
   * Language discovery has no project configuration, list reports enumerate
   * filtered units, and inspection reports retain every applicable population.
   */
  export function text(report: EvidQueryReport): string {
    if (report.command === "languages") return languages(report);
    if (report.command === "list") return list(report);
    return inspect(report);
  }
}

/**
 * Renders a filtered inventory listing and its analysis diagnostics.
 *
 * Filters appear in the heading so a copied terminal report records the selected
 * population even when its item list is empty.
 */
function list(report: IEvidListReport): string {
  const filters = [
    report.language === undefined ? undefined : `language=${report.language}`,
    report.kind === undefined ? undefined : `kind=${report.kind}`,
  ].filter((value) => value !== undefined);
  const lines: string[] = [
    `evid list ${report.status}.`,
    `Config: ${report.configFile}`,
    `Targets: ${report.total}${filters.length === 0 ? "" : ` (${filters.join(", ")})`}.`,
  ];
  for (const item of report.items) lines.push("", ...listItem(item));
  appendDiagnostics(lines, report.diagnostics);
  return lines.join("\n") + "\n";
}

/**
 * Expands one public unit into its stable terminal fields.
 *
 * Aliases and declaration sites remain separate because one semantic unit may
 * have several public addresses or physical declarations.
 */
function listItem(item: IEvidListItem): string[] {
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

/**
 * Renders every population's resolution of one requested target.
 *
 * An unresolved population is retained in the result rather than being hidden,
 * which explains why an inspect command may complete with an exit code of one.
 */
function inspect(report: IEvidInspectReport): string {
  const lines: string[] = [
    `evid inspect ${report.status}.`,
    `Config: ${report.configFile}`,
    `Target: ${JSON.stringify(report.target)}`,
    `Populations: ${report.inspections.length}.`,
  ];
  for (const inspection of report.inspections)
    lines.push("", ...inspectionLines(inspection));
  appendDiagnostics(lines, report.diagnostics);
  return lines.join("\n") + "\n";
}

/**
 * Expands one population's selected units, obligations, and acknowledgements.
 *
 * The report includes both declared target candidates and resolved units so users
 * can distinguish spelling ambiguity from graph coverage or review state.
 */
function inspectionLines(inspection: IEvidInspection): string[] {
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
      `  Policies: exclusion=${obligation.policy.noEvidExclude ? "forbidden" : "allowed"}, unique=${obligation.policy.uniqueEvid}, single=${obligation.policy.singleEvidPerSymbol}, checklist=${obligation.policy.checklist}, review=${obligation.policy.requireReview}`,
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

/**
 * Renders the certified adapter catalog without consulting project configuration.
 *
 * Grammar patterns, addressing rules, and documented unsupported forms let an
 * author choose an available artifact type before writing a configuration.
 */
function languages(report: IEvidLanguagesReport): string {
  const lines: string[] = [
    "Evidence Graph certified languages.",
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

/**
 * Appends analysis findings in the compact query-report diagnostic layout.
 *
 * Query reports retain diagnostics from the shared analysis even if their primary
 * listing or inspection data was successfully produced.
 */
function appendDiagnostics(
  lines: string[],
  diagnostics: IEvidDiagnostic[],
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

/**
 * Formats the authored claim and optional reference boundary for a query item.
 *
 * Names supplement stable numeric indices while artifact types identify which
 * adapter's target grammar applies to the displayed result.
 */
function scope(value: IEvidQueryScope): string {
  const claim = `claim[${value.claim}]${value.name === undefined ? "" : ` '${value.name}'`}`;
  return value.reference === undefined
    ? `${claim} (${value.type})`
    : `${claim} -> reference[${value.reference}] (${value.type})`;
}
