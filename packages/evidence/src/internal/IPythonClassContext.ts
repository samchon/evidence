/** Structural ownership while scanning one Python class body. */
export interface IPythonClassContext {
  identity: string[];
  suffix: string[];
  root: string;
  parentId: string;
}
