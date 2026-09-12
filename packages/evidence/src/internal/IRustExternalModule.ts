/** One file-backed Rust module declaration awaiting selected-source resolution. */
export interface IRustExternalModule {
  declarationId: string;
  modulePath: string[];
  name: string;
  pathOverride: boolean;
}
