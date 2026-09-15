import type {
  EvidProgrammingSymbol,
  EvidDatabaseSymbol,
  IEvidWithdrawal,
} from "evid";
import type { IEvidAdapterCertificationAddress } from "./IEvidAdapterCertificationAddress";

/** Exact semantic identity, ownership, sites, addresses, and withdrawal state. */
export interface IEvidAdapterCertificationUnitBase<
  TSymbol extends EvidProgrammingSymbol | EvidDatabaseSymbol,
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
  addresses: IEvidAdapterCertificationAddress[];

  /** Explicit visibility withdrawals. */
  withdrawals: IEvidWithdrawal["tag"][];
}
