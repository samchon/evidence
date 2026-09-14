import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

/** Creates and removes disposable file trees for logic tests. */
export namespace TestFileSystem {
  /** Writes relative file names, creating their parent directories as needed. */
  export async function save(
    location: string,
    records: Record<string, string>,
  ): Promise<void> {
    await mkdir(location, { recursive: true });

    for (const [name, content] of Object.entries(records)) {
      const filename = resolve(location, name);
      await mkdir(dirname(filename), { recursive: true });
      await writeFile(filename, content, "utf8");
    }
  }

  /** Removes the disposable directory and its contents. */
  export async function erase(location: string): Promise<void> {
    await rm(resolve(location), {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
  }

  /** Runs a closure in a new fixture directory and cleans up after either outcome. */
  export async function experiment<T>(
    location: string,
    records: Record<string, string>,
    closure: (directory: string) => T | Promise<T>,
  ): Promise<T> {
    const root = resolve(__dirname, "../../.tmp/fixtures");
    await mkdir(root, { recursive: true });
    const directory = await mkdtemp(join(root, basename(location) + "-"));

    try {
      await save(directory, records);
      return await closure(directory);
    } finally {
      await erase(directory);
    }
  }
}
