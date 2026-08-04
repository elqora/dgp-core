// SPDX-License-Identifier: GPL-3.0-only

import { describe, expect, it } from "vitest";

import {
  createProductIndex,
  filterHandlerServices,
  findService,
  resolveFallbackCandidates,
  resolveFallbackEligibilityForNode,
  resolveServiceBindings,
  serviceRateMatchesPolicy,
} from "../src/index.js";
import { emptyDefinition, handlerService } from "./fixtures.js";

describe("handler service identity and filtering", () => {
  it("uses canonical string lookup equality while preserving the original scalar", () => {
    const services = [handlerService(101, 10), handlerService("001", 11)];
    expect(findService(services, "101")?.id).toBe(101);
    expect(findService(services, 1)).toBeUndefined();
    expect(findService(services, "001")?.id).toBe("001");
  });

  it("implements every established catalog-rate policy exactly", () => {
    expect(serviceRateMatchesPolicy(10, 10, { kind: "eq_primary" })).toBe(true);
    expect(serviceRateMatchesPolicy(9.5, 10, { kind: "eq_primary" })).toBe(false);
    expect(serviceRateMatchesPolicy(9.5, 10, { kind: "lte_primary", pct: 5 })).toBe(true);
    expect(serviceRateMatchesPolicy(9.49, 10, { kind: "lte_primary", pct: 5 })).toBe(false);
    expect(serviceRateMatchesPolicy(10.5, 10, { kind: "within_pct", pct: 5 })).toBe(true);
    expect(serviceRateMatchesPolicy(1, 10, { kind: "within_pct", pct: 5 })).toBe(true);
    expect(serviceRateMatchesPolicy(9, 10, { kind: "at_least_pct_lower", pct: 10 })).toBe(true);
    expect(serviceRateMatchesPolicy(9.01, 10, { kind: "at_least_pct_lower", pct: 10 })).toBe(false);
    expect(serviceRateMatchesPolicy(null, 10, { kind: "eq_primary" })).toBe(false);
    expect(serviceRateMatchesPolicy(null, null, undefined)).toBe(true);
  });

  it("preserves input order and reports availability, capability, rate, and exclusion reasons", () => {
    const services = [
      handlerService(1, 10, {
        capabilities: { refill: { id: "refill", enabled: true, description: null, meta: {} } },
      }),
      handlerService(2, 20, { state: "disabled" }),
      handlerService(3, 9, {
        capabilities: { refill: { id: "refill", enabled: false, description: null, meta: {} } },
      }),
    ];
    const result = filterHandlerServices(services, {
      capabilities: { refill: true },
      primary_rate: 10,
      rate_policy: { kind: "eq_primary" },
      exclude_ids: [1],
    });
    expect(result.accepted).toEqual([]);
    expect(result.rejected.map(({ service, reasons }) => [service.id, reasons])).toEqual([
      [1, ["excluded"]],
      [2, ["unavailable", "capability_mismatch", "rate_mismatch"]],
      [3, ["capability_mismatch", "rate_mismatch"]],
    ]);
  });
});

describe("service binding and fallback interpretation", () => {
  function definition() {
    return emptyDefinition({
      filters: [
        { id: "a", label: "A", service_id: 101, capabilities: { refill: true } },
        { id: "b", label: "B", service_id: "101", capabilities: { cancel: true } },
      ],
      fields: [
        { id: "button", type: "button", label: "Button", button: true, service_id: 202 },
        {
          id: "choice",
          type: "select",
          label: "Choice",
          bind_id: ["a", "b"],
          options: [{ id: "option", label: "Option", service_id: 303 }],
        },
      ],
      fallbacks: {
        nodes: { option: [303, 304, "304", 305] },
        global: { "303": [305, 306, 304] },
      },
    });
  }

  it("deduplicates equivalent service ids while retaining first authored representation", () => {
    expect(resolveServiceBindings(definition())).toEqual({
      byNodeId: { a: 101, b: "101", button: 202, option: 303 },
      serviceIds: [101, 202, 303],
    });
  });

  it("returns node candidates before global candidates and removes self and aliases", () => {
    expect(resolveFallbackCandidates(definition(), 303, "option")).toEqual([304, 305, 306]);
  });

  it("accepts a multi-context option fallback when at least one context fits capabilities", () => {
    const source = definition();
    const services = [
      handlerService(303, 10),
      handlerService(304, 10, {
        capabilities: {
          refill: { id: "refill", enabled: false, description: null, meta: {} },
          cancel: { id: "cancel", enabled: true, description: null, meta: {} },
        },
      }),
      handlerService(305, 11, {
        capabilities: {
          refill: { id: "refill", enabled: false, description: null, meta: {} },
          cancel: { id: "cancel", enabled: false, description: null, meta: {} },
        },
      }),
    ];
    const rows = resolveFallbackEligibilityForNode(
      createProductIndex(source), "option", [304, 305, 999, 303], services,
      { require_capability_fit: true, rate_policy: { kind: "eq_primary" } },
    );
    expect(rows).toEqual([
      { candidate: 304, eligible: true, reasons: [], matching_filter_ids: ["b"] },
      {
        candidate: 305,
        eligible: false,
        reasons: ["capability_mismatch", "rate_mismatch"],
        matching_filter_ids: [],
      },
      {
        candidate: 999,
        eligible: false,
        reasons: ["unknown_service"],
        matching_filter_ids: [],
      },
      {
        candidate: 303,
        eligible: false,
        reasons: ["self_reference", "capability_mismatch"],
        matching_filter_ids: [],
      },
    ]);
  });
});
