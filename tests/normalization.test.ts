// SPDX-License-Identifier: GPL-3.0-only

import type { ProductDefinition } from "@elqora/dgp-spec";
import { describe, expect, it } from "vitest";

import { normalizeProductDefinition, prepareProductDefinitionForSave } from "../src/index.js";
import { emptyDefinition } from "./fixtures.js";

describe("canonical authoring normalization", () => {
  it("supplies required collection roots and one root context for an empty draft", () => {
    expect(normalizeProductDefinition({ id: "p", name: " P " })).toEqual({
      id: "p",
      name: "P",
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
    });
  });

  it("preserves authored root branches and normalizes bindings without inventing a literal root", () => {
    const result = normalizeProductDefinition({
      id: "p",
      name: "P",
      filters: [
        { id: " a ", label: " A " },
        { id: "b", label: "B", bind_id: " a " },
        { id: "orphan", label: "Orphan" },
      ],
      fields: [
        { id: "f", type: "text", label: " F ", bind_id: ["a", "a", " "] },
      ],
    });
    expect(result.filters).toEqual([
      { id: "a", label: "A" },
      { id: "b", label: "B", bind_id: "a" },
      { id: "orphan", label: "Orphan" },
    ]);
    expect(result.fields[0]).toMatchObject({ id: "f", bind_id: "a", pricing_role: "base" });
  });

  it("cascades pricing roles through recursive options and preserves explicit overrides", () => {
    const result = normalizeProductDefinition({
      id: "p",
      name: "P",
      fields: [{
        id: "f",
        type: "select",
        label: "F",
        pricing_role: "utility",
        options: [{
          id: "parent",
          label: "Parent",
          children: [{ id: "child", label: "Child", pricing_role: "base" }],
        }],
      }],
    });
    expect(result.fields[0]?.pricing_role).toBe("utility");
    expect(result.fields[0]?.options?.[0]?.pricing_role).toBe("utility");
    expect(result.fields[0]?.options?.[0]?.children?.[0]?.pricing_role).toBe("base");
  });

  it("deduplicates canonical relationships and fallback candidates while preserving scalar identity", () => {
    const result = normalizeProductDefinition({
      id: "p",
      name: "P",
      filters: [{ id: "root", label: "Root", includes: ["f", "f"], excludes: ["x", "x"] }],
      fields: [],
      includes_for_buttons: { trigger: ["f", "f", " "] },
      fallbacks: { global: { "101": [101, "101", 102, 102] } },
    });
    expect(result.filters[0]).toMatchObject({ includes: ["f"], excludes: ["x"] });
    expect(result.includes_for_buttons).toEqual({ trigger: ["f"] });
    expect(result.fallbacks).toEqual({ global: { "101": [102] } });
  });

  it("preserves every canonical declaration family and treats meta as opaque", () => {
    const source = emptyDefinition({
      fields: [{
        id: "f",
        type: "select",
        variant: "compact",
        label: "F",
        multiple: true,
        default_value: ["a"],
        defaults: { searchable: true },
        validation: [{ op: "gte", value_by: "length", value: 1 }],
        quantity_default: 2,
        quantity: { value_by: "length", multiply: 3, fallback: 1, clamp: { min: 1, max: 9 } },
        utility: { rate: 2, mode: "per_quantity" },
        meta: { multi: false, variant: "ignored", nested: { x: 1 } },
      }],
      value_effects_for_triggers: { root: { f: { value: ["a"], clear_on_deactivate: true } } },
      notices: [{
        id: "n",
        type: "public",
        kind: "migration",
        severity: "info",
        target: { scope: "global" },
        title: "Notice",
      }],
    });
    const before = structuredClone(source);
    const result = normalizeProductDefinition(source);
    expect(result.fields[0]).toMatchObject({ variant: "compact", multiple: true });
    expect(result.value_effects_for_triggers.root?.f).toEqual({
      value: ["a"], clear_on_deactivate: true,
    });
    expect(result.notices[0]?.kind).toBe("migration");
    expect(result.fields[0]?.meta).toEqual({ multi: false, variant: "ignored", nested: { x: 1 } });
    expect(source).toEqual(before);
  });
});

describe("deterministic save preparation", () => {
  function dirty(): ProductDefinition {
    return emptyDefinition({
      filters: [{ id: "root", label: "Root", excludes: ["orphan", "ghost"] }],
      fields: [
        { id: "orphan", type: "text", label: "Orphan", pricing_role: "utility" },
        { id: "kept", type: "text", label: "Kept", pricing_role: "utility" },
        {
          id: "trigger",
          type: "select",
          label: "Trigger",
          bind_id: "root",
          options: [{ id: "parent", label: "Parent", children: [{ id: "child", label: "Child" }] }],
        },
        {
          id: "target",
          type: "select",
          label: "Target",
          options: [{ id: "keep", label: "Keep", children: [{ id: "nested", label: "Nested" }] }],
        },
      ],
      order_for_tags: { root: ["trigger", "ghost", "trigger"], ghost: ["trigger"] },
      includes_for_buttons: { child: ["kept", "ghost"], ghost: ["kept"] },
      excludes_for_buttons: { child: ["ghost"] },
      option_effects_for_buttons: {
        child: {
          target: { force_visible: true, include: ["nested", "ghost"], exclude: ["keep", "ghost"] },
          ghost: { include: ["keep"] },
        },
        ghost: { target: { include: ["keep"] } },
      },
      value_effects_for_triggers: {
        root: { kept: { value: 1 }, ghost: { value: 2 } },
        child: { kept: { value: 3 } },
        ghost: { kept: { value: 4 } },
      },
    });
  }

  it("drops unreachable unbound utilities and prunes all dead relationship references", () => {
    const result = prepareProductDefinitionForSave(dirty());
    expect(result.fields.map(({ id }) => id)).toEqual(["kept", "trigger", "target"]);
    expect(result.order_for_tags).toEqual({ root: ["trigger"] });
    expect(result.includes_for_buttons).toEqual({ child: ["kept"] });
    expect(result.excludes_for_buttons).toEqual({});
    expect(result.option_effects_for_buttons).toEqual({
      child: { target: { force_visible: true, include: ["nested"], exclude: ["keep"] } },
    });
    expect(result.value_effects_for_triggers).toEqual({
      root: { kept: { value: 1 } },
      child: { kept: { value: 3 } },
    });
    expect(result.filters[0]?.excludes).toBeUndefined();
  });

  it("prunes fallback scopes without primaries, self aliases, and duplicates", () => {
    const result = prepareProductDefinitionForSave(emptyDefinition({
      filters: [{ id: "root", label: "Root", service_id: 101 }],
      fields: [{ id: "button", type: "button", label: "Button", button: true, service_id: "202" }],
      fallbacks: {
        nodes: { root: ["101", 102, "102"], missing: [9] },
        global: { "101": [101, 103, "103"], "999": [8] },
      },
    }));
    expect(result.fallbacks).toEqual({ nodes: { root: [102] }, global: { "101": [103] } });
  });
});
