import type { IEvidenceAddress } from "../structures/IEvidenceAddress";

/** Parses one whitespace-free Swagger operation target. */
export namespace SwaggerTarget {
  export function parse(target: string): IEvidenceAddress {
    if (/\s/u.test(target))
      throw new Error("Remove whitespace from the Swagger operation target.");
    const separator = target.indexOf(":");
    const method = separator < 0 ? "" : target.slice(0, separator);
    const path = separator < 0 ? "" : target.slice(separator + 1);
    if (
      !/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/u.test(method) ||
      method !== method.toUpperCase() ||
      !path.startsWith("/")
    )
      throw new Error(
        "Use an uppercase METHOD:/path target such as POST:/members.",
      );
    return { file: "swagger:", segments: [target] };
  }
}
