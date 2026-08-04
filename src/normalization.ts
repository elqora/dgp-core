// SPDX-License-Identifier: GPL-3.0-only

import type {
  FieldOption,
  FieldValueEffect,
  JsonValue,
  OptionEffectForButton,
  ProductDefinition,
  ProductField,
  ProductFilter,
  ProductNotice,
  ServiceFallbacks,
  ServiceId,
} from "@elqora/dgp-spec";

/** Canonical authoring input. Missing collection roots are authoring defaults, not legacy aliases. */
export type ProductDefinitionDraft = Pick<ProductDefinition, "id" | "name"> &
  Partial<Omit<ProductDefinition, "id" | "name">>;

export interface NormalizeProductDefinitionOptions {
  /** Used only when an authoring draft has no filter context at all. */
  root_id?: string;
  root_label?: string;
  default_pricing_role?: "base" | "utility";
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function trimmed(value: string): string {
  return value.trim();
}

function uniqueStrings(values: readonly string[] | undefined): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values ?? []) {
    const next = value.trim();
    if (next.length === 0 || seen.has(next)) continue;
    seen.add(next);
    result.push(next);
  }
  return result;
}

function uniqueServiceIds(values: readonly ServiceId[] | undefined, self?: ServiceId): ServiceId[] {
  const result: ServiceId[] = [];
  const seen = new Set<string>();
  const selfKey = self === undefined ? undefined : String(self);
  for (const value of values ?? []) {
    const key = String(value);
    if (key.length === 0 || key === selfKey || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function normalizedBindId(value: ProductField["bind_id"]): ProductField["bind_id"] {
  if (value === undefined) return undefined;
  if (typeof value === "string") {
    const next = value.trim();
    return next.length === 0 ? undefined : next;
  }
  const values = uniqueStrings(value);
  if (values.length === 0) return undefined;
  return values.length === 1 ? values[0] : values;
}

function normalizeOption(option: FieldOption, inheritedRole: "base" | "utility"): FieldOption {
  const pricingRole = option.pricing_role ?? inheritedRole;
  const children = option.children?.map((child) => normalizeOption(child, pricingRole));
  return {
    id: trimmed(option.id),
    label: trimmed(option.label),
    ...(option.value === undefined ? {} : { value: option.value }),
    ...(option.service_id === undefined ? {} : { service_id: option.service_id }),
    pricing_role: pricingRole,
    ...(option.quantity_default === undefined ? {} : { quantity_default: option.quantity_default }),
    ...(option.utility === undefined ? {} : { utility: cloneJson(option.utility) }),
    ...(option.meta === undefined ? {} : { meta: cloneJson(option.meta) }),
    ...(children === undefined ? {} : { children }),
  };
}

function normalizeField(field: ProductField, defaultRole: "base" | "utility"): ProductField {
  const pricingRole = field.pricing_role ?? defaultRole;
  const bindId = normalizedBindId(field.bind_id);
  const options = field.options?.map((option) => normalizeOption(option, pricingRole));
  const common = {
    id: trimmed(field.id),
    type: trimmed(field.type),
    ...(field.variant === undefined ? {} : { variant: trimmed(field.variant) }),
    label: trimmed(field.label),
    ...(bindId === undefined ? {} : { bind_id: bindId }),
    ...(field.name === undefined ? {} : { name: trimmed(field.name) }),
    ...(field.required === undefined ? {} : { required: field.required }),
    ...(field.multiple === undefined ? {} : { multiple: field.multiple }),
    ...(field.default_value === undefined ? {} : { default_value: cloneJson(field.default_value) }),
    ...(field.defaults === undefined ? {} : { defaults: cloneJson(field.defaults) }),
    ...(options === undefined ? {} : { options }),
    ...(field.description === undefined ? {} : { description: field.description }),
    pricing_role: pricingRole,
    ...(field.validation === undefined ? {} : { validation: cloneJson(field.validation) }),
    ...(field.quantity_default === undefined ? {} : { quantity_default: field.quantity_default }),
    ...(field.quantity === undefined ? {} : { quantity: cloneJson(field.quantity) }),
    ...(field.utility === undefined ? {} : { utility: cloneJson(field.utility) }),
    ...(field.meta === undefined ? {} : { meta: cloneJson(field.meta) }),
  };
  return field.button === true
    ? { ...common, button: true, ...(field.service_id === undefined ? {} : { service_id: field.service_id }) }
    : { ...common, ...(field.button === false ? { button: false as const } : {}) };
}

function normalizeFilter(filter: ProductFilter): ProductFilter {
  const includes = uniqueStrings(filter.includes);
  const excludes = uniqueStrings(filter.excludes);
  const bindId = filter.bind_id?.trim();
  return {
    id: trimmed(filter.id),
    label: trimmed(filter.label),
    ...(bindId === undefined || bindId.length === 0 ? {} : { bind_id: bindId }),
    ...(filter.service_id === undefined ? {} : { service_id: filter.service_id }),
    ...(includes.length === 0 ? {} : { includes }),
    ...(excludes.length === 0 ? {} : { excludes }),
    ...(filter.capabilities === undefined ? {} : { capabilities: { ...filter.capabilities } }),
    ...(filter.quantity_default === undefined ? {} : { quantity_default: filter.quantity_default }),
    ...(filter.meta === undefined ? {} : { meta: cloneJson(filter.meta) }),
  };
}

function normalizeStringArrayMap(value: Record<string, string[]> | undefined): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [rawKey, rawValues] of Object.entries(value ?? {})) {
    const key = rawKey.trim();
    const values = uniqueStrings(rawValues);
    if (key.length > 0 && values.length > 0) result[key] = values;
  }
  return result;
}

function normalizeOptionEffects(
  value: ProductDefinition["option_effects_for_buttons"] | undefined,
): ProductDefinition["option_effects_for_buttons"] {
  const result: Record<string, Record<string, OptionEffectForButton>> = {};
  for (const [rawTriggerId, rawTargets] of Object.entries(value ?? {})) {
    const triggerId = rawTriggerId.trim();
    const targets: Record<string, OptionEffectForButton> = {};
    for (const [rawFieldId, rawEffect] of Object.entries(rawTargets)) {
      const fieldId = rawFieldId.trim();
      const include = uniqueStrings(rawEffect.include);
      const exclude = uniqueStrings(rawEffect.exclude);
      if (fieldId.length === 0) continue;
      if (rawEffect.force_visible !== true && include.length === 0 && exclude.length === 0) continue;
      targets[fieldId] = {
        ...(rawEffect.force_visible === true ? { force_visible: true } : {}),
        ...(include.length === 0 ? {} : { include }),
        ...(exclude.length === 0 ? {} : { exclude }),
      };
    }
    if (triggerId.length > 0 && Object.keys(targets).length > 0) result[triggerId] = targets;
  }
  return result;
}

function normalizeValueEffects(
  value: ProductDefinition["value_effects_for_triggers"] | undefined,
): ProductDefinition["value_effects_for_triggers"] {
  const result: Record<string, Record<string, FieldValueEffect>> = {};
  for (const [rawTriggerId, rawTargets] of Object.entries(value ?? {})) {
    const triggerId = rawTriggerId.trim();
    const targets: Record<string, FieldValueEffect> = {};
    for (const [rawFieldId, rawEffect] of Object.entries(rawTargets)) {
      const fieldId = rawFieldId.trim();
      if (fieldId.length === 0) continue;
      targets[fieldId] = cloneJson(rawEffect);
    }
    if (triggerId.length > 0 && Object.keys(targets).length > 0) result[triggerId] = targets;
  }
  return result;
}

function normalizeFallbacks(value: ServiceFallbacks | null | undefined): ServiceFallbacks | null {
  if (value === null || value === undefined) return null;
  const nodes: Record<string, ServiceId[]> = {};
  const global: Record<string, ServiceId[]> = {};
  for (const [rawNodeId, candidates] of Object.entries(value.nodes ?? {})) {
    const nodeId = rawNodeId.trim();
    const next = uniqueServiceIds(candidates);
    if (nodeId.length > 0 && next.length > 0) nodes[nodeId] = next;
  }
  for (const [rawPrimary, candidates] of Object.entries(value.global ?? {})) {
    const primary = rawPrimary.trim();
    const next = uniqueServiceIds(candidates, primary);
    if (primary.length > 0 && next.length > 0) global[primary] = next;
  }
  return Object.keys(nodes).length === 0 && Object.keys(global).length === 0
    ? null
    : {
        ...(Object.keys(nodes).length === 0 ? {} : { nodes }),
        ...(Object.keys(global).length === 0 ? {} : { global }),
      };
}

/**
 * Normalize a canonical authoring draft. This deliberately recognizes no legacy keys and must not
 * be used as a substitute for validating externally supplied published documents.
 */
export function normalizeProductDefinition(
  input: ProductDefinitionDraft,
  options: NormalizeProductDefinitionOptions = {},
): ProductDefinition {
  const defaultRole = options.default_pricing_role ?? "base";
  const filters = (input.filters ?? []).map(normalizeFilter);
  if (filters.length === 0) {
    filters.push({ id: options.root_id ?? "root", label: options.root_label ?? "Root" });
  }
  return {
    id: input.id,
    name: trimmed(input.name),
    filters,
    fields: (input.fields ?? []).map((field) => normalizeField(field, defaultRole)),
    order_for_tags: normalizeStringArrayMap(input.order_for_tags),
    includes_for_buttons: normalizeStringArrayMap(input.includes_for_buttons),
    excludes_for_buttons: normalizeStringArrayMap(input.excludes_for_buttons),
    option_effects_for_buttons: normalizeOptionEffects(input.option_effects_for_buttons),
    value_effects_for_triggers: normalizeValueEffects(input.value_effects_for_triggers),
    schema_version: "1",
    fallbacks: normalizeFallbacks(input.fallbacks),
    description: input.description ?? null,
    notices: cloneJson<ProductNotice[]>(input.notices ?? []),
    meta: cloneJson<Record<string, JsonValue>>(input.meta ?? {}),
  };
}
