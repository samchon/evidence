import { CAdapter } from "./CAdapter";

/**
 * Extracts C external declarations, tags, typedefs, and aggregate members.
 *
 * Identity reconciliation stays within each selected physical file. Public
 * addresses preserve exact tag names and unambiguous typedef aliases, while
 * attached Doxygen establishes evidence positions. Shared declarator sites do
 * not require sibling variables to share semantic identity or fingerprint content.
 *
 * The adapter does not evaluate preprocessor branches, expand macros, traverse
 * includes, or infer linker exports. Uncertainty affecting the selected public
 * surface is reported instead of being removed from the denominator.
 */
export class EvidenceCAdapter extends CAdapter {}
