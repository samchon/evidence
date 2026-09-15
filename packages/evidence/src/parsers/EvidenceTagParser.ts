import type { IEvidenceTagContext } from "../contexts/IEvidenceTagContext";
import { EvidenceSourceText } from "../internal/EvidenceSourceText";
import { EvidenceTagProgrammer } from "../programmers/EvidenceTagProgrammer";
import type { IEvidenceDocumentation } from "../structures/IEvidenceDocumentation";
import type { IEvidenceHost } from "../structures/IEvidenceHost";
import type { IEvidenceTagParseResult } from "../structures/IEvidenceTagParseResult";

/**
 * Coordinates annotation parsing for one documented host.
 *
 * Every parse creates fresh continuation, fence, and diagnostic state. The
 * adapter establishes host attachment and documentation mapping before
 * construction; this controller preserves those inputs while delegating the
 * grammar to the tag programmer.
 */
export class EvidenceTagParser {
  /**
   * Original source content used to restore annotation positions.
   *
   * Documentation stores normalized text, while diagnostics must point into
   * this complete host source through the documentation's retained offset
   * mapping.
   */
  private readonly content: string;

  /**
   * Adapter-established attachment and semantic identity of the documented
   * host.
   *
   * The tag programmer uses this host for statements and diagnostics. It is
   * copied at construction so a caller cannot redirect parsed annotations by
   * later mutation.
   */
  private readonly host: IEvidenceHost;

  /**
   * Mapped documentation accepted for this host by its adapter.
   *
   * Its tag boundaries and withdrawal policy define what annotation syntax is
   * valid; the copy keeps a parse operation tied to the attachment it was
   * created for.
   */
  private readonly documentation: IEvidenceDocumentation;

  /**
   * Captures one adapter-established host and its mapped documentation.
   *
   * Callers supply the full source solely for source-coordinate conversion. The
   * constructor does not parse tags, allowing adapters to build all host
   * records before the independent parsing phase begins.
   */
  public constructor(
    content: string,
    host: IEvidenceHost,
    documentation: IEvidenceDocumentation,
  ) {
    this.content = content;
    this.host = structuredClone(host);
    this.documentation = structuredClone(documentation);
  }

  /**
   * Parses the captured documentation into statements, withdrawals, and
   * diagnostics.
   *
   * Mutable continuation and code-fence state is allocated per call. Repeated
   * calls therefore produce independent results and cannot carry an unfinished
   * tag from one extraction cycle into another.
   */
  public parse(): IEvidenceTagParseResult {
    const context: IEvidenceTagContext = {
      source: new EvidenceSourceText(this.content),
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

  /**
   * Parses one adapter-mapped documentation attachment without retaining a
   * controller.
   *
   * This convenience entry point has the same snapshot and isolation guarantees
   * as constructing a parser and calling `parse`, and is suitable for one-off
   * adapter work.
   */
  public static parse(
    content: string,
    host: IEvidenceHost,
    documentation: IEvidenceDocumentation,
  ): IEvidenceTagParseResult {
    return new EvidenceTagParser(content, host, documentation).parse();
  }
}
