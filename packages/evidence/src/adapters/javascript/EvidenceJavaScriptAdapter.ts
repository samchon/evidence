import { EcmaScriptAdapter } from "../ecmascript/EcmaScriptAdapter";

/** Builds JavaScript and JSX public declarations from the pinned Tree-sitter grammar. */
export class EvidenceJavaScriptAdapter extends EcmaScriptAdapter {
  public constructor() {
    super("javascript", "JavaScript");
  }
}
