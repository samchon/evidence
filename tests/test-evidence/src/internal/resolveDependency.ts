import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolves a dependency's package root, not its entry point.
 *
 * Walks up from the `package.json` rather than trusting a main entry: `ttsc`
 * resolves to a launcher, and what is needed here is the package root.
 */
export const resolveDependency = (specifier: string): string => {
  const manifest: string = fileURLToPath(
    import.meta.resolve(`${specifier}/package.json`),
  );
  return path.dirname(manifest);
};
