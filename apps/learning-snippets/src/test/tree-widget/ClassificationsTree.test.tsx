/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
// Alpha APIs are used throughout - line-level disables can't be used because they'd leak into the extracted README snippets.
/* eslint-disable import/no-duplicates, @itwin/no-internal */

import fs from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { UiFramework } from "@itwin/appui-react";
import { IModel } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";
// __PUBLISH_EXTRACT_START__ TreeWidget.ClassificationsTreeComponentImports
import { ClassificationsTreeComponent } from "@itwin/tree-widget-react";
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__ TreeWidget.SharedTreeContextProviderImports
import { SharedTreeContextProvider } from "@itwin/tree-widget-react";
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__ TreeWidget.ClassificationsTreeSelectionStorageImports
import type { SelectionStorage } from "@itwin/unified-selection";
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__ TreeWidget.ClassificationsTreeIModelImports
import type { IModelConnection } from "@itwin/core-frontend";
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__ TreeWidget.ClassificationsTreeSearchExampleImports
import { useMemo } from "react";
import { createTreeWidgetViewport, useClassificationsTree, VisibilityTree, VisibilityTreeRenderer } from "@itwin/tree-widget-react";
import type { Viewport } from "@itwin/core-frontend";
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__ TreeWidget.ClassificationsTreeInstanceSearchExampleImports
import { useClassificationsTreeDefinition } from "@itwin/tree-widget-react";
import type { InstanceKey } from "@itwin/presentation-shared";
// __PUBLISH_EXTRACT_END__
import { createStorage } from "@itwin/unified-selection";
import {
  createCode,
  importSchema,
  insertDefinitionSubModel,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertSpatialCategory,
} from "test-utilities";
import { withEditTxn } from "@itwin/core-backend";
import { buildIModel } from "../../utils/IModelUtils.js";
import { initializeLearningSnippetsTests, terminateLearningSnippetsTests } from "../../utils/InitializationUtils.js";
import { cleanup, getTestViewer, mockGetBoundingClientRect, render, renderHook, TreeWidgetTestUtils, waitFor } from "./TestUtils.js";

import type { IModelDb } from "@itwin/core-backend";

