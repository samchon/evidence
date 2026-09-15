/**
 * Optional diagnostic routing for isolated TypeScript configuration evaluation.
 *
 * `evaluateTypeScriptConfig` passes this sink to its child evaluator so callers
 * can collect or redirect compiler and runtime output without changing the
 * evaluated configuration result.
 */
export interface IEvidenceEvaluateTypeScriptConfigOptions {
  /**
   * Receives each stdout or stderr chunk emitted by the evaluator process.
   *
   * When omitted, evaluation writes diagnostics to the parent process's stderr
   * and preserves the child process's original formatting.
   */
  writeDiagnostic?: ((content: string) => void) | undefined;
}
