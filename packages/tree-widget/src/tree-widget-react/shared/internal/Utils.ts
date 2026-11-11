/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { assert, Id64 } from "@itwin/core-bentley";
import { ProcessedHierarchyNode } from "@itwin/presentation-hierarchies";
import {
  CLASS_NAME_DrawingCategory,
  CLASS_NAME_GeometricElement2d,
  CLASS_NAME_GeometricElement3d,
  CLASS_NAME_GeometricModel2d,
  CLASS_NAME_GeometricModel3d,
  CLASS_NAME_SpatialCategory,
} from "./ClassNameDefinitions.js";

import type { Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { EC } from "@itwin/presentation-shared";
import type { CategoryId, ElementId } from "./Types.js";

/** @internal */
export function setDifference<T>(lhs: ReadonlySet<T>, rhs: ReadonlySet<T>): Set<T> {
  let result = new Set<T>();
  if (lhs.size < rhs.size) {
    for (const x of lhs) {
      if (!rhs.has(x)) {
        result.add(x);
      }
    }
  } else {
    result = new Set(lhs);
    for (const x of rhs) {
      result.delete(x);
    }
  }
  return result;
}

/** @internal */
export function setIntersection<T>(lhs: ReadonlySet<T>, rhs: ReadonlySet<T>): Set<T> {
  const result = new Set<T>();
  const { smallerSet, largerSet } = lhs.size < rhs.size ? { smallerSet: lhs, largerSet: rhs } : { smallerSet: rhs, largerSet: lhs };
  for (const x of smallerSet) {
    if (largerSet.has(x)) {
      result.add(x);
    }
  }
  return result;
}

/** @internal */
export function countInSet(ids: Id64Arg, set: ReadonlySet<Id64String> | undefined): number {
  if (!set?.size) {
    return 0;
  }
  const { smallerIterable, largerSet } =
    set.size < Id64.sizeOf(ids) ? { smallerIterable: set, largerSet: Id64.toIdSet(ids) } : { smallerIterable: Id64.iterable(ids), largerSet: set };
  let count = 0;
  for (const id of smallerIterable) {
    if (largerSet.has(id)) {
      ++count;
    }
  }
  return count;
}

/** @internal */
export function getOptimalBatchSize({ totalSize, maximumBatchSize }: { totalSize: number; maximumBatchSize: number }): number {
  return Math.ceil(totalSize / Math.ceil(totalSize / maximumBatchSize));
}

/** @internal */
export function createIdsSelector(ids: Id64Array): string {
  // Note: `json_array` function only accepts up to 127 arguments and we may have more `ids` than that. As a workaround,
  // we're creating an array of arrays
  const slices = new Array<Id64String[]>();
  for (let sliceStartIndex = 0; sliceStartIndex < ids.length; sliceStartIndex += 127) {
    let sliceEndIndex: number | undefined = sliceStartIndex + 127;
    if (sliceEndIndex > ids.length) {
      sliceEndIndex = undefined;
    }
    slices.push(ids.slice(sliceStartIndex, sliceEndIndex));
  }
  return `json_array(${slices.map((sliceIds) => `json_array(${sliceIds.map((id) => `'${id}'`).join(",")})`).join(",")})`;
}

/**
 * Builds an ECSQL fragment that excludes the given classes via `<alias>.ECClassId IS NOT (...)`.
 * Returns an empty string when no classes are provided.
 * @internal
 */
export function createExcludedClassesClause({
  alias,
  excludedClassNames,
}: {
  alias: string;
  excludedClassNames: ReadonlyArray<EC.FullClassNameDotNotation> | undefined;
}): string {
  if (!excludedClassNames || excludedClassNames.length === 0) {
    return "";
  }
  return `${alias}.ECClassId IS NOT (${excludedClassNames.join(", ")})`;
}

/** @internal */
export function createWhereClause({ conditions }: { conditions: Array<string | undefined | false> }): string {
  const filteredConditions = conditions.filter((condition): condition is string => !!condition);
  if (filteredConditions.length === 0) {
    return "";
  }
  if (filteredConditions.length === 1) {
    return `WHERE ${filteredConditions[0]}`;
  }
  return `WHERE ${filteredConditions.map((condition) => `(${condition})`).join(" AND ")}`;
}

/** @internal */
export function parseIdsSelectorResult(selectorResult: any): Id64Array {
  if (!Array.isArray(selectorResult)) {
    return [];
  }
  return selectorResult.reduce((arr, ids: Id64String | Id64String[]) => [...arr, ...(Array.isArray(ids) ? ids : [ids])], new Array<Id64String>());
}

/** @internal */
export function getClassesByView(viewType: "2d" | "3d") {
  return viewType === "2d"
    ? ({ categoryClass: CLASS_NAME_DrawingCategory, elementClass: CLASS_NAME_GeometricElement2d, modelClass: CLASS_NAME_GeometricModel2d } as const)
    : ({ categoryClass: CLASS_NAME_SpatialCategory, elementClass: CLASS_NAME_GeometricElement3d, modelClass: CLASS_NAME_GeometricModel3d } as const);
}

/** @internal */
export type ChildrenTree<T extends object = {}> = Map<string, T & { children?: ChildrenTree<T> }>;

/** @internal */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export namespace ChildrenTree {
  /** @internal*/
  export function visit<T extends object = {}>({
    tree,
    accept,
  }: {
    tree: ChildrenTree<T>;
    accept: (props: { depth: number; treeEntry: T; key: string }) => { ignoreChildren: boolean };
  }): void {
    function getIdsInternal({ childrenTree, depth }: { childrenTree: ChildrenTree<T>; depth: number }): void {
      for (const [id, entry] of childrenTree) {
        const { ignoreChildren } = accept({ depth, treeEntry: entry, key: id });
        if (ignoreChildren) {
          continue;
        }
        if (entry.children) {
          getIdsInternal({ childrenTree: entry.children, depth: depth + 1 });
        }
      }
    }
    getIdsInternal({ childrenTree: tree, depth: 0 });
  }

  /**
   * Updates children tree with provided `idsToAdd`:
   * - All Ids are added (if they are not yet added) to children tree in the same order they appear in `idsToAdd` array.
   * - `T` is assigned to each entry using the `additionalPropsGetter` function.
   * @internal
   */
  export function update<T extends object = {}>({
    tree,
    additionalPropsGetter,
    idsToAdd,
  }: {
    tree: ChildrenTree<T>;
    idsToAdd: Id64Array;
    additionalPropsGetter: ({ id, additionalProps, depth }: { id: Id64String; additionalProps?: T; depth: number }) => T;
  }) {
    let currentTree: ChildrenTree<T> = tree;
    for (let i = 0; i < idsToAdd.length; ++i) {
      const id = idsToAdd[i];
      let entry = currentTree.get(id);
      entry = {
        // Whoever calls this function knows how to assign the `T` to entry.
        ...additionalPropsGetter({ id, additionalProps: entry, depth: i }),
        // If children already exists, we reuse it.
        // If children do not exist and there are still ids left in the `idsToAdd` array, create a new Map, it will have the next id.
        ...(entry?.children || i + 1 < idsToAdd.length ? { children: entry?.children ?? new Map() } : {}),
      };
      // Always update the set with updated entry.
      currentTree.set(id, entry);
      // This will only happen if it's the last id in `idsToAdd` array. In such case loop can be exited.
      if (!entry.children) {
        break;
      }
      currentTree = entry.children;
    }
  }
}

/** @internal */
export function groupingNodeDataFromChildren(children: ProcessedHierarchyNode[]):
  | {
      hasSearchTargetAncestor: true;
      hasDirectNonSearchTargets: undefined;
    }
  | {
      hasSearchTargetAncestor: false;
      hasDirectNonSearchTargets: boolean;
    } {
  if (children.length > 0) {
    assert(!ProcessedHierarchyNode.isGroupingNode(children[0]), "Expected only non-grouping nodes as children");
    if (children[0].search?.hasSearchTargetAncestor) {
      return { hasSearchTargetAncestor: true, hasDirectNonSearchTargets: undefined };
    }
  }
  for (const child of children) {
    assert(!ProcessedHierarchyNode.isGroupingNode(child), "Expected only non-grouping nodes as children");
    if (child.search && !child.search.isSearchTarget) {
      return { hasSearchTargetAncestor: false, hasDirectNonSearchTargets: true };
    }
  }

  return { hasSearchTargetAncestor: false, hasDirectNonSearchTargets: false };
}

/**
 * Path describing a chain of parent elements, where each segment is one category + its elements.
 *
 * Structurally compatible with `ElementPathSegment[]` — can be spread directly into it.
 * The difference: this type uses exact single values (`Id64String`, `Id64Array`) because each
 * segment is known precisely, while `ElementPathSegment` uses `Id64Arg` to allow multi-value
 * cache lookups.
 * @internal
 */
export type ParentElementsPath = Array<{
  elementIds: Id64Array;
  /** Single category ID. Named plural for structural compatibility with `ElementPathSegment.categoryIds`. */
  categoryIds: Id64String;
}>;

/** @internal */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export namespace ParentElementsPath {
  export function getSingleLastParentId(path: ParentElementsPath): ElementId | undefined {
    const lastParentIds = ParentElementsPath.getLastParentIds(path);
    assert(
      () => lastParentIds === undefined || lastParentIds.length === 1,
      `Expected exactly one parent id at end of path, got ${lastParentIds?.length}. Path: ${JSON.stringify(path)}`,
    );
    return lastParentIds?.[0];
  }
  export function getLastParentIds(path: ParentElementsPath): Id64Array | undefined {
    return path.length > 0 ? path[path.length - 1].elementIds : undefined;
  }
  export function appendToPath({ path, ids, categoryId }: { path: ParentElementsPath; ids: Id64Arg; categoryId: CategoryId }): ParentElementsPath {
    return [...path, { elementIds: getId64Array(ids), categoryIds: categoryId }];
  }
}

/** @internal */
export function getOrCreate<TKey, TValue>({ map, key, createFunc }: { map: Map<TKey, TValue>; key: TKey; createFunc: () => TValue }): TValue {
  let entry = map.get(key);
  if (entry === undefined) {
    entry = createFunc();
    map.set(key, entry);
  }
  return entry;
}

/** @internal */
export function getId64Array(ids: Id64Arg): Id64Array {
  return typeof ids === "string" ? [ids] : Array.isArray(ids) ? ids : [...ids];
}

/** @internal */
export function getId64Spreadable(ids: Id64Arg): Id64Array | Id64Set {
  return typeof ids === "string" ? [ids] : ids;
}

/**
 * Recursively merges overrides into defaults, ignoring properties whose value is `undefined`.
 *
 * @internal
 */
export function mergeWithDefaults<T extends object>({ defaults, overrides }: { defaults: DeepRequired<T>; overrides?: DeepOptional<T> }): DeepRequired<T> {
  return mergeObjects({ defaults: defaults as Record<string, unknown>, overrides: overrides as Record<string, unknown> | undefined }) as DeepRequired<T>;
}

function mergeObjects({ defaults, overrides }: { defaults: Record<string, unknown>; overrides: Record<string, unknown> | undefined }): Record<string, unknown> {
  const result = { ...defaults };
  if (!overrides) {
    return result;
  }

  for (const [key, override] of Object.entries(overrides)) {
    if (override === undefined) {
      continue;
    }

    const defaultValue = defaults[key];
    result[key] = isMergeableObject(defaultValue) && isMergeableObject(override) ? mergeObjects({ defaults: defaultValue, overrides: override }) : override;
  }
  return result;
}

function isMergeableObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Recursively marks all properties as required with no depth limit.
 * @internal
 */
export type DeepRequired<T> = T extends (...args: any[]) => any
  ? T
  : T extends Array<infer U>
    ? Array<DeepRequired<U>>
    : T extends object
      ? { [K in keyof T]-?: DeepRequired<Exclude<T[K], undefined>> }
      : T;

/**
 * Recursively marks all properties as optional with no depth limit.
 */
type DeepOptional<T> = T extends (...args: any[]) => any
  ? T
  : T extends Array<infer U>
    ? Array<DeepOptional<U>>
    : T extends object
      ? { [K in keyof T]?: DeepOptional<T[K]> | undefined }
      : T;

/** @internal */
export function stableStringify(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  if (typeof value !== "object") {
    return "";
  }
  const entries = Object.keys(value)
    .sort()
    .map((key) => {
      const entry = (value as Record<string, unknown>)[key];
      if (entry === undefined) {
        return undefined;
      }
      return `${JSON.stringify(key)}:${stableStringify(entry)}`;
    })
    .filter((entry): entry is string => !!entry);

  return `{${entries.join(",")}}`;
}
