// SPDX-License-Identifier: GPL-3.0-only

import { describe, expect, it } from "vitest";

import {
  createProductIndex,
  relevantSelectedTriggers,
  resolveCapabilities,
  resolveValueEffects,
  resolveVisibility,
} from "../src/index.js";
import { emptyDefinition } from "./fixtures.js";

function visibilityDefinition() {
  return emptyDefinition({
    filters: [
      { id: "root", label: "Root", includes: ["root-included"], capabilities: { refill: true } },
      { id: "parent", label: "Parent", bind_id: "root", capabilities: { refill: false, cancel: true } },
      { id: "active", label: "Active", bind_id: "parent", includes: ["active-included"], excludes: ["excluded"], capabilities: { dripfeed: true } },
      { id: "sibling", label: "Sibling", bind_id: "root" },
    ],
    fields: [
      { id: "root-bound", type: "text", label: "Root bound", bind_id: "root" },
      { id: "parent-bound", type: "text", label: "Parent bound", bind_id: "parent" },
      { id: "active-bound", type: "text", label: "Active bound", bind_id: "active" },
      { id: "descendant-bound", type: "text", label: "Descendant bound", bind_id: "sibling" },
      { id: "root-included", type: "text", label: "Root included" },
      { id: "active-included", type: "text", label: "Active included" },
      { id: "excluded", type: "text", label: "Excluded", bind_id: "active" },
      { id: "decision", type: "text", label: "Decision" },
      { id: "parent-button", type: "button", label: "Parent button", bind_id: "parent", button: true },
      { id: "active-button", type: "button", label: "Active button", bind_id: "active", button: true },
      { id: "sibling-button", type: "button", label: "Sibling button", bind_id: "sibling", button: true },
      {
        id: "choice",
        type: "select",
        label: "Choice",
        bind_id: "active",
        options: [{ id: "group", label: "Group", children: [{ id: "nested", label: "Nested" }] }],
      },
      {
        id: "target",
        type: "select",
        label: "Target",
        options: [
          { id: "a", label: "A", children: [{ id: "a1", label: "A1" }] },
          { id: "b", label: "B" },
        ],
      },
    ],
    order_for_tags: { active: ["active-bound", "root-bound", "ghost"] },
    includes_for_buttons: {
      "parent-button": ["decision"],
      "active-button": ["decision"],
      nested: ["decision"],
      "sibling-button": ["decision"],
    },
    excludes_for_buttons: { "active-button": ["decision"], nested: ["decision"] },
    option_effects_for_buttons: {
      nested: { target: { force_visible: true, include: ["a1"], exclude: ["b"] } },
      "sibling-button": { target: { force_visible: true } },
    },
    value_effects_for_triggers: {
      root: { decision: { value: "ancestor-filter" } },
      active: { decision: { value: "active-filter" } },
      "parent-button": { decision: { value: "parent", mode: "if_empty" } },
      nested: { decision: { value: "nested", clear_on_deactivate: true } },
      "sibling-button": { decision: { value: "sibling" } },
    },
  });
}

describe("lineage, visibility, and relationship parity", () => {
  it("inherits lineage-bound fields but not child or ancestor direct includes", () => {
    const result = resolveVisibility(visibilityDefinition(), "active");
    expect(result.fieldIds).toEqual([
      "active-bound", "root-bound", "parent-bound", "active-included", "parent-button", "active-button", "choice",
    ]);
    expect(result.fieldIds).not.toContain("root-included");
    expect(result.fieldIds).not.toContain("descendant-bound");
    expect(result.fieldIds).not.toContain("excluded");
  });

  it("uses closest trigger precedence and exclusion at equal depth", () => {
    const definition = visibilityDefinition();
    expect(resolveVisibility(definition, "active", ["parent-button"]).fieldIds).toContain("decision");
    expect(resolveVisibility(definition, "active", ["parent-button", "active-button"]).fieldIds)
      .not.toContain("decision");
    expect(resolveVisibility(definition, "active", ["nested"]).fieldIds).not.toContain("decision");
  });

  it("ignores triggers outside the active lineage and resolves recursive option effects", () => {
    const definition = visibilityDefinition();
    expect(relevantSelectedTriggers(
      createProductIndex(definition), "active", ["sibling-button", "nested"],
    )).toEqual(["nested"]);
    const result = resolveVisibility(definition, "active", ["nested", "sibling-button"]);
    expect(result.forcedFieldIds).toEqual(["target"]);
    expect(result.optionsByFieldId.target).toEqual(["a1"]);
  });

  it("narrows visible target options but does not reveal without force_visible", () => {
    const definition = visibilityDefinition();
    definition.option_effects_for_buttons.nested = { target: { include: ["a1"] } };
    const result = resolveVisibility(definition, "active", ["nested"]);
    expect(result.fieldIds).not.toContain("target");
    expect(result.optionsByFieldId.target).toBeUndefined();
  });

  it("preserves ancestor capability authority and reports the original source", () => {
    expect(resolveCapabilities(createProductIndex(visibilityDefinition()), "active")).toEqual({
      values: { refill: true, cancel: true, dripfeed: true },
      origins: { refill: "root", cancel: "parent", dripfeed: "active" },
    });
  });
});

describe("value-effect declaration order", () => {
  it("uses only the active filter implicitly, then selected buttons/options in selection order", () => {
    expect(resolveValueEffects(
      visibilityDefinition(), "active", ["parent-button", "sibling-button", "nested"],
    )).toEqual([
      { triggerId: "active", targetFieldId: "decision", effect: { value: "active-filter" } },
      {
        triggerId: "parent-button",
        targetFieldId: "decision",
        effect: { value: "parent", mode: "if_empty" },
      },
      {
        triggerId: "nested",
        targetFieldId: "decision",
        effect: { value: "nested", clear_on_deactivate: true },
      },
    ]);
  });

  it("does not treat ancestor filters as implicit value-effect triggers", () => {
    const effects = resolveValueEffects(visibilityDefinition(), "active", []);
    expect(effects.map(({ triggerId }) => triggerId)).toEqual(["active"]);
  });
});
