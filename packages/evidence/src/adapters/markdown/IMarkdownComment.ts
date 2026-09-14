/** One closed HTML comment accepted as Markdown documentation. */
export interface IMarkdownComment {
  start: number;
  end: number;
  startLine: number;
  endLine: number;
}
