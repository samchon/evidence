import type { JavaTypeKind } from "./JavaTypeKind";

/** One Java type owner while its nested declarations are scanned. */
export interface IJavaTypeContext {
  declarationId: string;
  identity: string[];
  address: string[];
  kind: JavaTypeKind;
  public: boolean;
}
