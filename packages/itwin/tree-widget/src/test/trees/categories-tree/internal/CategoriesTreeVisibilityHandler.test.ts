/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import type { Id64Array, Id64String } from "@itwin/core-bentley";
import { Code, ColorDef, IModel, IModelReadRpcInterface, RenderMode, SnapshotIModelRpcInterface } from "@itwin/core-common";
import { IModelApp, OffScreenViewport, SpatialViewState, ViewRect } from "@itwin/core-frontend";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { createIModelHierarchyProvider } from "@itwin/presentation-hierarchies";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
import {
  CategoriesTreeDefinition,
  defaultHierarchyConfiguration,
} from "../../../../tree-widget-react/components/trees/categories-tree/CategoriesTreeDefinition.js";
import { CategoriesTreeIdsCache } from "../../../../tree-widget-react/components/trees/categories-tree/internal/CategoriesTreeIdsCache.js";
import { createCategoriesTreeVisibilityHandler } from "../../../../tree-widget-react/components/trees/categories-tree/internal/CategoriesTreeVisibilityHandler.js";
import {
  buildIModel,
  insertDefinitionContainer,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertSpatialCategory,
  insertSubCategory,
  insertSubModel,
} from "../../../IModelUtils.js";
import { TestUtils, waitFor } from "../../../TestUtils.js";
import { createIModelAccess } from "../../Common.js";
import { createDefinitionContainerHierarchyNode, createSubCategoryHierarchyNode } from "./Utils.js";
import { validateHierarchyVisibility } from "./VisibilityValidation.js";

import type { InstanceKey } from "@itwin/presentation-common";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { CategoriesTreeHierarchyConfiguration } from "../../../../tree-widget-react/components/trees/categories-tree/CategoriesTreeDefinition.js";
import type { HierarchyNodeIdentifiersPath } from "@itwin/presentation-hierarchies";

