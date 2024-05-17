/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { BeEvent } from "@itwin/core-bentley";
import { QueryRowFormat } from "@itwin/core-common";
import { PerModelCategoryVisibility } from "@itwin/core-frontend";
import { KeySet } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { TreeWidget } from "../../../../TreeWidget";
import { CachingElementIdsContainer } from "../../models-tree/Utils";

import type { Id64String } from "@itwin/core-bentley";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { Keys } from "@itwin/presentation-common";
import type { VisibilityChangeListener, VisibilityStatus } from "../../VisibilityTreeEventHandler";
import { GroupingNodeKey, GroupingHierarchyNode, HierarchyNode } from "@itwin/presentation-hierarchies";

interface ExperimentalModelsVisibilityHandlerProps {
  viewport: Viewport;
}

/** @internal */
export class ExperimentalModelsVisibilityHandler {
  private _viewport: Viewport;
  private _pendingVisibilityChange: any | undefined;
  private _subjectModelIdsCache: SubjectModelIdsCache;
  private _elementIdsCache: ElementIdsCache;
  private _listeners = new Array<() => void>();

  constructor(props: ExperimentalModelsVisibilityHandlerProps) {
    this._viewport = props.viewport;
    this._subjectModelIdsCache = new SubjectModelIdsCache(props.viewport.iModel);
    this._elementIdsCache = new ElementIdsCache(props.viewport.iModel);
    this._listeners.push(this._viewport.onViewedCategoriesPerModelChanged.addListener(() => this.onVisibilityChangeInternal()));
    this._listeners.push(this._viewport.onViewedCategoriesChanged.addListener(() => this.onVisibilityChangeInternal()));
    this._listeners.push(this._viewport.onViewedModelsChanged.addListener(() => this.onVisibilityChangeInternal()));
    this._listeners.push(this._viewport.onAlwaysDrawnChanged.addListener(() => this.onVisibilityChangeInternal()));
    this._listeners.push(this._viewport.onNeverDrawnChanged.addListener(() => this.onVisibilityChangeInternal()));
  }

  public dispose() {
    this._listeners.forEach((remove) => remove());
    clearTimeout(this._pendingVisibilityChange);
  }

  public onVisibilityChange = new BeEvent<VisibilityChangeListener>();

  /** Returns visibility status of the tree node. */
  public getVisibilityStatus(node: HierarchyNode): Promise<VisibilityStatus> | VisibilityStatus {
    if (HierarchyNode.isClassGroupingNode(node)) {
      return this.getElementGroupingNodeDisplayStatus(node);
    }

    if (!HierarchyNode.isInstancesNode(node)) {
      return { state: "hidden", isDisabled: true };
    }

    if (isSubjectNode(node)) {
      // note: subject nodes may be merged to represent multiple subject instances
      return this.getSubjectNodeVisibility(node.key.instanceKeys.map((key) => key.id));
    }
    if (isModelNode(node)) {
      return this.getModelDisplayStatus(node.key.instanceKeys[0].id);
    }
    if (isCategoryNode(node)) {
      return this.getCategoryDisplayStatus(node.key.instanceKeys[0].id, this.getCategoryParentModelId(node));
    }
    return this.getElementDisplayStatus(node.key.instanceKeys[0].id, this.getElementModelId(node), this.getElementCategoryId(node));
  }

  /** Changes visibility of the items represented by the tree node. */
  public async changeVisibility(node: HierarchyNode, on: boolean) {
    if (HierarchyNode.isClassGroupingNode(node)) {
      await this.changeElementGroupingNodeState(node, on);
      return;
    }

    if (!HierarchyNode.isInstancesNode(node)) {
      return;
    }

    if (isSubjectNode(node)) {
      await this.changeSubjectNodeState(
        node.key.instanceKeys.map((key) => key.id),
        on,
      );
    } else if (isModelNode(node)) {
      await this.changeModelState(node.key.instanceKeys[0].id, on);
    } else if (isCategoryNode(node)) {
      this.changeCategoryState(node.key.instanceKeys[0].id, this.getCategoryParentModelId(node), on);
    } else {
      this.changeElementState(node.key.instanceKeys[0].id, this.getElementModelId(node), this.getElementCategoryId(node), on, node.children);
    }
  }

