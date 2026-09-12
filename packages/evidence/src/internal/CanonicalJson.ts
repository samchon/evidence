import { createHash } from "node:crypto";

/** Produces stable digests for parser-normalized declarations. */
export namespace CanonicalJson {
  export function digest(value: unknown): string {
    return createHash("sha256").update(render(value, new Set())).digest("hex");
  }

  /** Copies an object without fields that do not belong to semantic content. */
  export function without(
    value: object,
    keys: string[],
  ): Record<string, unknown> {
    const excluded = new Set(keys);
    return Object.fromEntries(
      Object.entries(value).filter(([key]) => !excluded.has(key)),
    );
  }

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

  function stringify(value: unknown): string {
    return JSON.stringify(value) ?? "null";
  }
}
