// SPDX-License-Identifier: GPL-3.0-only

import type { ProductDefinition, ProductField } from "@elqora/dgp-spec";

import { resolveFilterContext, triggerOwnerDepth } from "./context.js";
import { createProductIndex, type ProductIndex } from "./indexer.js";
import { fieldOptionIds } from "./options.js";

export interface VisibilityOptions {
  selectedTriggerIds?: Iterable<string>;
}

export interface ResolvedVisibility {
  fieldIds: string[];
  optionsByFieldId: Record<string, string[]>;
  forcedFieldIds: string[];
}

interface VisibilityInputs {
  definition: ProductDefinition;
  index: ProductIndex;
  filterId: string;
  selectedTriggerIds: Iterable<string>;
}

function relevantTriggers(inputs: VisibilityInputs): Array<{ id: string; depth: number }> {
  const context = resolveFilterContext(inputs.index, inputs.filterId);
  if (context === undefined) return [];
  const result: Array<{ id: string; depth: number }> = [];
  for (const id of inputs.selectedTriggerIds) {
    const depth = triggerOwnerDepth(inputs.index, id, context.lineageDepths);
    if (depth !== undefined) result.push({ id, depth });
  }
  return result;
}

function visibleFieldIdsFromInputs(inputs: VisibilityInputs): string[] {
  const context = resolveFilterContext(inputs.index, inputs.filterId);
  if (context === undefined) return [];
  const visible = new Set<string>();
  const lineageIds = new Set(context.lineage.map((filter) => filter.id));

  for (const field of inputs.definition.fields) {
    if (inputs.index.fieldBindIds(field).some((bindId) => lineageIds.has(bindId))) visible.add(field.id);
    if (context.filter.includes?.includes(field.id) === true) visible.add(field.id);
  }
  for (const fieldId of context.filter.excludes ?? []) visible.delete(fieldId);

  type Decision = { depth: number; kind: "include" | "exclude" };
  const decisions = new Map<string, Decision>();
  const decide = (fieldId: string, next: Decision): void => {
    const previous = decisions.get(fieldId);
    if (
      previous === undefined
      || next.depth < previous.depth
      || (next.depth === previous.depth && previous.kind === "include" && next.kind === "exclude")
    ) decisions.set(fieldId, next);
  };

  for (const trigger of relevantTriggers(inputs)) {
    for (const fieldId of inputs.definition.includes_for_buttons[trigger.id] ?? []) {
      decide(fieldId, { depth: trigger.depth, kind: "include" });
    }
    for (const fieldId of inputs.definition.excludes_for_buttons[trigger.id] ?? []) {
      decide(fieldId, { depth: trigger.depth, kind: "exclude" });
    }
  }
  for (const [fieldId, decision] of decisions) {
    if (decision.kind === "include") visible.add(fieldId);
    else visible.delete(fieldId);
  }

  const natural = inputs.definition.fields.filter((field) => visible.has(field.id)).map((field) => field.id);
  const pinned = inputs.definition.order_for_tags[inputs.filterId] ?? [];
  const pinnedVisible = pinned.filter((fieldId) => visible.has(fieldId));
  const pinnedSet = new Set(pinnedVisible);
  return [...pinnedVisible, ...natural.filter((fieldId) => !pinnedSet.has(fieldId))];
}

export function visibleFieldIdsUnder(
  definition: ProductDefinition,
  filterId: string,
  options: VisibilityOptions = {},
): string[] {
  return visibleFieldIdsFromInputs({
    definition,
    index: createProductIndex(definition),
    filterId,
    selectedTriggerIds: options.selectedTriggerIds ?? [],
  });
}

export function resolveVisibilityWithIndex(
  definition: ProductDefinition,
  index: ProductIndex,
  filterId: string,
  selectedTriggerIds: Iterable<string> = [],
): ResolvedVisibility {
  const inputs = { definition, index, filterId, selectedTriggerIds };
  const baseFieldIds = visibleFieldIdsFromInputs(inputs);
  const visible = new Set(baseFieldIds);
  const forced = new Set<string>();
  const optionsByFieldId: Record<string, string[]> = {};
  const optionIdsByFieldId = new Map<string, string[]>();

  const optionIds = (field: ProductField): string[] => {
    const cached = optionIdsByFieldId.get(field.id);
    if (cached !== undefined) return cached;
    const ids = fieldOptionIds(field);
    optionIdsByFieldId.set(field.id, ids);
    return ids;
  };
  const initializeOptions = (field: ProductField): void => {
    const ids = optionIds(field);
    if (ids.length > 0 && optionsByFieldId[field.id] === undefined) optionsByFieldId[field.id] = [...ids];
  };
  for (const fieldId of baseFieldIds) {
    const field = index.getField(fieldId);
    if (field !== undefined) initializeOptions(field);
  }

  for (const trigger of relevantTriggers(inputs)) {
    for (const [targetFieldId, rule] of Object.entries(
      definition.option_effects_for_buttons[trigger.id] ?? {},
    )) {
      const field = index.getField(targetFieldId);
      if (field === undefined) continue;
      if (!visible.has(targetFieldId) && rule.force_visible !== true) continue;
      if (!visible.has(targetFieldId)) {
        visible.add(targetFieldId);
        forced.add(targetFieldId);
      }

      const orderedOptionIds = optionIds(field);
      if (orderedOptionIds.length === 0) continue;
      const known = new Set(orderedOptionIds);
      let allowed = optionsByFieldId[targetFieldId] ?? [...orderedOptionIds];
      if ((rule.include?.length ?? 0) > 0) {
        const included = new Set(rule.include?.filter((id) => known.has(id)) ?? []);
        const currentlyAllowed = new Set(allowed);
        allowed = orderedOptionIds.filter((id) => included.has(id) && currentlyAllowed.has(id));
      }
      if ((rule.exclude?.length ?? 0) > 0) {
        const excluded = new Set(rule.exclude?.filter((id) => known.has(id)) ?? []);
        allowed = allowed.filter((id) => !excluded.has(id));
      }
      optionsByFieldId[targetFieldId] = allowed;
    }
  }

  const fieldIds = baseFieldIds.filter((fieldId) => visible.has(fieldId));
  const seen = new Set(fieldIds);
  for (const field of definition.fields) {
    if (!visible.has(field.id) || seen.has(field.id)) continue;
    seen.add(field.id);
    fieldIds.push(field.id);
    initializeOptions(field);
  }
  for (const fieldId of Object.keys(optionsByFieldId)) {
    if (!visible.has(fieldId)) delete optionsByFieldId[fieldId];
  }

  return {
    fieldIds,
    optionsByFieldId,
    forcedFieldIds: fieldIds.filter((fieldId) => forced.has(fieldId)),
  };
}

export function resolveVisibility(
  definition: ProductDefinition,
  filterId: string,
  selectedTriggerIds: Iterable<string> = [],
): ResolvedVisibility {
  return resolveVisibilityWithIndex(
    definition,
    createProductIndex(definition),
    filterId,
    selectedTriggerIds,
  );
}