  private async getSubjectNodeVisibility(ids: Id64String[]): Promise<VisibilityStatus> {
    if (!this._viewport.view.isSpatialView()) {
      return { isDisabled: true, state: "hidden", tooltip: createTooltip("disabled", "subject.nonSpatialView") };
    }

    return this.getSubjectDisplayStatus(ids);
  }

  private async getSubjectDisplayStatus(ids: Id64String[]): Promise<VisibilityStatus> {
    const modelIds = await this.getSubjectModelIds(ids);
    const isDisplayed = modelIds.some((modelId) => this.getModelDisplayStatus(modelId).state === "visible");
    if (isDisplayed) {
      return { state: "visible", tooltip: createTooltip("visible", "subject.atLeastOneModelVisible") };
    }
    return { state: "hidden", tooltip: createTooltip("hidden", "subject.allModelsHidden") };
  }

  private getModelDisplayStatus(id: Id64String): VisibilityStatus {
    if (!this._viewport.view.isSpatialView()) {
      return { isDisabled: true, state: "hidden", tooltip: createTooltip("disabled", "model.nonSpatialView") };
    }
    const isDisplayed = this._viewport.view.viewsModel(id);
    return { state: isDisplayed ? "visible" : "hidden", tooltip: createTooltip(isDisplayed ? "visible" : "hidden", undefined) };
  }

  private getCategoryDisplayStatus(id: Id64String, parentModelId: Id64String | undefined): VisibilityStatus {
    if (parentModelId) {
      if (this.getModelDisplayStatus(parentModelId).state === "hidden") {
        return { state: "hidden", isDisabled: true, tooltip: createTooltip("disabled", "category.modelNotDisplayed") };
      }

      const override = this._viewport.perModelCategoryVisibility.getOverride(parentModelId, id);
      switch (override) {
        case PerModelCategoryVisibility.Override.Show:
          return { state: "visible", tooltip: createTooltip("visible", "category.displayedThroughPerModelOverride") };
        case PerModelCategoryVisibility.Override.Hide:
          return { state: "hidden", tooltip: createTooltip("hidden", "category.hiddenThroughPerModelOverride") };
      }
    }
    const isDisplayed = this._viewport.view.viewsCategory(id);
    return {
      state: isDisplayed ? "visible" : "hidden",
      tooltip: isDisplayed
        ? createTooltip("visible", "category.displayedThroughCategorySelector")
        : createTooltip("hidden", "category.hiddenThroughCategorySelector"),
    };
  }

  private async getElementGroupingNodeDisplayStatus(node: GroupingHierarchyNode & { key: GroupingNodeKey }): Promise<VisibilityStatus> {
    const { modelId, categoryId, elementIds } = this.getGroupedElementIds(node);

    if (!modelId || !this._viewport.view.viewsModel(modelId)) {
      return { isDisabled: true, state: "hidden", tooltip: createTooltip("disabled", "element.modelNotDisplayed") };
    }

    if (this._viewport.alwaysDrawn !== undefined && this._viewport.alwaysDrawn.size > 0) {
      let atLeastOneElementForceDisplayed = false;
      for await (const elementId of elementIds()) {
        if (this._viewport.alwaysDrawn.has(elementId)) {
          atLeastOneElementForceDisplayed = true;
          break;
        }
      }
      if (atLeastOneElementForceDisplayed) {
        return { state: "visible", tooltip: createTooltip("visible", "element.displayedThroughAlwaysDrawnList") };
      }
    }

    if (this._viewport.alwaysDrawn !== undefined && this._viewport.alwaysDrawn.size !== 0 && this._viewport.isAlwaysDrawnExclusive) {
      return { state: "hidden", tooltip: createTooltip("hidden", "element.hiddenDueToOtherElementsExclusivelyAlwaysDrawn") };
    }

    // istanbul ignore else
    if (this._viewport.neverDrawn !== undefined && this._viewport.neverDrawn.size > 0) {
      let allElementsForceHidden = true;
      for await (const elementId of elementIds()) {
        if (!this._viewport.neverDrawn.has(elementId)) {
          allElementsForceHidden = false;
          break;
        }
      }
      if (allElementsForceHidden) {
        return { state: "hidden", tooltip: createTooltip("visible", "element.hiddenThroughNeverDrawnList") };
      }
    }

    if (categoryId && this.getCategoryDisplayStatus(categoryId, modelId).state === "visible") {
      return { state: "visible", tooltip: createTooltip("visible", undefined) };
    }

    return { state: "hidden", tooltip: createTooltip("hidden", "element.hiddenThroughCategory") };
  }