describe("CategoriesTreeVisibilityHandler", () => {
  before(async () => {
    await initializePresentationTesting({
      backendProps: {
        caching: {
          hierarchies: {
            mode: HierarchyCacheMode.Memory,
          },
        },
      },
      rpcs: [SnapshotIModelRpcInterface, IModelReadRpcInterface, PresentationRpcInterface, ECSchemaRpcInterface],
    });
    await TestUtils.initialize();
    // eslint-disable-next-line @itwin/no-internal
    ECSchemaRpcImpl.register();
  });

  after(async () => {
    await terminatePresentationTesting();
    TestUtils.terminate();
  });

  async function createCommonProps({
    imodel,
    hierarchyConfig,
    categoryIds,
  }: {
    imodel: IModelConnection;
    hierarchyConfig: CategoriesTreeHierarchyConfiguration;
    categoryIds: Id64Array;
  }) {
    const imodelAccess = createIModelAccess(imodel);
    const idsCache = new CategoriesTreeIdsCache(imodelAccess, "3d");
    const viewport = OffScreenViewport.create({
      view: await createViewState(imodel, categoryIds),
      viewRect: new ViewRect(),
    });
    return {
      imodelAccess,
      viewport,
      idsCache,
      hierarchyConfig,
    };
  }

  function createProvider(props: {
    idsCache: CategoriesTreeIdsCache;
    imodelAccess: ReturnType<typeof createIModelAccess>;
    filterPaths?: HierarchyNodeIdentifiersPath[];
    hierarchyConfig: CategoriesTreeHierarchyConfiguration;
  }) {
    return createIModelHierarchyProvider({
      hierarchyDefinition: new CategoriesTreeDefinition({ ...props, viewType: "3d" }),
      imodelAccess: props.imodelAccess,
      ...(props.filterPaths ? { filtering: { paths: props.filterPaths } } : undefined),
    });
  }

  async function createVisibilityTestData({
    imodel,
    hierarchyConfig,
    categoryIds,
    testDataVisibilityInitializer,
  }: {
    imodel: IModelConnection;
    testDataVisibilityInitializer?: TestDataVisibilityInitializer;
    hierarchyConfig?: Partial<CategoriesTreeHierarchyConfiguration>;
    categoryIds: Id64Array;
  }) {
    const hierarchyConfiguration = {
      ...defaultHierarchyConfiguration,
      ...hierarchyConfig,
    };
    const commonProps = await createCommonProps({ imodel, hierarchyConfig: hierarchyConfiguration, categoryIds });
    const handler = createCategoriesTreeVisibilityHandler(commonProps);
    const provider = createProvider({ ...commonProps });
    testDataVisibilityInitializer?.initialize(commonProps.viewport);
    return {
      handler,
      provider,
      ...commonProps,
      [Symbol.dispose]() {
        commonProps.idsCache[Symbol.dispose]();
        commonProps.viewport.dispose();
        handler[Symbol.dispose]();
        provider[Symbol.dispose]();
      },
    };
  }

  describe("test1", () => {
    // let iModel1: IModelConnection;
    // let createdIds1: {
    //   definitionContainerRoot: InstanceKey;
    //   definitionContainerChild: InstanceKey;
    //   directCategory: InstanceKey;
    //   indirectCategory: InstanceKey;
    //   indirectSubCategory: InstanceKey;
    // };

    // before(async function () {
    //   const { imodel: imodel1, ...ids1 } = await buildIModel(this, async (builder) => {
    //     const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
    //     const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
    //     const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });

    //     const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
    //     const definitionModelChild = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });

    //     const directCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory1", modelId: definitionModelRoot.id });
    //     insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: directCategory.id });
    //     const indirectCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModelChild.id });
    //     insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });
    //     const indirectSubCategory = insertSubCategory({
    //       builder,
    //       parentCategoryId: indirectCategory.id,
    //       codeValue: "subCategory",
    //       modelId: definitionModelChild.id,
    //     });
    //     return { definitionContainerRoot, definitionContainerChild, directCategory, indirectCategory, indirectSubCategory };
    //   });
    //   iModel1 = imodel1;
    //   createdIds1 = ids1;
    // });

    // after(async () => {
    //   await iModel1.close();
    // });

    for (let i = 0; i < 150; ++i) {
      it(`showing definition container makes it and all of its contained elements visible ${i}`, async function () {
        await using buildIModelResultawait = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });

          const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
          const definitionModelChild = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });

          const directCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory1", modelId: definitionModelRoot.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: directCategory.id });
          const indirectCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModelChild.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });
          const indirectSubCategory = insertSubCategory({
            builder,
            parentCategoryId: indirectCategory.id,
            codeValue: "subCategory",
            modelId: definitionModelChild.id,
          });
          return { definitionContainerRoot, definitionContainerChild, directCategory, indirectCategory, indirectSubCategory };
        });
        const { imodel, ...keys } = buildIModelResultawait;
        const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
        using visibilityTestData = await createVisibilityTestData({
          imodel,
          categoryIds: getCategoryIds(keys),
          testDataVisibilityInitializer,
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerRoot.id), true);
        await waitFor(async () =>
          validateHierarchyVisibility({
            provider,
            handler,
            viewport,
            expectations: "all-visible",
          }),
        );
      });
      it(`showing subCategory makes it visible and parents partially visible ${i}`, async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });

          const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelRoot.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          const subCategory = insertSubCategory({
            builder,
            parentCategoryId: category.id,
            codeValue: "subCategory",
            modelId: definitionModelRoot.id,
          });
          return { category, subCategory, definitionContainerRoot };
        });
        const { imodel, ...keys } = buildIModelResult;
        const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
        using visibilityTestData = await createVisibilityTestData({
          imodel,
          categoryIds: getCategoryIds(keys),
          testDataVisibilityInitializer,
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), true);
        await waitFor(async () =>
          validateHierarchyVisibility({
            provider,
            handler,
            viewport,
            expectations: {
              [keys.definitionContainerRoot.id]: "partial",
              [keys.category.id]: "partial",
              [keys.subCategory.id]: "visible",
            },
          }),
        );
      });

      // it(`showing definition container makes it and all of its contained elements visible ${i}`, async function () {
      //   const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(createdIds1));
      //   using visibilityTestData = await createVisibilityTestData({
      //     imodel: iModel1,
      //     categoryIds: getCategoryIds(createdIds1),
      //     testDataVisibilityInitializer,
      //   });
      //   const { handler, provider, viewport } = visibilityTestData;

      //   await handler.changeVisibility(createDefinitionContainerHierarchyNode(createdIds1.definitionContainerRoot.id), true);
      //   await waitFor(async () =>
      //     validateHierarchyVisibility({
      //       provider,
      //       handler,
      //       viewport,
      //       expectations: "all-visible",
      //     }),
      //   );
      // });
    }
  });
  // describe("test2", () => {
  //   let iModel2: IModelConnection;
  //   let createdIds2: { category: InstanceKey; subCategory: InstanceKey; definitionContainerRoot: InstanceKey };

  //   before(async function () {
  //     const { imodel: imodel2, ...ids2 } = await buildIModel(this, async (builder) => {
  //       const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
  //       const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
  //       const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });

  //       const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelRoot.id });
  //       insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
  //       const subCategory = insertSubCategory({
  //         builder,
  //         parentCategoryId: category.id,
  //         codeValue: "subCategory",
  //         modelId: definitionModelRoot.id,
  //       });
  //       return { category, subCategory, definitionContainerRoot };
  //     });
  //     iModel2 = imodel2;
  //     createdIds2 = ids2;
  //   });

  //   after(async () => {
  //     await iModel2.close();
  //   });

  //   for (let i = 0; i < 500; ++i) {
  //     it(`showing subCategory makes it visible and parents partially visible ${i}`, async function () {
  //       const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(createdIds2));
  //       using visibilityTestData = await createVisibilityTestData({
  //         imodel: iModel2,
  //         categoryIds: getCategoryIds(createdIds2),
  //         testDataVisibilityInitializer,
  //       });
  //       const { handler, provider, viewport } = visibilityTestData;

  //       await handler.changeVisibility(createSubCategoryHierarchyNode(createdIds2.subCategory.id, createdIds2.category.id), true);
  //       await waitFor(async () =>
  //         validateHierarchyVisibility({
  //           provider,
  //           handler,
  //           viewport,
  //           expectations: {
  //             [createdIds2.definitionContainerRoot.id]: "partial",
  //             [createdIds2.category.id]: "partial",
  //             [createdIds2.subCategory.id]: "visible",
  //           },
  //         }),
  //       );
  //     });
  //   }
  // });
});

