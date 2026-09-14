import type {
  EvidenceProgrammingSymbol,
  IEvidenceWithdrawal,
} from "@wrtnlabs/evidence";
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
