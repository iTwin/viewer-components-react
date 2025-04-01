/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { bufferCount, defer, firstValueFrom, from, lastValueFrom, map, merge, mergeMap, of, reduce, toArray } from "rxjs";
import { assert } from "@itwin/core-bentley";
import { createNodesQueryClauseFactory, createPredicateBasedHierarchyDefinition, ProcessedHierarchyNode } from "@itwin/presentation-hierarchies";
import { createBisInstanceLabelSelectClauseFactory, ECSql } from "@itwin/presentation-shared";
import {
  DEFINITION_CONTAINER_CLASS_NAME,
  INFORMATION_PARTITION_ELEMENT_CLASS_NAME,
  MODEL_CLASS_NAME,
  SUB_CATEGORY_CLASS_NAME,
  SUB_MODELED_ELEMENT_CLASS_NAME,
} from "../common/internal/ClassNameDefinitions.js";
import { createIdsSelector, getClassesByView, getDistinctMapValues, parseIdsSelectorResult, releaseMainThreadOnItemsCount } from "../common/internal/Utils.js";
import { FilterLimitExceededError } from "../common/TreeErrors.js";

import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { Observable } from "rxjs";
import type {
  DefineHierarchyLevelProps,
  DefineInstanceNodeChildHierarchyLevelProps,
  DefineRootHierarchyLevelProps,
  GenericInstanceFilter,
  HierarchyDefinition,
  HierarchyFilteringPath,
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
import type { CategoriesTreeIdsCache, CategoryInfo } from "./internal/CategoriesTreeIdsCache.js";
import type { CategoryId, DefinitionContainerId, ElementId, ModelId, SubCategoryId } from "../common/internal/Types.js";

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
}

/** @internal */
export const defaultHierarchyConfiguration: CategoriesTreeHierarchyConfiguration = {
  hideSubCategories: false,
  showElements: false,
};

export class CategoriesTreeDefinition implements HierarchyDefinition {
  private _impl: Promise<HierarchyDefinition> | undefined;
  private _selectQueryFactory: NodesQueryClauseFactory;
  private _nodeLabelSelectClauseFactory: IInstanceLabelSelectClauseFactory;
  private _idsCache: CategoriesTreeIdsCache;
  private _hierarchyConfig: CategoriesTreeHierarchyConfiguration;
  private _iModelAccess: ECSchemaProvider & ECClassHierarchyInspector & LimitingECSqlQueryExecutor;
  private _categoryClass: string;
  private _categoryElementClass: string;
  private _categoryModelClass: string;

