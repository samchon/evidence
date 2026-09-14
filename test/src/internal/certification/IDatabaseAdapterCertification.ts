import type {
  EvidenceDatabaseType,
  EvidenceDatabaseSymbol,
} from "@wrtnlabs/evidence";
import type { IAdapterCertificationBase } from "./IAdapterCertificationBase";

/** Complete executable contract for one independently configured database adapter. */
export interface IDatabaseAdapterCertification extends IAdapterCertificationBase<
  EvidenceDatabaseType,
  EvidenceDatabaseSymbol
> {}
