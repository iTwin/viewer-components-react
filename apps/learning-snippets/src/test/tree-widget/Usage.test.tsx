/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable import/no-duplicates */
/* eslint-disable unused-imports/no-unused-vars */

import { expect } from "chai";
import sinon from "sinon";
// __PUBLISH_EXTRACT_START__ TreeWidget.RegisterExampleImports
import { UiItemsManager } from "@itwin/appui-react";
import { createTreeWidget, ModelsTreeComponent } from "@itwin/tree-widget-react";
// __PUBLISH_EXTRACT_END__
import { UiFramework } from "@itwin/appui-react";
import { IModel } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";
import { createStorage } from "@itwin/unified-selection";
import { render, waitFor } from "@testing-library/react";
import { buildIModel, insertPhysicalModelWithPartition, insertSubject } from "../../utils/IModelUtils.js";
import { initializeLearningSnippetsTests, terminateLearningSnippetsTests } from "../../utils/InitializationUtils.js";
import { getSchemaContext, getTestViewer, TreeWidgetTestUtils } from "../../utils/TreeWidgetTestUtils.js";

import type { InstanceKey } from "@itwin/presentation-common";
import type { Widget } from "@itwin/appui-react";

describe("Tree widget", () => {
  describe("Learning snippets", () => {
    describe("Usage", () => {
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

      it("registers tree widget", async function () {
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

        // __PUBLISH_EXTRACT_START__ TreeWidget.RegisterExample
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
                    render: (props) => (
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
