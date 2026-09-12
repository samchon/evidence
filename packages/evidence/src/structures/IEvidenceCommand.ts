import type { IEvidenceCheckCommand } from "./IEvidenceCheckCommand";
import type { IEvidenceGraphCommand } from "./IEvidenceGraphCommand";
import type { IEvidenceHelpCommand } from "./IEvidenceHelpCommand";
import type { IEvidenceInspectCommand } from "./IEvidenceInspectCommand";
import type { IEvidenceInitCommand } from "./IEvidenceInitCommand";
import type { IEvidenceLanguagesCommand } from "./IEvidenceLanguagesCommand";
import type { IEvidenceListCommand } from "./IEvidenceListCommand";
import type { IEvidenceVersionCommand } from "./IEvidenceVersionCommand";

/** Valid command selected from a complete CLI argument list. */
export type IEvidenceCommand =
  | IEvidenceCheckCommand
  | IEvidenceGraphCommand
  | IEvidenceHelpCommand
  | IEvidenceInspectCommand
  | IEvidenceInitCommand
  | IEvidenceLanguagesCommand
  | IEvidenceListCommand
  | IEvidenceVersionCommand;
