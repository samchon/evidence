/**
 * Identifies the static form by which a name enters a Python module namespace.
 *
 * PythonExportResolver uses the form to decide whether it can publish a local
 * root or must follow a named, namespace, or star import within the snapshot.
 */
export type PythonBindingKind = "local" | "named" | "namespace" | "star";
