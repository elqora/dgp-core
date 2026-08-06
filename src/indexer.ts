// SPDX-License-Identifier: GPL-3.0-only

import type { FieldOption, ProductDefinition, ProductField, ProductFilter } from "@elqora/dgp-spec";

import { walkFieldOptions, type OptionVisit } from "./options.js";

export type ProductNodeKind = "filter" | "field" | "option" | "unknown";

export type FilterRelation = "self" | "ancestor" | "descendant" | "unrelated";

export type IndexedProductNode =
  | { kind: "filter"; id: string; filter: ProductFilter }
  | { kind: "field"; id: string; field: ProductField }
  | { kind: "option"; id: string; option: FieldOption; field: ProductField }
  | { kind: "unknown"; id: string };

export type ResolvedTrigger =
  | { kind: "filter"; id: string; triggerId: string; filter: ProductFilter }
  | { kind: "button"; id: string; triggerId: string; field: ProductField; filterIds: string[] }
  | {
      kind: "option";
      id: string;
      triggerId: string;
      option: FieldOption;
      field: ProductField;
      filterIds: string[];
      ancestors: FieldOption[];
    }
  | { kind: "unknown"; id: string; triggerId: string };

export interface ProductIndex {
  readonly definition: ProductDefinition;
  getNode(id: string): IndexedProductNode;
  getFilter(id: string): ProductFilter | undefined;
  getField(id: string): ProductField | undefined;
  getOption(id: string): FieldOption | undefined;
  getOptionOwner(id: string): ProductField | undefined;
  getOptionVisit(id: string): OptionVisit | undefined;
  optionAncestors(id: string): FieldOption[];
  optionDescendants(id: string): FieldOption[];
  nodeIds(): string[];
  triggerIds(): string[];
  resolveTrigger(id: string): ResolvedTrigger;
  rootFilters(): ProductFilter[];
  filterLineage(id: string): ProductFilter[];
  filterChildren(id: string): ProductFilter[];
  filterDescendants(id: string): ProductFilter[];
  relationBetweenFilters(baseId: string, otherId: string): FilterRelation;
  fieldBindIds(fieldOrId: ProductField | string): string[];
  /** Direct authored bind contexts only; relationship/effect reachability requires visibility resolution. */
  nodeFilterIds(nodeId: string): string[];
  isFieldBoundWithin(fieldOrId: ProductField | string, filterId: string): boolean;
}

