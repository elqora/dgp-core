// SPDX-License-Identifier: GPL-3.0-only

import type { HandlerService, ProductDefinition } from "@elqora/dgp-spec";

import { prepareProductDefinitionForSave } from "./cleanup.js";
import { projectProductGraphWithIndex, type ProductGraphSnapshot } from "./graph.js";
import { createProductIndex, type ProductIndex } from "./indexer.js";
import { createProductInterpreter, type ProductInterpreter } from "./interpreter.js";
import {
  normalizeProductDefinition,
  type NormalizeProductDefinitionOptions,
  type ProductDefinitionDraft,
} from "./normalization.js";
import type { ResolvedVisibility } from "./visibility.js";

export interface ProductBuilderOptions {
  selected_trigger_ids?: Iterable<string>;
  services?: readonly HandlerService[];
  normalization?: NormalizeProductDefinitionOptions;
}

/**
 * Canonical stateful authoring facade. It owns no history and performs no publication validation;
 * each load simply replaces the current normalized document and refreshes all derived views.
 */
export class ProductBuilder {
  #definition: ProductDefinition;
  #index: ProductIndex;
  #interpreter: ProductInterpreter;
  #selectedTriggerIds: string[];
  #services: readonly HandlerService[];
  #normalization: NormalizeProductDefinitionOptions;

  constructor(
    input: ProductDefinitionDraft = { id: "draft", name: "Untitled product" },
    options: ProductBuilderOptions = {},
  ) {
    this.#normalization = { ...options.normalization };
    this.#selectedTriggerIds = [...(options.selected_trigger_ids ?? [])];
    this.#services = options.services ?? [];
    this.#definition = normalizeProductDefinition(input, this.#normalization);
    this.#index = createProductIndex(this.#definition);
    this.#interpreter = createProductInterpreter(this.#definition);
  }

  get definition(): ProductDefinition {
    return this.#definition;
  }

  get index(): ProductIndex {
    return this.#index;
  }

  get interpreter(): ProductInterpreter {
    return this.#interpreter;
  }

  load(input: ProductDefinitionDraft): this {
    this.#definition = normalizeProductDefinition(input, this.#normalization);
    this.#index = createProductIndex(this.#definition);
    this.#interpreter = createProductInterpreter(this.#definition);
    return this;
  }

  replace(input: ProductDefinitionDraft): this {
    return this.load(input);
  }

  setOptions(patch: ProductBuilderOptions): this {
    if (patch.selected_trigger_ids !== undefined) {
      this.#selectedTriggerIds = [...patch.selected_trigger_ids];
    }
    if (patch.services !== undefined) this.#services = patch.services;
    if (patch.normalization !== undefined) this.#normalization = { ...patch.normalization };
    return this;
  }

  selectedTriggerIds(): string[] {
    return [...this.#selectedTriggerIds];
  }

  services(): readonly HandlerService[] {
    return this.#services;
  }

  tree(): ProductGraphSnapshot {
    return projectProductGraphWithIndex(this.#definition, this.#index);
  }

  resolveVisibility(filterId: string, selectedTriggerIds = this.#selectedTriggerIds): ResolvedVisibility {
    return this.#interpreter.resolveVisibility(filterId, selectedTriggerIds);
  }

  visibleFields(filterId: string, selectedTriggerIds = this.#selectedTriggerIds): string[] {
    return this.resolveVisibility(filterId, selectedTriggerIds).fieldIds;
  }

  cleanedDefinition(): ProductDefinition {
    return prepareProductDefinitionForSave(this.#definition);
  }

  getProps(): ProductDefinition {
    return this.#definition;
  }

  cleanedProps(): ProductDefinition {
    return this.cleanedDefinition();
  }

  isFilterId(id: string): boolean {
    return this.#index.getFilter(id) !== undefined;
  }

  isFieldId(id: string): boolean {
    return this.#index.getField(id) !== undefined;
  }

  isOptionId(id: string): boolean {
    return this.#index.getOption(id) !== undefined;
  }
}

export function createProductBuilder(
  input?: ProductDefinitionDraft,
  options?: ProductBuilderOptions,
): ProductBuilder {
  return new ProductBuilder(input, options);
}

/** Canonical convenience name retained for the established authoring facade experience. */
export const createBuilder = createProductBuilder;
