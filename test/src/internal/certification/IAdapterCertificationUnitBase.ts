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
  /** Selector-qualified identity used in assertions. */
  key: string;
  /** Expected family selector. */
  symbol: TSymbol;
  /** Exact semantic identity segments. */
  identity: string[];
  /** Selector-qualified owning unit identity. */
  parent?: string;
  /** Distinct physical declaration positions. */
  sites: number;
  /** Every expected public path and alias. */
  addresses: IAdapterCertificationAddress[];
  /** Explicit visibility withdrawals. */
  withdrawals: IEvidenceWithdrawal["tag"][];
}
