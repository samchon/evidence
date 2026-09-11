const LETTER = /^\p{L}$/u;
const NUMBER = /^\p{N}$/u;

/** Shared lexical rules that do not determine Prisma schema semantics. */
export namespace PrismaSyntax {
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
