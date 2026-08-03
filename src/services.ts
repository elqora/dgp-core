// SPDX-License-Identifier: GPL-3.0-only

import type { ProductDefinition, ServiceId } from "@elqora/dgp-spec";

import { createProductIndex, type ProductIndex } from "./indexer.js";
import { walkOptions } from "./options.js";

export interface ResolvedServiceBindings {
  byNodeId: Readonly<Record<string, ServiceId>>;
  serviceIds: ServiceId[];
}

export function serviceBindingForNode(index: ProductIndex, nodeId: string): ServiceId | undefined {
  const node = index.getNode(nodeId);
  if (node.kind === "filter") return node.filter.service_id;
  if (node.kind === "field") return node.field.button === true ? node.field.service_id : undefined;
  if (node.kind === "option") return node.option.service_id;
  return undefined;
}

export function resolveServiceBindingsWithIndex(
  definition: ProductDefinition,
  index: ProductIndex,
): ResolvedServiceBindings {
  const byNodeId: Record<string, ServiceId> = {};
  const serviceIds: ServiceId[] = [];
  const seen = new Set<string>();
  const bind = (nodeId: string, serviceId: ServiceId | undefined): void => {
    if (serviceId === undefined) return;
    byNodeId[nodeId] = serviceId;
    const key = String(serviceId);
    if (!seen.has(key)) {
      seen.add(key);
      serviceIds.push(serviceId);
    }
  };

  for (const filter of definition.filters) bind(filter.id, serviceBindingForNode(index, filter.id));
  for (const field of definition.fields) bind(field.id, serviceBindingForNode(index, field.id));
  for (const visit of walkOptions(definition)) {
    bind(visit.optionId, serviceBindingForNode(index, visit.optionId));
  }
  return { byNodeId, serviceIds };
}

export function resolveServiceBindings(definition: ProductDefinition): ResolvedServiceBindings {
  return resolveServiceBindingsWithIndex(definition, createProductIndex(definition));
}

export function resolveFallbackCandidates(
  definition: ProductDefinition,
  primaryServiceId: ServiceId,
  nodeId?: string,
): ServiceId[] {
  const candidates = [
    ...(nodeId === undefined ? [] : definition.fallbacks?.nodes?.[nodeId] ?? []),
    ...(definition.fallbacks?.global?.[String(primaryServiceId)] ?? []),
  ];
  const primaryKey = String(primaryServiceId);
  const seen = new Set<string>();
  const result: ServiceId[] = [];
  for (const candidate of candidates) {
    const key = String(candidate);
    if (key === primaryKey || seen.has(key)) continue;
    seen.add(key);
    result.push(candidate);
  }
  return result;
}

export function fallbackCandidatesForNode(
  definition: ProductDefinition,
  index: ProductIndex,
  nodeId: string,
): ServiceId[] {
  const primary = serviceBindingForNode(index, nodeId);
  return primary === undefined ? [] : resolveFallbackCandidates(definition, primary, nodeId);
}
