import type { IEvidenceCheckCommand } from "./IEvidenceCheckCommand";
import type { IEvidenceHelpCommand } from "./IEvidenceHelpCommand";
import type { IEvidenceInitCommand } from "./IEvidenceInitCommand";
import type { IEvidenceVersionCommand } from "./IEvidenceVersionCommand";

/** Valid command selected from a complete CLI argument list. */
export type IEvidenceCommand =
  | IEvidenceCheckCommand
  | IEvidenceHelpCommand
  | IEvidenceInitCommand
  | IEvidenceVersionCommand;