  private getElementDisplayStatus(elementId: Id64String, modelId: Id64String | undefined, categoryId: Id64String | undefined): VisibilityStatus {
    if (!modelId || !this._viewport.view.viewsModel(modelId)) {
      return { isDisabled: true, state: "hidden", tooltip: createTooltip("disabled", "element.modelNotDisplayed") };
    }
    if (this._viewport.neverDrawn !== undefined && this._viewport.neverDrawn.has(elementId)) {
      return { state: "hidden", tooltip: createTooltip("hidden", "element.hiddenThroughNeverDrawnList") };
    }
    if (this._viewport.alwaysDrawn !== undefined) {
      if (this._viewport.alwaysDrawn.has(elementId)) {
        return { state: "visible", tooltip: createTooltip("visible", "element.displayedThroughAlwaysDrawnList") };
      }
      if (this._viewport.alwaysDrawn.size !== 0 && this._viewport.isAlwaysDrawnExclusive) {
        return { state: "hidden", tooltip: createTooltip("hidden", "element.hiddenDueToOtherElementsExclusivelyAlwaysDrawn") };
      }
    }
    if (categoryId && this.getCategoryDisplayStatus(categoryId, modelId).state === "visible") {
      return { state: "visible", tooltip: createTooltip("visible", undefined) };
    }
    return { state: "hidden", tooltip: createTooltip("hidden", "element.hiddenThroughCategory") };
  }

  private async changeSubjectNodeState(ids: Id64String[], on: boolean) {
    if (!this._viewport.view.isSpatialView()) {
      return;
    }

    return this.changeSubjectState(ids, on);
  }

  private async changeSubjectState(ids: Id64String[], on: boolean) {
    const modelIds = await this.getSubjectModelIds(ids);
    return this.changeModelsVisibility(modelIds, on);
  }

  private async changeModelState(id: Id64String, on: boolean) {
    if (!this._viewport.view.isSpatialView()) {
      return;
    }

    return this.changeModelsVisibility([id], on);
  }

  private async changeModelsVisibility(ids: Id64String[], visible: boolean) {
    if (visible) {
      return this._viewport.addViewedModels(ids);
    } else {
      this._viewport.changeModelDisplay(ids, false);
    }
  }

  private changeCategoryState(categoryId: Id64String, parentModelId: Id64String | undefined, on: boolean) {
    if (parentModelId) {
      const isDisplayedInSelector = this._viewport.view.viewsCategory(categoryId);
      const ovr =
        on === isDisplayedInSelector
          ? PerModelCategoryVisibility.Override.None
          : on
            ? PerModelCategoryVisibility.Override.Show
            : PerModelCategoryVisibility.Override.Hide;
      this._viewport.perModelCategoryVisibility.setOverride(parentModelId, categoryId, ovr);
      if (ovr === PerModelCategoryVisibility.Override.None && on) {
        // we took off the override which means the category is displayed in selector, but
        // doesn't mean all its subcategories are displayed - this call ensures that
        this._viewport.changeCategoryDisplay([categoryId], true, true);
      }
      return;
    }
    this._viewport.changeCategoryDisplay([categoryId], on, on ? true : false);
  }

