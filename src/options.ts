// SPDX-License-Identifier: GPL-3.0-only

import type { FieldOption, ProductDefinition, ProductField } from "@elqora/dgp-spec";

export interface OptionVisit {
  field: ProductField;
  fieldId: string;
  option: FieldOption;
  optionId: string;
  depth: number;
  parentId?: string;
}

export function walkFieldOptions(field: ProductField): OptionVisit[] {
  const visits: OptionVisit[] = [];

  function visit(options: readonly FieldOption[] | undefined, depth: number, parentId?: string): void {
    for (const option of options ?? []) {
      visits.push({
        field,
        fieldId: field.id,
        option,
        optionId: option.id,
        depth,
        ...(parentId === undefined ? {} : { parentId }),
      });
      visit(option.children, depth + 1, option.id);
    }
  }

  visit(field.options, 0);
  return visits;
}

export function walkOptions(definition: ProductDefinition): OptionVisit[] {
  return definition.fields.flatMap((field) => walkFieldOptions(field));
}

export function fieldOptionIds(field: ProductField): string[] {
  return walkFieldOptions(field).map((visit) => visit.optionId);
}

export function findFieldOption(field: ProductField | undefined, optionId: string): FieldOption | undefined {
  return field === undefined
    ? undefined
    : walkFieldOptions(field).find((visit) => visit.optionId === optionId)?.option;
}

export function filterFieldOptionsById(
  options: readonly FieldOption[] | undefined,
  allowed: ReadonlySet<string>,
): FieldOption[] | undefined {
  if (options === undefined) {
    return undefined;
  }

  const result: FieldOption[] = [];
  for (const option of options) {
    const children = filterFieldOptionsById(option.children, allowed);
    if (!allowed.has(option.id) && (children === undefined || children.length === 0)) {
      continue;
    }
    result.push({
      ...option,
      ...(children === undefined ? {} : { children }),
    });
  }
  return result;
}
