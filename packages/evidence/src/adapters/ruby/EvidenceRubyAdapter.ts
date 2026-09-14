import { RubyAdapter } from "./RubyAdapter";

/**
 * Extracts explicit Ruby declarations, reopenings, and bounded aliases from selected source.
 *
 * The adapter reconciles classes, modules, methods, constants, and literal
 * attributes across the snapshot. RDoc line or embedded comments retain their
 * attachment. Instance members use their nominal owner directly, while singleton
 * members add a self segment, keeping equal method names on different sides distinct.
 *
 * Runtime load order, eval-generated declarations, mixins, refinements, and
 * inherited members are not executed or synthesized. Analysis retains failures
 * where these mechanisms prevent a trustworthy public population.
 */
export class EvidenceRubyAdapter extends RubyAdapter {}