async function createViewState(iModel: IModelConnection, categoryIds: Id64Array) {
  const model = IModel.dictionaryId;
  const viewState = SpatialViewState.createFromProps(
    {
      categorySelectorProps: { categories: categoryIds, model, code: Code.createEmpty(), classFullName: "BisCore:CategorySelector" },
      displayStyleProps: { model, code: Code.createEmpty(), classFullName: "BisCore:DisplayStyle3d" },
      viewDefinitionProps: {
        model,
        code: Code.createEmpty(),
        categorySelectorId: "",
        classFullName: "BisCore:SpatialViewDefinition",
        displayStyleId: "",
      },
      modelSelectorProps: {
        models: [],
        code: Code.createEmpty(),
        model,
        classFullName: "BisCore:ModelSelector",
      },
    },
    iModel,
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
  return viewState;
}

interface VisibilityInfo {
  id: Id64String;
  visible: boolean;
}

class TestDataVisibilityInitializer {
  private _categories: Array<VisibilityInfo>;
  private _subCategories: Array<VisibilityInfo>;
  private _models: Array<VisibilityInfo>;
  private _elements: Array<VisibilityInfo>;
  constructor(props?: {
    categories?: Array<VisibilityInfo>;
    subCategories?: Array<VisibilityInfo>;
    models?: Array<VisibilityInfo>;
    elements?: Array<VisibilityInfo>;
  }) {
    this._categories = props?.categories ?? [];
    this._subCategories = props?.subCategories ?? [];
    this._models = props?.models ?? [];
    this._elements = props?.elements ?? [];
  }

  public initialize(viewport: Viewport): void {
    for (const subCategoryInfo of this._subCategories) {
      viewport.changeSubCategoryDisplay(subCategoryInfo.id, subCategoryInfo.visible);
    }
    for (const categoryInfo of this._categories) {
      viewport.changeCategoryDisplay(categoryInfo.id, categoryInfo.visible, false);
    }

    for (const elementInfo of this._elements) {
      if (elementInfo.visible) {
        viewport.alwaysDrawn?.add(elementInfo.id);
        continue;
      }
      viewport.neverDrawn?.add(elementInfo.id);
    }
    if (!viewport.alwaysDrawn) {
      viewport.setAlwaysDrawn(new Set(this._elements.filter(({ visible }) => visible).map(({ id }) => id)));
    }
    if (!viewport.neverDrawn) {
      viewport.setNeverDrawn(new Set(this._elements.filter(({ visible }) => !visible).map(({ id }) => id)));
    }
    for (const modelInfo of this._models) {
      viewport.changeModelDisplay(modelInfo.id, modelInfo.visible);
    }
  }
}

function createHiddenTestData(keys: { [key: string]: InstanceKey }) {
  const categories = new Array<VisibilityInfo>();
  const subCategories = new Array<VisibilityInfo>();
  const elements = new Array<VisibilityInfo>();
  const models = new Array<VisibilityInfo>();
  for (const key of Object.values(keys)) {
    if (key.className.toLowerCase().includes("subcategory")) {
      subCategories.push({ id: key.id, visible: false });
      continue;
    }
    if (key.className.toLowerCase().includes("category")) {
      categories.push({ id: key.id, visible: false });
      subCategories.push({ id: getDefaultSubCategoryId(key.id), visible: false });
      continue;
    }
    if (key.className.toLowerCase().includes("physicalobject")) {
      elements.push({ id: key.id, visible: false });
      continue;
    }
    if (key.className.toLowerCase().includes("model")) {
      models.push({ id: key.id, visible: false });
    }
  }
  return { categories, subCategories, elements, models };
}

function getDefaultSubCategoryId(categoryId: Id64String) {
  const categoryIdNumber = Number.parseInt(categoryId, 16);
  const subCategoryId = `0x${(categoryIdNumber + 1).toString(16)}`;
  return subCategoryId;
}

function getCategoryIds(keys: { [key: string]: InstanceKey }) {
  const categoryIds = new Array<Id64String>();
  for (const key of Object.values(keys)) {
    if (key.className.toLowerCase().includes("subcategory")) {
      continue;
    }
    if (key.className.toLowerCase().includes("category")) {
      categoryIds.push(key.id);
      continue;
    }
  }
  return categoryIds;
}
