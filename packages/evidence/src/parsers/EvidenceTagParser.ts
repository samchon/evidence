import type { IEvidenceTagContext } from "../contexts/IEvidenceTagContext";
import { SourceText } from "../internal/SourceText";
import { EvidenceTagProgrammer } from "../programmers/EvidenceTagProgrammer";
import type { IEvidenceDocumentation } from "../structures/IEvidenceDocumentation";
import type { IEvidenceHost } from "../structures/IEvidenceHost";
import type { IEvidenceTagParseResult } from "../structures/IEvidenceTagParseResult";

/**
 * Coordinates annotation parsing for one documented host.
 *
 * Every parse creates fresh continuation, fence, and diagnostic state. The adapter's host and source mapping are captured when the controller is constructed.
 */
export class EvidenceTagParser {
  /** Original source bytes represented as UTF-16 text for coordinate mapping. */
  private readonly content: string;

  /** Captured attachment and semantic identity of the documented host. */
  private readonly host: IEvidenceHost;

  /** Captured documentation text, source offsets, and supported tag boundaries. */
  private readonly documentation: IEvidenceDocumentation;

  /** Captures one adapter-established host and its mapped documentation. */
  public constructor(
    content: string,
    host: IEvidenceHost,
    documentation: IEvidenceDocumentation,
  ) {
    this.content = content;
    this.host = structuredClone(host);
    this.documentation = structuredClone(documentation);
  }

  /** Parses the captured documentation with an independent mutable context. */
  public parse(): IEvidenceTagParseResult {
    const context: IEvidenceTagContext = {
      source: new SourceText(this.content),
      host: this.host,
      documentation: this.documentation,
      result: {
        declarations: [],
        reviews: [],
        withdrawals: [],
        diagnostics: [],
      },
      pending: undefined,
      fence: "",
      fenceLength: 0,
    };
    return EvidenceTagProgrammer.parse(context);
  }

  /** Creates a controller for one documentation parse operation. */
  public static parse(
    content: string,
    host: IEvidenceHost,
    documentation: IEvidenceDocumentation,
  ): IEvidenceTagParseResult {
    return new EvidenceTagParser(content, host, documentation).parse();
  }
}
