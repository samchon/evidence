import type {
  EvidenceProgrammingSymbol,
  EvidenceDatabaseSymbol,
  IEvidenceWithdrawal,
} from "@wrtnlabs/evidence";
import type { IAdapterCertificationAddress } from "./IAdapterCertificationAddress";

/** Exact semantic identity, ownership, sites, addresses, and withdrawal state. */
export interface IAdapterCertificationUnitBase<
  TSymbol extends EvidenceProgrammingSymbol | EvidenceDatabaseSymbol,
> {
  key: string;
  symbol: TSymbol;
  identity: string[];
  parent?: string;
  sites: number;
  addresses: IAdapterCertificationAddress[];
  withdrawals: IEvidenceWithdrawal["tag"][];
}
