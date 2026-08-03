// SPDX-License-Identifier: GPL-3.0-only

import type { HandlerService, ProductDefinition } from "@elqora/dgp-spec";
import { describe, expect, it } from "vitest";

import {
  createProductIndex,
  createProductInterpreter,
  filterFieldOptionsById,
  resolveCapabilities,
  resolveFallbackCandidates,
  resolveServiceBindings,
  resolveValueEffects,
  resolveVisibility,
  serviceSatisfiesCapabilities,
  walkFieldOptions,
} from "../src/index.js";

function definition(): ProductDefinition {
  return {
    id: "product",
    name: "Product",
    schema_version: "1",
    description: null,
    filters: [
      { id: "root", label: "Root", service_id: 10, capabilities: { dripfeed: true } },
      {
        id: "child",
        label: "Child",
        bind_id: "root",
        service_id: "child-service",
        includes: ["included"],
        excludes: ["excluded"],
        capabilities: { dripfeed: false, cancel: true },
      },
      { id: "sibling", label: "Sibling", bind_id: "root" },
    ],
    fields: [
      { id: "root-field", type: "text", label: "Root field", bind_id: "root" },
      { id: "ordered", type: "text", label: "Ordered", bind_id: "child" },
      { id: "excluded", type: "text", label: "Excluded", bind_id: "child" },
      { id: "included", type: "text", label: "Included" },
      { id: "decision", type: "text", label: "Decision" },
      { id: "parent-button", type: "button", label: "Parent", bind_id: "root", button: true, service_id: 20 },
      { id: "child-button", type: "button", label: "Child", bind_id: "child", button: true },
      {
        id: "choice",
        type: "select",
        label: "Choice",
        bind_id: "child",
        options: [
          {
            id: "parent-option",
            label: "Parent option",
            service_id: 30,
            children: [{ id: "child-option", label: "Child option", service_id: "nested" }],
          },
          { id: "other-option", label: "Other option" },
        ],
      },
      {
        id: "forced",
        type: "select",
        label: "Forced",
        options: [
          { id: "forced-a", label: "A", children: [{ id: "forced-a1", label: "A1" }] },
          { id: "forced-b", label: "B" },
        ],
      },
      { id: "unrelated-button", type: "button", label: "Unrelated", bind_id: "sibling", button: true },
    ],
    order_for_tags: { child: ["ordered", "root-field"] },
    includes_for_buttons: {
      "parent-button": ["decision"],
      "child-button": ["decision"],
      "child-option": ["decision"],
    },
    excludes_for_buttons: {
      "child-button": ["decision"],
      "child-option": ["decision"],
    },
    option_effects_for_buttons: {
      "child-option": {
        forced: { force_visible: true, include: ["forced-a1"], exclude: ["forced-b"] },
      },
      "unrelated-button": {
        forced: { force_visible: true },
      },
    },
    value_effects_for_triggers: {
      "parent-button": { ordered: { value: "parent", mode: "if_empty" } },
      "child-option": { ordered: { value: "child", clear_on_deactivate: true } },
      "unrelated-button": { ordered: { value: "unrelated" } },
    },
    fallbacks: {
      nodes: { "child-option": [31, "global", "nested"] },
      global: { nested: ["global", 32, "global"] },
    },
    notices: [],
    meta: { host: true },
  };
}

function service(overrides: Partial<HandlerService> = {}): HandlerService {
  return {
    id: "service",
    name: "Service",
    description: null,
    category: null,
    rate: 1,
    min: 1,
    max: 100,
    capabilities: {
      dripfeed: { id: "dripfeed", enabled: true, description: null, meta: {} },
      cancel: { id: "cancel", enabled: true, description: null, meta: {} },
    },
    meta: {},
    state: "enabled",
    state_reason: null,
    ...overrides,
  };
}

