// SPDX-License-Identifier: GPL-3.0-only

import type {
  CapabilityRequirements,
  HandlerService,
  ProductDefinition,
  ServiceId,
} from "@elqora/dgp-spec";

import { createProductIndex, type ProductIndex } from "./indexer.js";

export interface ResolvedCapabilities {
  values: Readonly<Record<string, boolean>>;
  origins: Readonly<Record<string, string>>;
}

export function resolveCapabilities(index: ProductIndex, filterId: string): ResolvedCapabilities {
  const values: Record<string, boolean> = {};
  const origins: Record<string, string> = {};

  for (const filter of index.filterLineage(filterId)) {
    for (const [capabilityId, required] of Object.entries(filter.capabilities ?? {})) {
      if (Object.hasOwn(values, capabilityId)) continue;
      values[capabilityId] = required;
      origins[capabilityId] = filter.id;
    }
  }

  return { values, origins };
}

export function resolveDefinitionCapabilities(
  definition: ProductDefinition,
  filterId: string,
): ResolvedCapabilities {
  return resolveCapabilities(createProductIndex(definition), filterId);
}

export function serviceCapabilityEnabled(service: HandlerService, capabilityId: string): boolean {
  return service.capabilities[capabilityId]?.enabled === true;
}

export function serviceSatisfiesCapabilities(
  service: HandlerService,
  requirements: CapabilityRequirements,
): boolean {
  return Object.entries(requirements).every(([capabilityId, required]) =>
    serviceCapabilityEnabled(service, capabilityId) === required,
  );
}

export function matchingServicesForFilter(
  index: ProductIndex,
  filterId: string,
  services: readonly HandlerService[],
): HandlerService[] {
  const requirements = resolveCapabilities(index, filterId).values;
  return services.filter(
    (service) => service.state === "enabled" && serviceSatisfiesCapabilities(service, requirements),
  );
}

export function findService(
  services: readonly HandlerService[],
  serviceId: ServiceId,
): HandlerService | undefined {
  return services.find((service) => String(service.id) === String(serviceId));
}
