/**
 * Identifies the static form by which a name enters a Python module namespace.
 *
 * EvidencePythonExportResolver uses the form to decide whether it can publish a
 * local root or must follow a named, namespace, or star import within the
 * snapshot.
 */
export type EvidencePythonBindingKind = "local" | "named" | "namespace" | "star";
