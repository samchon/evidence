import { EvidenceReporter } from "./EvidenceReporter";
import type { EvidenceReportFormat } from "./typings/EvidenceReportFormat";
import type { EvidenceWatchCycle } from "./typings/EvidenceWatchCycle";

/** Renders watch cycles as readable blocks or one compact JSON document per line. */
export namespace EvidenceWatchReporter {
  export function render(
    cycle: EvidenceWatchCycle,
    format: EvidenceReportFormat,
  ): string {
    return format === "json" ? json(cycle) : text(cycle);
  }

  /** Emits stable NDJSON framing for machine consumers. */
  export function json(cycle: EvidenceWatchCycle): string {
    return JSON.stringify(cycle) + "\n";
  }

  export function text(cycle: EvidenceWatchCycle): string {
    const heading = `Evidence watch cycle ${cycle.cycle} (${cycle.status}).\n`;
    if (cycle.status !== "failed")
      return heading + EvidenceReporter.text(cycle.report);
    return `${heading}Config: ${cycle.configFile}\n${cycle.message}\nRepair: ${cycle.repair}\n`;
  }
}
