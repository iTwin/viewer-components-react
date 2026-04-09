/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, describe, it, vi } from "vitest";
import { UiFramework } from "@itwin/appui-react";
import { IModel } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";
// __PUBLISH_EXTRACT_START__ TreeWidget.ImodelContentTreeExampleImports
import { IModelContentTreeComponent } from "@itwin/tree-widget-react";
// __PUBLISH_EXTRACT_END__
import { createStorage } from "@itwin/unified-selection";
import { cleanup, render, waitFor } from "@testing-library/react";
import { buildIModel, insertSubject } from "../../utils/IModelUtils.js";
import { initializeLearningSnippetsTests, terminateLearningSnippetsTests } from "../../utils/InitializationUtils.js";
import { getSchemaContext, getTestViewer, mockGetBoundingClientRect, TreeWidgetTestUtils } from "../../utils/TreeWidgetTestUtils.js";

describe("Tree widget", () => {
  mockGetBoundingClientRect();
  describe("Learning snippets", () => {
    describe("Components", () => {
      describe("IModel content tree", () => {
        beforeAll(async () => {
          await initializeLearningSnippetsTests();
          await TreeWidgetTestUtils.initialize();
        });

        afterAll(async () => {
          await terminateLearningSnippetsTests();
          TreeWidgetTestUtils.terminate();
        });

        it("renders <IModelContentTreeComponent />", async () => {
          const imodel = (
            await buildIModel(async (builder) => {
              const subjectA = insertSubject({ builder, codeValue: "Test subject A", parentId: IModel.rootSubjectId });
              return { subjectA };
            })
          ).imodel;
          const testViewport = getTestViewer(imodel);
          const unifiedSelectionStorage = createStorage();
          vi.spyOn(IModelApp.viewManager, "selectedView", "get").mockReturnValue(testViewport);
          vi.spyOn(UiFramework, "getIModelConnection").mockReturnValue(imodel);

          // __PUBLISH_EXTRACT_START__ TreeWidget.ImodelContentTreeExample
          function MyWidget() {
            return (
              <IModelContentTreeComponent
                // see "Creating schema context" section for example implementation
                getSchemaContext={getSchemaContext}
                // see "Creating unified selection storage" section for example implementation
                selectionStorage={unifiedSelectionStorage}
              />
            );
          }
          // __PUBLISH_EXTRACT_END__

          using _ = { [Symbol.dispose]: cleanup };
          const { getByText } = render(<MyWidget />);
          await waitFor(() => getByText("Test subject A"));
        });
      });
    });
  });
});
