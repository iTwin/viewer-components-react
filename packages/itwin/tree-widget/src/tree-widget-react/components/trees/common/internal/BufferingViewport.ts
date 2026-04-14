/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Id64 } from "@itwin/core-bentley";

import type { BeEvent, Id64Arg, Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { PerModelCategoryOverride, TreeWidgetViewport } from "../TreeWidgetViewport.js";
import type { CategoryId, ElementId, ModelId, SubCategoryId } from "./Types.js";

/**
 * A wrapper over TreeWidgetViewport that buffers changes to the viewport.
 *
 * The changes can be either all committed at once using `commit` method, or discarded using `discard` method.
 *
 * It ensures that any reads reflect the buffered changes, not the state of the real viewport.
 * @internal
 */
export class BufferingViewport implements TreeWidgetViewport {
  #realViewport: TreeWidgetViewport;

  #changedModelDisplay = new Map<ModelId, boolean>();
  #changedCategoryDisplay = new Map<CategoryId, boolean>();
  #changedSubCategoryDisplay = new Map<SubCategoryId, boolean>();
  #changedPerModelCategoryOverrides = new Map<ModelId, Map<CategoryId, PerModelCategoryOverride>>();
  #clearedPerModelCategoryOverrides: Set<ModelId> | "all" | undefined;
  #isExclusive: boolean | undefined;
  #neverDrawn: Set<ElementId> | undefined | "cleared";
  #alwaysDrawn: Set<ElementId> | undefined | "cleared";

  #onCommitCallbacks: Array<() => void> = [];

  constructor(realViewport: TreeWidgetViewport) {
    this.#realViewport = realViewport;
  }

  // --- Read methods ---

  public get viewType(): "2d" | "3d" | "other" {
    return this.#realViewport.viewType;
  }

  public get iModel(): IModelConnection {
    return this.#realViewport.iModel;
  }

  public viewsModel(modelId: Id64String): boolean {
    const entry = this.#changedModelDisplay?.get(modelId);
    if (entry !== undefined) {
      return entry;
    }
    return this.#realViewport.viewsModel(modelId);
  }

  public viewsCategory(categoryId: Id64String): boolean {
    const entry = this.#changedCategoryDisplay?.get(categoryId);
    if (entry !== undefined) {
      return entry;
    }
    return this.#realViewport.viewsCategory(categoryId);
  }

  public viewsSubCategory(subCategoryId: Id64String): boolean {
    const entry = this.#changedSubCategoryDisplay?.get(subCategoryId);
    if (entry !== undefined) {
      return entry;
    }
    return this.#realViewport.viewsSubCategory(subCategoryId);
  }

  public get neverDrawn(): ReadonlySet<Id64String> | undefined {
    if (this.#neverDrawn === undefined) {
      return this.#realViewport.neverDrawn;
    }
    return this.#neverDrawn === "cleared" ? undefined : this.#neverDrawn;
  }

  public get alwaysDrawn(): ReadonlySet<Id64String> | undefined {
    if (this.#alwaysDrawn === undefined) {
      return this.#realViewport.alwaysDrawn;
    }
    return this.#alwaysDrawn === "cleared" ? undefined : this.#alwaysDrawn;
  }

  public get isAlwaysDrawnExclusive(): boolean {
    if (this.#isExclusive !== undefined) {
      return !!this.#isExclusive;
    }
    return this.#realViewport.isAlwaysDrawnExclusive;
  }

  public getPerModelCategoryOverride({ modelId, categoryId }: { modelId: Id64String; categoryId: Id64String }): PerModelCategoryOverride {
    const entry = this.#changedPerModelCategoryOverrides.get(modelId)?.get(categoryId);
    if (entry) {
      return entry;
    }
    if (this.#clearedPerModelCategoryOverrides !== undefined) {
      if (this.#clearedPerModelCategoryOverrides === "all" || this.#clearedPerModelCategoryOverrides.has(modelId)) {
        return "none";
      }
    }
    return this.#realViewport.getPerModelCategoryOverride({ modelId, categoryId });
  }

  public get perModelCategoryOverrides(): Readonly<Iterable<{ modelId: Id64String; categoryId: Id64String; visible: boolean }>> {
    const changedOverrides = this.#changedPerModelCategoryOverrides;
    const clearedOverrides = this.#clearedPerModelCategoryOverrides;
    const realOverrides = this.#realViewport.perModelCategoryOverrides;

    return {
      *[Symbol.iterator]() {
        if (!clearedOverrides || clearedOverrides !== "all") {
          for (const entry of realOverrides) {
            if (changedOverrides.get(entry.modelId)?.has(entry.categoryId)) {
              continue;
            }
            if (clearedOverrides?.has(entry.modelId)) {
              continue;
            }
            yield entry;
          }
        }
        for (const [modelId, categoryMap] of changedOverrides.entries()) {
          for (const [categoryId, override] of categoryMap.entries()) {
            if (override === "none") {
              continue;
            }
            yield { modelId, categoryId, visible: override === "show" };
          }
        }
      },
    };
  }

  // --- Write methods ---

  public changeModelDisplay(props: { modelIds: Id64Arg; display: boolean }): void {
    for (const id of Id64.iterable(props.modelIds)) {
      this.#changedModelDisplay.set(id, props.display);
    }
    this.#onCommitCallbacks.push(() => this.#realViewport.changeModelDisplay(props));
  }

  public changeCategoryDisplay(props: { categoryIds: Id64Arg; display: boolean; enableAllSubCategories?: boolean }): void {
    for (const id of Id64.iterable(props.categoryIds)) {
      this.#changedCategoryDisplay.set(id, props.display);
    }
    this.#onCommitCallbacks.push(() => this.#realViewport.changeCategoryDisplay(props));
  }

  public changeSubCategoryDisplay(props: { subCategoryId: Id64String; display: boolean }): void {
    this.#changedSubCategoryDisplay.set(props.subCategoryId, props.display);
    this.#onCommitCallbacks.push(() => this.#realViewport.changeSubCategoryDisplay(props));
  }

  public setPerModelCategoryOverride(props: { modelIds: Id64Arg; categoryIds: Id64Arg; override: PerModelCategoryOverride }): void {
    for (const modelId of Id64.iterable(props.modelIds)) {
      let modelEntry = this.#changedPerModelCategoryOverrides.get(modelId);
      if (!modelEntry) {
        modelEntry = new Map();
        this.#changedPerModelCategoryOverrides.set(modelId, modelEntry);
      }
      for (const categoryId of Id64.iterable(props.categoryIds)) {
        modelEntry.set(categoryId, props.override);
      }
    }
    this.#onCommitCallbacks.push(() => this.#realViewport.setPerModelCategoryOverride(props));
  }

  public clearPerModelCategoryOverrides(props?: { modelIds?: Id64Arg }): void {
    if (props?.modelIds) {
      const clearPerModelCategoryOverridesSet = this.#getClearPerModelCategoryOverridesSet();
      for (const modelId of Id64.iterable(props.modelIds)) {
        clearPerModelCategoryOverridesSet.add(modelId);
        this.#changedPerModelCategoryOverrides.delete(modelId);
      }
    } else {
      this.#clearedPerModelCategoryOverrides = "all";
      this.#changedPerModelCategoryOverrides.clear();
    }
    this.#onCommitCallbacks.push(() => this.#realViewport.clearPerModelCategoryOverrides(props));
  }

  #getClearPerModelCategoryOverridesSet(): Set<ModelId> {
    if (!this.#clearedPerModelCategoryOverrides) {
      this.#clearedPerModelCategoryOverrides = new Set();
      return this.#clearedPerModelCategoryOverrides;
    }
    if (this.#clearedPerModelCategoryOverrides !== "all") {
      return this.#clearedPerModelCategoryOverrides;
    }
    this.#clearedPerModelCategoryOverrides = new Set<string>();
    // When converting from "all" to Set, need to iterate over real viewport overrides and add them to cleared set
    // If they have not been changed yet.
    for (const { modelId } of this.#realViewport.perModelCategoryOverrides) {
      if (!this.#changedPerModelCategoryOverrides.has(modelId)) {
        this.#clearedPerModelCategoryOverrides.add(modelId);
      }
    }
    return this.#clearedPerModelCategoryOverrides;
  }

  public setNeverDrawn(props: { elementIds: Set<Id64String> }): void {
    this.#neverDrawn = props.elementIds;
    this.#onCommitCallbacks.push(() => this.#realViewport.setNeverDrawn(props));
  }

  public clearNeverDrawn(): void {
    this.#neverDrawn = "cleared";
    this.#onCommitCallbacks.push(() => this.#realViewport.clearNeverDrawn());
  }

  public setAlwaysDrawn(props: { elementIds: Set<Id64String>; exclusive?: boolean }): void {
    this.#isExclusive = !!props.exclusive;
    this.#alwaysDrawn = props.elementIds;
    this.#onCommitCallbacks.push(() => this.#realViewport.setAlwaysDrawn(props));
  }

  public clearAlwaysDrawn(): void {
    this.#alwaysDrawn = "cleared";
    this.#isExclusive = false;
    this.#onCommitCallbacks.push(() => this.#realViewport.clearAlwaysDrawn());
  }

  // --- Events ---

  public get onAlwaysDrawnChanged(): BeEvent<() => void> {
    return this.#realViewport.onAlwaysDrawnChanged;
  }

  public get onNeverDrawnChanged(): BeEvent<() => void> {
    return this.#realViewport.onNeverDrawnChanged;
  }

  public get onDisplayStyleChanged(): BeEvent<() => void> {
    return this.#realViewport.onDisplayStyleChanged;
  }

  public get onDisplayedModelsChanged(): BeEvent<() => void> {
    return this.#realViewport.onDisplayedModelsChanged;
  }

  public get onDisplayedCategoriesChanged(): BeEvent<() => void> {
    return this.#realViewport.onDisplayedCategoriesChanged;
  }

  public get onPerModelCategoriesOverridesChanged(): BeEvent<() => void> {
    return this.#realViewport.onPerModelCategoriesOverridesChanged;
  }

  public commit(): void {
    for (const callback of this.#onCommitCallbacks) {
      callback();
    }
    this.discard();
  }

  public discard(): void {
    this.#changedCategoryDisplay.clear();
    this.#changedModelDisplay.clear();
    this.#changedSubCategoryDisplay.clear();
    this.#changedPerModelCategoryOverrides.clear();
    this.#clearedPerModelCategoryOverrides = undefined;
    this.#isExclusive = undefined;
    this.#neverDrawn = undefined;
    this.#alwaysDrawn = undefined;
    this.#onCommitCallbacks = [];
  }
}
