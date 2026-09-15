import type { EvidenceDatabaseType, EvidenceDatabaseSymbol } from "@wrtnlabs/evidence";
import type { IEvidenceAdapterCertificationBase } from "./IEvidenceAdapterCertificationBase";

/**
 * Complete executable contract for one independently configured database
 * adapter.
 */
export interface IEvidenceDatabaseAdapterCertification extends IEvidenceAdapterCertificationBase<
  EvidenceDatabaseType,
  EvidenceDatabaseSymbol
> {}
