/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { PropertyRecord } from "@itwin/appui-abstract";
import { BeEvent } from "@itwin/core-bentley";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { KeySet, StandardNodeTypes } from "@itwin/presentation-common";
import { Presentation, SelectionChangeEvent } from "@itwin/presentation-frontend";
import { toggleAllCategories } from "../../components/trees/CategoriesVisibilityUtils";
import { CategoryVisibilityHandler } from "../../components/trees/category-tree/CategoryVisibilityHandler";
import { mockPresentationManager, TestUtils } from "../TestUtils";
import type { Id64String } from "@itwin/core-bentley";
import type { IModelConnection, SpatialViewState, SubCategoriesCache, ViewManager, Viewport } from "@itwin/core-frontend";
import type { TreeDataChangesListener, TreeNodeItem } from "@itwin/components-react";
import type { ECInstancesNodeKey } from "@itwin/presentation-common";
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";
import type { PresentationManager, SelectionManager } from "@itwin/presentation-frontend";

describe("CategoryVisibilityUtils", () => {

  describe("#unit", () => {

    before(async () => {
      await NoRenderApp.startup();
      await TestUtils.initialize();
    });

    after(async () => {
      TestUtils.terminate();
      Presentation.terminate();
      await IModelApp.shutdown();
    });

    afterEach(() => {
      sinon.restore();
    });

    const imodelMock = moq.Mock.ofType<IModelConnection>();
    const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
    let presentationManagerMock: moq.IMock<PresentationManager>;
    const viewportMock = moq.Mock.ofType<Viewport>();
    const viewStateMock = moq.Mock.ofType<SpatialViewState>();
    const viewManagerMock = moq.Mock.ofType<ViewManager>();

    beforeEach(() => {
      viewManagerMock.reset();
      imodelMock.reset();
      selectionManagerMock.reset();
      viewportMock.reset();
      viewStateMock.reset();

      const selectionChangeEvent = new SelectionChangeEvent();
      selectionManagerMock.setup((x) => x.selectionChange).returns(() => selectionChangeEvent);
      selectionManagerMock.setup((x) => x.getSelectionLevels(imodelMock.object)).returns(() => []);
      selectionManagerMock.setup((x) => x.getSelection(imodelMock.object, moq.It.isAny())).returns(() => new KeySet());
      Presentation.setSelectionManager(selectionManagerMock.object);

      const mocks = mockPresentationManager();
      presentationManagerMock = mocks.presentationManager;
      Presentation.setPresentationManager(presentationManagerMock.object);

      async function* generator() {
        return;
      }

      imodelMock.setup((x) => x.query(moq.It.isAny(), moq.It.isAny(), moq.It.isAny())).returns(() => generator());
      viewportMock.setup((x) => x.view).returns(() => viewStateMock.object);
      viewStateMock.setup((x) => x.is3d()).returns(() => true);

    });

    const createKey = (id: Id64String): ECInstancesNodeKey => {
      return {
        type: StandardNodeTypes.ECInstancesNode,
        version: 0,
        instanceKeys: [{ className: "MyDomain:SpatialCategory", id }],
        pathFromRoot: [],
      };
    };

    describe("toggleAllCategories", () => {
      const subcategoriesCacheMock = moq.Mock.ofType<SubCategoriesCache>();
      let enableAllStub: sinon.SinonStub<[ViewManager, IModelConnection, string[], boolean, boolean, (boolean | undefined)?], void>;

      beforeEach(() => {
        enableAllStub = sinon.stub(CategoryVisibilityHandler, "enableCategory");
        subcategoriesCacheMock.reset();
        imodelMock.reset();
        async function* generator() {
          yield { id: "CategoryId" };
          return;
        }

        imodelMock.setup((x) => x.query(moq.It.isAny(), moq.It.isAny(), moq.It.isAny())).returns(() => generator());
        imodelMock.setup((x) => x.subcategories).returns(() => subcategoriesCacheMock.object);
      });

      it("enables all categories", async () => {
        await toggleAllCategories(viewManagerMock.object, imodelMock.object, true, viewportMock.object);
        expect(enableAllStub).to.be.calledWith(viewManagerMock.object, imodelMock.object, ["CategoryId"], true);
      });

      it("disables all categories", async () => {
        await toggleAllCategories(viewManagerMock.object, imodelMock.object, false, viewportMock.object);
        expect(enableAllStub).to.be.calledWith(viewManagerMock.object, imodelMock.object, ["CategoryId"], false);
      });

      describe("with filtered dataProvider", () => {
        let dataProvider: IPresentationTreeDataProvider;
        let testNode: TreeNodeItem;

        beforeEach(() => {
          testNode = { id: "filteredNodeId", label: PropertyRecord.fromString("test-node") };
          dataProvider = {
            imodel: imodelMock.object,
            rulesetId: "",
            onTreeNodeChanged: new BeEvent<TreeDataChangesListener>(),
            dispose: () => { },
            getFilteredNodePaths: async () => [],
            getNodeKey: (node: TreeNodeItem) => (node as any).__key,
            getNodesCount: async () => 1,
            getNodes: async () => [{ ...testNode, __key: createKey(testNode.id) }],
          };
        });

        it("enables all categories", async () => {
          await toggleAllCategories(viewManagerMock.object, imodelMock.object, true, viewportMock.object, true, dataProvider);
          expect(enableAllStub).to.be.calledWith(viewManagerMock.object, imodelMock.object, [testNode.id], true);
        });

        it("disables all categories", async () => {
          await toggleAllCategories(viewManagerMock.object, imodelMock.object, false, viewportMock.object, true, dataProvider);
          expect(enableAllStub).to.be.calledWith(viewManagerMock.object, imodelMock.object, [testNode.id], false);
        });
      });
    });
  });
});
