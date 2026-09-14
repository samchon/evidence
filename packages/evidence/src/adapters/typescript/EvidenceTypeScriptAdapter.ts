import { EcmaScriptAdapter } from "../ecmascript/EcmaScriptAdapter";

/** Builds TypeScript and TSX public declarations from pinned Tree-sitter grammars. */
export class EvidenceTypeScriptAdapter extends EcmaScriptAdapter {
  public constructor() {
    super("typescript", "TypeScript");
  }
}
