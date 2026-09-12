import type { EvidenceProgrammingSymbol } from "../../../../packages/evidence/src/typings/EvidenceProgrammingSymbol";
import type { IEvidenceWithdrawal } from "../../../../packages/evidence/src/structures/IEvidenceWithdrawal";
import type { IAdapterCertificationAddress } from "./IAdapterCertificationAddress";

/** Exact semantic identity, ownership, sites, addresses, and withdrawal state. */
export interface IAdapterCertificationUnit {
  key: string;
  symbol: EvidenceProgrammingSymbol;
  identity: string[];
  parent?: string;
  sites: number;
  addresses: IAdapterCertificationAddress[];
  withdrawals: IEvidenceWithdrawal["tag"][];
}
