import { EcmaScriptAdapter } from "./internal/EcmaScriptAdapter";

/** Builds JavaScript and JSX public declarations from the packaged Tree-sitter grammar. */
export class EvidenceJavaScriptAdapter extends EcmaScriptAdapter {
  public constructor() {
    super("javascript", "JavaScript");
  }
}
