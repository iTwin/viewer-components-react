/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import sinon from "sinon";
// __PUBLISH_EXTRACT_START__ Presentation.Tree-widget.Register-example-imports-1
import { UiFramework, UiItemsManager } from "@itwin/appui-react";
// __PUBLISH_EXTRACT_END__
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { createTreeWidget, ModelsTreeComponent } from "@itwin/tree-widget-react";
import { render, waitFor } from "@testing-library/react";
import { getSchemaContext, getTestViewer, TestUtils } from "../../utils/TestUtils";
import type { Widget } from "@itwin/appui-react";
import { IModel, IModelReadRpcInterface, SnapshotIModelRpcInterface } from "@itwin/core-common";
import { type InstanceKey, PresentationRpcInterface } from "@itwin/presentation-common";
import { createStorage } from "@itwin/unified-selection";
import { buildIModel, insertPhysicalModelWithPartition, insertSubject } from "../../utils/IModelUtils";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
import { join } from "path";

describe("Tree-widget", () => {
  describe("Learning-snippets", () => {
    describe("Usage", () => {
      let createTreeWidgetFunction: (() => ReadonlyArray<Widget>) | undefined;

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

        sinon.stub(UiItemsManager, "register").callsFake(({ id: _id, getWidgets }) => {
          createTreeWidgetFunction = getWidgets;
        });
      });

      afterEach(async () => {
        TestUtils.terminate();
        await IModelApp.shutdown();
        sinon.restore();
      });

      it("Register tree widget example", async function () {
        const imodel = (
          await buildIModel(this, async (builder) => {
            const model = insertPhysicalModelWithPartition({ builder, codeValue: "model" });
            const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };
            const childSubject = insertSubject({
              builder,
              codeValue: "test subject",
              parentId: rootSubject.id,
            });
            return { model, childSubject };
          })
        ).imodel;
        const testViewport = getTestViewer(imodel);
        const unifiedSelectionStorage = createStorage();
        sinon.stub(IModelApp.viewManager, "selectedView").get(() => testViewport);
        sinon.stub(UiFramework, "getIModelConnection").returns(imodel);

        // __PUBLISH_EXTRACT_START__ Presentation.Tree-widget.Register-example
        UiItemsManager.register({
          id: "tree-widget-provider",
          getWidgets: () =>
            [
              createTreeWidget({
                trees: [
                  // add a custom component
                  { id: "my-tree-id", startIcon: <svg />, getLabel: () => "My Custom Tree", render: () => <>This is my custom tree.</> },
                  // add the Models tree component delivered with the package
                  {
                    id: ModelsTreeComponent.id,
                    getLabel: () => ModelsTreeComponent.getLabel(),
                    render: (_props: any) => (
                      <ModelsTreeComponent
                        // see "Models tree" section for details regarding `getSchemaContext` and `selectionStorage` props
                        getSchemaContext={getSchemaContext}
                        selectionStorage={unifiedSelectionStorage}
                        selectionMode={"extended"}
                      />
                    ),
                  },
                ],
              }),
            ] as readonly Widget[],
        });
        // __PUBLISH_EXTRACT_END__
        expect(createTreeWidgetFunction).to.not.be.undefined;
        const widgets = createTreeWidgetFunction!();
        expect(widgets).to.not.be.undefined;
        const { getByText } = render(<>{widgets[0].content}</>);
        await waitFor(() => expect(getByText("My Custom Tree")).to.not.be.null);
      });
    });
  });
});
