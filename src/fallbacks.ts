// SPDX-License-Identifier: GPL-3.0-only

import type { HandlerService, ServiceId, ServiceRatePolicy } from "@elqora/dgp-spec";

import { findService, resolveCapabilities, serviceSatisfiesCapabilities } from "./capabilities.js";
import type { ProductIndex } from "./indexer.js";
import { serviceRateMatchesPolicy } from "./service-filter.js";
import { serviceBindingForNode } from "./services.js";

export type FallbackIneligibilityReason =
  | "primary_missing"
  | "self_reference"
  | "unknown_service"
  | "unavailable"
  | "capability_mismatch"
  | "rate_mismatch"
  | "context_missing";

export interface FallbackEligibilityRow {
  candidate: ServiceId;
  eligible: boolean;
  reasons: FallbackIneligibilityReason[];
  matching_filter_ids: string[];
}

export interface ResolveFallbackEligibilityOptions {
  rate_policy?: ServiceRatePolicy;
  require_capability_fit?: boolean;
  exclude_ids?: Iterable<ServiceId>;
  /** Reachable publication contexts supplied by a caller that resolves relationship visibility. */
  filter_ids?: readonly string[];
}

/**
 * Evaluate node-scoped fallback candidates against handler catalog evidence. A candidate bound to a
 * multi-context option remains eligible when it satisfies at least one reachable filter context.
 */
export function resolveFallbackEligibilityForNode(
  index: ProductIndex,
  nodeId: string,
  candidates: readonly ServiceId[],
  services: readonly HandlerService[],
  options: ResolveFallbackEligibilityOptions = {},
): FallbackEligibilityRow[] {
  const primaryId = serviceBindingForNode(index, nodeId);
  const primary = primaryId === undefined ? undefined : findService(services, primaryId);
  const filterIds = options.filter_ids === undefined
    ? index.nodeFilterIds(nodeId)
    : [...new Set(options.filter_ids)];
  const excluded = new Set([...options.exclude_ids ?? []].map(String));
  const seen = new Set<string>();
  const rows: FallbackEligibilityRow[] = [];

  for (const candidateId of candidates) {
    const key = String(candidateId);
    if (seen.has(key) || excluded.has(key)) continue;
    seen.add(key);
    const reasons: FallbackIneligibilityReason[] = [];
    const matchingFilterIds: string[] = [];
    if (primaryId === undefined || primary === undefined) reasons.push("primary_missing");
    if (primaryId !== undefined && key === String(primaryId)) reasons.push("self_reference");
    const candidate = findService(services, candidateId);
    if (candidate === undefined) reasons.push("unknown_service");
    else {
      if (candidate.state !== "enabled") reasons.push("unavailable");
      if (options.require_capability_fit === true) {
        for (const filterId of filterIds) {
          if (serviceSatisfiesCapabilities(candidate, resolveCapabilities(index, filterId).values)) {
            matchingFilterIds.push(filterId);
          }
        }
        if (filterIds.length === 0) reasons.push("context_missing");
        else if (matchingFilterIds.length === 0) reasons.push("capability_mismatch");
      } else {
        matchingFilterIds.push(...filterIds);
      }
      if (
        primary !== undefined
        && !serviceRateMatchesPolicy(candidate.rate, primary.rate, options.rate_policy)
      ) reasons.push("rate_mismatch");
    }
    rows.push({
      candidate: candidateId,
      eligible: reasons.length === 0,
      reasons,
      matching_filter_ids: matchingFilterIds,
    });
  }
  return rows;
}
