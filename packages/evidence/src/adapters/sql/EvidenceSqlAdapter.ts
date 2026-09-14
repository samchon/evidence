import { SqlAdapter } from "./SqlAdapter";
import { SqlFileScanner } from "./SqlFileScanner";

/** Extracts the explicitly configured portable SQL CREATE TABLE surface.
 *
 * This entry fixes interpretation to the portable grammar; shared `.sql` files
 * never trigger dialect probing that could change the selected population.
 */
export class EvidenceSqlAdapter extends SqlAdapter {
  /** Selects the portable grammar policy without probing another dialect.
   *
   * Parser lifetime and inventory materialization remain owned by `SqlAdapter`.
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
  ...args: ConstructorParameters<typeof SqlFileScanner>
): ReturnType<SqlFileScanner["scan"]> {
  return new SqlFileScanner(...args).scan();
}
