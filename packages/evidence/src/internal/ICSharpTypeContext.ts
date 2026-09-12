import type { CSharpTypeKind } from "./CSharpTypeKind";
import type { ICSharpDeclarationAddress } from "./ICSharpDeclarationAddress";

/** One C# type owner while its nested declarations are scanned. */
export interface ICSharpTypeContext {
  declarationId: string;
  identity: string[];
  addresses: ICSharpDeclarationAddress[];
  kind: CSharpTypeKind;
}
