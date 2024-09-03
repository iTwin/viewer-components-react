/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable import/no-duplicates */
import { expect } from "chai";
import { join } from "path";
import sinon from "sinon";
// __PUBLISH_EXTRACT_START__ Presentation.Tree-widget.Register-example-imports
import { UiItemsManager } from "@itwin/appui-react";
import { createTreeWidget, ModelsTreeComponent } from "@itwin/tree-widget-react"
// __PUBLISH_EXTRACT_END__
import {UiFramework} from "@itwin/appui-react";
import { IModel, IModelReadRpcInterface, SnapshotIModelRpcInterface } from "@itwin/core-common";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
import { createStorage } from "@itwin/unified-selection";
import { cleanup, render, waitFor } from "@testing-library/react";
import { buildIModel, insertPhysicalModelWithPartition, insertSubject } from "../../utils/IModelUtils";
import { getSchemaContext, getTestViewer, TestUtils } from "../../utils/TestUtils";

import type { InstanceKey } from "@itwin/presentation-common";

import type { Widget } from "@itwin/appui-react";
describe("Tree-widget", () => {
  describe("Learning-snippets", () => {
    describe("Usage", () => {
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
        let createTreeWidgetFunction: (() => ReadonlyArray<Widget>) | undefined;
        sinon.stub(UiItemsManager, "register").callsFake(({ id: _id, getWidgets }) => {
          createTreeWidgetFunction = getWidgets;
        });

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
                        // see "Creating schema context" section for example implementation
                        getSchemaContext={getSchemaContext}
                        // see "Creating unified selection storage" section for example implementation
                        selectionStorage={unifiedSelectionStorage}
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
        await waitFor(() => getByText("My Custom Tree"));
      });
    });
  });
});
