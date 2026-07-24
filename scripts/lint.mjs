import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Runs this repository's own evidence rules over its own source.
//
// The plugin asserts that a rule is worth having only when the build enforces
// it. Shipping three rules and submitting to none of them is the same shape as
// a spec nobody checks, which is the failure the graph exists to make
// impossible — so the repository lints itself, in CI, on every platform.

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

// The feature suite pins the ttsc plugin cache to this exact directory so its
// fixtures pay the cold Go link once instead of once each. Deriving the same
// path here is what keeps self-linting free: a differing path is a second cold
// link, minutes long, on all three CI platforms. See
// `tests/test-evidence/src/internal/runCheck.ts`.
const sharedCache = path.join(
  repositoryRoot,
  "tests",
  "test-evidence",
  ".cache",
  "ttsc",
);

// Where ttsc caches when nothing pins it. Its appearance is the symptom of a
// lint step that stopped sharing, which is invisible to correctness and
// expensive in wall clock — so it is asserted rather than trusted.
const defaultCache = path.join(repositoryRoot, "node_modules", ".cache", "ttsc");

const projects = [
  path.join(repositoryRoot, "packages", "evidence"),
  path.join(repositoryRoot, "tests", "test-evidence"),
];

// Walk up from the manifest rather than resolving the launcher directly: `ttsc`
// restricts its subpath exports, and what is needed here is the package root.
const launcher = path.join(
  path.dirname(
    createRequire(
      path.join(repositoryRoot, "packages", "evidence", "package.json"),
    ).resolve("ttsc/package.json"),
  ),
  "lib",
  "launcher",
  "ttsc.js",
);

fs.mkdirSync(sharedCache, { recursive: true });
const strayCacheBefore = fs.existsSync(defaultCache);

let failed = false;
for (const project of projects) {
  const relative = path.relative(repositoryRoot, project);
  console.log(`> evidence lint ${relative.split(path.sep).join("/")}`);
  const result = spawnSync(
    process.execPath,
    [launcher, "check", "-p", "tsconfig.json"],
    {
      cwd: project,
      stdio: "inherit",
      env: { ...process.env, TTSC_CACHE_DIR: sharedCache },
      // The first run of a cache key statically links the plugin's Go into the
      // lint binary, which ttsc warns can take several minutes cold.
      timeout: 900_000,
    },
  );
  if (result.status !== 0) failed = true;
}

if (!strayCacheBefore && fs.existsSync(defaultCache)) {
  console.error(
    `\nevidence lint used an unpinned plugin cache.\n\n` +
      `  expected: ${sharedCache}\n` +
      `  created:  ${defaultCache}\n\n` +
      `Every ttsc invocation in this repository must share the feature suite's ` +
      `cache directory. An unshared cache costs a second cold Go link per ` +
      `platform on every pull request, and nothing else in the build reports it.`,
  );
  failed = true;
}

process.exit(failed ? 1 : 0);
