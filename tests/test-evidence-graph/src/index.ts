import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Minimal runner. Discovers `test_*` exports under `features/`, runs each, and
// exits non-zero if any threw.
//
// Hand-rolled rather than pulling in a framework: what these tests assert is the
// observable output of a real `ttsc` process, so a runner needs to import
// modules, call functions, and count failures. A framework would add a
// dependency and a config file to buy `describe`/`it` sugar this suite has no
// use for.
const directory: string = path.dirname(fileURLToPath(import.meta.url));

const collect = (root: string): string[] => {
  const found: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const location: string = path.join(root, entry.name);
    if (entry.isDirectory()) found.push(...collect(location));
    else if (entry.name.startsWith("test_") && entry.name.endsWith(".ts"))
      found.push(location);
  }
  return found;
};

const main = async (): Promise<void> => {
  const only: string | undefined = process.argv
    .find((argument) => argument.startsWith("--include="))
    ?.slice("--include=".length);

  const files: string[] = collect(path.join(directory, "features")).filter(
    (file) => only === undefined || file.includes(only),
  );

  const failures: Error[] = [];
  for (const file of files) {
    const module: Record<string, unknown> = await import(
      new URL(`file://${file.split(path.sep).join("/")}`).href
    );
    for (const [name, value] of Object.entries(module)) {
      if (!name.startsWith("test_") || typeof value !== "function") continue;
      const started: number = Date.now();
      try {
        await (value as () => unknown | Promise<unknown>)();
        console.log(`  - ${name}: ${Date.now() - started} ms`);
      } catch (error) {
        console.log(`  - ${name}: FAILED`);
        failures.push(error as Error);
      }
    }
  }

  if (failures.length === 0) {
    console.log(`\nSuccess — ${files.length} feature(s).`);
    return;
  }
  for (const failure of failures) console.error(failure);
  console.error(`\nFailed — ${failures.length} case(s).`);
  process.exit(-1);
};

main().catch((error) => {
  console.error(error);
  process.exit(-1);
});
