/**
 * Represents one Dart export combinator retained from source order.
 *
 * An {@link IEvidenceDartDirective} owns these filters, and
 * EvidenceDartLibraries applies them in sequence while deciding whether each
 * exported top-level name is public.
 */
export interface IEvidenceDartExportFilter {
  /**
   * Selects whether this combinator keeps or removes its listed names.
   *
   * A `show` filter admits only listed candidates at its position, while a
   * `hide` filter removes listed candidates that earlier filters permitted.
   */
  kind: "show" | "hide";

  /**
   * Lists literal top-level declaration names affected by this combinator.
   *
   * The names preserve source spelling and are compared with the candidate
   * export name; they are not paths or resolved declaration identities.
   */
  names: string[];
}
