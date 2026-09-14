import type { IEvidenceUnit } from "../../structures/IEvidenceUnit";

/** One Python declaration and its suffix under a module binding. */
export interface IPythonOwnedUnit {
  unit: IEvidenceUnit;
  roots: string[];
  suffix: string[];
}
