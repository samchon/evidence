import type { IEvidenceCheckCommand } from "./IEvidenceCheckCommand";
import type { IEvidenceGraphCommand } from "./IEvidenceGraphCommand";
import type { IEvidenceHelpCommand } from "./IEvidenceHelpCommand";
import type { IEvidenceInspectCommand } from "./IEvidenceInspectCommand";
import type { IEvidenceInitCommand } from "./IEvidenceInitCommand";
import type { IEvidenceLanguagesCommand } from "./IEvidenceLanguagesCommand";
import type { IEvidenceListCommand } from "./IEvidenceListCommand";
import type { IEvidenceVersionCommand } from "./IEvidenceVersionCommand";

/**
 * Validated operation selected from the complete CLI argument list.
 *
 * Parsing rejects unknown, repeated, or incompatible options before producing
 * this discriminated union. Execution dispatches on operation without reinterpreting
 * raw tokens or allowing trailing input to escape validation.
 */
export type IEvidenceCommand =
  | IEvidenceCheckCommand
  | IEvidenceGraphCommand
  | IEvidenceHelpCommand
  | IEvidenceInspectCommand
  | IEvidenceInitCommand
  | IEvidenceLanguagesCommand
  | IEvidenceListCommand
  | IEvidenceVersionCommand;
