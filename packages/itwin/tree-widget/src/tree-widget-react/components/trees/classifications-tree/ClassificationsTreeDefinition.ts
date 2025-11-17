/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { bufferCount, defer, EMPTY, firstValueFrom, from, identity, lastValueFrom, map, merge, mergeMap, of, reduce, toArray } from "rxjs";
import { createNodesQueryClauseFactory, createPredicateBasedHierarchyDefinition } from "@itwin/presentation-hierarchies";
import { createBisInstanceLabelSelectClauseFactory, ECSql, parseFullClassName } from "@itwin/presentation-shared";
import {
  CLASS_NAME_Classification,
  CLASS_NAME_ClassificationSystem,
  CLASS_NAME_ClassificationTable,
  CLASS_NAME_Element,
  CLASS_NAME_ElementHasClassifications,
  CLASS_NAME_GeometricElement,
  CLASS_NAME_GeometricElement2d,
  CLASS_NAME_GeometricElement3d,
} from "../common/internal/ClassNameDefinitions.js";
import { releaseMainThreadOnItemsCount } from "../common/internal/Utils.js";
import { FilterLimitExceededError } from "../common/TreeErrors.js";

import type { Observable, OperatorFunction } from "rxjs";
import { Guid, type GuidString, type Id64Array, type Id64String, type MarkRequired } from "@itwin/core-bentley";
import type {
  DefineHierarchyLevelProps,
  DefineInstanceNodeChildHierarchyLevelProps,
  DefineRootHierarchyLevelProps,
  GenericInstanceFilter,
  HierarchyDefinition,
  HierarchyLevelDefinition,
  HierarchyNodeIdentifiersPath,
  LimitingECSqlQueryExecutor,
  NodesQueryClauseFactory,
} from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector, ECSchemaProvider, ECSqlQueryRow, IInstanceLabelSelectClauseFactory, InstanceKey } from "@itwin/presentation-shared";
import type { ElementId } from "../common/internal/Types.js";
import type { NormalizedHierarchyFilteringPath } from "../common/Utils.js";
import type { ClassificationId, ClassificationsTreeIdsCache, ClassificationTableId } from "./internal/ClassificationsTreeIdsCache.js";

const MAX_FILTERING_INSTANCE_KEY_COUNT = 100;

interface ClassificationsTreeDefinitionProps {
  imodelAccess: ECSchemaProvider & ECClassHierarchyInspector & LimitingECSqlQueryExecutor;
  idsCache: ClassificationsTreeIdsCache;
  hierarchyConfig: ClassificationsTreeHierarchyConfiguration;
}

/** @alpha */
export interface ClassificationsTreeHierarchyConfiguration {
  /**
   * The classifications' hierarchy starts at the root `ClassificationSystem` element. This attribute identifiers that
   * root `ClassificationSystem`.
   */
  rootClassificationSystemCode: string;
}

/** @alpha */
export interface ClassificationsTreeInstanceKeyPathsFromInstanceLabelProps {
  imodelAccess: ECClassHierarchyInspector & LimitingECSqlQueryExecutor;
  label: string;
  limit?: number | "unbounded";
  idsCache: ClassificationsTreeIdsCache;
  hierarchyConfig: ClassificationsTreeHierarchyConfiguration;
  componentId?: GuidString;
}

/** @internal */
export class ClassificationsTreeDefinition implements HierarchyDefinition {
  #impl: HierarchyDefinition;
  #selectQueryFactory: NodesQueryClauseFactory;
  #nodeLabelSelectClauseFactory: IInstanceLabelSelectClauseFactory;
  #props: ClassificationsTreeDefinitionProps;
  static #componentName = "ClassificationsTreeDefinition";