  private async changeElementGroupingNodeState(node: GroupingHierarchyNode & { key: GroupingNodeKey }, on: boolean) {
    const { modelId, categoryId, elementIds } = this.getGroupedElementIds(node);
    await this.changeElementsState(modelId, categoryId, elementIds(), on);
  }

  private async changeElementState(id: Id64String, modelId: Id64String | undefined, categoryId: Id64String | undefined, on: boolean, hasChildren: boolean) {
    const isDisplayedByDefault = this.isElementDisplayedByDefault(modelId, categoryId);
    const isHiddenDueToExclusiveAlwaysDrawnElements = this.hasExclusiveAlwaysDrawnElements();
    this.changeElementStateInternal(id, on, isDisplayedByDefault, isHiddenDueToExclusiveAlwaysDrawnElements);

    if (!hasChildren) {
      return;
    }

    const childElements = this.getAssemblyElementIds(id);
    for await (const elementId of childElements.getElementIds()) {
      this.changeElementStateInternal(elementId, on, isDisplayedByDefault, isHiddenDueToExclusiveAlwaysDrawnElements);
    }
  }

  private async changeElementsState(modelId: Id64String | undefined, categoryId: Id64String | undefined, elementIds: AsyncGenerator<Id64String>, on: boolean) {
    const isDisplayedByDefault = this.isElementDisplayedByDefault(modelId, categoryId);
    const isHiddenDueToExclusiveAlwaysDrawnElements = this.hasExclusiveAlwaysDrawnElements();
    for await (const elementId of elementIds) {
      this.changeElementStateInternal(elementId, on, isDisplayedByDefault, isHiddenDueToExclusiveAlwaysDrawnElements);
    }
  }

  private changeElementStateInternal(elementId: Id64String, on: boolean, isDisplayedByDefault: boolean, isHiddenDueToExclusiveAlwaysDrawnElements: boolean) {
    let changedNeverDraw = false;
    let changedAlwaysDrawn = false;

    const currNeverDrawn = new Set(this._viewport.neverDrawn ? this._viewport.neverDrawn : []);
    const currAlwaysDrawn = new Set(this._viewport.alwaysDrawn ? this._viewport.alwaysDrawn : /* istanbul ignore next */ []);

    if (on) {
      changedNeverDraw = changedNeverDraw || currNeverDrawn.delete(elementId);
      if ((!isDisplayedByDefault || isHiddenDueToExclusiveAlwaysDrawnElements) && !currAlwaysDrawn.has(elementId)) {
        currAlwaysDrawn.add(elementId);
        changedAlwaysDrawn = true;
      }
    } else {
      changedAlwaysDrawn = changedAlwaysDrawn || currAlwaysDrawn.delete(elementId);
      if (isDisplayedByDefault && !isHiddenDueToExclusiveAlwaysDrawnElements && !currNeverDrawn.has(elementId)) {
        currNeverDrawn.add(elementId);
        changedNeverDraw = true;
      }
    }

    changedNeverDraw && this._viewport.setNeverDrawn(currNeverDrawn);
    changedAlwaysDrawn && this._viewport.setAlwaysDrawn(currAlwaysDrawn, this._viewport.isAlwaysDrawnExclusive);
  }

  private isElementDisplayedByDefault(modelId: Id64String | undefined, categoryId: Id64String | undefined) {
    return (
      !!modelId &&
      this.getModelDisplayStatus(modelId).state === "visible" &&
      !!categoryId &&
      this.getCategoryDisplayStatus(categoryId, modelId).state === "visible"
    );
  }

  private hasExclusiveAlwaysDrawnElements() {
    return this._viewport.isAlwaysDrawnExclusive && 0 !== this._viewport.alwaysDrawn?.size;
  }

