/**
 * Classifies how completely the scanner can determine a module's `__all__`
 * value.
 *
 * EvidPythonExportResolver uses this state to select explicit exports or
 * underscore visibility, while a dynamic value preserves an incomplete analysis
 * diagnostic.
 */
export type EvidPythonAllState = "absent" | "static" | "dynamic";
