/** Output routing for the isolated TypeScript configuration evaluator. */
export interface IEvaluateTypeScriptConfigOptions {
  /** Receives evaluator stdout and stderr; defaults to the parent process stderr. */
  writeDiagnostic?: ((content: string) => void) | undefined;
}
