import { copyFileSync } from "node:fs";
import { join, resolve } from "node:path";

// Resolve from this script so direct package packing works from any cwd.
const repository = resolve(__dirname, "..");
for (const filename of ["README.md", "LICENSE"]) {
  copyFileSync(
    join(repository, filename),
    join(repository, "packages/evidence", filename),
  );
}
