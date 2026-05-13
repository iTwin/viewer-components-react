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
catA
└── elA
    ├── elB (catB)
    └── elC (catA)
```

**After:**
```
catA
└── elA
    ├── elC (same category as parent → no intermediate node)
    └── catB (intermediate category node, shown because B ≠ A)
        └── elB
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

**New tree structure:** `model → category → element1 → category → element2 → category → element3 → ...`
**New map entry:** `{ isInAlwaysOrNeverDrawnSet: boolean }` — `categoryId` is no longer needed on the entry because the element's category is its parent node in the cache tree.

The cache tree **always** interleaves categories between elements — every element is placed under its own category, regardless of whether it matches the parent's category. This differs from the display tree (which only shows intermediate category nodes when the category changes). The cache tree must be uniform so that navigation is consistent and we can scope to any category's subtree.

**Example:** `el1(catA) → el1_1(catB), el1_2(catC) → el1_2_1(catB)`, all in always drawn.

**Cache tree** (intermediate category nodes at every level):
```
M
├── catA
│   └── el1
│       ├── catB
│       │   └── el1_1
│       └── catC
│           └── el1_2
│               └── catB
│                   └── el1_2_1
```
Navigate `M → catA → el1 → catB` → only el1_1. Correct.


This replaces the old `parentElementIdsPath`. Currently, `getParentElementsIdsPath` (in `Utils.ts`) just slices instance keys from the top-most element — the path contains only element IDs and no categories. With intermediate category nodes appearing in the hierarchy, the path will naturally include category instance keys. The replacement `getElementPath` is moved into `AlwaysAndNeverDrawnElementInfoCache` (since it's the only consumer and knows the path structure it needs) and produces the structured `elementPath` array directly (see Key Decision #8).

**Request type:**
```typescript
interface AlwaysNeverDrawnProps {
  modelId: Id64String;
  setType: SetType;
  elementPath: Array<{ elementId?: Id64Arg; categoryId: Id64String }>;
}
```

**`elementPath` semantics:** Each entry pairs an optional element with its category. The path encodes the full navigation through the cache tree starting from the model:
- `[]` → model level (all elements in the model)
- `[{ categoryId: catA }]` → root category catA's subtree
- `[{ elementId: el1, categoryId: catA }]` → element el1's subtree (el1 belongs to catA)
- `[{ elementId: el1, categoryId: catA }, { categoryId: catB }]` → intermediate catB under el1
- `[{ elementId: el1, categoryId: catA }, { elementId: el1_1, categoryId: catB }]` → element el1_1's subtree

No separate `categoryOfTopMostParentElement` field needed — it's `elementPath[0].categoryId` when the path is non-empty.

**Return type:** `Map<CategoryId, Set<ElementId>>` — elements grouped by their own category (derived from the parent category node in the cache tree). Caller filters as needed.

**Query change required:** The current CTE builds `elementsPath` as a chain of element IDs only (`el1;el1_1;el1_1_1`) and carries `modelId`, `categoryId`, and `rootCategoryId` as separate columns. The new CTE returns only `modelId` and `elementsPath`, with every element's category interleaved into the path whenever an element is inserted. Changed `elementsPath` format:
- Current: `el1;el1_1;el1_1_1` (elements only, category in separate columns)
- New: `catA;el1;catB;el1_1;catC;el1_1_1` (each element is preceded by its own category)

For the example `el1(catA) → el1_1(catB) → el1_1_1(catC)`: the path `catA;el1;catB;el1_1;catC;el1_1_1` means navigate `catA → el1 → catB → el1_1 → catC → el1_1_1` — each element is correctly placed under its own category node.

**CTE changes:** Returns `modelId` and `elementsPath`. Every element inserted into the path is paired with its category (`category;element`). No separate `categoryId` or `rootCategoryId` columns needed:

```sql
ElementInfo(modelId, parentId, elementsPath) AS (
  -- Base case: leaf element — include its category
  SELECT
    Model.Id modelId,
    Parent.Id parentId,
    CAST(IdToHex(Category.Id) AS TEXT) || ';' || CAST(IdToHex(ECInstanceId) AS TEXT) elementsPath
  FROM ...

  UNION ALL

  -- Recursive step: prepend parent element + parent's category
  SELECT
    e.modelId modelId,
    p.Parent.Id parentId,
    CAST(IdToHex(p.Category.Id) AS TEXT) || ';' || CAST(IdToHex(p.ECInstanceId) AS TEXT) || ';' || e.elementsPath
  FROM ... p
  JOIN ElementInfo e ON p.ECInstanceId = e.parentId
)

SELECT modelId, elementsPath FROM ElementInfo WHERE parentId IS NULL
```

Each recursive step prepends `category;element` for the current ancestor. The base case also includes `category;element` for the leaf. This uniformly pairs every element with its category.

**Trace example** for `el1(catA) → el1_1(catB) → el1_1_1(catC)`:
1. Base (el1_1_1): `elementsPath="catC;el1_1_1"`
2. Recursive (p=el1_1): `elementsPath="catB;el1_1;catC;el1_1_1"`
3. Recursive (p=el1): `elementsPath="catA;el1;catB;el1_1;catC;el1_1_1"`

Final result: `modelId=M`, `elementsPath="catA;el1;catB;el1_1;catC;el1_1_1"`. ✅

The path always alternates `category;element` pairs. The first category in the path is the root element's category (= `categoryOfTopMostParentElement`). For root-level elements (no parent), the path is `"catA;el1"` — just one pair.

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

**Files:** `BaseVisibilityHelper.ts`, `VisibilityUtils.ts`, all visibility handlers and helpers, node types

#### Phase 3a: GET element visibility

**Current behavior** (`getElementsVisibilityStatus` + `getVisibilityFromAlwaysAndNeverDrawnElements`):
1. If model is hidden → return `hidden`
2. Compute `defaultStatus` from `getVisibleModelCategoryDirectVisibilityStatus({ categoryId, modelId })` — checks per-model category override, falls back to `viewsCategory()`
3. If `isAlwaysDrawnExclusive` → override `defaultStatus` to `hidden`
4. Determine `oppositeSet`: if default is visible → check `neverDrawn`; if hidden → check `alwaysDrawn`
5. If no children (`childrenCount === 0`): count how many of the element IDs are in `oppositeSet` → compute status
6. If has children: query `AlwaysAndNeverDrawnElementInfoCache` for child elements in the opposite set → combine with element's own count → compute status via `getVisibilityFromAlwaysAndNeverDrawnElementsImpl({ totalCount, numberOfElementsInOppositeSet })`
7. Also merge with sub-model visibility (elements that are models)

**Bug:** Steps 2 and 6 use a single `categoryId` for ALL descendants — ignoring children in different categories.

**New behavior:**

New parameter: `ignoreDescendants?: boolean` — when `true`, skip descendant computation (steps 3–6) and return only the element's own status. Used by SearchResultsTree where descendant visibility is not needed.

The function no longer receives `childrenCount` — it computes descendant counts itself via `DescendantsCountCache`.

1. If model is hidden → return `hidden`
2. **Compute the element's own visibility independently:**
   a. Check if the element is in the always/never drawn set
   b. `defaultStatus` = `getVisibleModelCategoryDirectVisibilityStatus({ categoryId: element's own category, modelId })`
   c. If `isAlwaysDrawnExclusive` → override `defaultStatus` to `hidden`
   d. Determine element's own status from its `defaultStatus` and whether it's in always/never drawn
3. If `ignoreDescendants` → return element's own status (step 2d)
4. Get per-category descendant counts: `DescendantsCountCache({ modelId, parentElementId: el1_1 })` → `Array<{ categoryId, count }>` (descendants only, does not include the element itself)
5. **Group descendant categories by default visibility:**
   a. For each category in the counts array: `defaultStatus` = `getVisibleModelCategoryDirectVisibilityStatus({ categoryId, modelId })`
   b. If `isAlwaysDrawnExclusive` → override all `defaultStatus` to `hidden`
   c. Split into `visibleCategories` (defaultStatus = visible) and `hiddenCategories` (defaultStatus = hidden)
6. **Query always/never drawn per group** (the `elementPath` includes the element itself, e.g. `[{ elementId: el1, categoryId: catA }, { elementId: el1_1, categoryId: catB }]`, so the cache will return only its descendants):
   a. For `visibleCategories` → `AlwaysAndNeverDrawnElementInfoCache({ modelId, setType: neverDrawn, elementPath })` → `Map<CategoryId, Set<ElementId>>`
   b. For `hiddenCategories` → `AlwaysAndNeverDrawnElementInfoCache({ modelId, setType: alwaysDrawn, elementPath })` → `Map<CategoryId, Set<ElementId>>`
7. **Per-category visibility computation:** For each category in descendant counts:
   a. Get the count of elements from that category in its opposite set (from the appropriate map in step 6)
   b. Compute per-category status via `getVisibilityFromAlwaysAndNeverDrawnElementsImpl({ totalCount: categoryCount, numberOfElementsInOppositeSet })`
8. Merge element's own status (step 2) + all per-category descendant statuses (step 7) + sub-model visibility → overall status

#### Phase 3b: GET category visibility

**Current behavior** (`getVisibilityFromAlwaysAndNeverDrawnElements` with `categoryId` branch):
1. Get total element count for this category in model: `baseIdsCache.getElementsCount({ modelId, categoryId })`
2. Get always/never drawn elements for this category: `AlwaysAndNeverDrawnElementInfoCache({ modelId, categoryIds, setType })`
3. Compute status via `getVisibilityFromAlwaysAndNeverDrawnElementsImpl({ totalCount, numberOfElementsInOppositeSet })`

**Bug:** Child elements might have different category from their parents, that has to be taken into consideration.

**New behavior** (same logic for top-level and intermediate categories — only the path differs):
1. Get per-category descendant counts: `DescendantsCountCache({ modelId, [parentElementId], categoryId })`
2. **Group categories by default visibility:**
   a. For each category in descendant counts: `defaultStatus` = `getVisibleModelCategoryDirectVisibilityStatus({ categoryId, modelId })`
   b. If `isAlwaysDrawnExclusive` → override all `defaultStatus` to `hidden`
   c. Split into `visibleCategories` / `hiddenCategories`
3. **Query always/never drawn per group:**
   a. For `visibleCategories` → `AlwaysAndNeverDrawnElementInfoCache({ modelId, setType: neverDrawn, elementPath })`
   b. For `hiddenCategories` → `AlwaysAndNeverDrawnElementInfoCache({ modelId, setType: alwaysDrawn, elementPath })`
4. Per-category computation (same as 3a step 6) → merge → overall status

**Path examples:**
- Top-level category (catA): `elementPath: [{ categoryId: catA }]`
- Intermediate category (catB under el1): `elementPath: [{ elementId: el1, categoryId: catA }, { categoryId: catB }]`

#### Phase 3c: CHANGE element visibility

**Current behavior** (`changeElementsVisibilityStatus`):
1. Get child elements from `elementChildrenCache`.
2. Collect all element IDs: `[...elementIds, ...children]` (children is a flat list, all treated with same `categoryId`)
3. If model not visible and turning on → `showModelWithoutAnyCategoriesOrElements({ modelId })`
4. For each element, we'll check if by default it matches the desired state (by default means without taking always/never drawn lists into consideration). For children always assume that they don't match the desired state.
5. Queue visibility change: for each element add to always drawn or never drawn list if they don't match the desired state.
6. Also change sub-model visibility

**Bug:** All children are put into the set which matches the desired state. That is not necessary if child elements categories already match that state.

**New behavior:**
1. Get per-category descendant counts: `DescendantsCountCache({ modelId, parentElementId })` → know which child categories exist
2. If model not visible and turning on → `showModelWithoutAnyCategoriesOrElements({ modelId })`
3. For the element(s) themselves: check if by default (based on element's own category) it matches the desired state. If not → add to always/never drawn. If matches → remove from always/never drawn.
4. For each child category:
   a. `defaultStatus` = `getVisibleModelCategoryDirectVisibilityStatus({ categoryId: childCategory, modelId })`
   b. If `isAlwaysDrawnExclusive` → override `defaultStatus` to `hidden`
   c. If `defaultStatus` matches desired state → remove those elements from both always AND never drawn sets:
      - `AlwaysAndNeverDrawnElementInfoCache({ modelId, setType: "always", elementPath })` → get IDs → remove from viewport always drawn
      - `AlwaysAndNeverDrawnElementInfoCache({ modelId, setType: "never", elementPath })` → get IDs → remove from viewport never drawn
   d. If `defaultStatus` does NOT match desired state → fetch descendant IDs and add to appropriate set:
      - `NestedChildrenCache({ modelId, parentElementId, childCategoryIds: [childCategory] })` → get IDs
      - Add to always drawn (if turning on) or never drawn (if turning off)
5. Also change sub-model visibility

#### Phase 3d: CHANGE category visibility

**Current behavior** (`changeCategoriesVisibilityStatus` / `changeCategoriesUnderModelVisibilityStatus`):
- **Top-level (no modelId):** change category selector display, remove per-model overrides across all models, clear always/never drawn, change sub-models, enable sub-categories if turning on
- **Under model:** set per-model category override (show/hide), clear always/never drawn for that category, change sub-models, turn on model if needed

**Bug:** Nested children might have different category than the category of whose visibility is being changed. Right now we assume that setting override will change visibility for those elements, which is not correct.

**New behavior** (same logic for top-level and intermediate categories — only the path/scope differs):
1. Set per-model category override for the target category (or change category selector display if top-level without modelId)
2. Turn on model if needed (turning on and model not visible)
3. For elements directly in the target category (within scope): remove from both always AND never drawn sets — they now follow the new category default which matches the desired state
   - `AlwaysAndNeverDrawnElementInfoCache({ modelId, setType: "always", elementPath })` → get IDs → remove from viewport always drawn
   - `AlwaysAndNeverDrawnElementInfoCache({ modelId, setType: "never", elementPath })` → get IDs → remove from viewport never drawn
4. Get per-category descendant counts: `DescendantsCountCache({ modelId, [parentElementId], categoryId })` → find which other categories exist in the subtree
5. For each other child category (not the target category):
   a. `defaultStatus` = `getVisibleModelCategoryDirectVisibilityStatus({ categoryId: childCategory, modelId })`
   b. If `isAlwaysDrawnExclusive` → override `defaultStatus` to `hidden`
   c. If `defaultStatus` matches desired state → remove those elements from both always AND never drawn sets (via `AlwaysAndNeverDrawnElementInfoCache`)
   d. If `defaultStatus` does NOT match desired state → fetch descendant IDs via `NestedChildrenCache({ modelId, [parentElementId], childCategoryIds: [childCategory] })` → add to always drawn (turning on) or never drawn (turning off)
6. Change sub-models visibility, enable sub-categories if turning on

**Path examples:**
- Top-level category (catA): `elementPath: [{ categoryId: catA }]`
- Intermediate category (catB under el1): `elementPath: [{ elementId: el1, categoryId: catA }, { categoryId: catB }]`

### Phase 4: Fix SearchResultsTree for all trees

**Files:**
- `src/tree-widget-react/components/trees/models-tree/ModelsTreeDefinition.ts` — `createGeometricElementInstanceKeyPaths` (line ~689)
- `src/tree-widget-react/components/trees/categories-tree/CategoriesTreeDefinition.ts` — `createGeometricElementInstanceKeyPaths` (line ~1036)
- `src/tree-widget-react/components/trees/classifications-tree/ClassificationsTreeDefinition.ts` — `createGeometricElementInstanceKeyPaths` (line ~669)
- Plus each tree's `SearchResultsTree.ts` for node handling

**Background:** Search paths are constructed inside the tree definitions via `createGeometricElementInstanceKeyPaths`. Each uses a recursive CTE that builds the path bottom-up (from target leaf to root). Currently, the CTE only includes a category in the path for the root-level element (`Parent.Id IS NULL`). Non-root elements are always emitted as `Element;elementId` — their category is never inserted even when it differs from the parent's.

Once search paths include intermediate categories, `categoryId: parent.categoryId` in `createSearchResultsTreeNode` (when parent is an element) is **not a bug** — if the parent node is an element, the child element will always have the same category.

**CTE fix (same pattern for all trees):**

The CTE needs a `CategoryId` column so the recursive step can compare child vs parent category. When they differ, insert a `Category;childCatId` segment before the element in the path.

Current CTE structure (Models tree as example):
```sql
ModelsCategoriesElementsHierarchy(ECInstanceId, ParentId, ModelId, GroupingNodeIndex, Path) AS (
  -- Base: target leaf
  SELECT e.ECInstanceId, e.ParentId, e.ModelId, ...,
    IIF(e.ParentId IS NULL,
      'Model;' || modelId || ';Category;' || catId || ';Element;' || elementId,
      'Element;' || elementId
    )
  -- Recursive: prepend parent
  SELECT pe.ECInstanceId, pe.Parent.Id, pe.Model.Id, ...,
    IIF(pe.Parent.Id IS NULL,
      'Model;' || modelId || ';Category;' || peCatId || ';Element;' || peId || ';' || ce.Path,
      'Element;' || peId || ';' || ce.Path
    )
)
```

New CTE structure:
```sql
ModelsCategoriesElementsHierarchy(ECInstanceId, ParentId, ModelId, CategoryId, GroupingNodeIndex, Path) AS (
  -- Base: target leaf (track its CategoryId)
  SELECT e.ECInstanceId, e.ParentId, e.ModelId, e.CategoryId, ...,
    IIF(e.ParentId IS NULL,
      'Model;' || modelId || ';Category;' || catId || ';Element;' || elementId,
      'Element;' || elementId
    )
  -- Recursive: prepend parent, insert intermediate category if child's category ≠ parent's
  SELECT pe.ECInstanceId, pe.Parent.Id, pe.Model.Id, pe.Category.Id, ...,
    IIF(pe.Parent.Id IS NULL,
      'Model;' || modelId || ';Category;' || peCatId || ';Element;' || peId || ';'
        || IIF(ce.CategoryId <> pe.Category.Id, 'Category;' || ce.CategoryId || ';', '')
        || ce.Path,
      'Element;' || peId || ';'
        || IIF(ce.CategoryId <> pe.Category.Id, 'Category;' || ce.CategoryId || ';', '')
        || ce.Path
    )
)
```

Key change: `IIF(ce.CategoryId <> pe.Category.Id, 'Category;' || ce.CategoryId || ';', '')` — conditionally inserts the intermediate category segment when child and parent categories differ.

**Per-tree specifics:**

**Models tree** (`ModelsTreeDefinition.ts`):
- CTE `ModelsCategoriesElementsHierarchy` — add `CategoryId` column, insert intermediate category as above
- Category class in path: `SpatialCategory` (`CATEGORY_CLASS_NAME_QUERY_ALIAS`)
- `parseQueryRow` already handles `CATEGORY_CLASS_NAME_QUERY_ALIAS` — no changes needed

**Categories tree** (`CategoriesTreeDefinition.ts`):
- CTE `CategoriesElementsHierarchy` — same fix, add `CategoryId`, insert intermediate category
- Category class depends on view type (2d/3d)
- `parseQueryRow` already handles `CATEGORY_CLASS_NAME_QUERY_ALIAS` — no changes needed

**Classifications tree** (`ClassificationsTreeDefinition.ts`):
- CTE `ElementsHierarchy` — currently has no category at all in the path (just elements). Need to add `CategoryId` column and insert `Category;catId` when child's category ≠ parent's category
- Need to add `CATEGORY_CLASS_NAME_QUERY_ALIAS` handling to `parseQueryRow`

**SearchResultsTree.ts changes (all trees):**
- **Fix `createSearchResultsTreeNode`:** extend `CategorySearchResultsTreeNode` with optional `parentElementId` (`undefined` for top-level, set when parent is an element)
- **Fix `getType`:** recognize the intermediate category class so it returns a category-like type

**Category search paths — intermediate occurrences:**

Currently, searching for a category by name only finds top-level occurrences (categories as direct children of models). With intermediate category nodes now visible in the tree, searching should also find intermediate occurrences (e.g., catB appearing under el1 because el1's children belong to catB).

**Models tree** — `createCategoryInstanceKeyPaths` (`ModelsTreeIdsCache.ts`):
- Currently produces paths only for models where the searched category is a top-level category (category of root-level elements)
- **Needs extension:** also find elements whose direct children have the searched category AND that category ≠ the element's own category → build element paths up to root → append the intermediate category node. This requires a new query.

**Categories tree** — `getCategoriesSearchPaths` (`CategoriesTreeIdsCache.ts`, line ~452):
- Same issue — currently only top-level paths
- **Needs same extension:** find parent elements with children in the searched category (where category differs) → build paths → append intermediate category

**Classifications tree** — currently doesn't search for categories at all (only classification tables, classifications, elements). Needs to add category search with both top-level and intermediate paths.

### Phase 5: Extend `AlwaysAndNeverDrawnElementInfoCache`

**Files:** `AlwaysAndNeverDrawnElementInfoCache.ts`

**What:**
- Insert intermediate category nodes into the cache tree for **every** element (not just when category differs from parent). The cache tree always alternates element→category→element→category, so navigation is uniform.
- Single request interface: `AlwaysNeverDrawnProps { modelId, setType, elementPath }` — no base/category/element split needed
- `elementPath: Array<{ elementId?, categoryId }>` encodes the full navigation path; the last entry determines scope (element vs category vs model)
- Cache entry simplifies to `{ isInAlwaysOrNeverDrawnSet: boolean }` — no `categoryId` on entries (the element's category is its parent node in the tree)
- Change return type from `Set<ElementId>` to `Map<CategoryId, Set<ElementId>>` — group by element's own category (derived from parent category node)
- The existing CTE query is modified: the single `categoryId` column is reused — the recursive step inserts `e.categoryId` (the child's category) into the path and overwrites `categoryId` to `p.Category.Id`, so at the final level it equals the root ancestor's category (see Architecture section for full CTE and trace)
- Caller filters the returned map as needed
- Note: `getParentElementsIdsPath` is replaced by `getElementPath` which produces the structured `elementPath` array directly

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
7. ✅ **`categoryOfTopMostParentElement` no longer needed in `AlwaysAndNeverDrawnElementInfoCache`** — the new `elementPath` encodes the root category as `elementPath[0].categoryId`. May still be kept in extendedData if other caches/visibility helpers need it.
8. ✅ **`elementPath` replaces `parentElementIdsPath` and `elementCategoryPath`** — `getParentElementsIdsPath` renamed to `getElementPath`, produces structured entries:
   ```
   getElementPath(topMostElement, topMostElementCategory, allCategories, parentInstanceKeys):
     path = []
     prevCat = topMostElementCategory
     lastWasElement = false
     // first entry: topMostElement with its category
     path.push({ elementId: topMostElement, categoryId: topMostElementCategory })
     lastWasElement = true
     for each id in parentInstanceKeys after topMostElement:
       if id in allCategories:
         prevCat = id
         lastWasElement = false
       else:
         // element entry — uses current prevCat (same as parent, or updated by preceding category key)
         path.push({ elementId: id, categoryId: prevCat })
         lastWasElement = true
     // if path ends on a category (request is for an intermediate category scope), emit category-only entry
     if not lastWasElement:
       path.push({ categoryId: prevCat })
     return path
   ```
   Examples:
   - Element path: `[..., catA, el1, el1_1, catB, el1_1_1, el1_1_1_1]` →
     `[{ elementId: el1, categoryId: catA }, { elementId: el1_1, categoryId: catA }, { elementId: el1_1_1, categoryId: catB }, { elementId: el1_1_1_1, categoryId: catB }]`
   - Intermediate category path: `[..., catA, el1, catB]` →
     `[{ elementId: el1, categoryId: catA }, { categoryId: catB }]`

---
