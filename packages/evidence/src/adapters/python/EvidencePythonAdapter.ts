import { PythonAdapter } from "./PythonAdapter";

/**
 * Extracts statically declared Python exports with bounded import and __all__ resolution.
 *
 * The adapter reconciles selected modules before publishing file-qualified paths.
 * Docstrings and eligible adjacent comments supply mapped evidence text. Instance
 * members use a prototype segment; class members remain directly under their
 * owner, preserving the difference between the two public surfaces.
 *
 * Module execution, dynamic __all__ mutation, and decorator- or metaclass-generated
 * members are not evaluated. These mechanisms cannot justify omitting unknown
 * declarations while reporting complete coverage.
 */
export class EvidencePythonAdapter extends PythonAdapter {}
