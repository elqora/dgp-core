// SPDX-License-Identifier: GPL-3.0-only

import type {
  OptionEffectForButton,
  ProductDefinition,
  ProductField,
  ServiceFallbacks,
  ServiceId,
} from "@elqora/dgp-spec";

import { createProductIndex } from "./indexer.js";
import { normalizeProductDefinition, type ProductDefinitionDraft } from "./normalization.js";
import { fieldOptionIds } from "./options.js";
import { serviceBindingForNode } from "./services.js";

function uniqueKnown(values: readonly string[], known: ReadonlySet<string>): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (!known.has(value) || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function isTrigger(index: ReturnType<typeof createProductIndex>, id: string): boolean {
  const node = index.getNode(id);
  return node.kind === "option" || (node.kind === "field" && node.field.button === true);
}

function fieldIsReachabilityReferenced(definition: ProductDefinition, fieldId: string): boolean {
  if (definition.filters.some((filter) => filter.includes?.includes(fieldId) === true)) return true;
  if (Object.values(definition.includes_for_buttons).some((ids) => ids.includes(fieldId))) return true;
  return Object.values(definition.option_effects_for_buttons).some(
    (targets) => targets[fieldId]?.force_visible === true,
  );
}

function pruneFields(definition: ProductDefinition): ProductField[] {
  return definition.fields.filter((field) => {
    if (field.pricing_role !== "utility" || field.bind_id !== undefined) return true;
    return fieldIsReachabilityReferenced(definition, field.id);
  });
}

function pruneFallbacks(
  definition: ProductDefinition,
  index: ReturnType<typeof createProductIndex>,
): ServiceFallbacks | null {
  if (definition.fallbacks === null) return null;
  const nodes: Record<string, ServiceId[]> = {};
  const global: Record<string, ServiceId[]> = {};
  for (const [nodeId, candidates] of Object.entries(definition.fallbacks.nodes ?? {})) {
    const primary = serviceBindingForNode(index, nodeId);
    if (primary === undefined) continue;
    const seen = new Set<string>([String(primary)]);
    const next = candidates.filter((candidate) => {
      const key = String(candidate);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (next.length > 0) nodes[nodeId] = next;
  }
  for (const [primary, candidates] of Object.entries(definition.fallbacks.global ?? {})) {
    const seen = new Set<string>([primary]);
    const next = candidates.filter((candidate) => {
      const key = String(candidate);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (next.length > 0) global[primary] = next;
  }
  return Object.keys(nodes).length === 0 && Object.keys(global).length === 0
    ? null
    : {
        ...(Object.keys(nodes).length === 0 ? {} : { nodes }),
        ...(Object.keys(global).length === 0 ? {} : { global }),
      };
}

/** Return deterministic canonical save output with dead authoring references removed. */
export function prepareProductDefinitionForSave(input: ProductDefinitionDraft): ProductDefinition {
  const normalized = normalizeProductDefinition(input);
  const fields = pruneFields(normalized);
  const base: ProductDefinition = { ...normalized, fields };
  const index = createProductIndex(base);
  const fieldIds = new Set(fields.map((field) => field.id));
  const filterIds = new Set(base.filters.map((filter) => filter.id));
  const triggerIds = new Set(index.triggerIds());

  const orderForTags: Record<string, string[]> = {};
  for (const [filterId, values] of Object.entries(base.order_for_tags)) {
    const next = uniqueKnown(values, fieldIds);
    if (filterIds.has(filterId) && next.length > 0) orderForTags[filterId] = next;
  }
  const pruneRelationshipMap = (value: Record<string, string[]>): Record<string, string[]> => {
    const result: Record<string, string[]> = {};
    for (const [triggerId, values] of Object.entries(value)) {
      const next = uniqueKnown(values, fieldIds);
      if (triggerIds.has(triggerId) && next.length > 0) result[triggerId] = next;
    }
    return result;
  };

  const optionEffects: ProductDefinition["option_effects_for_buttons"] = {};
  for (const [triggerId, targets] of Object.entries(base.option_effects_for_buttons)) {
    if (!isTrigger(index, triggerId)) continue;
    const nextTargets: Record<string, OptionEffectForButton> = {};
    for (const [fieldId, effect] of Object.entries(targets)) {
      const field = index.getField(fieldId);
      if (field === undefined) continue;
      const knownOptions = new Set(fieldOptionIds(field));
      const include = uniqueKnown(effect.include ?? [], knownOptions);
      const exclude = uniqueKnown(effect.exclude ?? [], knownOptions);
      if (effect.force_visible !== true && include.length === 0 && exclude.length === 0) continue;
      nextTargets[fieldId] = {
        ...(effect.force_visible === true ? { force_visible: true } : {}),
        ...(include.length === 0 ? {} : { include }),
        ...(exclude.length === 0 ? {} : { exclude }),
      };
    }
    if (Object.keys(nextTargets).length > 0) optionEffects[triggerId] = nextTargets;
  }

  const valueEffects: ProductDefinition["value_effects_for_triggers"] = {};
  for (const [triggerId, targets] of Object.entries(base.value_effects_for_triggers)) {
    if (!triggerIds.has(triggerId) && !filterIds.has(triggerId)) continue;
    const nextTargets = Object.fromEntries(
      Object.entries(targets).filter(([fieldId]) => fieldIds.has(fieldId)),
    );
    if (Object.keys(nextTargets).length > 0) valueEffects[triggerId] = nextTargets;
  }

  const withMaps: ProductDefinition = {
    ...base,
    filters: base.filters.map((filter) => {
      const { includes: rawIncludes, excludes: rawExcludes, ...rest } = filter;
      const includes = uniqueKnown(rawIncludes ?? [], fieldIds);
      const excludes = uniqueKnown(rawExcludes ?? [], fieldIds);
      return {
        ...rest,
        ...(includes.length === 0 ? {} : { includes }),
        ...(excludes.length === 0 ? {} : { excludes }),
      };
    }),
    order_for_tags: orderForTags,
    includes_for_buttons: pruneRelationshipMap(base.includes_for_buttons),
    excludes_for_buttons: pruneRelationshipMap(base.excludes_for_buttons),
    option_effects_for_buttons: optionEffects,
    value_effects_for_triggers: valueEffects,
  };
  return { ...withMaps, fallbacks: pruneFallbacks(withMaps, createProductIndex(withMaps)) };
}
