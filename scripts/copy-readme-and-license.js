const { copyFileSync } = require("node:fs");
const { join, resolve } = require("node:path");

// Resolve from this script so direct package packing works from any cwd.
const repository = resolve(__dirname, "..");
for (const filename of ["README.md", "LICENSE"]) {
  copyFileSync(
    join(repository, filename),
    join(repository, "packages/evidence", filename),
  );
}