describe("Tree widget", () => {
  mockGetBoundingClientRect();
  describe("Learning snippets", () => {
    describe("Classifications tree", () => {
      beforeAll(async () => {
        await initializeLearningSnippetsTests();
        await TreeWidgetTestUtils.initialize();
      });

      afterAll(async () => {
        await terminateLearningSnippetsTests();
        TreeWidgetTestUtils.terminate();
      });

      it("configures the classifications tree component", async () => {
        const { imodelConnection } = await buildClassificationsIModel();
        const testViewport = getTestViewer(imodelConnection);
        const unifiedSelectionStorage = createStorage();
        vi.spyOn(IModelApp.viewManager, "selectedView", "get").mockReturnValue(testViewport);
        vi.spyOn(UiFramework, "getIModelConnection").mockReturnValue(imodelConnection);

        // __PUBLISH_EXTRACT_START__ TreeWidget.ClassificationsTreeExample
        interface MyClassificationsTreeProps {
          selectionStorage: SelectionStorage;
        }

        function MyClassificationsTree({ selectionStorage }: MyClassificationsTreeProps) {
          return (
            <SharedTreeContextProvider>
              <ClassificationsTreeComponent
                treeLabel="Classifications tree"
                selectionStorage={selectionStorage}
                hierarchyConfig={{ rootClassificationSystemCode: "My Classification System" }}
                emptyTreeContent={<>No classifications are available.</>}
              />
            </SharedTreeContextProvider>
          );
        }
        // __PUBLISH_EXTRACT_END__

        using _ = { [Symbol.dispose]: cleanup };
        const { getByText } = render(<MyClassificationsTree selectionStorage={unifiedSelectionStorage} />);
        await waitFor(() => getByText("Configured classification table"));
      });

      it("configures the classifications tree", async () => {
        const { imodelConnection } = await buildClassificationsIModel();
        const testViewport = getTestViewer(imodelConnection);
        const unifiedSelectionStorage = createStorage();
        vi.spyOn(IModelApp.viewManager, "selectedView", "get").mockReturnValue(testViewport);
        vi.spyOn(UiFramework, "getIModelConnection").mockReturnValue(imodelConnection);

        // __PUBLISH_EXTRACT_START__ TreeWidget.ClassificationsTreeConfigExample
        function ConfiguredClassificationsTree({ selectionStorage }: { selectionStorage: SelectionStorage }) {
          return (
            <SharedTreeContextProvider>
              <ClassificationsTreeComponent
                treeLabel="Configured classifications tree"
                selectionStorage={selectionStorage}
                hierarchyConfig={{
                  rootClassificationSystemCode: "My Classification System",
                  // Exclude instances of this class and its subclasses from the tree.
                  elements: { excludedClasses: ["BisCore.SpatialLocationElement"] },
                }}
                visibilityHandlerConfig={{
                  // Use a custom relationship to determine the categories related to a classification.
                  classificationToCategoriesRelationshipSpecification: {
                    fullClassName: "MySchema.ClassificationHasCategory",
                    source: "classification",
                  },
                }}
              />
            </SharedTreeContextProvider>
          );
        }
        // __PUBLISH_EXTRACT_END__

        using _ = { [Symbol.dispose]: cleanup };
        const { getByText } = render(<ConfiguredClassificationsTree selectionStorage={unifiedSelectionStorage} />);
        await waitFor(() => getByText("Configured classification table"));
      });

      it("configures classifications tree search", async () => {
        const { imodelConnection } = await buildClassificationsIModel();
        const testViewport = getTestViewer(imodelConnection);
        const unifiedSelectionStorage = createStorage();

        // __PUBLISH_EXTRACT_START__ TreeWidget.ClassificationsTreeSearchExample
        interface SearchableClassificationsTreeProps {
          imodel: IModelConnection;
          viewport: Viewport;
          selectionStorage: SelectionStorage;
          searchText: string;
        }

        function SearchableClassificationsTree({ imodel, viewport, selectionStorage, searchText }: SearchableClassificationsTreeProps) {
          return (
            <SharedTreeContextProvider>
              <SearchableClassificationsTreeContent imodel={imodel} viewport={viewport} selectionStorage={selectionStorage} searchText={searchText} />
            </SharedTreeContextProvider>
          );
        }

        function SearchableClassificationsTreeContent({ imodel, viewport, selectionStorage, searchText }: SearchableClassificationsTreeProps) {
          const activeView = useMemo(() => createTreeWidgetViewport(viewport), [viewport]);
          const { treeProps, getTreeItemProps } = useClassificationsTree({
            activeView,
            hierarchyConfig: { rootClassificationSystemCode: "My Classification System" },
            searchText,
            // Use "unbounded" instead when every match must be returned.
            searchLimit: 250,
          });

          return (
            <VisibilityTree
              {...treeProps}
              imodel={imodel}
              selectionStorage={selectionStorage}
              treeRenderer={(rendererProps) => (
                <VisibilityTreeRenderer
                  {...rendererProps}
                  treeLabel="Searchable classifications tree"
                  getTreeItemProps={(node) => getTreeItemProps(node, rendererProps)}
                />
              )}
            />
          );
        }
        // __PUBLISH_EXTRACT_END__

        using _ = { [Symbol.dispose]: cleanup };
        const { getAllByText } = render(
          <SearchableClassificationsTree
            imodel={imodelConnection}
            viewport={testViewport}
            selectionStorage={unifiedSelectionStorage}
            searchText="Configured classification"
          />,
        );
        await waitFor(() => expect(getAllByText("Configured classification").length).toBeGreaterThan(0));
      });

      it("searches a classifications tree by instance keys", async () => {
        const { imodelConnection, classification } = await buildClassificationsIModel();
        const searchPathsChanged = vi.fn();

        // __PUBLISH_EXTRACT_START__ TreeWidget.ClassificationsTreeInstanceSearchExample
        interface ClassificationsTreeDefinitionProps {
          imodel: IModelConnection;
          targetItems: InstanceKey[];
          onSearchPathsChanged: (pathsFound: boolean) => void;
        }

        function useMyClassificationsTreeDefinition({ imodel, targetItems, onSearchPathsChanged }: ClassificationsTreeDefinitionProps) {
          return useClassificationsTreeDefinition({
            imodels: [imodel],
            hierarchyConfig: { rootClassificationSystemCode: "My Classification System" },
            search: {
              targetItems,
              limit: 250,
            },
            onSearchPathsChanged: (paths) => onSearchPathsChanged(paths !== undefined && paths.length > 0),
          });
        }
        // __PUBLISH_EXTRACT_END__

        const { result } = renderHook(
          () =>
            useMyClassificationsTreeDefinition({
              imodel: imodelConnection,
              targetItems: [classification],
              onSearchPathsChanged: searchPathsChanged,
            }),
          { wrapper: SharedTreeContextProvider },
        );
        const searchPaths = await result.current.getSearchPaths?.({ abortSignal: new AbortController().signal });
        expect(searchPaths).not.toBeUndefined();
        expect(searchPaths?.length).toBeGreaterThan(0);
        expect(searchPathsChanged).toHaveBeenCalledWith(true);
      });

      it("merges classifications across iModel versions", async () => {
        const { imodelConnection, classification } = await buildClassificationsIModel();

        // __PUBLISH_EXTRACT_START__ TreeWidget.ClassificationsTreeMultipleIModelsExample
        interface VersionedClassificationsTreeDefinitionProps {
          imodelVersions: IModelConnection[];
          targetItems: InstanceKey[];
        }

        function useVersionedClassificationsTreeDefinition({ imodelVersions, targetItems }: VersionedClassificationsTreeDefinitionProps) {
          return useClassificationsTreeDefinition({
            // Supply versions from earliest to latest.
            imodels: imodelVersions,
            hierarchyConfig: { rootClassificationSystemCode: "My Classification System" },
            search: { targetItems, limit: "unbounded" },
          });
        }
        // __PUBLISH_EXTRACT_END__

        const { result } = renderHook(
          () =>
            useVersionedClassificationsTreeDefinition({
              // the same connection stands in for two versions - this only checks that multiple iModels are accepted
              imodelVersions: [imodelConnection, imodelConnection],
              targetItems: [classification],
            }),
          { wrapper: SharedTreeContextProvider },
        );
        const searchPaths = await result.current.getSearchPaths?.({ abortSignal: new AbortController().signal });
        expect(searchPaths?.length).toBeGreaterThan(0);
      });
    });

    async function importClassificationSchema(imodel: IModelDb) {
      const schemaPath = import.meta.resolve("@bentley/classification-systems-schema/ClassificationSystems.ecschema.xml");
      await imodel.importSchemaStrings([fs.readFileSync(fs.realpathSync(new URL(schemaPath)), { encoding: "utf-8" })]);
    }

    async function importClassificationRelationshipSchema(imodel: IModelDb) {
      await importSchema({
        imodel,
        schemaName: "MySchema",
        schemaAlias: "my",
        schemaContentXml: `
          <ECSchemaReference name="BisCore" version="01.00.16" alias="bis" />
          <ECSchemaReference name="ClassificationSystems" version="01.00.04" alias="clsf" />
          <ECRelationshipClass typeName="ClassificationHasCategory" modifier="None" strength="referencing">
            <BaseClass>bis:ElementRefersToElements</BaseClass>
            <Source multiplicity="(0..*)" roleLabel="has" polymorphic="true">
              <Class class="clsf:Classification" />
            </Source>
            <Target multiplicity="(0..*)" roleLabel="is used by" polymorphic="true">
              <Class class="bis:Category" />
            </Target>
          </ECRelationshipClass>
        `,
      });
    }

    async function buildClassificationsIModel() {
      return buildIModel(async (imodel) => {
        await importClassificationSchema(imodel);
        await importClassificationRelationshipSchema(imodel);
        return withEditTxn(imodel, (txn) => {
          const systemId = txn.insertElement({
            classFullName: "ClassificationSystems.ClassificationSystem",
            model: IModel.dictionaryId,
            code: createCode({ imodel, scopeId: IModel.dictionaryId, codeValue: "My Classification System" }),
          });
          const tableId = txn.insertElement({
            classFullName: "ClassificationSystems.ClassificationTable",
            model: IModel.dictionaryId,
            code: createCode({ imodel, scopeId: systemId, codeValue: "Configured classification table" }),
            parent: {
              id: systemId,
              relClassName: "ClassificationSystems.ClassificationSystemOwnsClassificationTable",
            },
          });
          insertDefinitionSubModel({
            txn,
            modeledElementId: tableId,
            relationshipName: "ClassificationSystems.DefinitionModelBreaksDownClassificationTable",
          });
          const classificationId = txn.insertElement({
            classFullName: "ClassificationSystems.Classification",
            model: tableId,
            code: createCode({ imodel, scopeId: tableId, codeValue: "Configured classification" }),
          });
          const physicalModel = insertPhysicalModelWithPartition({ txn, codeValue: "Configured physical model" });
          const elementCategory = insertSpatialCategory({ txn, codeValue: "Element category" });
          const element = insertPhysicalElement({
            txn,
            codeValue: "Configured classified element",
            userLabel: "Configured classified element",
            modelId: physicalModel.id,
            categoryId: elementCategory.id,
          });
          txn.insertRelationship({
            classFullName: "ClassificationSystems.ElementHasClassifications",
            sourceId: element.id,
            targetId: classificationId,
          });
          const customRelationshipCategory = insertSpatialCategory({ txn, codeValue: "Custom relationship category" });
          const customRelationshipModel = insertPhysicalModelWithPartition({ txn, codeValue: "Custom relationship model" });
          insertPhysicalElement({
            txn,
            userLabel: "Element in custom relationship category",
            modelId: customRelationshipModel.id,
            categoryId: customRelationshipCategory.id,
          });
          txn.insertRelationship({
            classFullName: "MySchema.ClassificationHasCategory",
            sourceId: classificationId,
            targetId: customRelationshipCategory.id,
          });
          const classification: InstanceKey = {
            className: "ClassificationSystems.Classification",
            id: classificationId,
          };
          return { classification };
        });
      });
    }
  });
});
