import { join } from "path";
import React from "react";
// __PUBLISH_EXTRACT_END__
import sinon from "sinon";
import { UiFramework } from "@itwin/appui-react";
import { IModel, IModelReadRpcInterface, SnapshotIModelRpcInterface } from "@itwin/core-common";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
// __PUBLISH_EXTRACT_START__ Presentation.Tree-widget.Categories-tree-example-imports
import { IModelContentTreeComponent } from "@itwin/tree-widget-react";
import { createStorage } from "@itwin/unified-selection";
import { render, waitFor } from "@testing-library/react";
import { buildIModel, insertSubject } from "../../utils/IModelUtils";
import { getSchemaContext, getTestViewer, TestUtils } from "../../utils/TestUtils";

import type { InstanceKey } from "@itwin/presentation-common";

describe("Tree-widget", () => {
  describe("Learning-snippets", () => {
    describe("Components", () => {
      describe("Imodel content tree", () => {
        before(async function () {
          await initializePresentationTesting({
            backendProps: {
              caching: {
                hierarchies: {
                  mode: HierarchyCacheMode.Memory,
                },
              },
            },
            testOutputDir: join(__dirname, "output"),
            backendHostProps: {
              cacheDir: join(__dirname, "cache"),
            },
            rpcs: [SnapshotIModelRpcInterface, IModelReadRpcInterface, PresentationRpcInterface, ECSchemaRpcInterface],
          });
          // eslint-disable-next-line @itwin/no-internal
          ECSchemaRpcImpl.register();
        });

        after(async function () {
          await terminatePresentationTesting();
        });

        beforeEach(async () => {
          await NoRenderApp.startup();
          await TestUtils.initialize();
        });

        afterEach(async () => {
          TestUtils.terminate();
          await IModelApp.shutdown();
          sinon.restore();
        });

        it("Imodel content tree snippet", async function () {
          const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };
          const dictionaryModel: InstanceKey = { className: "BisCore.DictionaryModel", id: IModel.dictionaryId };

          const imodel = (
            await buildIModel(this, async (builder) => {
              const subjectA = insertSubject({ builder, codeValue: "A", parentId: IModel.rootSubjectId });
              const subjectB = insertSubject({ builder, codeValue: "B", parentId: IModel.rootSubjectId });
              const subjectC = insertSubject({ builder, codeValue: "C", parentId: subjectB.id });
              return { rootSubject, dictionaryModel, subjectA, subjectB, subjectC };
            })
          ).imodel;
          const testViewport = getTestViewer(imodel);
          const unifiedSelectionStorage = createStorage();
          sinon.stub(IModelApp.viewManager, "selectedView").get(() => testViewport);
          sinon.stub(UiFramework, "getIModelConnection").returns(imodel);

          // __PUBLISH_EXTRACT_START__ Presentation.Tree-widget.Imodel-content-tree-example
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

          const { getByText } = render(<MyWidget />);
          await waitFor(() => getByText("tree-widget-learning-snippets-components-imodel-content-tree-imodel-content-tree-snippet"));
        });
      });
    });
  });
});
