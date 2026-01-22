/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, map, mergeMap, of } from "rxjs";
import { HierarchyNodeKey } from "@itwin/presentation-hierarchies";
import { CLASS_NAME_GeometricElement3d, CLASS_NAME_GeometricModel3d } from "../../../common/internal/ClassNameDefinitions.js";
import { createVisibilityStatus } from "../../../common/internal/Tooltip.js";
import { getIdsFromChildrenTree } from "../../../common/internal/Utils.js";
import { BaseVisibilityHelper } from "../../../common/internal/visibility/BaseVisibilityHelper.js";
import { mergeVisibilityStatuses } from "../../../common/internal/VisibilityUtils.js";

import type { Observable } from "rxjs";
import type { Id64Arg, Id64String } from "@itwin/core-bentley";
import type { InstanceKey } from "@itwin/presentation-shared";
import type { CategoryId } from "../../../common/internal/Types.js";
import type { BaseVisibilityHelperProps } from "../../../common/internal/visibility/BaseVisibilityHelper.js";
import type { VisibilityStatus } from "../../../common/UseHierarchyVisibility.js";
import type { ModelsTreeIdsCache } from "../ModelsTreeIdsCache.js";
import type { ModelsTreeVisibilityHandlerOverrides } from "./ModelsTreeVisibilityHandler.js";
import type { ModelsTreeSearchTargets } from "./SearchResultsTree.js";

/** @internal */
export type ModelsTreeVisibilityHelperProps = BaseVisibilityHelperProps<ModelsTreeSearchTargets> & {
  idsCache: ModelsTreeIdsCache;
  overrides?: ModelsTreeVisibilityHandlerOverrides;
};

/**
 * Visibility status helper for models tree.
 *
 * It extends base visibility status helper and provides methods to get and change visibility status of subjects and grouped elements.
 * @internal
 */
export class ModelsTreeVisibilityHelper extends BaseVisibilityHelper<ModelsTreeSearchTargets> {
  #props: ModelsTreeVisibilityHelperProps;
  constructor(props: ModelsTreeVisibilityHelperProps) {
    super(props);
    this.#props = props;
  }

  /**
   * Gets visibility status of subjects.
   *
   * Determines visibility status by checking visibility status of related models.
   */
  public getSubjectsVisibilityStatus(props: { subjectIds: Id64Arg }): Observable<VisibilityStatus> {
    const result = defer(() => {
      const { subjectIds } = props;
      if (this.#props.viewport.viewType !== "3d") {
        return of(createVisibilityStatus("disabled"));
      }

      return this.#props.idsCache.getSubjectModelIds(subjectIds).pipe(
        mergeMap((modelIds) => this.getModelsVisibilityStatus({ modelIds, type: "GeometricModel3d" })),
        mergeVisibilityStatuses,
      );
    });
    return this.#props.overrideHandler
      ? this.#props.overrideHandler.createVisibilityHandlerResult({
          overrideProps: props,
          nonOverriddenResult: result,
          override: this.#props.overrides?.getSubjectsVisibilityStatus,
        })
      : result;
  }

  /** Gets visibility status of grouped elements */
  public getGroupedElementsVisibilityStatus(props: {
    modelId: Id64String;
    categoryId: Id64String;
    elementIds: Id64Arg;
    parentKeys: HierarchyNodeKey[];
    childrenCount: number;
    categoryOfElementOrParentElementWhichIsNotChild: CategoryId;
  }): Observable<VisibilityStatus> {
    const { modelId, categoryId, elementIds, parentKeys, categoryOfElementOrParentElementWhichIsNotChild, childrenCount } = props;
    return this.getParentElementsIdsPath({
      parentInstanceKeys: parentKeys.filter((key) => HierarchyNodeKey.isInstances(key)).map((key) => key.instanceKeys),
      modelId,
    }).pipe(
      mergeMap((parentElementsIdsPath) =>
        this.getElementsVisibilityStatus({
          elementIds,
          modelId,
          categoryId,
          type: "GeometricElement3d",
          parentElementsIdsPath,
          childrenCount,
          categoryOfElementOrParentElementWhichIsNotChild,
        }),
      ),
    );
  }

  public getParentElementsIdsPath({
    parentInstanceKeys,
    modelId,
  }: {
    parentInstanceKeys: Array<Array<InstanceKey>>;
    modelId: Id64String;
  }): Observable<Array<Id64Arg>> {
    // Parent instance keys can have models, categories or elements, need to determine which ones are elements.
    // But need to get those parent id's starting from the model node.
    return defer(async () => {
      for (let i = 0; i < parentInstanceKeys.length; ++i) {
        const instanceKeys = parentInstanceKeys[i];
        for (const instanceKey of instanceKeys) {
          if (instanceKey.id !== modelId) {
            continue;
          }

          const [isDerivedFrom, isDerivedTo] = await Promise.all([
            this.#props.classInspector.classDerivesFrom(instanceKey.className, CLASS_NAME_GeometricModel3d),
            this.#props.classInspector.classDerivesFrom(CLASS_NAME_GeometricModel3d, instanceKey.className),
          ]);
          if (isDerivedFrom || isDerivedTo) {
            // Found model node, after model category node will be present, so we can skip first two parent keys.
            return parentInstanceKeys.slice(i + 2);
          }
        }
      }
      return [];
    }).pipe(
      mergeMap(async (parentKeysToCheck) => {
        return (
          await Promise.all(
            parentKeysToCheck.map(async (instanceKeysOfParentNode) => {
              // Only need to check the first instance key class to determine if it's an element.
              // This is because nodes' which have multiple instance keys always share the same class.
              const [isDerivedFrom, isDerivedTo] = await Promise.all([
                this.#props.classInspector.classDerivesFrom(instanceKeysOfParentNode[0].className, CLASS_NAME_GeometricElement3d),
                this.#props.classInspector.classDerivesFrom(CLASS_NAME_GeometricElement3d, instanceKeysOfParentNode[0].className),
              ]);
              if (isDerivedFrom || isDerivedTo) {
                return instanceKeysOfParentNode.map((instanceKey) => instanceKey.id);
              }
              return undefined;
            }),
          )
        ).filter((elementParentKeys) => !!elementParentKeys);
      }),
    );
  }

  /**
   * Changes visibility status of subjects.
   *
   * Does this by changing visibility status of related models.
   */
  public changeSubjectsVisibilityStatus(props: { subjectIds: Id64Arg; on: boolean }): Observable<void> {
    const result = defer(() => {
      const { on, subjectIds } = props;
      return this.#props.idsCache.getSubjectModelIds(subjectIds).pipe(mergeMap((modelIds) => this.changeModelsVisibilityStatus({ modelIds, on })));
    });
    return this.#props.overrideHandler
      ? this.#props.overrideHandler.createVisibilityHandlerResult({
          overrideProps: props,
          nonOverriddenResult: result,
          override: this.#props.overrides?.changeSubjectsVisibilityStatus,
        })
      : result;
  }

  /** Changes visibility of grouped elements. */
  public changeGroupedElementsVisibilityStatus(props: { modelId: Id64String; categoryId: Id64String; elementIds: Id64Arg; on: boolean }): Observable<void> {
    const { modelId, categoryId, elementIds, on } = props;
    return this.#props.idsCache.getChildrenTree({ elementIds }).pipe(
      map((childrenTree) => getIdsFromChildrenTree({ tree: childrenTree, predicate: ({ depth }) => depth > 0 })),
      mergeMap((children) => this.changeElementsVisibilityStatus({ modelId, elementIds, categoryId, on, children })),
    );
  }
}
