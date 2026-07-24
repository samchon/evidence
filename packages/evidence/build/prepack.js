const fs = require("node:fs");
const path = require("node:path");

for (const file of ["LICENSE", "README.md"])
  fs.copyFileSync(
    path.join(__dirname, "..", "..", "..", file),
    path.join(__dirname, "..", file),
  );