  private onVisibilityChangeInternal() {
    if (this._pendingVisibilityChange) {
      return;
    }

    this._pendingVisibilityChange = setTimeout(() => {
      this.onVisibilityChange.raiseEvent();
      this._pendingVisibilityChange = undefined;
    }, 0);
  }

  private getCategoryParentModelId(categoryNode: HierarchyNode): Id64String | undefined {
    return categoryNode.extendedData && categoryNode.extendedData.modelIds[0] ? categoryNode.extendedData.modelIds[0][0] : /* istanbul ignore next */ undefined;
  }

  private getElementModelId(elementNode: HierarchyNode): Id64String | undefined {
    return elementNode.extendedData ? elementNode.extendedData.modelId : /* istanbul ignore next */ undefined;
  }

  private getElementCategoryId(elementNode: HierarchyNode): Id64String | undefined {
    return elementNode.extendedData ? elementNode.extendedData.categoryId : /* istanbul ignore next */ undefined;
  }

  private async getSubjectModelIds(subjectIds: Id64String[]) {
    return (await Promise.all(subjectIds.map(async (id) => this._subjectModelIdsCache.getSubjectModelIds(id)))).reduce(
      (allModelIds: Id64String[], curr: Id64String[]) => [...allModelIds, ...curr],
      [],
    );
  }

  private getAssemblyElementIds(assemblyId: Id64String) {
    return this._elementIdsCache.getAssemblyElementIds(assemblyId);
  }

  // istanbul ignore next
  private getGroupedElementIds(node: GroupingHierarchyNode & { key: GroupingNodeKey }) {
    const modelId = this.getElementModelId(node);
    const categoryId = this.getElementCategoryId(node);

    const getAssemblyElementIds = (id: Id64String) => this.getAssemblyElementIds(id);

    return {
      modelId,
      categoryId,
      elementIds: async function* () {
        for (const key of node.groupedInstanceKeys) {
          yield key.id;
          const assemblyElements = getAssemblyElementIds(key.id);
          for await (const elementId of assemblyElements.getElementIds()) {
            yield elementId;
          }
        }
      },
    };
  }
}

class SubjectModelIdsCache {
  private _imodel: IModelConnection;
  private _subjectsHierarchy: Map<Id64String, Id64String[]> | undefined;
  private _subjectModels: Map<Id64String, Id64String[]> | undefined;
  private _init: Promise<void> | undefined;

  constructor(imodel: IModelConnection) {
    this._imodel = imodel;
  }

  private async initSubjectModels() {
    const querySubjects = async (): Promise<Array<{ id: Id64String; parentId?: Id64String; targetPartitionId?: Id64String }>> => {
      const subjectsQuery = `
        SELECT ECInstanceId id, Parent.Id parentId, json_extract(JsonProperties, '$.Subject.Model.TargetPartition') targetPartitionId
        FROM bis.Subject
      `;
      return this._imodel.createQueryReader(subjectsQuery, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames }).toArray();
    };
    const queryModels = async (): Promise<Array<{ id: Id64String; parentId: Id64String }>> => {
      const modelsQuery = `
        SELECT p.ECInstanceId id, p.Parent.Id parentId
        FROM bis.InformationPartitionElement p
        INNER JOIN bis.GeometricModel3d m ON m.ModeledElement.Id = p.ECInstanceId
        WHERE NOT m.IsPrivate
      `;
      return this._imodel.createQueryReader(modelsQuery, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames }).toArray();
    };

    function pushToMap<TKey, TValue>(map: Map<TKey, TValue[]>, key: TKey, value: TValue) {
      let list = map.get(key);
      if (!list) {
        list = [];
        map.set(key, list);
      }
      list.push(value);
    }

    this._subjectsHierarchy = new Map();
    const targetPartitionSubjects = new Map<Id64String, Id64String[]>();
    for (const subject of await querySubjects()) {
      // istanbul ignore else
      if (subject.parentId) {
        pushToMap(this._subjectsHierarchy, subject.parentId, subject.id);
      }
      // istanbul ignore if
      if (subject.targetPartitionId) {
        pushToMap(targetPartitionSubjects, subject.targetPartitionId, subject.id);
      }
    }

    this._subjectModels = new Map();
    for (const model of await queryModels()) {
      // istanbul ignore next
      const subjectIds = targetPartitionSubjects.get(model.id) ?? [];
      // istanbul ignore else
      if (!subjectIds.includes(model.parentId)) {
        subjectIds.push(model.parentId);
      }

      subjectIds.forEach((subjectId) => {
        pushToMap(this._subjectModels!, subjectId, model.id);
      });
    }
  }

  private async initCache() {
    if (!this._init) {
      this._init = this.initSubjectModels().then(() => {});
    }
    return this._init;
  }

  private appendSubjectModelsRecursively(modelIds: Id64String[], subjectId: Id64String) {
    const subjectModelIds = this._subjectModels!.get(subjectId);
    if (subjectModelIds) {
      modelIds.push(...subjectModelIds);
    }

    const childSubjectIds = this._subjectsHierarchy!.get(subjectId);
    if (childSubjectIds) {
      childSubjectIds.forEach((cs) => this.appendSubjectModelsRecursively(modelIds, cs));
    }
  }

  public async getSubjectModelIds(subjectId: Id64String): Promise<Id64String[]> {
    await this.initCache();
    const modelIds = new Array<Id64String>();
    this.appendSubjectModelsRecursively(modelIds, subjectId);
    return modelIds;
  }
}

