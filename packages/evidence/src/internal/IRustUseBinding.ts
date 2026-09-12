/** One statically spelled target within a public Rust use declaration. */
export interface IRustUseBinding {
  path: string[];
  alias?: string;
  wildcard: boolean;
}
