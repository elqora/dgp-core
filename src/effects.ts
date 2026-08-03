// SPDX-License-Identifier: GPL-3.0-only

import type { FieldValueEffect, ProductDefinition } from "@elqora/dgp-spec";

import { relevantSelectedTriggers } from "./context.js";
import { createProductIndex, type ProductIndex } from "./indexer.js";

export interface ResolvedValueEffect {
  triggerId: string;
  targetFieldId: string;
  effect: FieldValueEffect;
}

export function resolveValueEffectsWithIndex(
  definition: ProductDefinition,
  index: ProductIndex,
  filterId: string,
  selectedTriggerIds: Iterable<string>,
): ResolvedValueEffect[] {
  const effects: ResolvedValueEffect[] = [];
  for (const triggerId of relevantSelectedTriggers(index, filterId, selectedTriggerIds)) {
    for (const [targetFieldId, effect] of Object.entries(
      definition.value_effects_for_triggers[triggerId] ?? {},
    )) {
      effects.push({ triggerId, targetFieldId, effect });
    }
  }
  return effects;
}

export function resolveValueEffects(
  definition: ProductDefinition,
  filterId: string,
  selectedTriggerIds: Iterable<string>,
): ResolvedValueEffect[] {
  return resolveValueEffectsWithIndex(
    definition,
    createProductIndex(definition),
    filterId,
    selectedTriggerIds,
  );
}