// istanbul ignore next
class ElementIdsCache {
  private _assemblyElementIdsCache = new Map<string, CachingElementIdsContainer>();

  constructor(private _imodel: IModelConnection) {}

  public clear() {
    this._assemblyElementIdsCache.clear();
  }

  public getAssemblyElementIds(assemblyId: Id64String) {
    const ids = this._assemblyElementIdsCache.get(assemblyId);
    if (ids) {
      return ids;
    }

    const container = createAssemblyElementIdsContainer(this._imodel, assemblyId);
    this._assemblyElementIdsCache.set(assemblyId, container);
    return container;
  }
}

// istanbul ignore next
async function* createInstanceIdsGenerator(imodel: IModelConnection, displayType: string, inputKeys: Keys) {
  const res = await Presentation.presentation.getContentInstanceKeys({
    imodel,
    rulesetOrId: {
      id: "AssemblyElements",
      rules: [
        {
          ruleType: "Content",
          specifications: [
            {
              specType: "ContentRelatedInstances",
              relationshipPaths: [
                {
                  direction: "Forward",
                  relationship: {
                    schemaName: "BisCore",
                    className: "ElementOwnsChildElements",
                  },
                  count: "*",
                },
              ],
            },
          ],
        },
      ],
    },
    displayType,
    keys: new KeySet(inputKeys),
  });
  for await (const key of res.items()) {
    yield key.id;
  }
}

// istanbul ignore next
function createAssemblyElementIdsContainer(imodel: IModelConnection, assemblyId: Id64String) {
  return new CachingElementIdsContainer(createInstanceIdsGenerator(imodel, "AssemblyElementsRequest", [{ className: "BisCore:Element", id: assemblyId }]));
}

const createTooltip = (status: "visible" | "hidden" | "disabled", tooltipStringId: string | undefined): string => {
  const statusStringId = `modelTree.status.${status}`;
  const statusString = TreeWidget.translate(statusStringId);
  if (!tooltipStringId) {
    return statusString;
  }

  tooltipStringId = `modelTree.tooltips.${tooltipStringId}`;
  const tooltipString = TreeWidget.translate(tooltipStringId);
  return `${statusString}: ${tooltipString}`;
};

function isSubjectNode(node: HierarchyNode) {
  return node.extendedData && node.extendedData.isSubject;
}

function isModelNode(node: HierarchyNode) {
  return node.extendedData && node.extendedData.isModel;
}

function isCategoryNode(node: HierarchyNode) {
  return node.extendedData && node.extendedData.isCategory;
}
