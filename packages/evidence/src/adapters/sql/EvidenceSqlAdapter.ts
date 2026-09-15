import { EvidenceSqlInventoryMaterializer } from "./EvidenceSqlInventoryMaterializer";
import { EvidenceSqlFileScanner } from "./EvidenceSqlFileScanner";
import type { IEvidenceAdapter } from "../../structures/IEvidenceAdapter";
import type { IEvidenceInventory } from "../../structures/IEvidenceInventory";
import type { IEvidenceSourceSnapshot } from "../../structures/IEvidenceSourceSnapshot";

const Evidence_SQL_TYPE = "sql" as const;

/**
 * Extracts the explicitly configured portable SQL CREATE TABLE surface.
 *
 * This entry fixes interpretation to the portable grammar; shared `.sql` files
 * never trigger dialect probing that could change the selected population.
 */
export class EvidenceSqlAdapter implements IEvidenceAdapter<"sql"> {
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
  private readonly materializer: EvidenceSqlInventoryMaterializer =
    new EvidenceSqlInventoryMaterializer({ type: Evidence_SQL_TYPE, scan });

  /**
   * Extracts portable SQL declarations from one captured source snapshot.
   *
   * No dialect probing occurs: the fixed portable scanner remains responsible
   * for syntax interpretation while the shared materializer publishes records.
   */
  public analyze(
    snapshot: IEvidenceSourceSnapshot,
  ): Promise<IEvidenceInventory> {
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
  ...args: ConstructorParameters<typeof EvidenceSqlFileScanner>
): ReturnType<EvidenceSqlFileScanner["scan"]> {
  return new EvidenceSqlFileScanner(...args).scan();
}
