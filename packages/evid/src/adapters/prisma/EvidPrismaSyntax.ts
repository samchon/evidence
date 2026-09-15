const LETTER = /^\p{L}$/u;
const NUMBER = /^\p{N}$/u;

/**
 * Shared lexical rules that do not determine Prisma schema semantics.
 *
 * Target and position helpers use these checks for safe identifier spelling;
 * the Prisma WASM parser remains the authority on whether a schema is valid.
 */
export namespace EvidPrismaSyntax {
  export function identifier(value: string): boolean {
    const characters = Array.from(value);
    const first = characters[0];
    return (
      first !== undefined &&
      initial(first) &&
      characters
        .slice(1)
        .every(
          (character) =>
            initial(character) || character === "_" || character === "-",
        )
    );
  }

  function initial(character: string): boolean {
    return LETTER.test(character) || NUMBER.test(character);
  }
}
