import type { IEvidAddress } from "../../structures/IEvidAddress";
import { EvidPrismaSyntax } from "./EvidPrismaSyntax";

/**
 * Parses one file-independent Prisma model or member target.
 *
 * Prisma references use the `prisma:` prefix because their parser-established
 * identities can span files, leaving the returned file key as a fixed
 * namespace.
 */
export namespace EvidPrismaTarget {
  export function parse(target: string): IEvidAddress {
    if (!target.startsWith("prisma:"))
      throw new Error("Start a Prisma target with 'prisma:'.");
    const segments = target.slice("prisma:".length).split(".");
    if (
      (segments.length !== 1 && segments.length !== 2) ||
      segments.some((segment) => !EvidPrismaSyntax.identifier(segment))
    )
      throw new Error(
        "Use prisma:Model or prisma:Model.member with valid Prisma identifiers.",
      );
    return { file: "prisma:", segments };
  }
}
