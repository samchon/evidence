import { EvidSqlAdapterBase } from "./EvidSqlAdapterBase";
import { EvidSqlFileScanner } from "./EvidSqlFileScanner";

/** Extracts the explicitly configured portable SQL CREATE TABLE surface.
 *
 * This entry fixes interpretation to the portable grammar; shared `.sql` files
 * never trigger dialect probing that could change the selected population.
 */
export class EvidSqlAdapter extends EvidSqlAdapterBase {
  /** Selects the portable grammar policy without probing another dialect.
   *
   * Parser lifetime and inventory materialization remain owned by `EvidSqlAdapterBase`.
   */
  public constructor() {
    super({ type: "sql", scan: scan });
  }
}

/** Copies portable declarations while the parser session is borrowed.
 *
 * The scanner returns node-free records so no native Tree-sitter value escapes
 * the callback that owns the parse session.
 */
function scan(
  ...args: ConstructorParameters<typeof EvidSqlFileScanner>
): ReturnType<EvidSqlFileScanner["scan"]> {
  return new EvidSqlFileScanner(...args).scan();
}
