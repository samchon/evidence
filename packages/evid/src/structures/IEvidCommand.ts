import type { IEvidCheckCommand } from "./IEvidCheckCommand";
import type { IEvidGraphCommand } from "./IEvidGraphCommand";
import type { IEvidHelpCommand } from "./IEvidHelpCommand";
import type { IEvidInspectCommand } from "./IEvidInspectCommand";
import type { IEvidInitCommand } from "./IEvidInitCommand";
import type { IEvidLanguagesCommand } from "./IEvidLanguagesCommand";
import type { IEvidListCommand } from "./IEvidListCommand";
import type { IEvidVersionCommand } from "./IEvidVersionCommand";

/**
 * Validated operation selected from the complete CLI argument list.
 *
 * Parsing rejects unknown, repeated, or incompatible options before producing
 * this discriminated union. Execution dispatches on operation without
 * reinterpreting raw tokens or allowing trailing input to escape validation.
 */
export type IEvidCommand =
  | IEvidCheckCommand
  | IEvidGraphCommand
  | IEvidHelpCommand
  | IEvidInspectCommand
  | IEvidInitCommand
  | IEvidLanguagesCommand
  | IEvidListCommand
  | IEvidVersionCommand;
