import { EvidSqlInventoryMaterializer } from "./EvidSqlInventoryMaterializer";
import { EvidSqlFileScanner } from "./EvidSqlFileScanner";
import type { IEvidAdapter } from "../../structures/IEvidAdapter";
import type { IEvidInventory } from "../../structures/IEvidInventory";
import type { IEvidSourceSnapshot } from "../../structures/IEvidSourceSnapshot";

const EVID_SQL_TYPE = "sql" as const;

/**
 * Extracts the explicitly configured portable SQL CREATE TABLE surface.
 *
 * This entry fixes interpretation to the portable grammar; shared `.sql` files
 * never trigger dialect probing that could change the selected population.
 */
export class EvidSqlAdapter implements IEvidAdapter<"sql"> {
  /**
   * Portable SQL grammar selected for this adapter.
   *
   * This fixed identity prevents a shared `.sql` suffix from implicitly
   * selecting a dialect with a different declaration population.
   */
  public get type(): "sql" {
    return "sql";
  }

  /**
   * Materializes scanner records into the public SQL inventory.
   *
   * The adapter owns portable SQL policy; the materializer owns only the parser
   * lifetime and syntax-independent inventory publication.
   */
  private readonly materializer: EvidSqlInventoryMaterializer =
    new EvidSqlInventoryMaterializer({ type: EVID_SQL_TYPE, scan });

  /**
   * Extracts portable SQL declarations from one captured source snapshot.
   *
   * No dialect probing occurs: the fixed portable scanner remains responsible
   * for syntax interpretation while the shared materializer publishes records.
   */
  public analyze(snapshot: IEvidSourceSnapshot): Promise<IEvidInventory> {
    return this.materializer.analyze(snapshot);
  }
}

/**
 * Copies portable declarations while the parser session is borrowed.
 *
 * The scanner returns node-free records so no native Tree-sitter value escapes
 * the callback that owns the parse session.
 */
function scan(
  ...args: ConstructorParameters<typeof EvidSqlFileScanner>
): ReturnType<EvidSqlFileScanner["scan"]> {
  return new EvidSqlFileScanner(...args).scan();
}
