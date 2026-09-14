/** One valid Markdown fence delimiter after its allowed indentation. */
export interface IMarkdownFence {
  marker: "`" | "~";
  length: number;
  remainder: string;
}
