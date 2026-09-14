import { LuaAdapter } from "./LuaAdapter";

/**
 * Extracts explicit Lua globals and statically returned module-table fields.
 *
 * Literal fields and resolved local aliases establish the supported public
 * surface. Tables are property units; dot and colon methods use literal field
 * accessors rather than acquiring different identities from call syntax. Eligible
 * LuaDoc and long comments retain their declaration ownership.
 *
 * Dynamic mutation, metatables, require execution, computed or numeric keys, and
 * conditional initialization cannot establish this static denominator. Shared
 * values with distinct table owners also require a diagnostic instead of an
 * arbitrary owner assignment.
 */
export class EvidenceLuaAdapter extends LuaAdapter {}
