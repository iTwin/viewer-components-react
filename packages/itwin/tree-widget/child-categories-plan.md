# Plan: Child Element Categories Visibility (Issues #1100, #1561 & #1563)

## Problem Statement

Child elements can belong to a different category than their parent. Currently, all visibility operations use the parent's (or topmost ancestor's) category for every descendant, ignoring each element's actual category. This causes incorrect results across all node types:

- **Getting visibility (categories, elements, models):** Visibility status is computed using the wrong category's default state, since all these ultimately rely on per-category visibility to determine their status.
- **Changing visibility (categories, elements):** Descendants are added to always/never drawn sets based on the wrong category, causing elements to appear/disappear incorrectly.

Issues: [#1100](https://github.com/iTwin/viewer-components-react/issues/1100), [#1561](https://github.com/iTwin/viewer-components-react/issues/1561), [#1563](https://github.com/iTwin/viewer-components-react/issues/1563)

## Proposed Approach

### Core Idea
1. **Show intermediate category nodes** in the tree for child elements whose category differs from parent (via hierarchy definition, as normal category instance nodes)
2. **Rename `ModelCategoryElementsCountCache` → `DescendantsCountCache`** — add `parentElementId` and optional `categoryId` dimensions to get per-category descendant counts on demand
3. **Extend `AlwaysAndNeverDrawnElementInfoCache`** — modify the CTE to interleave each element's `Category.Id` into the path, enabling category-aware cache tree navigation and grouped return type
4. **Modify `ElementChildrenCache` → `NestedChildrenCache`** — when changing visibility, fetch nested descendant IDs grouped by category

### Tree Structure Change (Before → After)

**Before:**
```
Category A
  → Element A
    → Child Element B (Category B)
    → Child Element C (Category A)
```

**After:**
```
Category A
  → Element A
    → Child Element C (same category as parent → no intermediate node)
    → Category B (intermediate category node, shown because B ≠ A)
      → Child Element B
```

Intermediate category nodes are only shown when a child's category **differs** from the parent's category. Children whose category matches the parent appear directly under the parent (current behavior preserved).

---

## Architecture: Modified & Extended Caches

### Renamed: `ModelCategoryElementsCountCache` → `DescendantsCountCache`

**Purpose:** Replaces the old cache. Extended with `parentElementId` and optional `categoryId` dimensions.

**Request types:**
```typescript
interface DescendantsCountBaseRequest {
  modelId: ModelId;
}

interface DescendantsCountCategoryRequest extends DescendantsCountBaseRequest {
  categoryId: CategoryId;
  parentElementId?: ElementId;  // undefined = root level
}

interface DescendantsCountElementRequest extends DescendantsCountBaseRequest {
  parentElementId: ElementId;
}
```

Single method: `getDescendantsCounts(props: DescendantsCountCategoryRequest | DescendantsCountElementRequest)` → `Observable<Array<{ categoryId: CategoryId; count: number }>>`

When `DescendantsCountCategoryRequest`: returns that category's self count + child categories in its subtree.
When `DescendantsCountElementRequest`: returns all child categories under that element.

**Storage structure:**
```typescript
Map<ModelId, Map<
  ElementId | undefined,       // parentElementId
  Map<
    CategoryId | undefined,    // categoryId (undefined = element request)
    Array<{ categoryId: CategoryId; count: number }>
  >
>>
```

**Query:**
```sql
Descendants(id, modelId, reqParent, reqCategory, ownCategory) AS (
  -- Base: category requests (included only when batch has category requests)
  SELECT ECInstanceId, Model.Id, Parent.Id, Category.Id, Category.Id
  FROM ${elementClassName}
  WHERE ${categoryWhereClauses}

  UNION ALL

  -- Base: element requests (included only when batch has element requests)
  SELECT ECInstanceId, Model.Id, Parent.Id, CAST(NULL AS TEXT), Category.Id
  FROM ${elementClassName}
  WHERE ${elementWhereClauses}

  UNION ALL

  -- Recursive: walk all children, propagate request tag, read child's own category
  SELECT c.ECInstanceId, p.modelId, p.reqParent, p.reqCategory, c.Category.Id
  FROM ${elementClassName} c
  JOIN Descendants p ON c.Parent.Id = p.id
)
SELECT modelId, reqParent, reqCategory, ownCategory, COUNT(*) as cnt
FROM Descendants
GROUP BY modelId, reqParent, reqCategory, ownCategory
```

- `reqParent` + `reqCategory` = request tag (set in base, propagated in recursive step)
- `ownCategory` = each element's actual `Category.Id`
- Category/element base cases are conditionally included — only when the batch contains that request type
- Result mapping: `(M, reqParent, reqCategory, ownCategory, cnt)` → `cache[M][reqParent ?? undefined][reqCategory ?? undefined].push({ categoryId: ownCategory, count: cnt })`

**Characteristics:**
- Same batching (20ms), caching, observable infrastructure as original `ModelCategoryElementsCountCache`
- Cache fills incrementally across multiple requests
- Lazy, small footprint: 1M descendants across 5 categories → 5 entries per query

#### Counting Semantics

The cache returns `Array<{ categoryId: CategoryId; count: number }>` for both request types:

**Category request** `({ modelId, parentElementId?, categoryId })`:
Returns the requested category's self count (descendants in its subtree matching the category) plus child categories found in that subtree. `parentElementId` is `undefined` for root-level categories.

**Element request** `({ modelId, parentElementId })`:
Returns all child categories (nested) and their counts under that element.

**Example:**
```
el1 (catA)
├── el1_1 (catB)
│   ├── el1_1_1 (catA)
│   └── el1_1_2 (catB)
├── el1_2 (catB)
│   └── el1_2_1 (catC)
├── el1_3 (catA)
└── el1_4 (catC)
    └── el1_4_1 (catC)
```

**Tree shown to user** (intermediate category nodes):
```
catA
└── el1
    ├── el1_3                    ← catA same as parent, no intermediate node
    ├── catB                     ← intermediate: el1_1, el1_2 have catB ≠ catA
    │   ├── el1_1
    │   │   ├── el1_1_2          ← catB same as parent
    │   │   └── catA             ← intermediate: el1_1_1 has catA ≠ catB
    │   │       └── el1_1_1
    │   └── el1_2
    │       └── catC             ← intermediate: el1_2_1 has catC ≠ catB
    │           └── el1_2_1
    └── catC                     ← intermediate: el1_4 has catC ≠ catA
        └── el1_4
            └── el1_4_1          ← catC same as parent
```

**`(M, undefined, catA)`** → `[{ catA, 3 }, { catB, 3 }, { catC, 3 }]`
  - catA: el1 + el1_1_1 + el1_3 (self count — all descendants under catA root that have catA)
  - catB: el1_1 + el1_1_2 + el1_2 (child category)
  - catC: el1_2_1 + el1_4 + el1_4_1 (child category)

**`(M, el1)`** → `[{ catA, 2 }, { catB, 3 }, { catC, 3 }]`
  - catA: el1_1_1 + el1_3
  - catB: el1_1 + el1_1_2 + el1_2
  - catC: el1_2_1 + el1_4 + el1_4_1

**`(M, el1, catB)`** → `[{ catB, 3 }, { catA, 1 }, { catC, 1 }]`
  - catB: el1_1 + el1_1_2 + el1_2 (self count)
  - catA: el1_1_1 (child category in catB subtree)
  - catC: el1_2_1 (child category in catB subtree)

**`(M, el1, catC)`** → `[{ catC, 2 }]`
  - catC: el1_4 + el1_4_1 (self count, no child categories under el1_4)

**`(M, el1, catA)`** → `[{ catA, 1 }]`
  - catA: el1_3 (self count, el1_3 has no children)

**`(M, el1_1, catA)`** → `[{ catA, 1 }]`
  - catA: el1_1_1

**`(M, el1_1, catB)`** → `[{ catB, 1 }]`
  - catB: el1_1_2

**`(M, el1_1)`** → `[{ catA, 1 }, { catB, 1 }]`

### Extended: `AlwaysAndNeverDrawnElementInfoCache`

The cache stores `{ isInAlwaysOrNeverDrawnSet: boolean }` for each element. The tree now includes intermediate category levels to enable correct subtree scoping:

**Current tree structure:** `model → categoryOfTopMostParentElement → element1 → element2 → ...`
**Current map entry:** `{ isInAlwaysOrNeverDrawnSet: true; categoryId: Id64String } | { isInAlwaysOrNeverDrawnSet: false }`

**New tree structure:** `model → categoryOfTopMostParentElement → element1 → category → element2 → category → element3 → ...`
**New map entry:** `{ isInAlwaysOrNeverDrawnSet: boolean }` — `categoryId` is no longer needed on the entry because the element's category is its parent node in the cache tree.

The cache tree **always** interleaves categories between elements — every element is placed under its own category, regardless of whether it matches the parent's category. This differs from the display tree (which only shows intermediate category nodes when the category changes). The cache tree must be uniform so that navigation is consistent and we can scope to any category's subtree.

**Example:** `el1(catA) → el1_1(catB), el1_2(catC) → el1_2_1(catB)`, all in always drawn.

With intermediate categories:
```
M → catA → el1 → catB → el1_1
               → catC → el1_2 → catB → el1_2_1
```
Navigate `M → catA → el1 → catB` → only el1_1. Correct.


This replaces the old `parentElementIdsPath` (which only contained element IDs and required filtering out category IDs).

**Request types:**
```typescript
interface AlwaysNeverBaseProps {
  modelId: Id64String;
  categoryOfTopMostParentElement: CategoryId;  // to navigate cache tree (model → category → ...)
  setType: SetType;
}

interface AlwaysNeverCategoryProps extends AlwaysNeverBaseProps {
  categoryId: CategoryId;
  elementCategoryPath?: Array<Id64Arg>;  // undefined = top-level category
}

interface AlwaysNeverElementProps extends AlwaysNeverBaseProps {
  elementCategoryPath: Array<Id64Arg>;
}
```

**Return type:** `Map<CategoryId, Set<ElementId>>` — elements grouped by their own category (derived from the parent category node in the cache tree). Caller filters as needed.

**Query change required:** The current CTE builds `elementsPath` as a chain of element IDs only (`el1;el1_1;el1_1_1`) and carries both the leaf's `categoryId` and the root's `rootCategoryId` separately. The new CTE simplifies to a single `categoryId` column and interleaves child categories into the path. Changed `elementsPath` format:
- Current: `el1;el1_1;el1_1_1`
- New: `el1;catB;el1_1;catC;el1_1_1` (each intermediate category is the FOLLOWING element's own category)

For the example `el1(catA) → el1_1(catB) → el1_1_1(catC)`: the path `el1;catB;el1_1;catC;el1_1_1` means navigate `el1 → catB → el1_1 → catC → el1_1_1` — each element is correctly placed under its own category node.

**CTE changes:** The single `categoryId` column serves double duty — in the recursive step it's `e.categoryId` (the child's own category, inserted into the path), and it's overwritten to `p.Category.Id` (the current ancestor). At the final level (parentId IS NULL), `categoryId` = root ancestor's category = `categoryOfTopMostParentElement`. No separate `rootCategoryId` or `topCategoryId` columns needed:

```sql
ElementInfo(modelId, categoryId, parentId, elementsPath) AS (
  -- Base case: leaf element
  SELECT
    Model.Id modelId,
    Category.Id categoryId,       -- leaf's own category
    Parent.Id parentId,
    CAST(IdToHex(ECInstanceId) AS TEXT) elementsPath
  FROM ...

  UNION ALL

  -- Recursive step: prepend parent element + child's category
  SELECT
    e.modelId modelId,
    p.Category.Id categoryId,     -- overwrite: now tracks current ancestor's category
    p.Parent.Id parentId,
    CAST(IdToHex(p.ECInstanceId) AS TEXT) || ';' || CAST(IdToHex(e.categoryId) AS TEXT) || ';' || e.elementsPath
  FROM ... p
  JOIN ElementInfo e ON p.ECInstanceId = e.parentId
)
```

The recursive step inserts `e.categoryId` (the child's category) between parent and child in the path, then overwrites `categoryId` to `p.Category.Id`. This naturally produces the correct interleaving: each element sits under its own category.

**Trace example** for `el1(catA) → el1_1(catB) → el1_1_1(catC)`:
1. Base (el1_1_1): `elementsPath="el1_1_1"`, `categoryId=catC`
2. Recursive (p=el1_1): `elementsPath="el1_1;catC;el1_1_1"`, `categoryId=catB`
3. Recursive (p=el1): `elementsPath="el1;catB;el1_1;catC;el1_1_1"`, `categoryId=catA`

Final result: `elementsPath="el1;catB;el1_1;catC;el1_1_1"`, `categoryId=catA` (= categoryOfTopMostParentElement). ✅

For root-level elements (no parent), the path is just `"el1"` and `categoryId` = the element's own category = `categoryOfTopMostParentElement`.

### Modified: `ElementChildrenCache` → renamed `NestedChildrenCache`

**Purpose:** When changing visibility, retrieve IDs of nested descendants for specific categories. Replaces the current `ElementChildrenCache` which loads all descendants into a tree structure.

**Request types:**
```typescript
interface NestedChildrenBaseRequest {
  modelId: ModelId;
  childCategoryIds: CategoryId[];  // which child categories to fetch descendants for
}

interface NestedChildrenCategoryRequest extends NestedChildrenBaseRequest {
  categoryId: CategoryId;
  parentElementId?: ElementId;  // undefined = root level
}

interface NestedChildrenElementRequest extends NestedChildrenBaseRequest {
  parentElementId: ElementId;
}
```

Single method: `getNestedChildren(props: NestedChildrenCategoryRequest | NestedChildrenElementRequest)` → `Observable<Id64Array>`

Returns a flat array of all descendant IDs matching the requested `childCategoryIds`.

**Incremental caching:** The cache stores results per individual child category. When a request arrives:
1. Check which `childCategoryIds` are already cached for this `(modelId, parentElementId, categoryId)` key
2. Query only the missing child categories (filter: `WHERE ownCategory IN (missingCategoryIds)`)
3. Store each child category's results separately in the cache
4. Merge all (cached + newly fetched) into flat `Id64Array` and return

**Storage:**
```typescript
Map<ModelId, Map<
  ElementId | undefined,       // parentElementId
  Map<
    CategoryId | undefined,    // categoryId (undefined = element request)
    Map<CategoryId, Id64Array> // childCategoryId → descendant IDs
  >
>>
```

**Query:**
```sql
Descendants(id, modelId, reqParent, reqCategory, ownCategory) AS (
  -- Base: category requests (included only when batch has category requests)
  SELECT ECInstanceId, Model.Id, Parent.Id, Category.Id, Category.Id
  FROM ${elementClassName}
  WHERE ${categoryWhereClauses}

  UNION ALL

  -- Base: element requests (included only when batch has element requests)
  SELECT ECInstanceId, Model.Id, Parent.Id, CAST(NULL AS TEXT), Category.Id
  FROM ${elementClassName}
  WHERE ${elementWhereClauses}

  UNION ALL

  -- Recursive: walk all children, propagate request tag, read child's own category
  SELECT c.ECInstanceId, p.modelId, p.reqParent, p.reqCategory, c.Category.Id
  FROM ${elementClassName} c
  JOIN Descendants p ON c.Parent.Id = p.id
)
SELECT modelId, reqParent, reqCategory, ownCategory, id
FROM Descendants
WHERE ownCategory IN (${missingChildCategoryIds})
```

- Same CTE structure as `DescendantsCountCache`
- Outer query filters by only the **missing** child categories and returns element IDs
- Results stored per child category: `cache[M][reqParent][reqCategory][ownCategory].push(id)`

**Characteristics:**
- Incremental: only queries child categories not yet cached
- Flat list storage — lighter than current tree structure
- Subsequent requests with overlapping child categories reuse cached results
- Same caching approach as current `ElementChildrenCache` (not batched like `DescendantsCountCache`)

---

## Implementation Phases

### Phase 1: `DescendantsCountCache`

Rename `ModelCategoryElementsCountCache` → `DescendantsCountCache`. Implement split request interfaces and new CTE query as described in Architecture section.

**Files:** `ModelCategoryElementsCountCache.ts` → `DescendantsCountCache.ts`, tests, `BaseIdsCache.ts`

### Phase 2: Intermediate category nodes in hierarchy definitions

**Files:**
- `ModelsTreeDefinition.ts` → `createGeometricElement3dChildrenQuery`
- `CategoriesTreeDefinition.ts` → `createElementChildrenQuery`
- `ClassificationsTreeDefinition.ts` → child element creation

**What:**
- Parent element nodes already have `categoryId` in extendedData — use it to query:
  1. Direct child elements with the same `categoryId` → shown directly under parent (current behavior)
  2. Distinct categories from child elements where `Category.Id ≠ parentCategoryId` → produce intermediate category instance nodes (category class depends on the tree: `BisCore.SpatialCategory`, `BisCore.DrawingCategory`, etc.)
- Under each intermediate category node: query child elements of the parent that have that category

**Extended data for intermediate category node:**
- Same extended data as existing category nodes in that tree (e.g., `isCategory`, `modelIds`, etc.)
- Plus `parentElementId: Id64String` (top-level categories have `undefined`)
- Plus `categoryOfTopMostParentElement: CategoryId` (the top-level category, needed for `AlwaysAndNeverDrawnElementInfoCache` navigation)

### Phase 3: Unified visibility logic for categories and elements

**Files:** All visibility handlers and helpers, node types

**GET visibility for an element node** (e.g., el1_1):
1. `DescendantsCountCache({ modelId, parentElementId: el1_1 })` — element request → per-category counts of all descendants under el1_1
2. `AlwaysAndNeverDrawnElementInfoCache({ modelId, categoryOfTopMostParentElement, elementCategoryPath: [path-to-el1_1], setType })` — element request → navigates cache tree (model → categoryOfTopMostParentElement → ... → el1_1), walks all children, returns `Map<CategoryId, Set<ElementId>>`
3. For each category: compare descendant count vs always/never drawn count → per-category status
4. Merge per-category statuses → overall visibility

**GET visibility for a category node** (e.g., intermediate catB under el1):
1. `DescendantsCountCache({ modelId, parentElementId: el1, categoryId: catB })` — category request → per-category counts in catB's subtree
2. `AlwaysAndNeverDrawnElementInfoCache({ modelId, categoryOfTopMostParentElement, categoryId: catB, elementCategoryPath: [path-to-el1], setType })` — category request → navigates to el1, only traverses children with catB, returns `Map<CategoryId, Set<ElementId>>` scoped to catB's subtree
3. For each category: compare descendant count vs always/never drawn count → per-category status
4. Merge per-category statuses → overall visibility

**CHANGE visibility for an element node** (e.g., el1_1 → turn on):
1. `DescendantsCountCache({ modelId, parentElementId: el1_1 })` → per-category counts
2. For each category, check if that category's default visibility matches desired state
3. **Don't match** → `NestedChildrenCache({ modelId, parentElementId: el1_1, childCategoryIds: [catX] })` → fetch descendant IDs, add to always/never drawn
4. **Match** → `AlwaysAndNeverDrawnElementInfoCache({ modelId, categoryOfTopMostParentElement, elementCategoryPath: [path-to-el1_1], setType })` → get those category's descendant IDs, then remove them from both always and never drawn sets via viewport API

**CHANGE visibility for a category node** (e.g., intermediate catB under el1 → turn on):
1. Set per-model category override for catB
2. `DescendantsCountCache({ modelId, parentElementId: el1, categoryId: catB })` → per-category counts in catB's subtree
3. For each category, check if that category's default visibility matches desired state
4. **Don't match** → `NestedChildrenCache({ modelId, parentElementId: el1, categoryId: catB, childCategoryIds: [catX] })` → fetch descendant IDs, add to always/never drawn
5. **Match** → `AlwaysAndNeverDrawnElementInfoCache({ modelId, categoryOfTopMostParentElement, categoryId: catB, elementCategoryPath: [path-to-el1], setType })` → get those category's descendant IDs, then remove them from both always and never drawn sets via viewport API

### Phase 4: Fix SearchResultsTree for all trees

**Files:**
- `models-tree/internal/visibility/SearchResultsTree.ts`
- `categories-tree/internal/visibility/SearchResultsTree.ts`
- `classifications-tree/internal/visibility/SearchResultsTree.ts`

**Background:** With intermediate category nodes added to hierarchies (Phase 2), the search/filter path for a child element with a different category now includes: `... → Parent Element → Category B → Child Element`. All three trees' `SearchResultsTree` must be updated to handle this new intermediate category node type.

**Models tree** (`models-tree/.../SearchResultsTree.ts`):
- **Bug** (line 278): `categoryId: parent.categoryId` — when parent is an element, child blindly inherits parent's `categoryId`
- **Fix `createSearchResultsTreeNode`:** add a case for when parent is an intermediate category node (under an element): set `categoryId: parent.id` and `modelId: parent.modelId`
- **Fix `getType`:** recognize the intermediate category class (e.g., `SpatialCategory`) so it returns a category-like type
- **Update `SearchResultsTreeNode` types:** add an intermediate category variant (category node that also carries `modelId` and sits under an element), or extend existing `CategorySearchResultsTreeNode` to handle this case

**Categories tree** (`categories-tree/.../SearchResultsTree.ts`):
- **Bug** (line 397): `categoryId: parent.categoryId` — same inheritance pattern as Models tree
- **Fix `createSearchResultsTreeNode`:** same approach — when parent is intermediate category under element, set `categoryId: parent.id`
- **Fix `getType`:** recognize the intermediate category class for the categories tree (may differ from models tree depending on category element class used)
- **Update node types** similarly to Models tree

**Classifications tree** (`classifications-tree/.../SearchResultsTree.ts`):
- **No `categoryId: parent.categoryId` bug** — elements start with `categoryId: undefined` then resolve via `getFilteredElementsData` query which correctly returns each element's own `Category.Id`
- **Still needs structural changes:**
  - `createSearchResultsTreeNode` must handle intermediate category nodes as valid parents of element nodes
  - `getType` (currently knows only `classificationTable`, `classification`, `element`) must recognize the intermediate category class
  - Node type definitions must include the new intermediate category variant
- `getFilteredElementsData` already returns correct per-element `categoryId` — no query changes needed

### Phase 5: Extend `AlwaysAndNeverDrawnElementInfoCache`

**Files:** `AlwaysAndNeverDrawnElementInfoCache.ts`

**What:**
- Insert intermediate category nodes into the cache tree for **every** element (not just when category differs from parent). The cache tree always alternates element→category→element→category, so navigation is uniform.
- Unify request interface with base + category/element split (same pattern as other caches)
- Add `elementCategoryPath` to category requests (for intermediate categories under elements). This path alternates element→category→element→... and includes categories even when same as parent.
- Change return type from `Set<ElementId>` to `Map<CategoryId, Set<ElementId>>` — group by element's own category
- The existing CTE query is modified: add a `topCategoryId` column and use `e.topCategoryId` (the child's category) in the recursive step to interleave each element's own `Category.Id` into the `elementsPath` string (see Architecture section for full CTE and trace)
- Caller filters the returned map as needed
- Note: `getParentElementsIdsPath` no longer needs to filter out category IDs — the `elementCategoryPath` naturally includes them

---

## Key Decisions (Confirmed)

1. ✅ **Intermediate categories shown only when child's category differs from parent's**
2. ✅ **Intermediate category nodes are normal category instance nodes** (category class depends on tree)
3. ✅ **Rename `ElementChildrenCache` → `NestedChildrenCache`** — accepts `childCategoryIds`, returns `Observable<Id64Array>` (flat, filtered), caches per child category internally. **Rename `ModelCategoryElementsCountCache` → `DescendantsCountCache`** — unified request interface for counts
4. ✅ **No `isChildElementCategory` flag** — use `parentElementId` in extendedData (`undefined` = top-level, value = intermediate). Visibility logic is the same for both.
5. ✅ **Category visibility change is always global** — toggling any category node (top-level or intermediate) sets the per-model category override. Always/never drawn handles scoping. Flow:
   - Set per-model category override for that category
   - Child categories with visibility different from desired state → query descendants via `NestedChildrenCache`, add to always/never drawn
   - Child categories with visibility matching desired state → remove their elements from both always and never drawn sets
6. ✅ **Drop `childrenCount` from element extended data** — `DescendantsCountCache` provides per-category counts;
7. ✅ **Keep `categoryOfTopMostParentElement` in extended data** — both element and category nodes need it to navigate the `AlwaysAndNeverDrawnElementInfoCache` tree
8. ✅ **`elementCategoryPath` replaces `parentElementIdsPath`** — `getParentElementsIdsPath` renamed to `getElementCategoryPath`:
   ```
   getElementCategoryPath(topMostElement, topMostElementCategory, allCategories, parentInstanceKeys):
     path = [topMostElement]
     prevCat = topMostElementCategory
     lastWasElement = true
     for each id in parentInstanceKeys after topMostElement:
       if lastWasElement:
         if id in allCategories:
           path.push(id)
           prevCat = id
           lastWasElement = false
         else:
           path.push(prevCat, id)  // insert missing same-category
       else:
         path.push(id)
         lastWasElement = true
     return path
   ```
   Example: `[..., catA, el1, el1_1, catB, el1_1_1, el1_1_1_1]` → `[el1, catA, el1_1, catB, el1_1_1, catB, el1_1_1_1]`

---
