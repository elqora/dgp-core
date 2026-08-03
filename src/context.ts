// SPDX-License-Identifier: GPL-3.0-only

import type { ProductField, ProductFilter } from "@elqora/dgp-spec";

import type { ProductIndex } from "./indexer.js";

export interface ResolvedFilterContext {
  filter: ProductFilter;
  lineage: ProductFilter[];
  lineageDepths: ReadonlyMap<string, number>;
}

export function resolveFilterContext(
  index: ProductIndex,
  filterId: string,
): ResolvedFilterContext | undefined {
  const filter = index.getFilter(filterId);
  if (filter === undefined) return undefined;

  const lineage = index.filterLineage(filterId);
  const lineageDepths = new Map<string, number>();
  for (let indexFromSelf = lineage.length - 1; indexFromSelf >= 0; indexFromSelf -= 1) {
    const item = lineage[indexFromSelf];
    if (item !== undefined) lineageDepths.set(item.id, lineage.length - 1 - indexFromSelf);
  }

  return { filter, lineage, lineageDepths };
}

export function fieldOwnerDepth(
  field: ProductField,
  lineageDepths: ReadonlyMap<string, number>,
): number | undefined {
  const bindIds = field.bind_id === undefined
    ? []
    : Array.isArray(field.bind_id)
      ? field.bind_id
      : [field.bind_id];
  let closest: number | undefined;
  for (const bindId of bindIds) {
    const depth = lineageDepths.get(bindId);
    if (depth !== undefined && (closest === undefined || depth < closest)) closest = depth;
  }
  return closest;
}

export function triggerOwnerDepth(
  index: ProductIndex,
  triggerId: string,
  lineageDepths: ReadonlyMap<string, number>,
): number | undefined {
  const node = index.getNode(triggerId);
  if (node.kind === "field") {
    return node.field.button === true ? fieldOwnerDepth(node.field, lineageDepths) : undefined;
  }
  if (node.kind === "option") return fieldOwnerDepth(node.field, lineageDepths);
  return undefined;
}

export function relevantSelectedTriggers(
  index: ProductIndex,
  filterId: string,
  selectedTriggerIds: Iterable<string>,
): string[] {
  const context = resolveFilterContext(index, filterId);
  if (context === undefined) return [];
  const relevant: string[] = [];
  for (const triggerId of selectedTriggerIds) {
    if (triggerOwnerDepth(index, triggerId, context.lineageDepths) !== undefined) relevant.push(triggerId);
  }
  return relevant;
}
