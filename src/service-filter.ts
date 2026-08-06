// SPDX-License-Identifier: GPL-3.0-only

import type { HandlerService, ServiceId, ServiceRatePolicy } from "@elqora/dgp-spec";

import { serviceSatisfiesCapabilities } from "./capabilities.js";

export interface ServiceFilterRejection {
  service: HandlerService;
  reasons: Array<"unavailable" | "capability_mismatch" | "rate_mismatch" | "excluded">;
}

export interface ServiceFilterResult {
  accepted: HandlerService[];
  rejected: ServiceFilterRejection[];
}

export interface ServiceFilterOptions {
  capabilities?: Readonly<Record<string, boolean>>;
  primary_rate?: number;
  rate_policy?: ServiceRatePolicy;
  exclude_ids?: Iterable<ServiceId>;
}

/** Compare catalog-rate evidence without calculating a final or authoritative customer price. */
export function serviceRateMatchesPolicy(
  candidateRate: number | null,
  primaryRate: number | null | undefined,
  policy: ServiceRatePolicy | undefined,
): boolean {
  if (policy === undefined) return true;
  if (primaryRate === undefined) return true;
  if (primaryRate === null || candidateRate === null) return false;
  switch (policy.kind) {
    case "eq_primary":
      return candidateRate === primaryRate;
    case "lte_primary":
      return candidateRate <= primaryRate && candidateRate >= primaryRate * (1 - policy.pct / 100);
    case "within_pct":
      return candidateRate <= primaryRate * (1 + policy.pct / 100);
    case "at_least_pct_lower":
      return candidateRate <= primaryRate * (1 - policy.pct / 100);
  }
}

export function filterHandlerServices(
  services: readonly HandlerService[],
  options: ServiceFilterOptions = {},
): ServiceFilterResult {
  const excluded = new Set([...options.exclude_ids ?? []].map(String));
  const accepted: HandlerService[] = [];
  const rejected: ServiceFilterRejection[] = [];
  for (const service of services) {
    const reasons: ServiceFilterRejection["reasons"] = [];
    if (excluded.has(String(service.id))) reasons.push("excluded");
    if (service.state !== "enabled") reasons.push("unavailable");
    if (!serviceSatisfiesCapabilities(service, options.capabilities ?? {})) {
      reasons.push("capability_mismatch");
    }
    if (!serviceRateMatchesPolicy(service.rate, options.primary_rate, options.rate_policy)) {
      reasons.push("rate_mismatch");
    }
    if (reasons.length === 0) accepted.push(service);
    else rejected.push({ service, reasons });
  }
  return { accepted, rejected };
}