  public constructor(props: ClassificationsTreeDefinitionProps) {
    this.#props = props;
    this.#nodeLabelSelectClauseFactory = createBisInstanceLabelSelectClauseFactory({ classHierarchyInspector: this.#props.imodelAccess });
    this.#selectQueryFactory = createNodesQueryClauseFactory({
      imodelAccess: props.imodelAccess,
      instanceLabelSelectClauseFactory: this.#nodeLabelSelectClauseFactory,
    });
    this.#impl = createPredicateBasedHierarchyDefinition({
      classHierarchyInspector: props.imodelAccess,
      hierarchy: {
        rootNodes: async (requestProps: DefineRootHierarchyLevelProps) => this.#createClassificationTablesQuery(requestProps),
        childNodes: [
          {
            parentInstancesNodePredicate: CLASS_NAME_ClassificationTable,
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.#createClassificationTableChildrenQuery(requestProps),
          },
          {
            parentInstancesNodePredicate: CLASS_NAME_Classification,
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.#createClassificationChildrenQuery(requestProps),
          },
          {
            parentInstancesNodePredicate: CLASS_NAME_GeometricElement,
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.#createGeometricElementChildrenQuery(requestProps),
          },
        ],
      },
    });
  }

  public async defineHierarchyLevel(props: DefineHierarchyLevelProps) {
    return this.#impl.defineHierarchyLevel(props);
  }

  async #createClassificationTablesQuery(props: { instanceFilter?: GenericInstanceFilter }): Promise<HierarchyLevelDefinition> {
    const { instanceFilter } = props;
    const instanceFilterClauses = await this.#selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: CLASS_NAME_ClassificationTable, alias: "this" },
    });
    return [
      {
        fullClassName: CLASS_NAME_ClassificationTable,
        query: {
          ecsql: `
            SELECT
              ${await this.#selectQueryFactory.createSelectClause({
                ecClassId: { selector: ECSql.createRawPropertyValueSelector("this", "ECClassId") },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this.#nodeLabelSelectClauseFactory.createSelectClause({
                    classAlias: "this",
                    className: CLASS_NAME_ClassificationTable,
                  }),
                },
                hasChildren: {
                  selector: `
                    IFNULL((
                      SELECT 1
                      FROM ${CLASS_NAME_Classification} classification
                      WHERE classification.Model.Id = this.ECInstanceId
                      LIMIT 1
                    ), 0)
                  `,
                },
                extendedData: {
                  type: "ClassificationTable",
                },
                supportsFiltering: true,
              })}
            FROM
              ${instanceFilterClauses.from} this
            JOIN ${CLASS_NAME_ClassificationSystem} system ON system.ECInstanceId = this.Parent.Id
            ${instanceFilterClauses.joins}
            WHERE
              system.CodeValue = '${this.#props.hierarchyConfig.rootClassificationSystemCode}'
              AND NOT this.IsPrivate
              ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
          `,
        },
      },
    ];
  }

  async #createClassificationTableChildrenQuery(props: {
    parentNodeInstanceIds: ClassificationTableId[];
    instanceFilter?: GenericInstanceFilter;
  }): Promise<HierarchyLevelDefinition> {
    const { parentNodeInstanceIds: classificationTableIds, instanceFilter } = props;
    const instanceFilterClauses = await this.#selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: CLASS_NAME_Classification, alias: "this" },
    });
    const classificationIds = await firstValueFrom(this.#props.idsCache.getDirectChildClassifications(classificationTableIds));
    return classificationIds.length
      ? [
          {
            fullClassName: CLASS_NAME_Classification,
            query: {
              ecsql: `
                SELECT
                  ${await this.#selectQueryFactory.createSelectClause({
                    ecClassId: { selector: ECSql.createRawPropertyValueSelector("this", "ECClassId") },
                    ecInstanceId: { selector: "this.ECInstanceId" },
                    nodeLabel: {
                      selector: await this.#nodeLabelSelectClauseFactory.createSelectClause({
                        classAlias: "this",
                        className: CLASS_NAME_Classification,
                      }),
                    },
                    hasChildren: {
                      selector: createClassificationHasChildrenSelector("this"),
                    },
                    extendedData: {
                      type: "Classification",
                    },
                    supportsFiltering: true,
                  })}
                FROM
                  ${instanceFilterClauses.from} this
                ${instanceFilterClauses.joins}
                WHERE
                  this.ECInstanceId IN (${classificationIds.join(",")})
                  ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
              `,
            },
          },
        ]
      : [];
  }

  async #createClassificationChildrenQuery(props: {
    parentNodeInstanceIds: ClassificationId[];
    instanceFilter?: GenericInstanceFilter;
  }): Promise<HierarchyLevelDefinition> {
    const { parentNodeInstanceIds: parentClassificationIds, instanceFilter } = props;
    const classificationIds = await firstValueFrom(this.#props.idsCache.getDirectChildClassifications(parentClassificationIds));
    return [
      // load child classifications
      ...(classificationIds.length
        ? [
            await (async () => {
              const instanceFilterClauses = await this.#selectQueryFactory.createFilterClauses({
                filter: instanceFilter,
                contentClass: { fullName: CLASS_NAME_Classification, alias: "this" },
              });
              return {
                fullClassName: CLASS_NAME_Classification,
                query: {
                  ecsql: `
                    SELECT
                      ${await this.#selectQueryFactory.createSelectClause({
                        ecClassId: { selector: ECSql.createRawPropertyValueSelector("this", "ECClassId") },
                        ecInstanceId: { selector: "this.ECInstanceId" },
                        nodeLabel: {
                          selector: await this.#nodeLabelSelectClauseFactory.createSelectClause({
                            classAlias: "this",
                            className: CLASS_NAME_Classification,
                          }),
                        },
                        hasChildren: {
                          selector: createClassificationHasChildrenSelector("this"),
                        },
                        extendedData: {
                          type: "Classification",
                        },
                        supportsFiltering: true,
                      })}
                    FROM
                      ${instanceFilterClauses.from} this
                    ${instanceFilterClauses.joins}
                    WHERE
                      this.ECInstanceId IN (${classificationIds.join(",")})
                      ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
                  `,
                },
              };
            })(),
          ]
        : []),
      // load classification elements
      ...(await Promise.all(
        [CLASS_NAME_GeometricElement2d, CLASS_NAME_GeometricElement3d].map(async (elementClassName) => {
          const instanceFilterClauses = await this.#selectQueryFactory.createFilterClauses({
            filter: instanceFilter,
            contentClass: { fullName: elementClassName, alias: "this" },
          });
          return {
            fullClassName: elementClassName,
            query: {
              ecsql: `
                SELECT ${await this.#createElementSelectClause(elementClassName)}
                FROM ${instanceFilterClauses.from} this
                JOIN ${CLASS_NAME_ElementHasClassifications} ehc ON ehc.SourceECInstanceId = this.ECInstanceId
                ${instanceFilterClauses.joins}
                WHERE
                  ehc.TargetECInstanceId IN (${parentClassificationIds.join(",")})
                  AND this.Parent.Id IS NULL
                  ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
              `,
            },
          };
        }),
      )),
    ];
  }

  async #createGeometricElementChildrenQuery({
    parentNodeInstanceIds: parentElementIds,
    instanceFilter,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    return Promise.all(
      [CLASS_NAME_GeometricElement2d, CLASS_NAME_GeometricElement3d].map(async (elementClassName) => {
        const instanceFilterClauses = await this.#selectQueryFactory.createFilterClauses({
          filter: instanceFilter,
          contentClass: { fullName: elementClassName, alias: "this" },
        });
        return {
          fullClassName: elementClassName,
          query: {
            ecsql: `
              SELECT ${await this.#createElementSelectClause(elementClassName)}
              FROM ${instanceFilterClauses.from} this
              ${instanceFilterClauses.joins}
              WHERE
                this.Parent.Id IN (${parentElementIds.join(",")})
                ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
            `,
          },
        };
      }),
    );
  }

  async #createElementSelectClause(elementFullClassName: string): Promise<string> {
    const { className: elementClassName } = parseFullClassName(elementFullClassName);
    return this.#selectQueryFactory.createSelectClause({
      ecClassId: { selector: "this.ECClassId" },
      ecInstanceId: { selector: "this.ECInstanceId" },
      nodeLabel: {
        selector: await this.#nodeLabelSelectClauseFactory.createSelectClause({
          classAlias: "this",
          className: elementFullClassName,
        }),
      },
      hasChildren: {
        selector: `
          IFNULL((
            SELECT 1
            FROM ${CLASS_NAME_Element} ce
            WHERE ce.Parent.Id = this.ECInstanceId
            LIMIT 1
          ), 0)
        `,
      },
      extendedData: {
        type: elementClassName,
        modelId: { selector: "IdToHex(this.Model.Id)" },
        categoryId: { selector: "IdToHex(this.Category.Id)" },
      },
      supportsFiltering: true,
    });
  }

  public static async createInstanceKeyPaths(props: ClassificationsTreeInstanceKeyPathsFromInstanceLabelProps): Promise<NormalizedHierarchyFilteringPath[]> {
    const labelsFactory = createBisInstanceLabelSelectClauseFactory({ classHierarchyInspector: props.imodelAccess });
    return createInstanceKeyPathsFromInstanceLabel({ ...props, labelsFactory, componentId: props.componentId ?? Guid.createValue(), componentName: this.#componentName });
  }
}

function createClassificationHasChildrenSelector(classificationAlias: string) {
  return `
    COALESCE((
        SELECT 1
        FROM ${CLASS_NAME_Classification} classification
        WHERE classification.Parent.Id = ${classificationAlias}.ECInstanceId
        LIMIT 1
      ), (
        SELECT 1
        FROM ${CLASS_NAME_ElementHasClassifications} ehc
        WHERE ehc.TargetECInstanceId = ${classificationAlias}.ECInstanceId
        LIMIT 1
      ),
      0
    )
  `;
}

async function createInstanceKeyPathsFromInstanceLabel(
  props: MarkRequired<ClassificationsTreeInstanceKeyPathsFromInstanceLabelProps, "componentId"> & { labelsFactory: IInstanceLabelSelectClauseFactory; componentName: string },
): Promise<NormalizedHierarchyFilteringPath[]> {
  const adjustedLabel = props.label.replace(/[%_\\]/g, "\\$&");

  const CLASSIFICATION_TABLES_WITH_LABELS_CTE = "ClassificationTablesWithLabels";
  const CLASSIFICATIONS_WITH_LABELS_CTE = "ClassificationsWithLabels";
  const ELEMENTS_2D_WITH_LABELS_CTE = "Elements2dWithLabels";
  const ELEMENTS_3D_WITH_LABELS_CTE = "Elements3dWithLabels";
  return lastValueFrom(
    defer(async () => {
      const [classificationTableLabelSelectClause, classificationLabelSelectClause, element2dLabelSelectClause, element3dLabelSelectClause] = await Promise.all(
        [CLASS_NAME_ClassificationTable, CLASS_NAME_Classification, CLASS_NAME_GeometricElement2d, CLASS_NAME_GeometricElement3d].map(async (className) =>
          props.labelsFactory.createSelectClause({ classAlias: "this", className }),
        ),
      );
      const classificationIds = await firstValueFrom(props.idsCache.getAllClassifications());
      const ctes = [
        `
          ${CLASSIFICATION_TABLES_WITH_LABELS_CTE}(ClassName, ECInstanceId, DisplayLabel) AS (
            SELECT
              'ct',
              this.ECInstanceId,
              ${classificationTableLabelSelectClause}
            FROM
              ${CLASS_NAME_ClassificationTable} this
            JOIN ${CLASS_NAME_ClassificationSystem} system ON system.ECInstanceId = this.Parent.Id
            WHERE
              system.CodeValue = '${props.hierarchyConfig.rootClassificationSystemCode}'
              AND NOT this.IsPrivate
          )
        `,
        ...(classificationIds.length > 0
          ? [
              `${CLASSIFICATIONS_WITH_LABELS_CTE}(ClassName, ECInstanceId, DisplayLabel) AS (
            SELECT
              'c',
              this.ECInstanceId,
              ${classificationLabelSelectClause}
            FROM
              ${CLASS_NAME_Classification} this
            WHERE
              this.ECInstanceId IN (${classificationIds.join(",")})
          )`,
              `${ELEMENTS_2D_WITH_LABELS_CTE}(ClassName, ECInstanceId, DisplayLabel) AS (
            SELECT
              'e2d',
              this.ECInstanceId,
              ${element2dLabelSelectClause}
            FROM
              ${CLASS_NAME_GeometricElement2d} this
              JOIN ${CLASS_NAME_ElementHasClassifications} ehc ON ehc.SourceECInstanceId = this.ECInstanceId
            WHERE
              ehc.TargetECInstanceId IN (${classificationIds.join(",")})
              AND this.Parent.Id IS NULL

            UNION ALL

            SELECT
              'e2d',
              this.ECInstanceId,
              ${element2dLabelSelectClause}
            FROM
              ${CLASS_NAME_GeometricElement2d} this
              JOIN ${ELEMENTS_2D_WITH_LABELS_CTE} pe ON pe.ECInstanceId = this.Parent.Id
          )`,
              `${ELEMENTS_3D_WITH_LABELS_CTE}(ClassName, ECInstanceId, DisplayLabel) AS (
            SELECT
              'e3d',
              this.ECInstanceId,
              ${element3dLabelSelectClause}
            FROM
              ${CLASS_NAME_GeometricElement3d} this
              JOIN ${CLASS_NAME_ElementHasClassifications} ehc ON ehc.SourceECInstanceId = this.ECInstanceId
            WHERE
              ehc.TargetECInstanceId IN (${classificationIds.join(",")})
              AND this.Parent.Id IS NULL

            UNION ALL

            SELECT
              'e3d',
              this.ECInstanceId,
              ${element3dLabelSelectClause}
            FROM
              ${CLASS_NAME_GeometricElement3d} this
              JOIN ${ELEMENTS_3D_WITH_LABELS_CTE} pe ON pe.ECInstanceId = this.Parent.Id
          )`,
            ]
          : []),
      ];
      const ecsql = `
        SELECT * FROM (
          SELECT
            ct.ClassName AS ClassName,
            ct.ECInstanceId AS ECInstanceId
          FROM
            ${CLASSIFICATION_TABLES_WITH_LABELS_CTE} ct
          WHERE
            ct.DisplayLabel LIKE '%' || ? || '%' ESCAPE '\\'

          ${
            classificationIds.length > 0
              ? `
                UNION ALL

                SELECT
                  c.ClassName AS ClassName,
                  c.ECInstanceId AS ECInstanceId
                FROM
                  ${CLASSIFICATIONS_WITH_LABELS_CTE} c
                WHERE
                  c.DisplayLabel LIKE '%' || ? || '%' ESCAPE '\\'

                UNION ALL

                SELECT
                  e2d.ClassName AS ClassName,
                  e2d.ECInstanceId AS ECInstanceId
                FROM
                  ${ELEMENTS_2D_WITH_LABELS_CTE} e2d
                WHERE
                  e2d.DisplayLabel LIKE '%' || ? || '%' ESCAPE '\\'

                UNION ALL

                SELECT
                  e3d.ClassName AS ClassName,
                  e3d.ECInstanceId AS ECInstanceId
                FROM
                  ${ELEMENTS_3D_WITH_LABELS_CTE} e3d
                WHERE
                  e3d.DisplayLabel LIKE '%' || ? || '%' ESCAPE '\\'
              `
              : ""
          }
        )
        ${props.limit === undefined ? `LIMIT ${MAX_FILTERING_INSTANCE_KEY_COUNT + 1}` : props.limit !== "unbounded" ? `LIMIT ${props.limit}` : ""}
      `;
      const bindings = [
        { type: "string" as const, value: adjustedLabel },
        ...(classificationIds.length > 0
          ? [
              { type: "string" as const, value: adjustedLabel },
              { type: "string" as const, value: adjustedLabel },
              { type: "string" as const, value: adjustedLabel },
            ]
          : []),
      ];
      return { ctes, ecsql, bindings };
    }).pipe(
      mergeMap((queryProps) =>
        props.imodelAccess.createQueryReader(queryProps, { restartToken: `${props.componentName}/${props.componentId}/filter-by-label`, limit: props.limit }),
      ),
      map((row): InstanceKey => {
        let className: string;
        switch (row.ClassName) {
          case "ct":
            className = CLASS_NAME_ClassificationTable;
            break;
          case "c":
            className = CLASS_NAME_Classification;
            break;
          case "e2d":
            className = CLASS_NAME_GeometricElement2d;
            break;
          default:
            className = CLASS_NAME_GeometricElement3d;
            break;
        }
        return {
          className,
          id: row.ECInstanceId,
        };
      }),
      createInstanceKeyPathsFromTargetItems(props),
      toArray(),
    ),
  );
}

function createInstanceKeyPathsFromTargetItems({
  idsCache,
  imodelAccess,
  limit,
  componentId,
  componentName
}: Pick<ClassificationsTreeInstanceKeyPathsFromInstanceLabelProps, "limit" | "imodelAccess" | "idsCache"> & { componentId: GuidString; componentName: string}): OperatorFunction<
  InstanceKey,
  NormalizedHierarchyFilteringPath
> {
  const actualLimit = limit ?? MAX_FILTERING_INSTANCE_KEY_COUNT;
  return (targetItems: Observable<InstanceKey>) => {
    return targetItems.pipe(
      actualLimit !== "unbounded"
        ? map((targetItem, index) => {
            if (index >= actualLimit) {
              throw new FilterLimitExceededError(actualLimit);
            }
            return targetItem;
          })
        : identity,
      releaseMainThreadOnItemsCount(2000),
      reduce(
        (acc, { id, className }) => {
          if (className === CLASS_NAME_ClassificationTable) {
            acc.classificationTableIds.push(id);
            return acc;
          }
          if (className === CLASS_NAME_Classification) {
            acc.classificationIds.push(id);
            return acc;
          }
          if (className === CLASS_NAME_GeometricElement2d) {
            acc.element2dIds.push(id);
            return acc;
          }

          acc.element3dIds.push(id);
          return acc;
        },
        {
          classificationTableIds: new Array<ClassificationTableId>(),
          classificationIds: new Array<ClassificationId>(),
          element2dIds: new Array<ElementId>(),
          element3dIds: new Array<ElementId>(),
        },
      ),
      mergeMap((ids) => {
        const elements2dLength = ids.element2dIds.length;
        const elements3dLength = ids.element3dIds.length;
        return merge(
          from(ids.classificationTableIds).pipe(map((id) => ({ path: [{ id, className: CLASS_NAME_ClassificationTable }], options: { autoExpand: true } }))),
          idsCache.getClassificationsPathObs(ids.classificationIds).pipe(map((path) => ({ path, options: { autoExpand: true } }))),
          from(ids.element2dIds).pipe(
            bufferCount(Math.ceil(elements2dLength / Math.ceil(elements2dLength / 5000))),
            releaseMainThreadOnItemsCount(1),
            mergeMap((block, chunkIndex) => createGeometricElementInstanceKeyPaths({ idsCache, imodelAccess, targetItems: block, type: "2d", chunkIndex, componentId, componentName }), 10),
          ),
          from(ids.element3dIds).pipe(
            bufferCount(Math.ceil(elements3dLength / Math.ceil(elements3dLength / 5000))),
            releaseMainThreadOnItemsCount(1),
            mergeMap((block, chunkIndex) => createGeometricElementInstanceKeyPaths({ idsCache, imodelAccess, targetItems: block, type: "3d", chunkIndex, componentId, componentName }), 10),
          ),
        );
      }),
    );
  };
}

function createGeometricElementInstanceKeyPaths(props: {
  idsCache: ClassificationsTreeIdsCache;
  imodelAccess: ECClassHierarchyInspector & LimitingECSqlQueryExecutor;
  targetItems: Id64Array;
  type: "2d" | "3d";
  componentId: GuidString;
  componentName: string;
  chunkIndex: number;
}): Observable<NormalizedHierarchyFilteringPath> {
  const { targetItems, imodelAccess, type, idsCache, componentId, componentName, chunkIndex } = props;
  if (targetItems.length === 0) {
    return EMPTY;
  }

  const separator = ";";

  return defer(() => {
    const ctes = [
      `ElementsHierarchy(ECInstanceId, ParentId, Path) AS (
        SELECT
          e.ECInstanceId,
          e.Parent.Id,
          'e${type}${separator}' || CAST(IdToHex([e].[ECInstanceId]) AS TEXT)
        FROM  ${CLASS_NAME_Element} e
        WHERE e.ECInstanceId IN (${targetItems.join(",")})

        UNION ALL

        SELECT
          pe.ECInstanceId,
          pe.Parent.Id,
          'e${type}${separator}' || CAST(IdToHex([pe].[ECInstanceId]) AS TEXT) || '${separator}' || ce.Path
        FROM ElementsHierarchy ce
        JOIN ${CLASS_NAME_Element} pe ON pe.ECInstanceId = ce.ParentId
      )`,
    ];
    const ecsql = `
      SELECT
        e.Path path,
        c.ECInstanceId classificationId
      FROM
        ${CLASS_NAME_Classification} c
        JOIN ${CLASS_NAME_ElementHasClassifications} ehc ON ehc.TargetECInstanceId = c.ECInstanceId
        JOIN ElementsHierarchy e ON ehc.SourceECInstanceId = e.ECInstanceId
      WHERE e.ParentId IS NULL
    `;

    return imodelAccess.createQueryReader(
      { ctes, ecsql },
      { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${componentName}/${componentId}/elements${type}-filter-paths/${chunkIndex}` },
    );
  }).pipe(
    releaseMainThreadOnItemsCount(300),
    map((row) => parseQueryRow(row, separator)),
    mergeMap(({ path, parentClassificationId }) => {
      if (parentClassificationId) {
        return idsCache
          .getClassificationsPathObs(parentClassificationId)
          .pipe(map((parentClassificationPath) => ({ path: parentClassificationPath.concat(path), options: { autoExpand: true } })));
      }
      return of({ path, options: { autoExpand: true } });
    }),
  );
}

function parseQueryRow(row: ECSqlQueryRow, separator: string): { path: HierarchyNodeIdentifiersPath; parentClassificationId: Id64String | undefined } {
  const rowElements: string[] = row.path.split(separator);
  const path: HierarchyNodeIdentifiersPath = [];
  for (let i = 0; i < rowElements.length; i += 2) {
    switch (rowElements[i]) {
      case "e2d":
        path.push({ className: CLASS_NAME_GeometricElement2d, id: rowElements[i + 1] });
        break;
      case "e3d":
        path.push({ className: CLASS_NAME_GeometricElement3d, id: rowElements[i + 1] });
        break;
    }
  }

  return { path, parentClassificationId: row.classificationId };
}
