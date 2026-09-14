import { createHash } from "node:crypto";

/**
 * Produces canonical JSON-derived values for semantic identity calculations.
 *
 * The renderer normalizes object order and cyclic references so equivalent
 * extracted structures have stable hashes across process runs.
 */
export namespace CanonicalJson {
  /** Hashes the canonical representation with SHA-256 for persisted semantic comparison. */
  export function digest(value: unknown): string {
    return createHash("sha256").update(render(value, new Set())).digest("hex");
  }

  /**
   * Copies enumerable fields except caller-named non-semantic metadata.
   *
   * This is non-mutating because adapters may reuse the source record for
   * diagnostics after computing an identity-specific view.
   */
  export function without(
    value: object,
    keys: string[],
  ): Record<string, unknown> {
    const excluded = new Set(keys);
    return Object.fromEntries(
      Object.entries(value).filter(([key]) => !excluded.has(key)),
    );
  }

  /** Recursively serializes values while replacing an active cycle with a stable sentinel. */
  function render(value: unknown, seen: Set<object>): string {
    if (value === null || typeof value !== "object") return stringify(value);
    if (seen.has(value)) return '"[circular]"';
    seen.add(value);
    try {
      if (Array.isArray(value)) {
        const elements: unknown[] = value;
        return `[${elements
          .map((element) => render(element ?? null, seen))
          .join(",")}]`;
      }
      const raw: Array<[string, unknown]> = Object.entries(value);
      const entries = raw.filter(([, element]) => element !== undefined);
      entries.sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0));
      return `{${entries
        .map(
          ([key, element]) => `${JSON.stringify(key)}:${render(element, seen)}`,
        )
        .join(",")}}`;
    } finally {
      seen.delete(value);
    }
  }

  /** Preserves JSON primitive semantics while making unsupported values explicit as null. */
  function stringify(value: unknown): string {
    return JSON.stringify(value) ?? "null";
  }
}
