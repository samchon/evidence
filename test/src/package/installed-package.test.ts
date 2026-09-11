import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { t, x } from "tar";

import { repository } from "../internal/paths.js";

/**
 * Verifies the actual tarball in an independent pnpm consumer.
 *
 * Workspace links can conceal missing declarations, assets, README copies,
 * or executable metadata that only fail after publication.
 * 1. Pack through the package lifecycle after making the generated README stale.
 * 2. Inspect the archive and compare its README and license with the root.
 * 3. Install it offline with the required peers outside this checkout.
 * 4. Check public types, the CLI shim, and the installed compiler peers.
 */
test("the packed package installs with its peers and fresh root documentation", async () => {
  const scratch = mkdtempSync(join(tmpdir(), "evidence-package-"));
  const pnpmPath = process.env.npm_execpath;
  assert.ok(pnpmPath, "Run package verification through pnpm.");
  const pnpmCommand = pnpmPath.endsWith(".exe") ? pnpmPath : process.execPath;
  const pnpmPrefix = pnpmPath.endsWith(".exe") ? [] : [pnpmPath];
  const runPnpm = (cwd: string, args: string[]): string => {
    const result = spawnSync(pnpmCommand, [...pnpmPrefix, ...args], {
      cwd,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    return result.stdout;
  };
  try {
    // The OS temp directory can be on another drive with a different pnpm store.
    const storeRoot = dirname(runPnpm(repository, ["store", "path"]).trim());
    const packageRoot = join(repository, "packages/evidence");
    writeFileSync(join(packageRoot, "README.md"), "stale generated README\n");
    runPnpm(packageRoot, ["pack", "--pack-destination", scratch]);
    const archives = readdirSync(scratch).filter((name) =>
      name.endsWith(".tgz"),
    );
    assert.equal(archives.length, 1);
    const archive = join(scratch, archives[0]!);
    const entries: string[] = [];
    await t({
      file: archive,
      onReadEntry: (entry) => entries.push(entry.path),
    });
    for (const required of [
      "package/package.json",
      "package/README.md",
      "package/LICENSE",
      "package/lib/index.js",
      "package/lib/index.d.ts",
      "package/lib/executable/evidence.js",
    ])
      assert.ok(
        entries.includes(required),
        `Missing archive entry: ${required}`,
      );
    assert.ok(
      entries.every((entry) =>
        /^package\/(?:package\.json|README\.md|LICENSE|lib\/.*\.(?:js|d\.ts))$/.test(
          entry,
        ),
      ),
      `Unexpected archive contents: ${entries.join(", ")}`,
    );
    const unpacked = join(scratch, "unpacked");
    mkdirSync(unpacked);
    await x({ file: archive, cwd: unpacked });
    for (const filename of ["README.md", "LICENSE"])
      assert.equal(
        readFileSync(join(unpacked, "package", filename), "utf8"),
        readFileSync(join(repository, filename), "utf8"),
      );
    const manifestText = readFileSync(
      join(unpacked, "package/package.json"),
      "utf8",
    );
    assert.doesNotMatch(manifestText, /workspace:|catalog:/);
    assert.match(
      readFileSync(
        join(unpacked, "package/lib/executable/evidence.js"),
        "utf8",
      ),
      /^#!\/usr\/bin\/env node\n/,
    );

    const consumer = join(scratch, "consumer with spaces");
    mkdirSync(consumer);
    writeFileSync(
      join(consumer, "package.json"),
      JSON.stringify({
        name: "evidence-package-consumer",
        private: true,
        type: "module",
      }),
    );
    writeFileSync(
      join(consumer, "pnpm-workspace.yaml"),
      `autoInstallPeers: false\nstrictPeerDependencies: true\nstoreDir: ${JSON.stringify(storeRoot)}\n`,
    );
    const require = createRequire(import.meta.url);
    const typescript = require("typescript/package.json") as {
      version: string;
    };
    const ttsc = require("ttsc/package.json") as { version: string };
    runPnpm(consumer, [
      "add",
      "-D",
      "--offline",
      `typescript@${typescript.version}`,
      `ttsc@${ttsc.version}`,
      archive,
    ]);
    writeFileSync(
      join(consumer, "consumer-한글.ts"),
      'import * as evidence from "@samchon/evidence";\nexport type EvidenceApi = typeof evidence;\n',
    );
    writeFileSync(
      join(consumer, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { module: "NodeNext", strict: true, noEmit: true },
        files: ["consumer-한글.ts"],
      }),
    );
    runPnpm(consumer, ["exec", "tsc", "-p", "tsconfig.json"]);
    const installed = JSON.parse(manifestText) as { version: string };
    assert.equal(
      runPnpm(consumer, ["exec", "evidence", "--version"]).trim(),
      installed.version,
    );
    assert.match(
      runPnpm(consumer, ["exec", "evidence", "--help"]),
      /not implemented yet/,
    );
    assert.match(runPnpm(consumer, ["exec", "ttsc", "--version"]), /\d+\.\d+/);
    assert.match(runPnpm(consumer, ["exec", "ttsx", "--version"]), /\d+\.\d+/);
    assert.equal(
      runPnpm(consumer, [
        "exec",
        "node",
        "--input-type=module",
        "--eval",
        'await import("@samchon/evidence")',
      ]),
      "",
    );
    const unchecked = spawnSync(
      pnpmCommand,
      [...pnpmPrefix, "exec", "evidence", "check"],
      {
        cwd: consumer,
        encoding: "utf8",
        windowsHide: true,
      },
    );
    assert.ifError(unchecked.error);
    assert.equal(unchecked.status, 2);
    assert.match(unchecked.stderr, /No project was checked/);
  } finally {
    assert.equal(dirname(resolve(scratch)), resolve(tmpdir()));
    rmSync(scratch, { recursive: true, force: true });
  }
});
