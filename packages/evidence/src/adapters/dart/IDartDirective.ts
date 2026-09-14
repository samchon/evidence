import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";

/** A static directive whose selected dependency can alter public library addresses. */
export interface IDartDirective {
  /** Relationship established by the directive. */
  kind: "part" | "part-of" | "export";

  /** Decoded URI or named part-of library. */
  target: string;

  /** Whether target denotes a named library instead of a URI. */
  named: boolean;

  /** Resolved selected physical file, when URI resolution succeeds. */
  resolved?: string;

  /** Ordered filters; each show list intersects and each hide list subtracts. */
  filters: IDartExportFilter[];

  /** Original directive range. */
  range: IEvidenceSourceRange;
}

import type { IDartExportFilter } from "./IDartExportFilter";
