// SPDX-License-Identifier: GPL-3.0-only

import type { HandlerService, ProductDefinition, ServiceId } from "@elqora/dgp-spec";

import {
  matchingServicesForFilter,
  resolveCapabilities,
  type ResolvedCapabilities,
} from "./capabilities.js";
import { resolveFilterContext, type ResolvedFilterContext } from "./context.js";
import { resolveValueEffectsWithIndex, type ResolvedValueEffect } from "./effects.js";
import { createProductIndex, type ProductIndex } from "./indexer.js";
import {
  fallbackCandidatesForNode,
  resolveFallbackCandidates,
  resolveServiceBindingsWithIndex,
  serviceBindingForNode,
  type ResolvedServiceBindings,
} from "./services.js";
import {
  resolveVisibilityWithIndex,
  type ResolvedVisibility,
} from "./visibility.js";

export interface ResolvedProductContext {
  filter: ResolvedFilterContext;
  capabilities: ResolvedCapabilities;
  visibility: ResolvedVisibility;
  valueEffects: ResolvedValueEffect[];
}

export interface ProductInterpreter {
  readonly definition: ProductDefinition;
  readonly index: ProductIndex;
  resolveFilter(filterId: string): ResolvedFilterContext | undefined;
  resolveCapabilities(filterId: string): ResolvedCapabilities;
  resolveVisibility(filterId: string, selectedTriggerIds?: Iterable<string>): ResolvedVisibility;
  resolveValueEffects(filterId: string, selectedTriggerIds: Iterable<string>): ResolvedValueEffect[];
  resolveContext(filterId: string, selectedTriggerIds?: Iterable<string>): ResolvedProductContext | undefined;
  serviceBindingForNode(nodeId: string): ServiceId | undefined;
  resolveServiceBindings(): ResolvedServiceBindings;
  resolveFallbackCandidates(primaryServiceId: ServiceId, nodeId?: string): ServiceId[];
  fallbackCandidatesForNode(nodeId: string): ServiceId[];
  matchingServicesForFilter(filterId: string, services: readonly HandlerService[]): HandlerService[];
}

export function createProductInterpreter(definition: ProductDefinition): ProductInterpreter {
  const index = createProductIndex(definition);
  return {
    definition,
    index,
    resolveFilter(filterId) {
      return resolveFilterContext(index, filterId);
    },
    resolveCapabilities(filterId) {
      return resolveCapabilities(index, filterId);
    },
    resolveVisibility(filterId, selectedTriggerIds = []) {
      return resolveVisibilityWithIndex(definition, index, filterId, selectedTriggerIds);
    },
    resolveValueEffects(filterId, selectedTriggerIds) {
      return resolveValueEffectsWithIndex(definition, index, filterId, selectedTriggerIds);
    },
    resolveContext(filterId, selectedTriggerIds = []) {
      const filter = resolveFilterContext(index, filterId);
      if (filter === undefined) return undefined;
      return {
        filter,
        capabilities: resolveCapabilities(index, filterId),
        visibility: resolveVisibilityWithIndex(definition, index, filterId, selectedTriggerIds),
        valueEffects: resolveValueEffectsWithIndex(definition, index, filterId, selectedTriggerIds),
      };
    },
    serviceBindingForNode(nodeId) {
      return serviceBindingForNode(index, nodeId);
    },
    resolveServiceBindings() {
      return resolveServiceBindingsWithIndex(definition, index);
    },
    resolveFallbackCandidates(primaryServiceId, nodeId) {
      return resolveFallbackCandidates(definition, primaryServiceId, nodeId);
    },
    fallbackCandidatesForNode(nodeId) {
      return fallbackCandidatesForNode(definition, index, nodeId);
    },
    matchingServicesForFilter(filterId, services) {
      return matchingServicesForFilter(index, filterId, services);
    },
  };
}
