/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import {
  bufferCount,
  defaultIfEmpty,
  defer,
  EMPTY,
  firstValueFrom,
  forkJoin,
  from,
  fromEvent,
  identity,
  lastValueFrom,
  map,
  merge,
  mergeMap,
  of,
  reduce,
  takeUntil,
  toArray,
} from "rxjs";
import { assert, Guid } from "@itwin/core-bentley";
import { createNodesQueryClauseFactory, createPredicateBasedHierarchyDefinition, ProcessedHierarchyNode } from "@itwin/presentation-hierarchies";
import { createBisInstanceLabelSelectClauseFactory, ECSql } from "@itwin/presentation-shared";
import {
  CLASS_NAME_DefinitionContainer,
  CLASS_NAME_InformationPartitionElement,
  CLASS_NAME_ISubModeledElement,
  CLASS_NAME_Model,
  CLASS_NAME_SubCategory,
} from "../common/internal/ClassNameDefinitions.js";
import {
  createIdsSelector,
  getClassesByView,
  getDistinctMapValues,
  getOptimalBatchSize,
  groupingNodeHasFilterTargets,
  parseIdsSelectorResult,
  releaseMainThreadOnItemsCount,
} from "../common/internal/Utils.js";
import { FilterLimitExceededError } from "../common/TreeErrors.js";

import type { Observable } from "rxjs";
import type { GuidString, Id64Array, MarkRequired } from "@itwin/core-bentley";
import type {
  DefineHierarchyLevelProps,
  DefineInstanceNodeChildHierarchyLevelProps,
  DefineRootHierarchyLevelProps,
  GenericInstanceFilter,
  HierarchyDefinition,
  HierarchyLevelDefinition,
  HierarchyNodesDefinition,
  LimitingECSqlQueryExecutor,
  NodesQueryClauseFactory,
} from "@itwin/presentation-hierarchies";
import type {
  ECClassHierarchyInspector,
  ECSchemaProvider,
  ECSqlBinding,
  ECSqlQueryRow,
  IInstanceLabelSelectClauseFactory,
  InstanceKey,
} from "@itwin/presentation-shared";
import type { CategoryId, DefinitionContainerId, ElementId, ModelId, SubCategoryId } from "../common/internal/Types.js";
import type { NormalizedHierarchyFilteringPath } from "../common/Utils.js";
import type { CategoriesTreeIdsCache, CategoryInfo } from "./internal/CategoriesTreeIdsCache.js";

const MAX_FILTERING_INSTANCE_KEY_COUNT = 100;

interface CategoriesTreeDefinitionProps {
  imodelAccess: ECSchemaProvider & ECClassHierarchyInspector & LimitingECSqlQueryExecutor;
  viewType: "2d" | "3d";
  idsCache: CategoriesTreeIdsCache;
  hierarchyConfig: CategoriesTreeHierarchyConfiguration;
}

interface CategoriesTreeInstanceKeyPathsFromInstanceLabelProps {
  imodelAccess: ECClassHierarchyInspector & LimitingECSqlQueryExecutor;
  label: string;
  viewType: "2d" | "3d";
  limit?: number | "unbounded";
  idsCache: CategoriesTreeIdsCache;
  hierarchyConfig: CategoriesTreeHierarchyConfiguration;
  abortSignal?: AbortSignal;
  componentId?: GuidString;
}

/**
 * Defines hierarchy configuration supported by `CategoriesTree`.
 * @beta
 */
export interface CategoriesTreeHierarchyConfiguration {
  /** Should SubCategories be hidden. Defaults to `false` */
  hideSubCategories: boolean;
  /** Should Elements be shown. Defaults to `false` */
  showElements: boolean;
  /** Should categories without elements be shown. Defaults to `false`. */
  showEmptyCategories: boolean;
}

/** @internal */
export const defaultHierarchyConfiguration: CategoriesTreeHierarchyConfiguration = {
  hideSubCategories: false,
  showElements: false,
  showEmptyCategories: false,
};

/** @internal */
export class CategoriesTreeDefinition implements HierarchyDefinition {
  #impl: Promise<HierarchyDefinition> | undefined;
  #selectQueryFactory: NodesQueryClauseFactory;
  #nodeLabelSelectClauseFactory: IInstanceLabelSelectClauseFactory;
  #idsCache: CategoriesTreeIdsCache;
  #hierarchyConfig: CategoriesTreeHierarchyConfiguration;
  #iModelAccess: ECSchemaProvider & ECClassHierarchyInspector & LimitingECSqlQueryExecutor;
  #categoryClass: string;
  #categoryElementClass: string;
  #categoryModelClass: string;
  static #componentName = "CategoriesTreeDefinition";

