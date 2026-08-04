// SPDX-License-Identifier: GPL-3.0-only

import type { ProductDefinition, ServiceId } from "@elqora/dgp-spec";

import { createProductIndex, type ProductIndex } from "./indexer.js";
import { walkOptions } from "./options.js";
import { serviceBindingForNode } from "./services.js";

export type ProductGraphNodeKind = "filter" | "field" | "option" | "service";
export type ProductGraphEdgeKind =
  | "child"
  | "bind"
  | "include"
  | "exclude"
  | "option"
  | "option_effect"
  | "value_effect"
  | "service";

export interface ProductGraphNode {
  id: string;
  kind: ProductGraphNodeKind;
  label: string;
  source_id: string | ServiceId;
  field_id?: string;
  parent_option_id?: string;
}

export interface ProductGraphEdge {
  id: string;
  kind: ProductGraphEdgeKind;
  from: string;
  to: string;
}

export interface ProductGraphSnapshot {
  nodes: ProductGraphNode[];
  edges: ProductGraphEdge[];
}

function serviceNodeId(serviceId: ServiceId): string {
  return `service:${String(serviceId)}`;
}

function edgeId(kind: ProductGraphEdgeKind, from: string, to: string, ordinal: number): string {
  return `${kind}:${from}:${to}:${ordinal}`;
}

/** Deterministic graph projection over actual canonical node identifiers. */
export function projectProductGraphWithIndex(
  definition: ProductDefinition,
  index: ProductIndex,
): ProductGraphSnapshot {
  const nodes: ProductGraphNode[] = [];
  const edges: ProductGraphEdge[] = [];
  const edgeOrdinals = new Map<string, number>();
  const pushEdge = (kind: ProductGraphEdgeKind, from: string, to: string): void => {
    const signature = `${kind}:${from}:${to}`;
    const ordinal = edgeOrdinals.get(signature) ?? 0;
    edgeOrdinals.set(signature, ordinal + 1);
    edges.push({ id: edgeId(kind, from, to, ordinal), kind, from, to });
  };

  for (const filter of definition.filters) {
    nodes.push({ id: filter.id, kind: "filter", label: filter.label, source_id: filter.id });
    if (filter.bind_id !== undefined && index.getFilter(filter.bind_id) !== undefined) {
      pushEdge("child", filter.bind_id, filter.id);
    }
    for (const fieldId of filter.includes ?? []) {
      if (index.getField(fieldId) !== undefined) pushEdge("include", filter.id, fieldId);
    }
    for (const fieldId of filter.excludes ?? []) {
      if (index.getField(fieldId) !== undefined) pushEdge("exclude", filter.id, fieldId);
    }
  }
  for (const field of definition.fields) {
    nodes.push({ id: field.id, kind: "field", label: field.label, source_id: field.id });
    for (const filterId of index.fieldBindIds(field)) {
      if (index.getFilter(filterId) !== undefined) pushEdge("bind", filterId, field.id);
    }
  }
  for (const visit of walkOptions(definition)) {
    nodes.push({
      id: visit.optionId,
      kind: "option",
      label: visit.option.label,
      source_id: visit.optionId,
      field_id: visit.fieldId,
      ...(visit.parentId === undefined ? {} : { parent_option_id: visit.parentId }),
    });
    pushEdge("option", visit.parentId ?? visit.fieldId, visit.optionId);
  }

  const seenServices = new Set<string>();
  for (const nodeId of index.nodeIds()) {
    const serviceId = serviceBindingForNode(index, nodeId);
    if (serviceId === undefined) continue;
    const id = serviceNodeId(serviceId);
    if (!seenServices.has(id)) {
      seenServices.add(id);
      nodes.push({ id, kind: "service", label: String(serviceId), source_id: serviceId });
    }
    pushEdge("service", nodeId, id);
  }
  for (const [triggerId, fieldIds] of Object.entries(definition.includes_for_buttons)) {
    for (const fieldId of fieldIds) {
      if (index.getNode(triggerId).kind !== "unknown" && index.getField(fieldId) !== undefined) {
        pushEdge("include", triggerId, fieldId);
      }
    }
  }
  for (const [triggerId, fieldIds] of Object.entries(definition.excludes_for_buttons)) {
    for (const fieldId of fieldIds) {
      if (index.getNode(triggerId).kind !== "unknown" && index.getField(fieldId) !== undefined) {
        pushEdge("exclude", triggerId, fieldId);
      }
    }
  }
  for (const [triggerId, targets] of Object.entries(definition.option_effects_for_buttons)) {
    for (const fieldId of Object.keys(targets)) {
      if (index.getNode(triggerId).kind !== "unknown" && index.getField(fieldId) !== undefined) {
        pushEdge("option_effect", triggerId, fieldId);
      }
    }
  }
  for (const [triggerId, targets] of Object.entries(definition.value_effects_for_triggers)) {
    for (const fieldId of Object.keys(targets)) {
      if (index.getNode(triggerId).kind !== "unknown" && index.getField(fieldId) !== undefined) {
        pushEdge("value_effect", triggerId, fieldId);
      }
    }
  }
  return { nodes, edges };
}

export function projectProductGraph(definition: ProductDefinition): ProductGraphSnapshot {
  return projectProductGraphWithIndex(definition, createProductIndex(definition));
}
