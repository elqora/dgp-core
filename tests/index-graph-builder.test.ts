// SPDX-License-Identifier: GPL-3.0-only

import { describe, expect, it } from "vitest";

import {
  ProductBuilder,
  createProductIndex,
  projectProductGraph,
} from "../src/index.js";
import { emptyDefinition } from "./fixtures.js";

function indexedDefinition() {
  return emptyDefinition({
    filters: [
      { id: "root", label: "Root", service_id: 1, includes: ["included"], excludes: ["excluded"] },
      { id: "child", label: "Child", bind_id: "root" },
      { id: "orphan", label: "Orphan", bind_id: "missing" },
    ],
    fields: [
      { id: "bound", type: "text", label: "Bound", bind_id: ["root", "child"] },
      { id: "included", type: "text", label: "Included" },
      { id: "excluded", type: "text", label: "Excluded" },
      { id: "button", type: "button", label: "Button", bind_id: "child", button: true, service_id: "2" },
      {
        id: "choice",
        type: "select",
        label: "Choice",
        bind_id: "child",
        options: [{
          id: "parent",
          label: "Parent",
          service_id: 3,
          children: [{ id: "nested", label: "Nested", children: [{ id: "leaf", label: "Leaf" }] }],
        }],
      },
    ],
    includes_for_buttons: { nested: ["included"] },
    excludes_for_buttons: { button: ["excluded"] },
  });
}

describe("ProductIndex parity", () => {
  it("uses actual ids and returns recursive ownership, ancestry, descendants, and triggers", () => {
    const index = createProductIndex(indexedDefinition());
    expect(index.getOptionOwner("leaf")?.id).toBe("choice");
    expect(index.getOptionVisit("leaf")).toMatchObject({ depth: 2, parentId: "nested" });
    expect(index.optionAncestors("leaf").map(({ id }) => id)).toEqual(["parent", "nested"]);
    expect(index.optionDescendants("parent").map(({ id }) => id)).toEqual(["nested", "leaf"]);
    expect(index.triggerIds()).toEqual(["button", "parent", "nested", "leaf"]);
    expect(index.resolveTrigger("nested")).toMatchObject({
      kind: "option", id: "nested", triggerId: "nested", filterIds: ["child"],
    });
    expect(index.resolveTrigger("button")).toMatchObject({ kind: "button", id: "button" });
    expect(index.resolveTrigger("root")).toMatchObject({ kind: "filter", id: "root" });
    expect(index.resolveTrigger("choice")).toEqual({ kind: "unknown", id: "choice", triggerId: "choice" });
  });

  it("keeps first authored identity on duplicates and deterministic kind precedence on collisions", () => {
    const definition = indexedDefinition();
    definition.filters.push({ id: "root", label: "Duplicate root" });
    definition.fields.push({ id: "root", type: "text", label: "Colliding field" });
    definition.fields.push({ id: "bound", type: "text", label: "Duplicate field" });
    const index = createProductIndex(definition);
    expect(index.getFilter("root")?.label).toBe("Root");
    expect(index.getField("bound")?.label).toBe("Bound");
    expect(index.getNode("root")).toMatchObject({ kind: "filter", filter: { label: "Root" } });
  });

  it("reports roots, bindings, lineage, descendants, and malformed cycles without looping", () => {
    const definition = indexedDefinition();
    definition.filters[0] = { ...definition.filters[0]!, bind_id: "child" };
    const index = createProductIndex(definition);
    expect(index.rootFilters().map(({ id }) => id)).toEqual(["orphan"]);
    expect(index.filterLineage("child").map(({ id }) => id)).toEqual(["root", "child"]);
    expect(index.filterDescendants("root").map(({ id }) => id)).toEqual(["child"]);
    expect(index.nodeFilterIds("nested")).toEqual(["child"]);
    expect(index.isFieldBoundWithin("bound", "child")).toBe(true);
  });
});

describe("framework-neutral graph projection", () => {
  it("projects filter, field, recursive option, service, and relationship edges deterministically", () => {
    const graph = projectProductGraph(indexedDefinition());
    expect(graph.nodes.map(({ id }) => id)).toEqual([
      "root", "child", "orphan",
      "bound", "included", "excluded", "button", "choice",
      "parent", "nested", "leaf",
      "service:1", "service:2", "service:3",
    ]);
    const signatures = graph.edges.map(({ kind, from, to }) => `${kind}:${from}->${to}`);
    expect(signatures).toEqual(expect.arrayContaining([
      "child:root->child",
      "include:root->included",
      "exclude:root->excluded",
      "bind:root->bound",
      "bind:child->bound",
      "option:choice->parent",
      "option:parent->nested",
      "option:nested->leaf",
      "service:root->service:1",
      "service:button->service:2",
      "service:parent->service:3",
      "include:nested->included",
      "exclude:button->excluded",
    ]));
    expect(new Set(graph.edges.map(({ id }) => id)).size).toBe(graph.edges.length);
  });
});

describe("ProductBuilder lifecycle", () => {
  it("normalizes, replaces, refreshes all derived state, and owns no history", () => {
    const builder = new ProductBuilder({ id: "p", name: "P" });
    expect(builder.definition.filters[0]?.id).toBe("root");
    const firstIndex = builder.index;
    builder.load(indexedDefinition());
    expect(builder.index).not.toBe(firstIndex);
    expect(builder.isFilterId("child")).toBe(true);
    expect(builder.isFieldId("choice")).toBe(true);
    expect(builder.isOptionId("leaf")).toBe(true);
    builder.replace(emptyDefinition({ filters: [{ id: "next", label: "Next" }] }));
    expect(builder.isFilterId("child")).toBe(false);
    expect(builder.isFilterId("next")).toBe(true);
  });

  it("uses builder trigger options only when a call does not override them", () => {
    const definition = emptyDefinition({
      fields: [
        { id: "toggle", type: "select", label: "Toggle", bind_id: "root", options: [{ id: "on", label: "On" }] },
        { id: "shown", type: "text", label: "Shown" },
      ],
      includes_for_buttons: { on: ["shown"] },
    });
    const builder = new ProductBuilder(definition, { selected_trigger_ids: ["on"] });
    expect(builder.visibleFields("root")).toEqual(["toggle", "shown"]);
    expect(builder.visibleFields("root", [])).toEqual(["toggle"]);
    builder.setOptions({ selected_trigger_ids: [] });
    expect(builder.visibleFields("root")).toEqual(["toggle"]);
  });

  it("returns canonical cleaned save output and a complete graph", () => {
    const builder = new ProductBuilder(indexedDefinition());
    expect(builder.cleanedProps().schema_version).toBe("1");
    expect(builder.tree()).toEqual(projectProductGraph(builder.definition));
  });
});
