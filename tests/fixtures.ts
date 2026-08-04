// SPDX-License-Identifier: GPL-3.0-only

import type { HandlerService, ProductDefinition } from "@elqora/dgp-spec";

export function emptyDefinition(overrides: Partial<ProductDefinition> = {}): ProductDefinition {
  return {
    id: "product",
    name: "Product",
    filters: [{ id: "root", label: "Root" }],
    fields: [],
    order_for_tags: {},
    includes_for_buttons: {},
    excludes_for_buttons: {},
    option_effects_for_buttons: {},
    value_effects_for_triggers: {},
    schema_version: "1",
    fallbacks: null,
    description: null,
    notices: [],
    meta: {},
    ...overrides,
  };
}

export function handlerService(
  id: HandlerService["id"],
  rate: number | null,
  overrides: Partial<HandlerService> = {},
): HandlerService {
  return {
    id,
    name: `Service ${String(id)}`,
    description: null,
    category: null,
    rate,
    min: 1,
    max: 100,
    capabilities: {},
    meta: {},
    state: "enabled",
    state_reason: null,
    ...overrides,
  };
}
