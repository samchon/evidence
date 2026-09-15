import type { EvidDatabaseType, EvidDatabaseSymbol } from "evid";
import type { IEvidAdapterCertificationBase } from "./IEvidAdapterCertificationBase";

/**
 * Complete executable contract for one independently configured database
 * adapter.
 */
export interface IEvidDatabaseAdapterCertification extends IEvidAdapterCertificationBase<
  EvidDatabaseType,
  EvidDatabaseSymbol
> {}
