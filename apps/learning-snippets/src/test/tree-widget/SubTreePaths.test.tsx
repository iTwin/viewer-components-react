/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { useCallback } from "react";
import { UiFramework } from "@itwin/appui-react";
import { IModelApp } from "@itwin/core-frontend";
import { useModelsTree, VisibilityTree, VisibilityTreeRenderer } from "@itwin/tree-widget-react";
import { createStorage } from "@itwin/unified-selection";
import { cleanup, render, waitFor } from "@testing-library/react";
import { insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory } from "test-utilities";
import { buildIModel } from "../../utils/IModelUtils.js";
import { initializeLearningSnippetsTests, terminateLearningSnippetsTests } from "../../utils/InitializationUtils.js";
import { getSchemaContext, getTestViewer, mockGetBoundingClientRect, TreeWidgetTestUtils } from "../../utils/TreeWidgetTestUtils.js";

import type { SelectionStorage } from "@itwin/unified-selection";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { InstanceKey } from "@itwin/presentation-common";
import type { Props } from "@itwin/presentation-shared";

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

  const { modelsTreeProps, rendererProps } = useModelsTree({ activeView: viewport, getSubTreePaths });

  return (
    <VisibilityTree
      {...modelsTreeProps}
      getSchemaContext={getSchemaContext}
      selectionStorage={selectionStorage}
      imodel={imodel}
      treeRenderer={(props) => <VisibilityTreeRenderer {...props} {...rendererProps} />}
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
          const { imodelConnection, ...keys } = await buildIModel(async (imodel) => {
            const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
            const physicalModel2 = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel 2" });
            const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory" });
            insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });
            const category2 = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory 2" });
            insertPhysicalElement({ imodel, modelId: physicalModel2.id, categoryId: category2.id });
            return { physicalModel, physicalModel2 };
          });
          const testViewport = getTestViewer(imodelConnection, true);
          const unifiedSelectionStorage = createStorage();
          vi.spyOn(IModelApp.viewManager, "selectedView", "get").mockReturnValue(testViewport);
          vi.spyOn(UiFramework, "getIModelConnection").mockReturnValue(imodelConnection);

          using _ = { [Symbol.dispose]: cleanup };
          const { getByText, queryByText } = render(
            <CustomModelsTreeComponentWithTargetItems
              selectionStorage={unifiedSelectionStorage}
              imodel={imodelConnection}
              viewport={testViewport}
              targetItems={[keys.physicalModel]}
            />,
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
