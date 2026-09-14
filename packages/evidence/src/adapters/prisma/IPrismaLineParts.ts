import type { IPrismaPendingComment } from "./IPrismaPendingComment";

/** Prisma source line split into structural code and optional comment text. */
export interface IPrismaLineParts {
  code: string;
  comment?: IPrismaPendingComment;
  commented: boolean;
}
