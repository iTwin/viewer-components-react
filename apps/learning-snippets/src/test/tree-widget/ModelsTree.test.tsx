/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable import/no-duplicates */

import { afterAll, beforeAll, describe, it, vi } from "vitest";
import { UiFramework } from "@itwin/appui-react";
import { IModel } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";
// __PUBLISH_EXTRACT_START__ TreeWidget.ModelsTreeExampleImports
import { ModelsTreeComponent } from "@itwin/tree-widget-react";
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__ TreeWidget.CustomModelsTreeExampleImports
import { useCallback } from "react";
import { TreeWithHeader, useModelsTree, useModelsTreeButtonProps, VisibilityTree, VisibilityTreeRenderer } from "@itwin/tree-widget-react";
import type { SelectionStorage } from "@itwin/unified-selection";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { SchemaContext } from "@itwin/ecschema-metadata";
import type { ComponentPropsWithoutRef } from "react";
// __PUBLISH_EXTRACT_END__
import { createStorage } from "@itwin/unified-selection";
import { cleanup, render, waitFor } from "@testing-library/react";
import { insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory, insertSubject } from "test-utilities";
import { buildIModel } from "../../utils/IModelUtils.js";
import { initializeLearningSnippetsTests, terminateLearningSnippetsTests } from "../../utils/InitializationUtils.js";
import { getSchemaContext as getTestSchemaContext, getTestViewer, mockGetBoundingClientRect, TreeWidgetTestUtils } from "../../utils/TreeWidgetTestUtils.js";

import type { InstanceKey } from "@itwin/presentation-common";

describe("Tree widget", () => {
  mockGetBoundingClientRect();
  describe("Learning snippets", () => {
    describe("Components", () => {
      describe("Models tree", () => {
        beforeAll(async () => {
          await initializeLearningSnippetsTests();
          await TreeWidgetTestUtils.initialize();
        });

        afterAll(async () => {
          await terminateLearningSnippetsTests();
          TreeWidgetTestUtils.terminate();
        });

        it("renders <ModelsTreeComponent />", async () => {
          const { imodelConnection } = await buildIModel(async (imodel) => {
            const model = insertPhysicalModelWithPartition({ imodel, codeValue: "Test model X", partitionParentId: IModel.rootSubjectId });
            const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory" });
            insertPhysicalElement({ imodel, userLabel: `element`, modelId: model.id, categoryId: category.id });
            return { model };
          });
          const testViewport = getTestViewer(imodelConnection, true);
          const unifiedSelectionStorage = createStorage();
          vi.spyOn(IModelApp.viewManager, "selectedView", "get").mockReturnValue(testViewport);
          vi.spyOn(UiFramework, "getIModelConnection").mockReturnValue(imodelConnection);
          const getSchemaContext = getTestSchemaContext;

          // __PUBLISH_EXTRACT_START__ TreeWidget.ModelsTreeExample
          function MyWidget() {
            return (
              <ModelsTreeComponent
                // see "Creating schema context" section for example implementation
                getSchemaContext={getSchemaContext}
                // see "Creating unified selection storage" section for example implementation
                selectionStorage={unifiedSelectionStorage}
                headerButtons={[
                  (props) => <ModelsTreeComponent.ShowAllButton {...props} key={"ShowAllButton"} />,
                  (props) => <ModelsTreeComponent.HideAllButton {...props} key={"HideAllButton"} />,
                ]}
              />
            );
          }
          // __PUBLISH_EXTRACT_END__

          using _ = { [Symbol.dispose]: cleanup };
          const { getByText } = render(<MyWidget />);
          await waitFor(async () => getByText("Test model X"));
        });

        it("renders custom models tree", async function () {
          const { imodelConnection } = await buildIModel(async (imodel) => {
            const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };
            const childSubject = insertSubject({
              imodel,
              codeValue: "Test subject X",
              parentId: rootSubject.id,
            });
            const model = insertPhysicalModelWithPartition({ imodel, codeValue: "model", partitionParentId: childSubject.id });
            insertPhysicalElement({
              imodel,
              userLabel: `element`,
              modelId: model.id,
              categoryId: insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory" }).id,
            });
            return { model, childSubject };
          });
          const testViewport = getTestViewer(imodelConnection, true);
          const unifiedSelectionStorage = createStorage();
          vi.spyOn(IModelApp.viewManager, "selectedView", "get").mockReturnValue(testViewport);
          vi.spyOn(UiFramework, "getIModelConnection").mockReturnValue(imodelConnection);

          // __PUBLISH_EXTRACT_START__ TreeWidget.CustomModelsTreeExample
          type VisibilityTreeRendererProps = ComponentPropsWithoutRef<typeof VisibilityTreeRenderer>;
          type CustomModelsTreeRendererProps = Parameters<ComponentPropsWithoutRef<typeof VisibilityTree>["treeRenderer"]>[0];
          function CustomModelsTreeRenderer(props: CustomModelsTreeRendererProps) {
            const getLabel = props.getLabel;
            const getLabelCallback = useCallback<Required<VisibilityTreeRendererProps>["getLabel"]>(
              (node) => {
                const originalLabel = getLabel(node);
                return <>Custom node - {originalLabel}</>;
              },
              [getLabel],
            );
            const getSublabelCallback = useCallback<Required<VisibilityTreeRendererProps>["getSublabel"]>((node) => <>Sublabel - {node.label}</>, []);
            return <VisibilityTreeRenderer {...props} getLabel={getLabelCallback} getSublabel={getSublabelCallback} />;
          }

          interface CustomModelsTreeProps {
            imodel: IModelConnection;
            viewport: Viewport;
            getSchemaContext: (imodel: IModelConnection) => SchemaContext;
            selectionStorage: SelectionStorage;
          }

          function CustomModelsTreeComponent({ imodel, viewport, getSchemaContext, selectionStorage }: CustomModelsTreeProps) {
            const { buttonProps } = useModelsTreeButtonProps({ imodel, viewport });
            const { modelsTreeProps, rendererProps } = useModelsTree({ activeView: viewport });

            return (
              <TreeWithHeader
                buttons={[
                  <ModelsTreeComponent.ShowAllButton {...buttonProps} key={"ShowAllButton"} />,
                  <ModelsTreeComponent.HideAllButton {...buttonProps} key={"HideAllButton"} />,
                ]}
              >
                <VisibilityTree
                  {...modelsTreeProps}
                  getSchemaContext={getSchemaContext}
                  selectionStorage={selectionStorage}
                  imodel={imodel}
                  treeRenderer={(props) => <CustomModelsTreeRenderer {...props} {...rendererProps} />}
                />
              </TreeWithHeader>
            );
          }
          // __PUBLISH_EXTRACT_END__

          using _ = { [Symbol.dispose]: cleanup };
          const { getByText } = render(
            <CustomModelsTreeComponent
              imodel={imodelConnection}
              viewport={testViewport}
              getSchemaContext={getTestSchemaContext}
              selectionStorage={unifiedSelectionStorage}
            />,
          );
          await waitFor(() => {
            getByText("Test subject X");
            getByText("Sublabel - Test subject X");
          });
        });
      });
    });
  });
});
