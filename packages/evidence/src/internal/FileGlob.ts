import type { IFileGlobPattern } from "./IFileGlobPattern";

/** The upstream Evidence glob language: *, **, ?, and ordered negation. */
export class FileGlob {
  private readonly patterns: IFileGlobPattern[];

  public constructor(patterns: readonly string[]) {
    this.patterns = patterns.map(compile);
    if (!this.patterns.some((pattern) => !pattern.exclude))
      throw new Error(
        "The files array must contain at least one positive glob.",
      );
  }

  /** Applies every matching pattern in declaration order. */
  public matches(location: string): boolean {
    const segments = split(location);
    let included = false;
    for (const pattern of this.patterns)
      if (match(pattern.segments, segments, false)) included = !pattern.exclude;
    return included;
  }

  /** Keeps possible descendants, including those restored by a later positive. */
  public couldMatchDescendant(directory: string): boolean {
    const prefix = split(directory);
    let possible = false;
    for (const pattern of this.patterns)
      if (!pattern.exclude) {
        if (match(pattern.segments, prefix, true)) possible = true;
      } else if (
        pattern.segments.at(-1) === "**" &&
        match(pattern.segments, prefix, false)
      )
        possible = false;
    return possible;
  }
}

function compile(raw: string): IFileGlobPattern {
  if (raw.trim() === "") throw new Error("Glob strings must not be empty.");
  const exclude = raw.startsWith("!");
  let value = (exclude ? raw.slice(1) : raw).replaceAll("\\", "/");
  while (value.startsWith("./")) value = value.slice(2);
  if (value === "")
    throw new Error("The exclusion marker '!' must be followed by a glob.");
  if (value.startsWith("/") || /^[A-Za-z]:/.test(value))
    throw new Error(`Glob '${raw}' must be relative to its population root.`);
  if (value.endsWith("/")) value = value.slice(0, -1);
  const segments = value.split("/");
  if (segments.includes("") || segments.includes(".."))
    throw new Error(
      `Glob '${raw}' contains an empty segment or escapes its root.`,
    );
  return { segments, exclude };
}

function split(value: string): string[] {
  let normalized = value.replaceAll("\\", "/");
  while (normalized.startsWith("./")) normalized = normalized.slice(2);
  normalized = normalized.replace(/^\/+|\/+$/g, "");
  return normalized === "" || normalized === "." ? [] : normalized.split("/");
}

/** Memoization bounds repeated globstar branches to the pattern/path grid. */
function match(
  pattern: readonly string[],
  segments: readonly string[],
  descendant: boolean,
): boolean {
  const memo = new Map<string, boolean>();
  return visit(0, 0);

  function visit(patternIndex: number, pathIndex: number): boolean {
    const key = `${patternIndex}:${pathIndex}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    const token = pattern[patternIndex];
    const segment = segments[pathIndex];
    let result: boolean;
    if (descendant && pathIndex === segments.length)
      result = patternIndex < pattern.length;
    else if (token === undefined) result = pathIndex === segments.length;
    else if (token === "**")
      result =
        visit(patternIndex + 1, pathIndex) ||
        (segment !== undefined && visit(patternIndex, pathIndex + 1));
    else
      result =
        segment !== undefined &&
        matchSegment(token, segment) &&
        visit(patternIndex + 1, pathIndex + 1);
    memo.set(key, result);
    return result;
  }
}

/** A question mark consumes one Unicode code point, as in the Go matcher. */
function matchSegment(pattern: string, value: string): boolean {
  const tokens = Array.from(pattern);
  const characters = Array.from(value);
  let patternIndex = 0;
  let valueIndex = 0;
  let starPattern = -1;
  let starValue = 0;
  while (valueIndex < characters.length)
    if (tokens[patternIndex] === "*") {
      starPattern = patternIndex++;
      starValue = valueIndex;
    } else if (
      tokens[patternIndex] === "?" ||
      tokens[patternIndex] === characters[valueIndex]
    ) {
      patternIndex++;
      valueIndex++;
    } else if (starPattern >= 0) {
      patternIndex = starPattern + 1;
      valueIndex = ++starValue;
    } else return false;
  while (tokens[patternIndex] === "*") patternIndex++;
  return patternIndex === tokens.length;
}