  public constructor(props: CategoriesTreeDefinitionProps) {
    this._iModelAccess = props.imodelAccess;
    this._idsCache = props.idsCache;
    this._nodeLabelSelectClauseFactory = createBisInstanceLabelSelectClauseFactory({ classHierarchyInspector: props.imodelAccess });
    this._selectQueryFactory = createNodesQueryClauseFactory({
      imodelAccess: props.imodelAccess,
      instanceLabelSelectClauseFactory: this._nodeLabelSelectClauseFactory,
    });
    this._hierarchyConfig = props.hierarchyConfig;
    const { categoryClass, elementClass, modelClass } = getClassesByView(props.viewType);
    this._categoryClass = categoryClass;
    this._categoryElementClass = elementClass;
    this._categoryModelClass = modelClass;
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
      return {
        ...node,
        label: node.label,
        extendedData: {
          ...node.extendedData,
          // add `categoryId` from the first grouped element
          categoryId: node.children[0].extendedData?.categoryId,
          modelElementsMap,
          // `imageId` is assigned to instance nodes at query time, but grouping ones need to
          // be handled during post-processing
          imageId: "icon-ec-class",
        },
      };
    }
    return node;
  }

  private async getHierarchyDefinition(): Promise<HierarchyDefinition> {
    this._impl ??= (async () => {
      const isDefinitionContainerSupported = await this._idsCache.getIsDefinitionContainerSupported();
      return createPredicateBasedHierarchyDefinition({
        classHierarchyInspector: this._iModelAccess,
        hierarchy: {
          rootNodes: async (requestProps: DefineRootHierarchyLevelProps) => this.createDefinitionContainersAndCategoriesQuery(requestProps),
          childNodes: [
            ...(this._hierarchyConfig.showElements
              ? [
                  {
                    parentInstancesNodePredicate: this._categoryElementClass,
                    definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createElementChildrenQuery(requestProps),
                  },
                  {
                    parentInstancesNodePredicate: SUB_MODELED_ELEMENT_CLASS_NAME,
                    definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createISubModeledElementChildrenQuery(requestProps),
                  },
                  {
                    parentInstancesNodePredicate: this._categoryModelClass,
                    definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createGeometricModel3dChildrenQuery(requestProps),
                  },
                ]
              : []),
            ...(this._hierarchyConfig.hideSubCategories && !this._hierarchyConfig.showElements
              ? []
              : [
                  {
                    parentInstancesNodePredicate: this._categoryClass,
                    definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createCategoryChildrenQuery(requestProps),
                  },
                ]),
            ...(isDefinitionContainerSupported
              ? [
                  {
                    parentInstancesNodePredicate: DEFINITION_CONTAINER_CLASS_NAME,
                    definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) =>
                      this.createDefinitionContainersAndCategoriesQuery(requestProps),
                  },
                ]
              : []),
          ],
        },
      });
    })();
    return this._impl;
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
        fullClassName: this._categoryModelClass,
        query: {
          ecsql: `
            SELECT
              ${await this._selectQueryFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: "", // doesn't matter - the node is always hidden
                hideNodeInHierarchy: true,
                hasChildren: true,
                extendedData: {
                  isModel: true,
                },
              })}
            FROM ${this._categoryModelClass} this
            WHERE
              this.ModeledElement.Id IN (${elementIds.map(() => "?").join(",")})
              AND NOT this.IsPrivate
              AND this.ECInstanceId IN (SELECT Model.Id FROM ${this._categoryElementClass})
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
    const instanceFilterClauses = await this._selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: this._categoryClass, alias: "this" },
    });

    return [
      {
        fullClassName: this._categoryClass,
        query: {
          ecsql: `
          SELECT
            ${await this._selectQueryFactory.createSelectClause({
              ecClassId: { selector: "this.ECClassId" },
              ecInstanceId: { selector: "this.ECInstanceId" },
              nodeLabel: {
                selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
                  classAlias: "this",
                  className: this._categoryClass,
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
              FROM ${this._categoryElementClass} element
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
    const { definitionContainers, categories } =
      parentNodeInstanceIds === undefined
        ? await this._idsCache.getRootDefinitionContainersAndCategories()
        : await this._idsCache.getDirectChildDefinitionContainersAndCategories(parentNodeInstanceIds);
    const hierarchyDefinition = new Array<HierarchyNodesDefinition>();
    if (categories.length > 0) {
      hierarchyDefinition.push(...(await this.createCategoriesQuery({ categories, instanceFilter })));
    }
    if (definitionContainers.length > 0) {
      hierarchyDefinition.push(...(await this.createDefinitionContainersQuery({ definitionContainers, instanceFilter })));
    }
    return hierarchyDefinition;
  }

  private async createDefinitionContainersQuery({
    definitionContainers,
    instanceFilter,
  }: {
    definitionContainers: Array<DefinitionContainerId>;
    instanceFilter?: GenericInstanceFilter;
  }): Promise<HierarchyLevelDefinition> {
    const instanceFilterClauses = await this._selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: DEFINITION_CONTAINER_CLASS_NAME, alias: "this" },
    });

    return [
      {
        fullClassName: DEFINITION_CONTAINER_CLASS_NAME,
        query: {
          ecsql: `
            SELECT
              ${await this._selectQueryFactory.createSelectClause({
                ecClassId: { selector: ECSql.createRawPropertyValueSelector("this", "ECClassId") },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
                    classAlias: "this",
                    className: DEFINITION_CONTAINER_CLASS_NAME,
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
              this.ECInstanceId IN (${definitionContainers.join(", ")})
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
    const instanceFilterClauses = await this._selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: this._categoryClass, alias: "this" },
    });
    const categoriesWithMultipleSubCategories = categories
      .filter((categoryInfo) => categoryInfo.subCategoryChildCount > 1)
      .map((categoryInfo) => categoryInfo.id);

    const hasChildrenSelector = () => {
      const conditions = new Array<string>();
      if (!this._hierarchyConfig.hideSubCategories && categoriesWithMultipleSubCategories.length > 0) {
        conditions.push(`this.ECInstanceId IN (${categoriesWithMultipleSubCategories.join(",")})`);
      }
      if (this._hierarchyConfig.showElements) {
        conditions.push(`
          this.ECInstanceId IN (
            SELECT e.Category.Id
            FROM ${this._categoryElementClass} e
            WHERE
              e.Parent.Id IS NULL
              AND e.ECInstanceId NOT IN (SELECT m.ECInstanceId FROM ${this._categoryModelClass} m)
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
        fullClassName: this._categoryClass,
        query: {
          ecsql: `
            SELECT
              ${await this._selectQueryFactory.createSelectClause({
                ecClassId: { selector: ECSql.createRawPropertyValueSelector("this", "ECClassId") },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
                    classAlias: "this",
                    className: this._categoryClass,
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
        ...(!this._hierarchyConfig.hideSubCategories && props.parentNode.extendedData?.hasSubCategories ? [this.createSubCategoriesQuery(props)] : []),
        ...(this._hierarchyConfig.showElements ? [this.createCategoryElementsQuery(props)] : []),
      ])
    ).reduce((acc, levelDefinition) => acc.concat(levelDefinition), new Array<HierarchyNodesDefinition>());
  }

  private async createSubCategoriesQuery({
    parentNodeInstanceIds: categoryIds,
    instanceFilter,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const instanceFilterClauses = await this._selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: SUB_CATEGORY_CLASS_NAME, alias: "this" },
    });

    return [
      {
        fullClassName: SUB_CATEGORY_CLASS_NAME,
        query: {
          ecsql: `
            SELECT
              ${await this._selectQueryFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
                    classAlias: "this",
                    className: SUB_CATEGORY_CLASS_NAME,
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
    const instanceFilterClauses = await this._selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: this._categoryElementClass, alias: "this" },
    });
    const modelIds: Array<ModelId> = parentNode.extendedData?.isCategoryOfSubModel
      ? parseIdsSelectorResult(parentNode.extendedData?.modelIds)
      : [...getDistinctMapValues(await this._idsCache.getCategoriesElementModels(categoryIds))];

    if (modelIds.length === 0) {
      return [];
    }
    const modeledElements = await firstValueFrom(
      from(modelIds).pipe(
        mergeMap(async (modelId) => this._idsCache.getCategoriesModeledElements(modelId, categoryIds)),
        reduce((acc, foundModeledElements) => {
          return acc.concat(foundModeledElements);
        }, new Array<ElementId>()),
      ),
    );

    return [
      {
        fullClassName: this._categoryElementClass,
        query: {
          ecsql: `
            SELECT
            ${await this._selectQueryFactory.createSelectClause({
              ecClassId: { selector: "this.ECClassId" },
              ecInstanceId: { selector: "this.ECInstanceId" },
              nodeLabel: {
                selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
                  classAlias: "this",
                  className: this._categoryElementClass,
                }),
              },
              hasChildren: {
                selector: `
                  IIF(
                    ${modeledElements.length ? `this.ECInstanceId IN (${modeledElements.join(",")})` : `FALSE`},
                    1,
                    IFNULL((
                      SELECT 1
                      FROM ${this._categoryElementClass} ce
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
          ${parentNode.extendedData?.isCategoryOfSubModel ? "" : `JOIN ${INFORMATION_PARTITION_ELEMENT_CLASS_NAME} ipe ON ipe.ECInstanceId = this.Model.Id`}
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
    const instanceFilterClauses = await this._selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: this._categoryElementClass, alias: "this" },
    });
    return [
      {
        fullClassName: this._categoryElementClass,
        query: {
          ecsql: `
            SELECT
              ${await this._selectQueryFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
                    classAlias: "this",
                    className: this._categoryElementClass,
                  }),
                },
                hasChildren: {
                  selector: `
                    IFNULL((
                      SELECT 1
                      FROM ${this._categoryElementClass} ce
                      JOIN ${MODEL_CLASS_NAME} m ON ce.Model.Id = m.ECInstanceId
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

  public static async createInstanceKeyPaths(props: CategoriesTreeInstanceKeyPathsFromInstanceLabelProps): Promise<HierarchyFilteringPath[]> {
    const labelsFactory = createBisInstanceLabelSelectClauseFactory({ classHierarchyInspector: props.imodelAccess });
    return createInstanceKeyPathsFromInstanceLabel({ ...props, labelsFactory });
  }
}

async function createInstanceKeyPathsFromInstanceLabel(
  props: CategoriesTreeInstanceKeyPathsFromInstanceLabelProps & { labelsFactory: IInstanceLabelSelectClauseFactory },
): Promise<HierarchyFilteringPath[]> {
  const { definitionContainers, categories } = await props.idsCache.getAllDefinitionContainersAndCategories();
  if (categories.length === 0) {
    return [];
  }
  const { categoryClass, elementClass } = getClassesByView(props.viewType);
  const adjustedLabel = props.label.replace(/[%_\\]/g, "\\$&");

  const CATEGORIES_WITH_LABELS_CTE = "CategoriesWithLabels";
  const ELEMENTS_WITH_LABELS_CTE = "ElementsWithLabels";
  const SUBCATEGORIES_WITH_LABELS_CTE = "SubCategoriesWithLabels";
  const DEFINITION_CONTAINERS_WITH_LABELS_CTE = "DefinitionContainersWithLabels";
  const [categoryLabelSelectClause, subCategoryLabelSelectClause, elementLabelSelectClause, definitionContainerLabelSelectClause] = await Promise.all(
    [categoryClass, SUB_CATEGORY_CLASS_NAME, elementClass, ...(definitionContainers.length > 0 ? [DEFINITION_CONTAINER_CLASS_NAME] : [])].map(
      async (className) => props.labelsFactory.createSelectClause({ classAlias: "this", className }),
    ),
  );
  return lastValueFrom(
    defer(() => {
      const ctes = [
        `${CATEGORIES_WITH_LABELS_CTE}(ClassName, ECInstanceId, ChildCount, DisplayLabel) AS (
            SELECT
              'c',
              this.ECInstanceId,
              COUNT(sc.ECInstanceId),
              ${categoryLabelSelectClause}
            FROM
              ${categoryClass} this
              JOIN ${SUB_CATEGORY_CLASS_NAME} sc ON sc.Parent.Id = this.ECInstanceId
            WHERE
              this.ECInstanceId IN (${categories.join(", ")})
              GROUP BY this.ECInstanceId
          )`,
        ...(props.hierarchyConfig.showElements
          ? [
              `${ELEMENTS_WITH_LABELS_CTE}(ClassName, ECInstanceId, ParentId, DisplayLabel) AS (
                  SELECT
                    'e',
                    this.ECInstanceId,
                    this.Parent.Id,
                    ${elementLabelSelectClause}
                  FROM
                    ${elementClass} this
                    JOIN ${MODEL_CLASS_NAME} m ON this.Model.Id = m.ECInstanceId
                  WHERE
                    NOT m.IsPrivate
                    AND this.Category.Id IN (${categories.join(", ")})
                )`,
            ]
          : []),
        ...(props.hierarchyConfig.hideSubCategories
          ? []
          : [
              `${SUBCATEGORIES_WITH_LABELS_CTE}(ClassName, ECInstanceId, ParentId, DisplayLabel) AS (
                SELECT
                  'sc',
                  this.ECInstanceId,
                  this.Parent.Id,
                  ${subCategoryLabelSelectClause}
                FROM
                  ${SUB_CATEGORY_CLASS_NAME} this
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
                  ${DEFINITION_CONTAINER_CLASS_NAME} this
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
            props.hierarchyConfig.showElements
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
            props.hierarchyConfig.hideSubCategories
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
        ${props.limit === undefined ? `LIMIT ${MAX_FILTERING_INSTANCE_KEY_COUNT + 1}` : props.limit !== "unbounded" ? `LIMIT ${props.limit}` : ""}
      `;
      const bindings = [
        { type: "string" as const, value: adjustedLabel },
        ...(props.hierarchyConfig.showElements ? [{ type: "string" as const, value: adjustedLabel }] : []),
        ...(props.hierarchyConfig.hideSubCategories ? [] : [{ type: "string" as const, value: adjustedLabel }]),
        ...(definitionContainers.length > 0 ? [{ type: "string" as const, value: adjustedLabel }] : []),
      ];
      return props.imodelAccess.createQueryReader(
        { ctes, ecsql, bindings },
        { restartToken: "tree-widget/categories-tree/filter-by-label-query", limit: props.limit },
      );
    }).pipe(
      map((row): InstanceKey => {
        let className: string;
        switch (row.ClassName) {
          case "c":
            className = categoryClass;
            break;
          case "sc":
            className = SUB_CATEGORY_CLASS_NAME;
            break;
          case "e":
            className = elementClass;
            break;
          default:
            className = DEFINITION_CONTAINER_CLASS_NAME;
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
}: CategoriesTreeInstanceKeyPathsFromInstanceLabelProps & { targetItems: InstanceKey[] }): Observable<HierarchyFilteringPath> {
  if (limit !== "unbounded" && targetItems.length > (limit ?? MAX_FILTERING_INSTANCE_KEY_COUNT)) {
    throw new FilterLimitExceededError(limit ?? MAX_FILTERING_INSTANCE_KEY_COUNT);
  }
  const { categoryClass } = getClassesByView(viewType);

  return from(targetItems).pipe(
    releaseMainThreadOnItemsCount(2000),
    reduce(
      (acc, { id, className }) => {
        if (className === categoryClass) {
          acc.categories.push(id);
          return acc;
        }
        if (className === DEFINITION_CONTAINER_CLASS_NAME) {
          acc.definitionContainers.push(id);
          return acc;
        }
        if (className === SUB_CATEGORY_CLASS_NAME) {
          if (hierarchyConfig.hideSubCategories) {
            return acc;
          }
          acc.subCategories.push(id);
          return acc;
        }

        if (!hierarchyConfig.showElements) {
          return acc;
        }
        acc.elements.push(id);
        return acc;
      },
      {
        definitionContainers: new Array<DefinitionContainerId>(),
        categories: new Array<CategoryId>(),
        subCategories: new Array<SubCategoryId>(),
        elements: new Array<ElementId>(),
      },
    ),
    mergeMap((ids) => {
      const elementsLength = ids.elements.length;
      return merge(
        from(ids.definitionContainers).pipe(
          mergeMap(async (id) => ({ path: await idsCache.getInstanceKeyPaths({ definitionContainerId: id }), options: { autoExpand: true } })),
        ),
        from(ids.categories).pipe(mergeMap(async (id) => ({ path: await idsCache.getInstanceKeyPaths({ categoryId: id }), options: { autoExpand: true } }))),
        from(ids.subCategories).pipe(
          mergeMap(async (id) => ({ path: await idsCache.getInstanceKeyPaths({ subCategoryId: id }), options: { autoExpand: true } })),
        ),
        from(ids.elements).pipe(
          bufferCount(Math.ceil(elementsLength / Math.ceil(elementsLength / 5000))),
          releaseMainThreadOnItemsCount(1),
          mergeMap((block) => createGeometricElementInstanceKeyPaths(imodelAccess, idsCache, hierarchyConfig, viewType, block), 10),
        ),
      );
    }),
  );
}

function createGeometricElementInstanceKeyPaths(
  imodelAccess: ECClassHierarchyInspector & LimitingECSqlQueryExecutor,
  idsCache: CategoriesTreeIdsCache,
  hierarchyConfig: CategoriesTreeHierarchyConfiguration,
  viewType: "2d" | "3d",
  targetItems: Array<Id64String>,
): Observable<HierarchyFilteringPath> {
  const separator = ";";
  const { categoryClass, elementClass, modelClass } = getClassesByView(viewType);
  if (targetItems.length === 0 || !hierarchyConfig.showElements) {
    return of([]);
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
      { rowFormat: "Indexes", limit: "unbounded", restartToken: "tree-widget/categories-tree/elements-filter-paths-query" },
    );
  }).pipe(
    releaseMainThreadOnItemsCount(300),
    map((row) => parseQueryRow(row, separator, elementClass, categoryClass, modelClass)),
    mergeMap(async (elementHierarchyPath) => {
      const pathToCategory = await idsCache.getInstanceKeyPaths({ categoryId: elementHierarchyPath[0].id });
      pathToCategory.pop(); // category is already included in the element hierarchy path
      const path = [...pathToCategory, ...elementHierarchyPath];
      return { path, options: { autoExpand: true } };
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
