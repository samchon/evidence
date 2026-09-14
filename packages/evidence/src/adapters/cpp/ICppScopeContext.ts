import type { CppScopeKind } from "./CppScopeKind";

/** One namespace, record, or enum owner while C++ declarations are scanned. */
export interface ICppScopeContext {
  declarationId?: string;
  identity: string[];
  address: string[];
  kind: CppScopeKind;
  name: string;
  public: boolean;
}
