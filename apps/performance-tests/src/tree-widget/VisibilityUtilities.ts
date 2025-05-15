/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { EMPTY, expand, from, mergeMap } from "rxjs";
import { waitFor } from "test-utilities";
import { assert } from "@itwin/core-bentley";
import { Code, ColorDef, IModel, RenderMode } from "@itwin/core-common";
import { IModelApp, OffScreenViewport, SpatialViewState, ViewRect } from "@itwin/core-frontend";
import { HierarchyNode } from "@itwin/presentation-hierarchies";
import { toVoidPromise } from "@itwin/tree-widget-react/internal";

import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { HierarchyProvider, NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";
import type { ECSqlQueryDef } from "@itwin/presentation-shared";
import type { HierarchyVisibilityHandler } from "@itwin/tree-widget-react";
import type { IModelAccess } from "./StatelessHierarchyProvider.js";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";

type Visibility = "visible" | "hidden" | "partial";

export interface ValidateNodeProps {
  handler: HierarchyVisibilityHandler;
  viewport: Viewport;
  expectations:
    | "all-visible"
    | "all-hidden"
    | {
        default: "all-visible" | "all-hidden";
        instances: { [id: string]: Visibility };
      };
}

async function validateNodeVisibility({ node, handler, expectations }: ValidateNodeProps & { node: HierarchyNode }) {
  if (HierarchyNode.isClassGroupingNode(node)) {
    return;
  }
  assert(HierarchyNode.isInstancesNode(node));
  const ids = node.key.instanceKeys.map((instanceKey) => instanceKey.id);
  const actualVisibility = await handler.getVisibilityStatus(node);
  if (expectations === "all-visible" || expectations === "all-hidden") {
    expect(actualVisibility.state).to.eq(expectations === "all-hidden" ? "hidden" : "visible");
    return;
  }
  const idInExpectations = ids.find((id) => id in expectations.instances)
  if (idInExpectations) {
    const expectedVisibility = expectations.instances[idInExpectations];
    expect(actualVisibility.state).to.eq(expectedVisibility);
  } else {
    expect(actualVisibility.state).to.eq(expectations.default === "all-hidden" ? "hidden" : "visible");
  }
}

export async function validateHierarchyVisibility({
  provider,
  ...props
}: ValidateNodeProps & {
  provider: HierarchyProvider;
}) {
  await toVoidPromise(
    from(provider.getNodes({ parentNode: undefined })).pipe(
      expand((node) => (node.children ? provider.getNodes({ parentNode: node }) : EMPTY)),
      mergeMap(async (node) => waitFor(async () => validateNodeVisibility({ ...props, node }))),
    ),
  );
}

export async function createViewport({
  iModelConnection,
  testData,
}: {
  iModelConnection: IModelConnection;
  testData: {
    categories: VisibilityInfo[];
    subCategories: VisibilityInfo[];
    elements: VisibilityInfo[];
    models: VisibilityInfo[];
  };
}): Promise<Viewport> {
  const model = IModel.dictionaryId;
  const viewState = SpatialViewState.createFromProps(
    {
      categorySelectorProps: {
        categories: testData.categories.map((category) => category.id),
        model,
        code: Code.createEmpty(),
        classFullName: "BisCore:CategorySelector",
      },
      displayStyleProps: { model, code: Code.createEmpty(), classFullName: "BisCore:DisplayStyle3d" },
      viewDefinitionProps: {
        model,
        code: Code.createEmpty(),
        categorySelectorId: "",
        classFullName: "BisCore:SpatialViewDefinition",
        displayStyleId: "",
      },
      modelSelectorProps: {
        models: testData.models.map((testModel) => testModel.id),
        code: Code.createEmpty(),
        model,
        classFullName: "BisCore:ModelSelector",
      },
    },
    iModelConnection,
  );

  viewState.setAllow3dManipulations(true);

  viewState.displayStyle.backgroundColor = ColorDef.white;
  const flags = viewState.viewFlags.copy({
    grid: false,
    renderMode: RenderMode.SmoothShade,
    backgroundMap: false,
  });
  viewState.displayStyle.viewFlags = flags;

  IModelApp.viewManager.onViewOpen.addOnce((vp) => {
    if (vp.view.hasSameCoordinates(viewState)) {
      vp.applyViewState(viewState);
    }
  });
  await viewState.load();
  return OffScreenViewport.create({
    view: viewState,
    viewRect: new ViewRect(),
  });
}

interface VisibilityInfo {
  id: Id64String;
  visible: boolean;
}

export function setupInitialDisplayState(props: {
  viewport: Viewport;
  categories?: Array<VisibilityInfo>;
  subCategories?: Array<VisibilityInfo>;
  models?: Array<VisibilityInfo>;
  elements?: Array<VisibilityInfo>;
}) {
  const { viewport } = props;
  const categories = props.categories ?? [];
  const elements = props.elements ?? [];
  const subCategories = props.subCategories ?? [];
  const models = props.models ?? [];
  for (const subCategoryInfo of subCategories) {
    viewport.changeSubCategoryDisplay(subCategoryInfo.id, subCategoryInfo.visible);
  }
  for (const categoryInfo of categories) {
    viewport.changeCategoryDisplay(categoryInfo.id, categoryInfo.visible, false);
  }

  for (const elementInfo of elements) {
    if (elementInfo.visible) {
      viewport.alwaysDrawn?.add(elementInfo.id);
      continue;
    }
    viewport.neverDrawn?.add(elementInfo.id);
  }
  if (!viewport.alwaysDrawn) {
    viewport.setAlwaysDrawn(new Set(elements.filter(({ visible }) => visible).map(({ id }) => id)));
  }
  if (!viewport.neverDrawn) {
    viewport.setNeverDrawn(new Set(elements.filter(({ visible }) => !visible).map(({ id }) => id)));
  }
  for (const modelInfo of models) {
    viewport.changeModelDisplay(modelInfo.id, modelInfo.visible);
  }
}

export function createTestDataForInitialDisplay(props: {
  visibilityTargets: { models: Id64Array; categories: Id64Array; subCategories: Id64Array; elements: Id64Array };
  visible: boolean;
}) {
  return {
    categories: props.visibilityTargets.categories.map((category) => ({ id: category, visible: props.visible })),
    subCategories: props.visibilityTargets.subCategories.map((subCategory) => ({ id: subCategory, visible: props.visible })),
    elements: props.visibilityTargets.elements.map((element) => ({ id: element, visible: props.visible })),
    models: props.visibilityTargets.models.map((model) => ({ id: model, visible: props.visible })),
  };
}

export function createCategoryHierarchyNode(categoryId: Id64String, hasChildren = false, modelId?: Id64String): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: "bis:SpatialCategory", id: categoryId }],
    },
    children: hasChildren,
    label: "",
    parentKeys: [],
    extendedData: {
      isCategory: true,
      modelId,
    },
  };
}
export function createModelHierarchyNode(modelId?: Id64String, hasChildren?: boolean): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: "bis:Model", id: modelId ?? "" }],
    },
    children: !!hasChildren,
    label: "",
    parentKeys: [],
    extendedData: {
      isModel: true,
      modelId: modelId ?? "0x1",
    },
  };
}

