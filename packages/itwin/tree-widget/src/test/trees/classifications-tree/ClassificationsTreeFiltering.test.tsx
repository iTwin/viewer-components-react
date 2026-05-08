/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory } from "test-utilities";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useClassificationsTreeDefinition } from "../../../tree-widget-react/components/trees/classifications-tree/UseClassificationsTreeDefinition.js";
import {
  CLASS_NAME_Classification,
  CLASS_NAME_ClassificationTable,
  CLASS_NAME_GeometricElement3d,
} from "../../../tree-widget-react/components/trees/common/internal/ClassNameDefinitions.js";
import { SharedTreeContextProvider } from "../../../tree-widget-react/components/trees/common/SharedTreeContextProvider.js";
import { buildIModel } from "../../IModelUtils.js";
import { initializeITwinJs, terminateITwinJs } from "../../Initialize.js";
import {
  importClassificationSchema,
  insertClassification,
  insertClassificationSystem,
  insertClassificationTable,
  insertElementHasClassificationsRelationship,
} from "./Utils.js";

import type { Props } from "@itwin/presentation-shared";

const rootClassificationSystemCode = "TestClassificationSystem";
const defaultHierarchyConfiguration = {
  rootClassificationSystemCode,
};

describe("Classifications tree", () => {
  describe("Hierarchy search", () => {
    beforeAll(async () => {
      await initializeITwinJs();
    });

    afterAll(async () => {
      await terminateITwinJs();
    });

    ["Test", "_", "%"].forEach((label) => {
      it(`finds classification table by label when it contains '${label}'`, async function () {
        await using buildIModelResult = await buildIModel(async (imodel) => {
          await importClassificationSchema(imodel);

          const system = insertClassificationSystem({ imodel, codeValue: rootClassificationSystemCode });
          const table = insertClassificationTable({ imodel, parentId: system.id, codeValue: "ClassificationTable", userLabel: `${label}Table` });
          const classification = insertClassification({ imodel, modelId: table.id, codeValue: "Classification" });
          const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "Model" });
          const spatialCategory = insertSpatialCategory({ imodel, codeValue: "Category" });
          const element = insertPhysicalElement({
            imodel,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            codeValue: "Element",
          });
          insertElementHasClassificationsRelationship({ imodel, elementId: element.id, classificationId: classification.id });

          return { table };
        });
        const { imodelConnection, ...keys } = buildIModelResult;
        using hook = renderUseClassificationsTreeDefinitionHook({
          imodels: [imodelConnection],
          hierarchyConfig: defaultHierarchyConfiguration,
          search: { searchText: label },
        });
        expect(await act(async () => hook.result.current.getSearchPaths?.({ abortSignal: new AbortController().signal }))).toEqual([
          {
            identifier: { id: keys.table.id, className: CLASS_NAME_ClassificationTable },
            options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } },
          },
        ]);
      });

      it(`finds classification by label when it contains '${label}'`, async function () {
        await using buildIModelResult = await buildIModel(async (imodel) => {
          await importClassificationSchema(imodel);

          const system = insertClassificationSystem({ imodel, codeValue: rootClassificationSystemCode });
          const table = insertClassificationTable({ imodel, parentId: system.id, codeValue: "ClassificationTable" });
          const classification = insertClassification({ imodel, modelId: table.id, codeValue: "Classification", userLabel: `${label}Cl` });
          const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "Model" });
          const spatialCategory = insertSpatialCategory({ imodel, codeValue: "Category" });
          const element = insertPhysicalElement({
            imodel,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            codeValue: "Element",
          });
          insertElementHasClassificationsRelationship({ imodel, elementId: element.id, classificationId: classification.id });

          return { table, classification };
        });
        const { imodelConnection, ...keys } = buildIModelResult;
        using hook = renderUseClassificationsTreeDefinitionHook({
          imodels: [imodelConnection],
          hierarchyConfig: defaultHierarchyConfiguration,
          search: { searchText: label },
        });
        expect(await act(async () => hook.result.current.getSearchPaths?.({ abortSignal: new AbortController().signal }))).toEqual([
          {
            identifier: { id: keys.table.id, className: CLASS_NAME_ClassificationTable },
            options: { autoExpand: true },
            children: [
              {
                identifier: { id: keys.classification.id, className: CLASS_NAME_Classification },
                options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } },
              },
            ],
          },
        ]);
      });

      it(`finds 3d element by label when it contains '${label}'`, async function () {
        await using buildIModelResult = await buildIModel(async (imodel) => {
          await importClassificationSchema(imodel);

          const system = insertClassificationSystem({ imodel, codeValue: rootClassificationSystemCode });
          const table = insertClassificationTable({ imodel, parentId: system.id, codeValue: "ClassificationTable" });
          const classification = insertClassification({ imodel, modelId: table.id, codeValue: "Classification" });
          const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "Model" });
          const spatialCategory = insertSpatialCategory({ imodel, codeValue: "Category" });
          const element = insertPhysicalElement({
            imodel,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            codeValue: "Element",
            userLabel: `${label}El`,
          });
          insertElementHasClassificationsRelationship({ imodel, elementId: element.id, classificationId: classification.id });

          return { table, classification, element };
        });
        const { imodelConnection, ...keys } = buildIModelResult;
        using hook = renderUseClassificationsTreeDefinitionHook({
          imodels: [imodelConnection],
          hierarchyConfig: defaultHierarchyConfiguration,
          search: { searchText: label },
        });
        expect(await act(async () => hook.result.current.getSearchPaths?.({ abortSignal: new AbortController().signal }))).toEqual([
          {
            identifier: { id: keys.table.id, className: CLASS_NAME_ClassificationTable },
            options: { autoExpand: true },
            children: [
              {
                identifier: { id: keys.classification.id, className: CLASS_NAME_Classification },
                options: { autoExpand: true },
                children: [
                  {
                    identifier: { id: keys.element.id, className: CLASS_NAME_GeometricElement3d },
                    options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } },
                  },
                ],
              },
            ],
          },
        ]);
      });

      it(`finds 3d child element by label when it contains '${label}'`, async function () {
        await using buildIModelResult = await buildIModel(async (imodel) => {
          await importClassificationSchema(imodel);

          const system = insertClassificationSystem({ imodel, codeValue: rootClassificationSystemCode });
          const table = insertClassificationTable({ imodel, parentId: system.id, codeValue: "ClassificationTable" });
          const classification = insertClassification({ imodel, modelId: table.id, codeValue: "Classification" });
          const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "Model" });
          const spatialCategory = insertSpatialCategory({ imodel, codeValue: "Category" });
          const parentElement = insertPhysicalElement({
            imodel,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            codeValue: "Parent Element",
          });
          insertElementHasClassificationsRelationship({ imodel, elementId: parentElement.id, classificationId: classification.id });
          const childElement = insertPhysicalElement({
            imodel,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            codeValue: "Child Element",
            userLabel: `${label}ChildEl`,
            parentId: parentElement.id,
          });

          return { table, classification, parentElement, childElement };
        });
        const { imodelConnection, ...keys } = buildIModelResult;
        using hook = renderUseClassificationsTreeDefinitionHook({
          imodels: [imodelConnection],
          hierarchyConfig: defaultHierarchyConfiguration,
          search: { searchText: label },
        });
        expect(await act(async () => hook.result.current.getSearchPaths?.({ abortSignal: new AbortController().signal }))).toEqual([
          {
            identifier: { id: keys.table.id, className: CLASS_NAME_ClassificationTable },
            options: { autoExpand: true },
            children: [
              {
                identifier: { id: keys.classification.id, className: CLASS_NAME_Classification },
                options: { autoExpand: true },
                children: [
                  {
                    identifier: { id: keys.parentElement.id, className: CLASS_NAME_GeometricElement3d },
                    options: { autoExpand: true },
                    children: [
                      {
                        identifier: { id: keys.childElement.id, className: CLASS_NAME_GeometricElement3d },
                        options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ]);
      });
    });

    describe("by instance key", () => {
      it("finds classifications table", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) => {
          await importClassificationSchema(imodel);

          const system = insertClassificationSystem({ imodel, codeValue: rootClassificationSystemCode });
          const table1 = insertClassificationTable({ imodel, parentId: system.id, codeValue: "ClassificationTable1" });
          const classification1 = insertClassification({ imodel, modelId: table1.id, codeValue: "Classification1" });
          const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "Model1" });
          const spatialCategory = insertSpatialCategory({ imodel, codeValue: "Category1" });
          const element1 = insertPhysicalElement({
            imodel,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            codeValue: "Element1",
            userLabel: "Element1",
          });
          insertElementHasClassificationsRelationship({ imodel, elementId: element1.id, classificationId: classification1.id });

          const table2 = insertClassificationTable({ imodel, parentId: system.id, codeValue: "ClassificationTable2" });
          const classification2 = insertClassification({ imodel, modelId: table2.id, codeValue: "Classification2" });
          const element2 = insertPhysicalElement({
            imodel,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            codeValue: "Element2",
            userLabel: "Element2",
          });
          insertElementHasClassificationsRelationship({ imodel, elementId: element2.id, classificationId: classification2.id });

          return { table1, table2 };
        });
        const { imodelConnection, ...keys } = buildIModelResult;
        using hook = renderUseClassificationsTreeDefinitionHook({
          imodels: [imodelConnection],
          hierarchyConfig: defaultHierarchyConfiguration,
          search: { targetItems: [keys.table2] },
        });
        expect(await act(async () => hook.result.current.getSearchPaths?.({ abortSignal: new AbortController().signal }))).toEqual([
          {
            identifier: { id: keys.table2.id, className: CLASS_NAME_ClassificationTable },
            options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } },
          },
        ]);
      });

      it("finds classifications", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) => {
          await importClassificationSchema(imodel);

          const system = insertClassificationSystem({ imodel, codeValue: rootClassificationSystemCode });
          const table1 = insertClassificationTable({ imodel, parentId: system.id, codeValue: "ClassificationTable1" });
          const classification1 = insertClassification({ imodel, modelId: table1.id, codeValue: "Classification1" });
          const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "Model1" });
          const spatialCategory = insertSpatialCategory({ imodel, codeValue: "Category1" });
          const element1 = insertPhysicalElement({
            imodel,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            codeValue: "Element1",
            userLabel: "Element1",
          });
          insertElementHasClassificationsRelationship({ imodel, elementId: element1.id, classificationId: classification1.id });

          const table2 = insertClassificationTable({ imodel, parentId: system.id, codeValue: "ClassificationTable2" });
          const classification2 = insertClassification({ imodel, modelId: table2.id, codeValue: "Classification2" });
          const element2 = insertPhysicalElement({
            imodel,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            codeValue: "Element2",
            userLabel: "Element2",
          });
          insertElementHasClassificationsRelationship({ imodel, elementId: element2.id, classificationId: classification2.id });

          return { table1, table2, classification1, classification2 };
        });
        const { imodelConnection, ...keys } = buildIModelResult;
        using hook = renderUseClassificationsTreeDefinitionHook({
          imodels: [imodelConnection],
          hierarchyConfig: defaultHierarchyConfiguration,
          search: { targetItems: [keys.classification2] },
        });
        expect(await act(async () => hook.result.current.getSearchPaths?.({ abortSignal: new AbortController().signal }))).toEqual([
          {
            identifier: { id: keys.table2.id, className: CLASS_NAME_ClassificationTable },
            options: { autoExpand: true },
            children: [
              {
                identifier: { id: keys.classification2.id, className: CLASS_NAME_Classification },
                options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } },
              },
            ],
          },
        ]);
      });

      it("finds geometric element 3d", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) => {
          await importClassificationSchema(imodel);

          const system = insertClassificationSystem({ imodel, codeValue: rootClassificationSystemCode });
          const table1 = insertClassificationTable({ imodel, parentId: system.id, codeValue: "ClassificationTable1" });
          const classification1 = insertClassification({ imodel, modelId: table1.id, codeValue: "Classification1" });
          const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "Model1" });
          const spatialCategory = insertSpatialCategory({ imodel, codeValue: "Category1" });
          const element1 = insertPhysicalElement({
            imodel,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            codeValue: "Element1",
            userLabel: "Element1",
          });
          insertElementHasClassificationsRelationship({ imodel, elementId: element1.id, classificationId: classification1.id });

          const table2 = insertClassificationTable({ imodel, parentId: system.id, codeValue: "ClassificationTable2" });
          const classification2 = insertClassification({ imodel, modelId: table2.id, codeValue: "Classification2" });
          const element2 = insertPhysicalElement({
            imodel,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            codeValue: "Element2",
            userLabel: "Element2",
          });
          insertElementHasClassificationsRelationship({ imodel, elementId: element2.id, classificationId: classification2.id });

          return { table1, table2, classification1, classification2, element1, element2 };
        });
        const { imodelConnection, ...keys } = buildIModelResult;
        using hook = renderUseClassificationsTreeDefinitionHook({
          imodels: [imodelConnection],
          hierarchyConfig: defaultHierarchyConfiguration,
          search: { targetItems: [keys.element2] },
        });
        expect(await act(async () => hook.result.current.getSearchPaths?.({ abortSignal: new AbortController().signal }))).toEqual([
          {
            identifier: { id: keys.table2.id, className: CLASS_NAME_ClassificationTable },
            options: { autoExpand: true },
            children: [
              {
                identifier: { id: keys.classification2.id, className: CLASS_NAME_Classification },
                options: { autoExpand: true },
                children: [
                  {
                    identifier: { id: keys.element2.id, className: CLASS_NAME_GeometricElement3d },
                    options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } },
                  },
                ],
              },
            ],
          },
        ]);
      });

      it("finds child geometric element 3d", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) => {
          await importClassificationSchema(imodel);

          const system = insertClassificationSystem({ imodel, codeValue: rootClassificationSystemCode });
          const table1 = insertClassificationTable({ imodel, parentId: system.id, codeValue: "ClassificationTable1" });
          const classification1 = insertClassification({ imodel, modelId: table1.id, codeValue: "Classification1" });
          const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "Model1" });
          const spatialCategory = insertSpatialCategory({ imodel, codeValue: "Category1" });
          const element1 = insertPhysicalElement({
            imodel,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            codeValue: "Element1",
            userLabel: "Element1",
          });
          insertElementHasClassificationsRelationship({ imodel, elementId: element1.id, classificationId: classification1.id });

          const table2 = insertClassificationTable({ imodel, parentId: system.id, codeValue: "ClassificationTable2" });
          const classification2 = insertClassification({ imodel, modelId: table2.id, codeValue: "Classification2" });
          const element2 = insertPhysicalElement({
            imodel,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            codeValue: "element",
            userLabel: "Element2",
          });

          insertElementHasClassificationsRelationship({ imodel, elementId: element2.id, classificationId: classification2.id });
          const childElement = insertPhysicalElement({
            imodel,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            codeValue: "Child Element",
            userLabel: `ChildEl2`,
            parentId: element2.id,
          });

          return { table1, table2, classification1, classification2, element1, element2, childElement };
        });
        const { imodelConnection, ...keys } = buildIModelResult;
        using hook = renderUseClassificationsTreeDefinitionHook({
          imodels: [imodelConnection],
          hierarchyConfig: defaultHierarchyConfiguration,
          search: { targetItems: [keys.childElement] },
        });
        expect(await act(async () => hook.result.current.getSearchPaths?.({ abortSignal: new AbortController().signal }))).toEqual([
          {
            identifier: { id: keys.table2.id, className: CLASS_NAME_ClassificationTable },
            options: { autoExpand: true },
            children: [
              {
                identifier: { id: keys.classification2.id, className: CLASS_NAME_Classification },
                options: { autoExpand: true },
                children: [
                  {
                    identifier: { id: keys.element2.id, className: CLASS_NAME_GeometricElement3d },
                    options: { autoExpand: true },
                    children: [
                      {
                        identifier: { id: keys.childElement.id, className: CLASS_NAME_GeometricElement3d },
                        options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ]);
      });
    });

    it("returns empty array when nothing matches provided search text", async () => {
      await using buildIModelResult = await buildIModel(async (imodel) => {
        await importClassificationSchema(imodel);

        const system = insertClassificationSystem({ imodel, codeValue: rootClassificationSystemCode });
        const table = insertClassificationTable({ imodel, parentId: system.id, codeValue: "ClassificationTable" });
        const classification = insertClassification({ imodel, modelId: table.id, codeValue: "Classification" });
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "physical model" });
        const spatialCategory = insertSpatialCategory({ imodel, codeValue: "physical category" });
        const physicalElement = insertPhysicalElement({
          imodel,
          modelId: physicalModel.id,
          categoryId: spatialCategory.id,
          codeValue: "Physical element",
        });
        insertElementHasClassificationsRelationship({ imodel, elementId: physicalElement.id, classificationId: classification.id });
      });
      const { imodelConnection } = buildIModelResult;
      using hook = renderUseClassificationsTreeDefinitionHook({
        imodels: [imodelConnection],
        hierarchyConfig: defaultHierarchyConfiguration,
        search: { searchText: "Test" },
      });
      expect(await act(async () => hook.result.current.getSearchPaths?.({ abortSignal: new AbortController().signal }))).toEqual([]);
    });

    it("aborts when abort signal fires", async () => {
      await using buildIModelResult = await buildIModel(async (imodel) => {
        await importClassificationSchema(imodel);

        const system = insertClassificationSystem({ imodel, codeValue: rootClassificationSystemCode });
        const table = insertClassificationTable({ imodel, parentId: system.id, codeValue: "ClassificationTable", userLabel: `TestTable` });
        const classification = insertClassification({ imodel, modelId: table.id, codeValue: "Classification" });
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "physical model" });
        const spatialCategory = insertSpatialCategory({ imodel, codeValue: "physical category" });
        const physicalElement = insertPhysicalElement({
          imodel,
          modelId: physicalModel.id,
          categoryId: spatialCategory.id,
          codeValue: "Physical element",
        });
        insertElementHasClassificationsRelationship({ imodel, elementId: physicalElement.id, classificationId: classification.id });
        return { classificationTable: table };
      });
      const { imodelConnection, ...ids } = buildIModelResult;
      using hook = renderUseClassificationsTreeDefinitionHook({
        imodels: [imodelConnection],
        hierarchyConfig: defaultHierarchyConfiguration,
        search: { searchText: "Test" },
      });

      const abortController1 = new AbortController();
      const pathsPromiseAborted = act(async () => hook.result.current.getSearchPaths?.({ abortSignal: abortController1.signal }));
      abortController1.abort();
      expect(await pathsPromiseAborted).toEqual([]);

      const abortController2 = new AbortController();
      const pathsPromise = act(async () => hook.result.current.getSearchPaths?.({ abortSignal: abortController2.signal }));
      expect(await pathsPromise).toEqual([
        {
          identifier: { className: ids.classificationTable.className, id: ids.classificationTable.id },
          options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } },
        },
      ]);
    });
  });
});

function renderUseClassificationsTreeDefinitionHook(props: Props<typeof useClassificationsTreeDefinition>) {
  const result = renderHook((hookProps) => useClassificationsTreeDefinition(hookProps), {
    initialProps: props,
    wrapper: ({ children }) => <SharedTreeContextProvider>{children}</SharedTreeContextProvider>,
  });
  return { ...result, [Symbol.dispose]: () => result.unmount() };
}
