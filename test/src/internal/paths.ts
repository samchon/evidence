import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const repository = fileURLToPath(new URL("../../../", import.meta.url));
export const executable = join(
  repository,
  "packages/evidence/lib/executable/evidence.js",
);