describe("product indexing and options", () => {
  it("indexes recursive options and preserves ancestors when filtering", () => {
    const source = definition();
    const index = createProductIndex(source);
    expect(index.getOption("child-option")?.label).toBe("Child option");
    expect(index.getOptionOwner("child-option")?.id).toBe("choice");
    expect(walkFieldOptions(index.getField("choice")!)).toMatchObject([
      { optionId: "parent-option", depth: 0 },
      { optionId: "child-option", parentId: "parent-option", depth: 1 },
      { optionId: "other-option", depth: 0 },
    ]);

    expect(filterFieldOptionsById(index.getField("choice")?.options, new Set(["child-option"]))).toEqual([
      {
        id: "parent-option",
        label: "Parent option",
        service_id: 30,
        children: [{ id: "child-option", label: "Child option", service_id: "nested" }],
      },
    ]);
  });

  it("resolves deterministic lineage, descendants, and relations", () => {
    const index = createProductIndex(definition());
    expect(index.filterLineage("child").map(({ id }) => id)).toEqual(["root", "child"]);
    expect(index.filterDescendants("root").map(({ id }) => id)).toEqual(["child", "sibling"]);
    expect(index.relationBetweenFilters("child", "root")).toBe("ancestor");
    expect(index.relationBetweenFilters("root", "child")).toBe("descendant");
    expect(index.relationBetweenFilters("child", "sibling")).toBe("unrelated");
  });

  it("terminates safely on a filter cycle", () => {
    const source = definition();
    source.filters[0] = { ...source.filters[0]!, bind_id: "child" };
    expect(createProductIndex(source).filterLineage("child").map(({ id }) => id)).toEqual(["root", "child"]);
  });
});

describe("capability interpretation", () => {
  it("preserves ancestor precedence and reports origins without mutating the definition", () => {
    const source = definition();
    const before = structuredClone(source);
    expect(resolveCapabilities(createProductIndex(source), "child")).toEqual({
      values: { dripfeed: true, cancel: true },
      origins: { dripfeed: "root", cancel: "child" },
    });
    expect(source).toEqual(before);
  });

  it("matches both required and explicitly disallowed capabilities", () => {
    expect(serviceSatisfiesCapabilities(service(), { dripfeed: true, refill: false })).toBe(true);
    expect(serviceSatisfiesCapabilities(service(), { cancel: false })).toBe(false);
  });
});

describe("visibility and effects", () => {
  it("uses lineage binding, current-filter rules, ordering, and closest-trigger precedence", () => {
    const resolved = resolveVisibility(definition(), "child", ["parent-button", "child-button"]);
    expect(resolved.fieldIds).toEqual([
      "ordered",
      "root-field",
      "included",
      "parent-button",
      "child-button",
      "choice",
    ]);
    expect(resolved.fieldIds).not.toContain("excluded");
    expect(resolved.fieldIds).not.toContain("decision");
  });

  it("applies recursive option effects only from selected triggers in the active lineage", () => {
    const resolved = resolveVisibility(definition(), "child", ["child-option", "unrelated-button"]);
    expect(resolved.forcedFieldIds).toEqual(["forced"]);
    expect(resolved.optionsByFieldId.forced).toEqual(["forced-a1"]);
  });

  it("returns ordered value-effect declarations without applying customer state", () => {
    expect(
      resolveValueEffects(definition(), "child", ["parent-button", "unrelated-button", "child-option"]),
    ).toEqual([
      {
        triggerId: "parent-button",
        targetFieldId: "ordered",
        effect: { value: "parent", mode: "if_empty" },
      },
      {
        triggerId: "child-option",
        targetFieldId: "ordered",
        effect: { value: "child", clear_on_deactivate: true },
      },
    ]);
  });
});

describe("service and fallback interpretation", () => {
  it("collects filter, button, and recursive-option service bindings", () => {
    expect(resolveServiceBindings(definition())).toEqual({
      byNodeId: {
        root: 10,
        child: "child-service",
        "parent-button": 20,
        "parent-option": 30,
        "child-option": "nested",
      },
      serviceIds: [10, "child-service", 20, 30, "nested"],
    });
  });

  it("lists node candidates before global candidates and removes duplicates and self references", () => {
    expect(resolveFallbackCandidates(definition(), "nested", "child-option")).toEqual([
      31,
      "global",
      32,
    ]);
  });

  it("exposes a composed interpreter while retaining pure results", () => {
    const source = definition();
    const before = structuredClone(source);
    const interpreter = createProductInterpreter(source);
    const context = interpreter.resolveContext("child", ["child-option"]);
    expect(context?.filter.lineage.map(({ id }) => id)).toEqual(["root", "child"]);
    expect(context?.capabilities.values).toEqual({ dripfeed: true, cancel: true });
    expect(interpreter.fallbackCandidatesForNode("child-option")).toEqual([31, "global", 32]);
    expect(interpreter.matchingServicesForFilter("child", [service()])).toHaveLength(1);
    expect(source).toEqual(before);
  });
});
