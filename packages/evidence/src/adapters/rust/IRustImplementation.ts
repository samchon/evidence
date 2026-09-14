/** One Rust impl block whose local nominal owner is resolved across modules. */
export interface IRustImplementation {
  id: string;
  modulePath: string[];
  ownerPath: string[];
  traitPath?: string[];
  typeParameters: string[];
}