  public constructor(props: CategoriesTreeDefinitionProps) {
    this.#iModelAccess = props.imodelAccess;
    this.#idsCache = props.idsCache;
    this.#nodeLabelSelectClauseFactory = createBisInstanceLabelSelectClauseFactory({ classHierarchyInspector: props.imodelAccess });
    this.#selectQueryFactory = createNodesQueryClauseFactory({
      imodelAccess: props.imodelAccess,
      instanceLabelSelectClauseFactory: this.#nodeLabelSelectClauseFactory,
    });
    this.#hierarchyConfig = props.hierarchyConfig;
    const { categoryClass, elementClass, modelClass } = getClassesByView(props.viewType);
    this.#categoryClass = categoryClass;
    this.#categoryElementClass = elementClass;
    this.#categoryModelClass = modelClass;
  }

  public async postProcessNode(node: ProcessedHierarchyNode): Promise<ProcessedHierarchyNode> {
    if (ProcessedHierarchyNode.isGroupingNode(node)) {
      const modelElementsMap = new Map<ModelId, Set<ElementId>>();
      node.children.forEach((child) => {
        let modelEntry = modelElementsMap.get(child.extendedData?.modelId);
        if (!modelEntry) {
          modelEntry = new Set();
          modelElementsMap.set(child.extendedData?.modelId, modelEntry);
        }
        assert(child.key.type === "instances");
        for (const { id } of child.key.instanceKeys) {
          modelEntry.add(id);
        }
      });

      const { hasFilterTargetAncestor, hasDirectNonFilteredTargets } = groupingNodeHasFilterTargets(node.children);

      return {
        ...node,
        label: node.label,
        extendedData: {
          ...node.extendedData,
          // add `categoryId` from the first grouped element
          categoryId: node.children[0].extendedData?.categoryId,
          modelElementsMap,
          ...(hasDirectNonFilteredTargets ? { hasDirectNonFilteredTargets } : {}),
          ...(hasFilterTargetAncestor ? { hasFilterTargetAncestor } : {}),
          // `imageId` is assigned to instance nodes at query time, but grouping ones need to
          // be handled during post-processing
          imageId: "icon-ec-class",
        },
      };
    }
    return node;
  }

  private async getHierarchyDefinition(): Promise<HierarchyDefinition> {
    this.#impl ??= (async () => {
      const isDefinitionContainerSupported = await firstValueFrom(this.#idsCache.getIsDefinitionContainerSupported());
      return createPredicateBasedHierarchyDefinition({
        classHierarchyInspector: this.#iModelAccess,
        hierarchy: {
          rootNodes: async (requestProps: DefineRootHierarchyLevelProps) => this.createDefinitionContainersAndCategoriesQuery(requestProps),
          childNodes: [
            ...(this.#hierarchyConfig.showElements
              ? [
                  {
                    parentInstancesNodePredicate: this.#categoryElementClass,
                    definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createElementChildrenQuery(requestProps),
                  },
                  {
                    parentInstancesNodePredicate: CLASS_NAME_ISubModeledElement,
                    definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createISubModeledElementChildrenQuery(requestProps),
                  },
                  {
                    parentInstancesNodePredicate: this.#categoryModelClass,
                    definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createGeometricModel3dChildrenQuery(requestProps),
                  },
                ]
              : []),
            ...(this.#hierarchyConfig.hideSubCategories && !this.#hierarchyConfig.showElements
              ? []
              : [
                  {
                    parentInstancesNodePredicate: this.#categoryClass,
                    definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createCategoryChildrenQuery(requestProps),
                  },
                ]),
            ...(isDefinitionContainerSupported
              ? [
                  {
                    parentInstancesNodePredicate: CLASS_NAME_DefinitionContainer,
                    definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) =>
                      this.createDefinitionContainersAndCategoriesQuery(requestProps),
                  },
                ]
              : []),
          ],
        },
      });
    })();
    return this.#impl;
  }

  public async defineHierarchyLevel(props: DefineHierarchyLevelProps) {
    return (await this.getHierarchyDefinition()).defineHierarchyLevel(props);
  }

  private async createISubModeledElementChildrenQuery({
    parentNodeInstanceIds: elementIds,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    // note: we do not apply hierarchy level filtering on this hierarchy level, because it's always
    // hidden - the filter will get applied on the child hierarchy levels
    return [
      {
        fullClassName: this.#categoryModelClass,
        query: {
          ecsql: `
            SELECT
              ${await this.#selectQueryFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: "", // doesn't matter - the node is always hidden
                hideNodeInHierarchy: true,
                hasChildren: true,
                extendedData: {
                  isModel: true,
                },
              })}
            FROM ${this.#categoryModelClass} this
            WHERE
              this.ModeledElement.Id IN (${elementIds.map(() => "?").join(",")})
              AND NOT this.IsPrivate
              AND this.ECInstanceId IN (SELECT Model.Id FROM ${this.#categoryElementClass})
          `,
          bindings: [...elementIds.map((id): ECSqlBinding => ({ type: "id", value: id }))],
        },
      },
    ];
  }

  private async createGeometricModel3dChildrenQuery({
    parentNodeInstanceIds: modelIds,
    instanceFilter,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const instanceFilterClauses = await this.#selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: this.#categoryClass, alias: "this" },
    });

    return [
      {
        fullClassName: this.#categoryClass,
        query: {
          ecsql: `
          SELECT
            ${await this.#selectQueryFactory.createSelectClause({
              ecClassId: { selector: "this.ECClassId" },
              ecInstanceId: { selector: "this.ECInstanceId" },
              nodeLabel: {
                selector: await this.#nodeLabelSelectClauseFactory.createSelectClause({
                  classAlias: "this",
                  className: this.#categoryClass,
                }),
              },
              grouping: { byLabel: { action: "merge", groupId: "category" } },
              hasChildren: true,
              extendedData: {
                imageId: "icon-layers",
                isCategory: true,
                modelIds: { selector: createIdsSelector(modelIds) },
                isCategoryOfSubModel: true,
              },
              supportsFiltering: true,
            })}
          FROM ${instanceFilterClauses.from} this
          ${instanceFilterClauses.joins}
          WHERE
            EXISTS (
              SELECT 1
              FROM ${this.#categoryElementClass} element
              WHERE
                element.Model.Id IN (${modelIds.join(",")})
                AND element.Category.Id = +this.ECInstanceId
                AND element.Parent.Id IS NULL
            )
            ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
        `,
        },
      },
    ];
  }

  private async createDefinitionContainersAndCategoriesQuery(props: {
    parentNodeInstanceIds?: Id64Array;
    instanceFilter?: GenericInstanceFilter;
  }): Promise<HierarchyLevelDefinition> {
    const { parentNodeInstanceIds, instanceFilter } = props;
    const { definitionContainers, categories } = await firstValueFrom(
      parentNodeInstanceIds === undefined
        ? this.#idsCache.getRootDefinitionContainersAndCategories({ includeEmpty: this.#hierarchyConfig.showEmptyCategories })
        : this.#idsCache.getDirectChildDefinitionContainersAndCategories({
            parentDefinitionContainerIds: parentNodeInstanceIds,
            includeEmpty: this.#hierarchyConfig.showEmptyCategories,
          }),
    );
    const hierarchyDefinition = new Array<HierarchyNodesDefinition>();
    if (categories.length > 0) {
      hierarchyDefinition.push(...(await this.createCategoriesQuery({ categories, instanceFilter })));
    }
    if (definitionContainers.length > 0) {
      hierarchyDefinition.push(...(await this.createDefinitionContainersQuery({ definitionContainerIds: definitionContainers, instanceFilter })));
    }
    return hierarchyDefinition;
  }

  private async createDefinitionContainersQuery({
    definitionContainerIds,
    instanceFilter,
  }: {
    definitionContainerIds: Id64Array;
    instanceFilter?: GenericInstanceFilter;
  }): Promise<HierarchyLevelDefinition> {
    const instanceFilterClauses = await this.#selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: CLASS_NAME_DefinitionContainer, alias: "this" },
    });

    return [
      {
        fullClassName: CLASS_NAME_DefinitionContainer,
        query: {
          ecsql: `
            SELECT
              ${await this.#selectQueryFactory.createSelectClause({
                ecClassId: { selector: ECSql.createRawPropertyValueSelector("this", "ECClassId") },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this.#nodeLabelSelectClauseFactory.createSelectClause({
                    classAlias: "this",
                    className: CLASS_NAME_DefinitionContainer,
                  }),
                },
                extendedData: {
                  isDefinitionContainer: true,
                  imageId: "icon-definition-container",
                },
                hasChildren: true,
                supportsFiltering: true,
              })}
            FROM
              ${instanceFilterClauses.from} this
              ${instanceFilterClauses.joins}
            WHERE
              this.ECInstanceId IN (${definitionContainerIds.join(", ")})
              ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
          `,
        },
      },
    ];
  }

  private async createCategoriesQuery({
    categories,
    instanceFilter,
  }: {
    categories: Array<CategoryInfo>;
    instanceFilter?: GenericInstanceFilter;
  }): Promise<HierarchyLevelDefinition> {
    const instanceFilterClauses = await this.#selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: this.#categoryClass, alias: "this" },
    });
    const categoriesWithMultipleSubCategories = categories
      .filter((categoryInfo) => categoryInfo.subCategoryChildCount > 1)
      .map((categoryInfo) => categoryInfo.id);

    const hasChildrenSelector = () => {
      const conditions = new Array<string>();
      if (!this.#hierarchyConfig.hideSubCategories && categoriesWithMultipleSubCategories.length > 0) {
        conditions.push(`this.ECInstanceId IN (${categoriesWithMultipleSubCategories.join(",")})`);
      }
      if (this.#hierarchyConfig.showElements) {
        conditions.push(`
          this.ECInstanceId IN (
            SELECT e.Category.Id
            FROM ${this.#categoryElementClass} e
            WHERE
              e.Parent.Id IS NULL
              AND e.ECInstanceId NOT IN (SELECT m.ECInstanceId FROM ${this.#categoryModelClass} m)
          )`);
      }
      return conditions.length > 0
        ? {
            selector: `IIF(${conditions.join(" OR ")}, 1, 0)`,
          }
        : false;
    };

    return [
      {
        fullClassName: this.#categoryClass,
        query: {
          ecsql: `
            SELECT
              ${await this.#selectQueryFactory.createSelectClause({
                ecClassId: { selector: ECSql.createRawPropertyValueSelector("this", "ECClassId") },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this.#nodeLabelSelectClauseFactory.createSelectClause({
                    classAlias: "this",
                    className: this.#categoryClass,
                  }),
                },
                hasChildren: hasChildrenSelector(),
                extendedData: {
                  description: { selector: "this.Description" },
                  isCategory: true,
                  imageId: "icon-layers",
                  hasSubCategories:
                    categoriesWithMultipleSubCategories.length > 0
                      ? { selector: `IIF(this.ECInstanceId IN (${categoriesWithMultipleSubCategories.join(",")}), true, false) ` }
                      : false,
                },
                supportsFiltering: true,
              })}
            FROM
              ${instanceFilterClauses.from} this
              ${instanceFilterClauses.joins}
            WHERE
              this.ECInstanceId IN (${categories.map((category) => category.id).join(", ")})
              ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
          `,
        },
      },
    ];
  }

  private async createCategoryChildrenQuery(props: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    return (
      await Promise.all([
        ...(!this.#hierarchyConfig.hideSubCategories && props.parentNode.extendedData?.hasSubCategories ? [this.createSubCategoriesQuery(props)] : []),
        ...(this.#hierarchyConfig.showElements ? [this.createCategoryElementsQuery(props)] : []),
      ])
    ).reduce((acc, levelDefinition) => acc.concat(levelDefinition), new Array<HierarchyNodesDefinition>());
  }

  private async createSubCategoriesQuery({
    parentNodeInstanceIds: categoryIds,
    instanceFilter,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const instanceFilterClauses = await this.#selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: CLASS_NAME_SubCategory, alias: "this" },
    });

    return [
      {
        fullClassName: CLASS_NAME_SubCategory,
        query: {
          ecsql: `
            SELECT
              ${await this.#selectQueryFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this.#nodeLabelSelectClauseFactory.createSelectClause({
                    classAlias: "this",
                    className: CLASS_NAME_SubCategory,
                  }),
                },
                extendedData: {
                  categoryId: { selector: "printf('0x%x', this.Parent.Id)" },
                  isSubCategory: true,
                  imageId: "icon-layers-isolate",
                },
                supportsFiltering: false,
              })}
            FROM ${instanceFilterClauses.from} this
            ${instanceFilterClauses.joins}
            WHERE
              NOT this.IsPrivate AND this.Parent.Id IN (${categoryIds.join(",")})
              ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
          `,
        },
      },
    ];
  }

  private async createCategoryElementsQuery({
    parentNodeInstanceIds: categoryIds,
    instanceFilter,
    parentNode,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const instanceFilterClauses = await this.#selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: this.#categoryElementClass, alias: "this" },
    });
    const modelIds: Id64Array = parentNode.extendedData?.isCategoryOfSubModel
      ? parseIdsSelectorResult(parentNode.extendedData?.modelIds)
      : [...getDistinctMapValues(await firstValueFrom(this.#idsCache.getCategoriesElementModels(categoryIds)))];

    if (modelIds.length === 0) {
      return [];
    }
    const modeledElements = await firstValueFrom(
      from(modelIds).pipe(
        mergeMap((modelId) => this.#idsCache.getCategoriesModeledElements(modelId, categoryIds)),
        reduce((acc, foundModeledElements) => {
          return acc.concat(foundModeledElements);
        }, new Array<ElementId>()),
      ),
    );

    return [
      {
        fullClassName: this.#categoryElementClass,
        query: {
          ecsql: `
            SELECT
            ${await this.#selectQueryFactory.createSelectClause({
              ecClassId: { selector: "this.ECClassId" },
              ecInstanceId: { selector: "this.ECInstanceId" },
              nodeLabel: {
                selector: await this.#nodeLabelSelectClauseFactory.createSelectClause({
                  classAlias: "this",
                  className: this.#categoryElementClass,
                }),
              },
              hasChildren: {
                selector: `
                  IIF(
                    ${modeledElements.length ? `this.ECInstanceId IN (${modeledElements.join(",")})` : `FALSE`},
                    1,
                    IFNULL((
                      SELECT 1
                      FROM ${this.#categoryElementClass} ce
                      WHERE ce.Parent.Id = this.ECInstanceId
                      LIMIT 1
                    ), 0)
                  )
                `,
              },
              grouping: {
                byClass: true,
              },
              extendedData: {
                modelId: { selector: "IdToHex(this.Model.Id)" },
                categoryId: { selector: "IdToHex(this.Category.Id)" },
                imageId: "icon-item",
                isElement: true,
              },
              supportsFiltering: true,
            })}
          FROM ${instanceFilterClauses.from} this
          ${parentNode.extendedData?.isCategoryOfSubModel ? "" : `JOIN ${CLASS_NAME_InformationPartitionElement} ipe ON ipe.ECInstanceId = this.Model.Id`}
          ${instanceFilterClauses.joins}
          WHERE
            this.Category.Id IN (${categoryIds.join(",")})
            AND this.Model.Id IN (${modelIds.join(",")})
            AND this.Parent.Id IS NULL
            ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
          `,
        },
      },
    ];
  }

  private async createElementChildrenQuery({
    parentNodeInstanceIds: elementIds,
    instanceFilter,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const instanceFilterClauses = await this.#selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: this.#categoryElementClass, alias: "this" },
    });
    return [
      {
        fullClassName: this.#categoryElementClass,
        query: {
          ecsql: `
            SELECT
              ${await this.#selectQueryFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this.#nodeLabelSelectClauseFactory.createSelectClause({
                    classAlias: "this",
                    className: this.#categoryElementClass,
                  }),
                },
                hasChildren: {
                  selector: `
                    IFNULL((
                      SELECT 1
                      FROM ${this.#categoryElementClass} ce
                      JOIN ${CLASS_NAME_Model} m ON ce.Model.Id = m.ECInstanceId
                      WHERE ce.Parent.Id = this.ECInstanceId OR (ce.Model.Id = this.ECInstanceId AND m.IsPrivate = false)
                      LIMIT 1
                    ), 0)
                  `,
                },
                grouping: {
                  byClass: true,
                },
                extendedData: {
                  modelId: { selector: "IdToHex(this.Model.Id)" },
                  categoryId: { selector: "IdToHex(this.Category.Id)" },
                  imageId: "icon-item",
                  isElement: true,
                },
                supportsFiltering: true,
              })}
            FROM ${instanceFilterClauses.from} this
            ${instanceFilterClauses.joins}
            WHERE
              this.Parent.Id IN (${elementIds.join(",")})
              ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
          `,
        },
      },
    ];
  }

  public static async createInstanceKeyPaths(props: CategoriesTreeInstanceKeyPathsFromInstanceLabelProps): Promise<NormalizedHierarchyFilteringPath[]> {
    const labelsFactory = createBisInstanceLabelSelectClauseFactory({ classHierarchyInspector: props.imodelAccess });
    return createInstanceKeyPathsFromInstanceLabel({
      ...props,
      labelsFactory,
      componentId: props.componentId ?? Guid.createValue(),
      componentName: this.#componentName,
    });
  }
}

async function createInstanceKeyPathsFromInstanceLabel(
  props: MarkRequired<CategoriesTreeInstanceKeyPathsFromInstanceLabelProps, "componentId"> & {
    labelsFactory: IInstanceLabelSelectClauseFactory;
    componentName: string;
  },
): Promise<NormalizedHierarchyFilteringPath[]> {
  const { idsCache, abortSignal, label, viewType, labelsFactory, limit, hierarchyConfig, imodelAccess, componentId, componentName } = props;
  const { categoryClass, elementClass } = getClassesByView(viewType);

  const adjustedLabel = label.replace(/[%_\\]/g, "\\$&");

  const CATEGORIES_WITH_LABELS_CTE = "CategoriesWithLabels";
  const ELEMENTS_WITH_LABELS_CTE = "ElementsWithLabels";
  const SUBCATEGORIES_WITH_LABELS_CTE = "SubCategoriesWithLabels";
  const DEFINITION_CONTAINERS_WITH_LABELS_CTE = "DefinitionContainersWithLabels";

  return lastValueFrom(
    idsCache
      .getAllDefinitionContainersAndCategories({
        includeEmpty: props.hierarchyConfig.showEmptyCategories,
      })
      .pipe(
        mergeMap(async ({ definitionContainers, categories }) => {
          if (categories.length === 0) {
            return undefined;
          }
          const [categoryLabelSelectClause, subCategoryLabelSelectClause, elementLabelSelectClause, definitionContainerLabelSelectClause] = await Promise.all(
            [categoryClass, CLASS_NAME_SubCategory, elementClass, ...(definitionContainers.length > 0 ? [CLASS_NAME_DefinitionContainer] : [])].map(
              async (className) => labelsFactory.createSelectClause({ classAlias: "this", className }),
            ),
          );
          const ctes = [
            `${CATEGORIES_WITH_LABELS_CTE}(ClassName, ECInstanceId, ChildCount, DisplayLabel) AS (
            SELECT
              'c',
              this.ECInstanceId,
              COUNT(sc.ECInstanceId),
              ${categoryLabelSelectClause}
            FROM
              ${categoryClass} this
              JOIN ${CLASS_NAME_SubCategory} sc ON sc.Parent.Id = this.ECInstanceId
            WHERE
              this.ECInstanceId IN (${categories.join(", ")})
              GROUP BY this.ECInstanceId
          )`,
            ...(hierarchyConfig.showElements
              ? [
                  `${ELEMENTS_WITH_LABELS_CTE}(ClassName, ECInstanceId, ParentId, DisplayLabel) AS (
                  SELECT
                    'e',
                    this.ECInstanceId,
                    this.Parent.Id,
                    ${elementLabelSelectClause}
                  FROM
                    ${elementClass} this
                    JOIN ${CLASS_NAME_Model} m ON this.Model.Id = m.ECInstanceId
                  WHERE
                    NOT m.IsPrivate
                    AND this.Category.Id IN (${categories.join(", ")})
                )`,
                ]
              : []),
            ...(hierarchyConfig.hideSubCategories
              ? []
              : [
                  `${SUBCATEGORIES_WITH_LABELS_CTE}(ClassName, ECInstanceId, ParentId, DisplayLabel) AS (
                SELECT
                  'sc',
                  this.ECInstanceId,
                  this.Parent.Id,
                  ${subCategoryLabelSelectClause}
                FROM
                  ${CLASS_NAME_SubCategory} this
                WHERE
                  NOT this.IsPrivate
                  AND this.Parent.Id IN (${categories.join(", ")})
              )`,
                ]),
            ...(definitionContainers.length > 0
              ? [
                  `${DEFINITION_CONTAINERS_WITH_LABELS_CTE}(ClassName, ECInstanceId, DisplayLabel) AS (
                SELECT
                  'dc',
                  this.ECInstanceId,
                  ${definitionContainerLabelSelectClause}
                FROM
                  ${CLASS_NAME_DefinitionContainer} this
                WHERE
                  this.ECInstanceId IN (${definitionContainers.join(", ")})
              )`,
                ]
              : []),
          ];
          const ecsql = `
        SELECT * FROM (
          SELECT
            c.ClassName AS ClassName,
            c.ECInstanceId AS ECInstanceId
          FROM
            ${CATEGORIES_WITH_LABELS_CTE} c
          WHERE
            c.DisplayLabel LIKE '%' || ? || '%' ESCAPE '\\'
          ${
            hierarchyConfig.showElements
              ? `
                UNION ALL
                SELECT
                  e.ClassName AS ClassName,
                  e.ECInstanceId AS ECInstanceId
                FROM
                  ${ELEMENTS_WITH_LABELS_CTE} e
                WHERE
                  e.DisplayLabel LIKE '%' || ? || '%' ESCAPE '\\'
              `
              : ""
          }
          ${
            hierarchyConfig.hideSubCategories
              ? ""
              : `
                UNION ALL
                SELECT
                  sc.ClassName AS ClassName,
                  sc.ECInstanceId AS ECInstanceId
                FROM
                  ${CATEGORIES_WITH_LABELS_CTE} c
                  JOIN ${SUBCATEGORIES_WITH_LABELS_CTE} sc ON sc.ParentId = c.ECInstanceId
                WHERE
                  c.ChildCount > 1
                  AND sc.DisplayLabel LIKE '%' || ? || '%' ESCAPE '\\'
              `
          }
          ${
            definitionContainers.length > 0
              ? `
                UNION ALL
                SELECT
                  dc.ClassName AS ClassName,
                  dc.ECInstanceId AS ECInstanceId
                FROM
                  ${DEFINITION_CONTAINERS_WITH_LABELS_CTE} dc
                WHERE
                  dc.DisplayLabel LIKE '%' || ? || '%' ESCAPE '\\'
              `
              : ""
          }
        )
        ${limit === undefined ? `LIMIT ${MAX_FILTERING_INSTANCE_KEY_COUNT + 1}` : limit !== "unbounded" ? `LIMIT ${limit}` : ""}
      `;
          const bindings = [
            { type: "string" as const, value: adjustedLabel },
            ...(hierarchyConfig.showElements ? [{ type: "string" as const, value: adjustedLabel }] : []),
            ...(hierarchyConfig.hideSubCategories ? [] : [{ type: "string" as const, value: adjustedLabel }]),
            ...(definitionContainers.length > 0 ? [{ type: "string" as const, value: adjustedLabel }] : []),
          ];
          return { ctes, ecsql, bindings };
        }),
        mergeMap((queryProps) => {
          if (!queryProps) {
            return EMPTY;
          }
          return imodelAccess.createQueryReader(queryProps, { restartToken: `${componentName}/${componentId}/filter-by-label`, limit });
        }),
        releaseMainThreadOnItemsCount(1000),
        map((row): InstanceKey => {
          let className: string;
          switch (row.ClassName) {
            case "c":
              className = categoryClass;
              break;
            case "sc":
              className = CLASS_NAME_SubCategory;
              break;
            case "e":
              className = elementClass;
              break;
            default:
              className = CLASS_NAME_DefinitionContainer;
              break;
          }
          return {
            className,
            id: row.ECInstanceId,
          };
        }),
        toArray(),
        mergeMap((targetItems) => createInstanceKeyPathsFromTargetItems({ ...props, targetItems })),
        toArray(),
        abortSignal ? takeUntil(fromEvent(abortSignal, "abort")) : identity,
        defaultIfEmpty([]),
      ),
  );
}

function createInstanceKeyPathsFromTargetItems({
  targetItems,
  imodelAccess,
  viewType,
  hierarchyConfig,
  idsCache,
  limit,
  componentId,
  componentName,
}: MarkRequired<CategoriesTreeInstanceKeyPathsFromInstanceLabelProps, "componentId"> & {
  targetItems: InstanceKey[];
  componentName: string;
}): Observable<NormalizedHierarchyFilteringPath> {
  if (limit !== "unbounded" && targetItems.length > (limit ?? MAX_FILTERING_INSTANCE_KEY_COUNT)) {
    throw new FilterLimitExceededError(limit ?? MAX_FILTERING_INSTANCE_KEY_COUNT);
  }
  const { categoryClass } = getClassesByView(viewType);

  return from(targetItems).pipe(
    releaseMainThreadOnItemsCount(500),
    reduce(
      (acc, { id, className }) => {
        if (className === categoryClass) {
          acc.categoryIds.push(id);
          return acc;
        }
        if (className === CLASS_NAME_DefinitionContainer) {
          acc.definitionContainerIds.push(id);
          return acc;
        }
        if (className === CLASS_NAME_SubCategory) {
          if (hierarchyConfig.hideSubCategories) {
            return acc;
          }
          acc.subCategoryIds.push(id);
          return acc;
        }

        if (!hierarchyConfig.showElements) {
          return acc;
        }
        acc.elementIds.push(id);
        return acc;
      },
      {
        definitionContainerIds: new Array<DefinitionContainerId>(),
        categoryIds: new Array<CategoryId>(),
        subCategoryIds: new Array<SubCategoryId>(),
        elementIds: new Array<ElementId>(),
      },
    ),
    mergeMap((ids) => {
      const elementsLength = ids.elementIds.length;
      return merge(
        from(ids.definitionContainerIds).pipe(
          mergeMap((id) => idsCache.getInstanceKeyPaths({ definitionContainerId: id })),
          map((path) => ({ path, options: { reveal: true } })),
        ),
        from(ids.categoryIds).pipe(
          mergeMap((id) => idsCache.getInstanceKeyPaths({ categoryId: id })),
          map((path) => ({ path, options: { reveal: true } })),
        ),
        from(ids.subCategoryIds).pipe(
          mergeMap((id) => idsCache.getInstanceKeyPaths({ subCategoryId: id })),
          map((path) => ({ path, options: { reveal: true } })),
        ),
        from(ids.elementIds).pipe(
          bufferCount(getOptimalBatchSize({ totalSize: elementsLength, maximumBatchSize: 5000 })),
          releaseMainThreadOnItemsCount(1),
          mergeMap(
            (block, chunkIndex) =>
              createGeometricElementInstanceKeyPaths({
                imodelAccess,
                idsCache,
                hierarchyConfig,
                viewType,
                targetItems: block,
                chunkIndex,
                componentId,
                componentName,
              }),
            10,
          ),
        ),
      );
    }),
  );
}

function createGeometricElementInstanceKeyPaths(props: {
  imodelAccess: ECClassHierarchyInspector & LimitingECSqlQueryExecutor;
  idsCache: CategoriesTreeIdsCache;
  hierarchyConfig: CategoriesTreeHierarchyConfiguration;
  viewType: "2d" | "3d";
  targetItems: Id64Array;
  componentId: GuidString;
  componentName: string;
  chunkIndex: number;
}): Observable<NormalizedHierarchyFilteringPath> {
  const separator = ";";
  const { targetItems, chunkIndex, componentId, componentName, hierarchyConfig, idsCache, imodelAccess, viewType } = props;
  const { categoryClass, elementClass, modelClass } = getClassesByView(viewType);
  if (targetItems.length === 0 || !hierarchyConfig.showElements) {
    return EMPTY;
  }

  return defer(() => {
    const ctes = [
      `CategoriesElementsHierarchy(ECInstanceId, ParentId, ModelId, Path) AS (
        SELECT
          e.ECInstanceId,
          e.Parent.Id,
          e.Model.Id,
          IIF(e.Parent.Id IS NULL,
            'm${separator}' || CAST(IdToHex([m].[ECInstanceId]) AS TEXT) || '${separator}c${separator}' || CAST(IdToHex([c].[ECInstanceId]) AS TEXT) || '${separator}e${separator}' || CAST(IdToHex([e].[ECInstanceId]) AS TEXT),
            'e${separator}' || CAST(IdToHex([e].[ECInstanceId]) AS TEXT)
          )
        FROM ${elementClass} e
        LEFT JOIN ${modelClass} m ON (e.Parent.Id IS NULL AND m.ECInstanceId = e.Model.Id)
        LEFT JOIN ${categoryClass} c ON (e.Parent.Id IS NULL AND c.ECInstanceId = e.Category.Id)
        WHERE e.ECInstanceId IN (${targetItems.join(",")})

        UNION ALL

        SELECT
          pe.ECInstanceId,
          pe.Parent.Id,
          pe.Model.Id,
          IIF(pe.Parent.Id IS NULL,
            'm${separator}' || CAST(IdToHex([m].[ECInstanceId]) AS TEXT) || '${separator}c${separator}' || CAST(IdToHex([c].[ECInstanceId]) AS TEXT) || '${separator}e${separator}' || CAST(IdToHex([pe].[ECInstanceId]) AS TEXT) || '${separator}' || ce.Path,
            'e${separator}' || CAST(IdToHex([pe].[ECInstanceId]) AS TEXT) || '${separator}' || ce.Path
          )
        FROM CategoriesElementsHierarchy ce
        JOIN ${elementClass} pe ON (pe.ECInstanceId = ce.ParentId OR pe.ECInstanceId = ce.ModelId AND ce.ParentId IS NULL)
        LEFT JOIN ${modelClass} m ON (pe.Parent.Id IS NULL AND m.ECInstanceId = pe.Model.Id)
        LEFT JOIN ${categoryClass} c ON (pe.Parent.Id IS NULL AND c.ECInstanceId = pe.Category.Id)
      )`,
    ];
    const ecsql = `
      SELECT mce.Path
      FROM CategoriesElementsHierarchy mce
      WHERE mce.ParentId IS NULL
    `;

    return imodelAccess.createQueryReader(
      { ctes, ecsql },
      { rowFormat: "Indexes", limit: "unbounded", restartToken: `${componentName}/${componentId}/element-paths/${chunkIndex}` },
    );
  }).pipe(
    releaseMainThreadOnItemsCount(300),
    map((row) => parseQueryRow(row, separator, elementClass, categoryClass, modelClass)),
    mergeMap((elementHierarchyPath) =>
      forkJoin({ elementHierarchyPath: of(elementHierarchyPath), pathToCategory: idsCache.getInstanceKeyPaths({ categoryId: elementHierarchyPath[0].id }) }),
    ),
    map(({ elementHierarchyPath, pathToCategory }) => {
      pathToCategory.pop(); // category is already included in the element hierarchy path
      const path = [...pathToCategory, ...elementHierarchyPath];
      return { path, options: { reveal: true } };
    }),
  );
}

function parseQueryRow(row: ECSqlQueryRow, separator: string, elementClassName: string, categoryClassName: string, modelClassName: string) {
  const rowElements: string[] = row[0].split(separator);
  const path = new Array<InstanceKey>();
  for (let i = 0; i < rowElements.length; i += 2) {
    switch (rowElements[i]) {
      case "e":
        path.push({ className: elementClassName, id: rowElements[i + 1] });
        break;
      case "c":
        path.push({ className: categoryClassName, id: rowElements[i + 1] });
        break;
      case "m":
        // Ignore first model since it isn't in hierarchy
        if (i === 0) {
          break;
        }
        path.push({ className: modelClassName, id: rowElements[i + 1] });
        break;
    }
  }

  return path;
}
