import { SqlAdapter } from "./SqlAdapter";
import { SqlFileScanner } from "./SqlFileScanner";

/** Extracts the explicitly configured portable SQL CREATE TABLE surface. */
export class EvidenceSqlAdapter extends SqlAdapter {
  /** Selects the portable grammar policy without probing another dialect. */
  public constructor() {
    super({ type: "sql", scan: scan });
  }
}

/** Copies portable declarations while the parser session is borrowed. */
function scan(
  ...args: ConstructorParameters<typeof SqlFileScanner>
): ReturnType<SqlFileScanner["scan"]> {
  return new SqlFileScanner(...args).scan();
}