export function createProductIndex(definition: ProductDefinition): ProductIndex {
  const filters = new Map<string, ProductFilter>();
  const fields = new Map<string, ProductField>();
  const options = new Map<string, { option: FieldOption; field: ProductField; visit: OptionVisit }>();
  const children = new Map<string, ProductFilter[]>();

  for (const filter of definition.filters) {
    if (!filters.has(filter.id)) filters.set(filter.id, filter);
  }
  for (const field of definition.fields) {
    if (!fields.has(field.id)) fields.set(field.id, field);
    for (const visit of walkFieldOptions(field)) {
      if (!options.has(visit.optionId)) {
        options.set(visit.optionId, { option: visit.option, field, visit });
      }
    }
  }
  for (const filter of definition.filters) {
    if (filter.bind_id === undefined || !filters.has(filter.bind_id)) continue;
    const siblings = children.get(filter.bind_id) ?? [];
    siblings.push(filter);
    children.set(filter.bind_id, siblings);
  }

  function getFilter(id: string): ProductFilter | undefined {
    return filters.get(id);
  }

  function getField(id: string): ProductField | undefined {
    return fields.get(id);
  }

  function filterLineage(id: string): ProductFilter[] {
    const reversed: ProductFilter[] = [];
    const seen = new Set<string>();
    let current = filters.get(id);
    while (current !== undefined && !seen.has(current.id)) {
      reversed.push(current);
      seen.add(current.id);
      current = current.bind_id === undefined ? undefined : filters.get(current.bind_id);
    }
    return reversed.reverse();
  }

  function fieldBindIds(fieldOrId: ProductField | string): string[] {
    const field = typeof fieldOrId === "string" ? fields.get(fieldOrId) : fieldOrId;
    if (field?.bind_id === undefined) return [];
    return Array.isArray(field.bind_id) ? [...field.bind_id] : [field.bind_id];
  }

  function nodeFilterIds(nodeId: string): string[] {
    const filter = filters.get(nodeId);
    if (filter !== undefined) return [filter.id];
    const field = fields.get(nodeId);
    if (field !== undefined) return fieldBindIds(field);
    const option = options.get(nodeId);
    return option === undefined ? [] : fieldBindIds(option.field);
  }

  function filterDescendants(id: string): ProductFilter[] {
    const result: ProductFilter[] = [];
    const visited = new Set<string>([id]);
    const queue = [...(children.get(id) ?? [])];
    while (queue.length > 0) {
      const filter = queue.shift();
      if (filter === undefined || visited.has(filter.id)) continue;
      visited.add(filter.id);
      result.push(filter);
      queue.push(...(children.get(filter.id) ?? []));
    }
    return result;
  }

  return {
    definition,
    getNode(id): IndexedProductNode {
      const filter = filters.get(id);
      if (filter !== undefined) return { kind: "filter", id, filter };
      const field = fields.get(id);
      if (field !== undefined) return { kind: "field", id, field };
      const option = options.get(id);
      if (option !== undefined) return { kind: "option", id, ...option };
      return { kind: "unknown", id };
    },
    getFilter,
    getField,
    getOption(id) {
      return options.get(id)?.option;
    },
    getOptionOwner(id) {
      return options.get(id)?.field;
    },
    getOptionVisit(id) {
      return options.get(id)?.visit;
    },
    optionAncestors(id) {
      const result: FieldOption[] = [];
      const seen = new Set<string>();
      let current = options.get(id)?.visit;
      while (current?.parentId !== undefined && !seen.has(current.parentId)) {
        seen.add(current.parentId);
        const parent = options.get(current.parentId);
        if (parent === undefined) break;
        result.unshift(parent.option);
        current = parent.visit;
      }
      return result;
    },
    optionDescendants(id) {
      const root = options.get(id);
      if (root === undefined) return [];
      const result: FieldOption[] = [];
      const queue = [...(root.option.children ?? [])];
      const seen = new Set<string>([id]);
      while (queue.length > 0) {
        const option = queue.shift();
        if (option === undefined || seen.has(option.id)) continue;
        seen.add(option.id);
        result.push(option);
        queue.push(...(option.children ?? []));
      }
      return result;
    },
    nodeIds() {
      return [...filters.keys(), ...fields.keys(), ...options.keys()];
    },
    triggerIds() {
      return [
        ...[...fields.values()].filter((field) => field.button === true).map((field) => field.id),
        ...options.keys(),
      ];
    },
    resolveTrigger(id) {
      const filter = filters.get(id);
      if (filter !== undefined) return { kind: "filter", id, triggerId: id, filter };
      const field = fields.get(id);
      if (field?.button === true) {
        return { kind: "button", id, triggerId: id, field, filterIds: fieldBindIds(field) };
      }
      const hit = options.get(id);
      if (hit !== undefined) {
        const ancestors: FieldOption[] = [];
        const seen = new Set<string>();
        let visit: OptionVisit | undefined = hit.visit;
        while (visit.parentId !== undefined && !seen.has(visit.parentId)) {
          seen.add(visit.parentId);
          const parent = options.get(visit.parentId);
          if (parent === undefined) break;
          ancestors.unshift(parent.option);
          visit = parent.visit;
        }
        return {
          kind: "option",
          id,
          triggerId: id,
          option: hit.option,
          field: hit.field,
          filterIds: fieldBindIds(hit.field),
          ancestors,
        };
      }
      return { kind: "unknown", id, triggerId: id };
    },
    rootFilters() {
      return definition.filters.filter(
        (filter) => filter.bind_id === undefined || !filters.has(filter.bind_id),
      );
    },
    filterLineage,
    filterChildren(id) {
      return [...(children.get(id) ?? [])];
    },
    filterDescendants,
    relationBetweenFilters(baseId, otherId) {
      if (baseId === otherId && filters.has(baseId)) return "self";
      if (filterLineage(baseId).some((filter) => filter.id === otherId)) return "ancestor";
      if (filterLineage(otherId).some((filter) => filter.id === baseId)) return "descendant";
      return "unrelated";
    },
    fieldBindIds,
    nodeFilterIds,
    isFieldBoundWithin(fieldOrId, filterId) {
      const lineage = new Set(filterLineage(filterId).map((filter) => filter.id));
      return fieldBindIds(fieldOrId).some((id) => lineage.has(id));
    },
  };
}
