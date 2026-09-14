import { EcmaScriptAdapter } from "../ecmascript/EcmaScriptAdapter";

/** Builds TypeScript and TSX public declarations from packaged Tree-sitter grammars. */
export class EvidenceTypeScriptAdapter extends EcmaScriptAdapter {
  public constructor() {
    super("typescript", "TypeScript");
  }
}
