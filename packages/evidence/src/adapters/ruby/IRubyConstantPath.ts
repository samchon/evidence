/** A statically readable Ruby constant path and its root qualification. */
export interface IRubyConstantPath {
  absolute: boolean;
  segments: string[];
}
