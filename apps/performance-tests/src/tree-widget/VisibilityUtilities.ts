/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { EMPTY, expand, from, mergeMap } from "rxjs";
import { Id64String } from "@itwin/core-bentley";
import { Code, ColorDef, IModel, RenderMode } from "@itwin/core-common";
import { IModelApp, IModelConnection, OffScreenViewport, SpatialViewState, Viewport, ViewRect } from "@itwin/core-frontend";
import { HierarchyNode } from "@itwin/presentation-hierarchies";
import { ECSqlQueryDef, InstanceKey } from "@itwin/presentation-shared";
import { toVoidPromise } from "@itwin/tree-widget-react/internal";
import { waitFor } from "@testing-library/react";
import { IModelAccess } from "./StatelessHierarchyProvider.js";

import type { HierarchyProvider, NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";
import type { HierarchyVisibilityHandler } from "@itwin/tree-widget-react";
export interface ValidateNodeProps {
  handler: HierarchyVisibilityHandler;
  viewport: Viewport;
  expectations: "all-visible" | "all-hidden";
}

async function validateNodeVisibility({ node, handler, expectations }: ValidateNodeProps & { node: HierarchyNode }) {
  const actualVisibility = await handler.getVisibilityStatus(node);
  expect(actualVisibility.state).to.eq(expectations === "all-hidden" ? "hidden" : "visible");
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
        models: testData.models.map((model) => model.id),
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

export function createTestDataForInitialDisplay(keys: InstanceKey[], visible = false) {
  const categories = new Array<VisibilityInfo>();
  const subCategories = new Array<VisibilityInfo>();
  const elements = new Array<VisibilityInfo>();
  const models = new Array<VisibilityInfo>();
  for (const key of keys) {
    if (key.className.toLowerCase().includes("subcategory")) {
      subCategories.push({ id: key.id, visible });
      continue;
    }
    if (key.className.toLowerCase().includes("category")) {
      categories.push({ id: key.id, visible });
      subCategories.push({ id: getDefaultSubCategoryId(key.id), visible });
      continue;
    }
    if (key.className.toLowerCase().includes("element")) {
      elements.push({ id: key.id, visible });
      continue;
    }
    if (key.className.toLowerCase().includes("model")) {
      models.push({ id: key.id, visible });
    }
  }
  return { categories, subCategories, elements, models };
}

function getDefaultSubCategoryId(categoryId: Id64String) {
  const categoryIdNumber = Number.parseInt(categoryId, 16);
  const subCategoryId = `0x${(categoryIdNumber + 1).toString(16)}`;
  return subCategoryId;
}

export function createCategoryHierarchyNode(categoryId: Id64String, hasChildren = false): NonGroupingHierarchyNode {
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

export async function getAllItems(imodelAccess: IModelAccess): Promise<Array<InstanceKey>> {
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
  const keys = new Array<InstanceKey>();
  for await (const row of imodelAccess.createQueryReader(query, { limit: "unbounded" })) {
    keys.push({ id: row.ECInstanceId, className: row.ClassName });
  }
  return keys;
}
