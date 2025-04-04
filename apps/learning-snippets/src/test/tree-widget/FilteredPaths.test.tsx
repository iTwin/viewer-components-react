/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-shadow */

import { expect } from "chai";
import sinon from "sinon";
import { useCallback } from "react";
import { UiFramework } from "@itwin/appui-react";
import { IModelApp } from "@itwin/core-frontend";
import { useModelsTree, VisibilityTree, VisibilityTreeRenderer } from "@itwin/tree-widget-react";
import { createStorage } from "@itwin/unified-selection";
import { cleanup, render, waitFor } from "@testing-library/react";
import { buildIModel, insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory } from "../../utils/IModelUtils.js";
import { initializeLearningSnippetsTests, terminateLearningSnippetsTests } from "../../utils/InitializationUtils.js";
import { getSchemaContext, getTestViewer, mockGetBoundingClientRect, TreeWidgetTestUtils } from "../../utils/TreeWidgetTestUtils.js";

import type { SelectionStorage } from "@itwin/unified-selection";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { InstanceKey } from "@itwin/presentation-common";

// __PUBLISH_EXTRACT_START__ TreeWidget.GetFilteredPathsComponentExample
type UseModelsTreeProps = Parameters<typeof useModelsTree>[0];
type GetFilteredPathsType = Exclude<UseModelsTreeProps["getFilteredPaths"], undefined>;
interface CustomModelsTreeProps {
  viewport: Viewport;
  selectionStorage: SelectionStorage;
  imodel: IModelConnection;
  targetItems: InstanceKey[];
}

function CustomModelsTreeComponent({ viewport, selectionStorage, imodel, targetItems }: CustomModelsTreeProps) {
  const getFilteredPaths = useCallback<GetFilteredPathsType>(
    async ({ createInstanceKeyPaths }) => {
      return createInstanceKeyPaths({
        // list of instance keys representing nodes that should be displayed in the hierarchy
        targetItems,
      });
    },
    [targetItems],
  );

  const { modelsTreeProps, rendererProps } = useModelsTree({ activeView: viewport, getFilteredPaths });

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
  describe("Learning snippets", () => {
    describe("Components", () => {
      describe("Filtered paths", () => {
        before(async function () {
          await initializeLearningSnippetsTests();
          await TreeWidgetTestUtils.initialize();
        });

        after(async function () {
          await terminateLearningSnippetsTests();
          TreeWidgetTestUtils.terminate();
        });

        afterEach(async () => {
          sinon.restore();
        });

        it("renders custom models tree component with filtered paths", async function () {
          const imodel = await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
            const physicalModel2 = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel 2" });
            const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
            insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
            const category2 = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory 2" });
            insertPhysicalElement({ builder, modelId: physicalModel2.id, categoryId: category2.id });
            return { physicalModel, physicalModel2 };
          });
          const testViewport = getTestViewer(imodel.imodel, true);
          const unifiedSelectionStorage = createStorage();
          sinon.stub(IModelApp.viewManager, "selectedView").get(() => testViewport);
          sinon.stub(UiFramework, "getIModelConnection").returns(imodel.imodel);
          mockGetBoundingClientRect();

          using _ = { [Symbol.dispose]: cleanup };
          const { getByText, queryByText } = render(
            <CustomModelsTreeComponent
              selectionStorage={unifiedSelectionStorage}
              imodel={imodel.imodel}
              viewport={testViewport}
              targetItems={[imodel.physicalModel]}
            />,
          );

          await waitFor(() => {
            getByText("TestPhysicalModel");
            expect(queryByText("TestPhysicalModel 2")).to.be.null;
          });
        });
      });
    });
  });
});
