import type {
  EvidDatabaseType,
  EvidDatabaseSymbol,
} from "evid";
import type { IAdapterCertificationBase } from "./IAdapterCertificationBase";

/** Complete executable contract for one independently configured database adapter. */
export interface IDatabaseAdapterCertification extends IAdapterCertificationBase<
  EvidDatabaseType,
  EvidDatabaseSymbol
> {}