export function createElementHierarchyNode(props: {
  modelId: Id64String;
  categoryId: Id64String;
  hasChildren?: boolean;
  elementId: Id64String;
}): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: "bis:GeometricalElement3d", id: props.elementId ?? "" }],
    },
    children: !!props.hasChildren,
    label: "",
    parentKeys: [],
    extendedData: {
      modelId: props.modelId,
      categoryId: props.categoryId,
    },
  };
}

/** @internal */
export function createDefinitionContainerHierarchyNode(definitionContainerId: Id64String): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: "bis:DefinitionContainer", id: definitionContainerId }],
    },
    children: true,
    label: "",
    parentKeys: [],
    extendedData: {
      isDefinitionContainer: true,
    },
  };
}

export async function getVisibilityTargets(
  imodelAccess: IModelAccess,
): Promise<{ models: Id64Array; categories: Id64Array; subCategories: Id64Array; elements: Id64Array }> {
  const query: ECSqlQueryDef = {
    ecsql: `
      SELECT
        CAST(IdToHex(ECInstanceId) AS TEXT) AS ECInstanceId,
        'BisCore.GeometricElement3d' as ClassName
      FROM bis.GeometricElement3d
      UNION ALL
      SELECT
        CAST(IdToHex(ECInstanceId) AS TEXT) AS ECInstanceId,
        'BisCore.Model' as ClassName
      FROM bis.Model
      UNION ALL
      SELECT
        CAST(IdToHex(ECInstanceId) AS TEXT) AS ECInstanceId,
        'BisCore.SpatialCategory' as ClassName
      FROM bis.SpatialCategory
      UNION ALL
      SELECT
        CAST(IdToHex(ECInstanceId) AS TEXT) AS ECInstanceId,
        'BisCore.SubCategory' as ClassName
      FROM bis.SubCategory
    `,
  };
  const categories = new Array<Id64String>();
  const subCategories = new Array<Id64String>();
  const elements = new Array<Id64String>();
  const models = new Array<Id64String>();
  for await (const row of imodelAccess.createQueryReader(query, { limit: "unbounded" })) {
    if (row.ClassName.toLowerCase().includes("subcategory")) {
      subCategories.push(row.ECInstanceId);
      continue;
    }
    if (row.ClassName.toLowerCase().includes("category")) {
      categories.push(row.ECInstanceId);
      continue;
    }
    if (row.ClassName.toLowerCase().includes("element")) {
      elements.push(row.ECInstanceId);
      continue;
    }
    if (row.ClassName.toLowerCase().includes("model")) {
      models.push(row.ECInstanceId);
    }
  }
  return { categories, subCategories, elements, models };
}
