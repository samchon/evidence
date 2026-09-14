import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";

/** Source position found for one parser-established Prisma identity. */
export interface IPrismaLocation {
  key: string;
  range: IEvidenceSourceRange;
}
