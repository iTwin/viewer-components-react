/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { useCallback, useMemo } from "react";
import { UiFramework } from "@itwin/appui-react";
import { IModelApp } from "@itwin/core-frontend";
import { createTreeWidgetViewport, SharedTreeContextProvider, useModelsTree, VisibilityTree, VisibilityTreeRenderer } from "@itwin/tree-widget-react";
import { createStorage } from "@itwin/unified-selection";
import { insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory } from "test-utilities";
import { buildIModel } from "../../utils/IModelUtils.js";
import { initializeLearningSnippetsTests, terminateLearningSnippetsTests } from "../../utils/InitializationUtils.js";
import { cleanup, getTestViewer, mockGetBoundingClientRect, render, TreeWidgetTestUtils, waitFor } from "./TestUtils.js";

import type { SelectionStorage } from "@itwin/unified-selection";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { InstanceKey, Props } from "@itwin/presentation-shared";
import { withEditTxn } from "@itwin/core-backend";

// __PUBLISH_EXTRACT_START__ TreeWidget.GetSubTreePathsComponentWithTargetItemsExample
type UseModelsTreeProps = Props<typeof useModelsTree>;
type GetSubTreePathsType = NonNullable<UseModelsTreeProps["getSubTreePaths"]>;

function CustomModelsTreeComponentWithTargetItems({
  viewport,
  selectionStorage,
  imodel,
  targetItems,
}: {
  viewport: Viewport;
  selectionStorage: SelectionStorage;
  imodel: IModelConnection;
  targetItems: InstanceKey[];
}) {
  const getSubTreePaths = useCallback<GetSubTreePathsType>(
    async ({ createInstanceKeyPaths }) => {
      return createInstanceKeyPaths({
        // List of instance keys representing nodes that should be part of the hierarchy.
        // Only these nodes, their ancestors and children will be part of that hierarchy.
        targetItems,
      });
    },
    [targetItems],
  );

  const activeView = useMemo(() => createTreeWidgetViewport(viewport), [viewport]);
  const { treeProps, getTreeItemProps } = useModelsTree({ activeView, getSubTreePaths });

  return (
    <VisibilityTree
      {...treeProps}
      selectionStorage={selectionStorage}
      imodel={imodel}
      treeRenderer={(rendererProps) => (
        <VisibilityTreeRenderer {...rendererProps} treeLabel="Custom models tree" getTreeItemProps={(node) => getTreeItemProps(node, rendererProps)} />
      )}
    />
  );
}
// __PUBLISH_EXTRACT_END__

describe("Tree widget", () => {
  mockGetBoundingClientRect();
  describe("Learning snippets", () => {
    describe("Components", () => {
      describe("SubTree paths", () => {
        beforeAll(async () => {
          await initializeLearningSnippetsTests();
          await TreeWidgetTestUtils.initialize();
        });

        afterAll(async () => {
          await terminateLearningSnippetsTests();
          TreeWidgetTestUtils.terminate();
        });

        it("renders custom models tree component with filtered paths using targetItems", async () => {
          const { imodelConnection, ...keys } = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const physicalModel = insertPhysicalModelWithPartition({ txn, codeValue: "TestPhysicalModel" });
              const physicalModel2 = insertPhysicalModelWithPartition({ txn, codeValue: "TestPhysicalModel 2" });
              const category = insertSpatialCategory({ txn, codeValue: "Test SpatialCategory" });
              insertPhysicalElement({ txn, modelId: physicalModel.id, categoryId: category.id });
              const category2 = insertSpatialCategory({ txn, codeValue: "Test SpatialCategory 2" });
              insertPhysicalElement({ txn, modelId: physicalModel2.id, categoryId: category2.id });
              return { physicalModel, physicalModel2 };
            }),
          );
          const testViewport = getTestViewer(imodelConnection, true);
          const unifiedSelectionStorage = createStorage();
          vi.spyOn(IModelApp.viewManager, "selectedView", "get").mockReturnValue(testViewport);
          vi.spyOn(UiFramework, "getIModelConnection").mockReturnValue(imodelConnection);

          using _ = { [Symbol.dispose]: cleanup };
          const { getByText, queryByText } = render(
            <SharedTreeContextProvider>
              <CustomModelsTreeComponentWithTargetItems
                selectionStorage={unifiedSelectionStorage}
                imodel={imodelConnection}
                viewport={testViewport}
                targetItems={[keys.physicalModel]}
              />
            </SharedTreeContextProvider>,
          );

          await waitFor(() => {
            getByText("TestPhysicalModel");
            expect(queryByText("TestPhysicalModel 2")).toBeNull();
          });
        });
      });
    });
  });
});
