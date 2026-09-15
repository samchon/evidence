import { createHash } from "node:crypto";

/**
 * Produces canonical JSON-derived values for semantic identity calculations.
 *
 * The renderer normalizes object order and cyclic references so equivalent
 * extracted structures have stable hashes across process runs.
 */
export namespace EvidCanonicalJson {
  /** Hashes a canonical representation with SHA-256 for persisted semantic comparison.
   *
   * Fingerprint consumers use the digest to compare semantic records whose ordinary object enumeration order may differ.
   */
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

  /** Serializes values recursively while replacing an active cycle with a stable sentinel.
   *
   * Tracking only the active ancestry permits shared acyclic values while preventing recursive structures from making fingerprint rendering diverge.
   */
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

  /** Serializes JSON primitives while representing unsupported values as `null`.
   *
   * This follows `JSON.stringify` for representable primitives and keeps the canonical renderer total for arbitrary input.
   */
  function stringify(value: unknown): string {
    return JSON.stringify(value) ?? "null";
  }
}
