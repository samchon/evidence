import type { IEvidTagContext } from "../contexts/IEvidTagContext";
import { EvidSourceText } from "../internal/EvidSourceText";
import { EvidTagProgrammer } from "../programmers/EvidTagProgrammer";
import type { IEvidDocumentation } from "../structures/IEvidDocumentation";
import type { IEvidHost } from "../structures/IEvidHost";
import type { IEvidTagParseResult } from "../structures/IEvidTagParseResult";

/**
 * Coordinates annotation parsing for one documented host.
 *
 * Every parse creates fresh continuation, fence, and diagnostic state. The adapter
 * establishes host attachment and documentation mapping before construction; this
 * controller preserves those inputs while delegating the grammar to the tag programmer.
 */
export class EvidTagParser {
  /**
   * Original source content used to restore annotation positions.
   *
   * Documentation stores normalized text, while diagnostics must point into this
   * complete host source through the documentation's retained offset mapping.
   */
  private readonly content: string;

  /**
   * Adapter-established attachment and semantic identity of the documented host.
   *
   * The tag programmer uses this host for statements and diagnostics. It is copied
   * at construction so a caller cannot redirect parsed annotations by later mutation.
   */
  private readonly host: IEvidHost;

  /**
   * Mapped documentation accepted for this host by its adapter.
   *
   * Its tag boundaries and withdrawal policy define what annotation syntax is valid;
   * the copy keeps a parse operation tied to the attachment it was created for.
   */
  private readonly documentation: IEvidDocumentation;

  /**
   * Captures one adapter-established host and its mapped documentation.
   *
   * Callers supply the full source solely for source-coordinate conversion. The
   * constructor does not parse tags, allowing adapters to build all host records
   * before the independent parsing phase begins.
   */
  public constructor(
    content: string,
    host: IEvidHost,
    documentation: IEvidDocumentation,
  ) {
    this.content = content;
    this.host = structuredClone(host);
    this.documentation = structuredClone(documentation);
  }

  /**
   * Parses the captured documentation into statements, withdrawals, and diagnostics.
   *
   * Mutable continuation and code-fence state is allocated per call. Repeated calls
   * therefore produce independent results and cannot carry an unfinished tag from
   * one extraction cycle into another.
   */
  public parse(): IEvidTagParseResult {
    const context: IEvidTagContext = {
      source: new EvidSourceText(this.content),
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
    return EvidTagProgrammer.parse(context);
  }

  /**
   * Parses one adapter-mapped documentation attachment without retaining a controller.
   *
   * This convenience entry point has the same snapshot and isolation guarantees as
   * constructing a parser and calling `parse`, and is suitable for one-off adapter work.
   */
  public static parse(
    content: string,
    host: IEvidHost,
    documentation: IEvidDocumentation,
  ): IEvidTagParseResult {
    return new EvidTagParser(content, host, documentation).parse();
  }
}
