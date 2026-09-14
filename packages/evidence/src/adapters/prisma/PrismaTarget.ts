import type { IEvidenceAddress } from "../../structures/IEvidenceAddress";
import { PrismaSyntax } from "./PrismaSyntax";

/**
 * Parses one file-independent Prisma model or member target.
 *
 * Prisma references use the `prisma:` prefix because their parser-established
 * identities can span files, leaving the returned file key as a fixed namespace.
 */
export namespace PrismaTarget {
  export function parse(target: string): IEvidenceAddress {
    if (!target.startsWith("prisma:"))
      throw new Error("Start a Prisma target with 'prisma:'.");
    const segments = target.slice("prisma:".length).split(".");
    if (
      (segments.length !== 1 && segments.length !== 2) ||
      segments.some((segment) => !PrismaSyntax.identifier(segment))
    )
      throw new Error(
        "Use prisma:Model or prisma:Model.member with valid Prisma identifiers.",
      );
    return { file: "prisma:", segments };
  }
}
