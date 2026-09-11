import { copyFileSync } from "node:fs";

// Resolve from this script so direct package packing works from any cwd.
const repository = new URL("../", import.meta.url);
for (const filename of ["README.md", "LICENSE"]) {
  copyFileSync(
    new URL(filename, repository),
    new URL(`packages/evidence/${filename}`, repository),
  );
}
