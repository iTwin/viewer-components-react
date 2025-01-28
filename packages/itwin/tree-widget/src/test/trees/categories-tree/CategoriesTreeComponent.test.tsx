/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Children } from "react";
import sinon from "sinon";
import * as td from "testdouble";
import { BeEvent } from "@itwin/core-bentley";
import { Presentation } from "@itwin/presentation-frontend";
import * as treeHeaderModule from "../../../tree-widget-react/components/tree-header/TreeHeader.js";
import * as categoriesTreeModule from "../../../tree-widget-react/components/trees/categories-tree/CategoriesTree.js";
import * as categoriesVisibilityUtilsModule from "../../../tree-widget-react/components/trees/common/CategoriesVisibilityUtils.js";
import * as treeWidgetModule from "../../../tree-widget-react/TreeWidget.js";
import { mockPresentationManager, render, waitFor } from "../../TestUtils.js";

import type * as categoriesTreeComponentModule from "../../../tree-widget-react/components/trees/categories-tree/CategoriesTreeComponent.js";
import type { ComponentPropsWithoutRef } from "react";
import type { CategoryInfo } from "../../../tree-widget-react/components/trees/common/CategoriesVisibilityUtils.js";
import type { Id64String } from "@itwin/core-bentley";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";

type TreeHeaderProps = ComponentPropsWithoutRef<typeof treeHeaderModule.TreeHeader>;

describe("<CategoriesTreeComponent />", () => {
  async function initialize() {
    const { IModelApp, NoRenderApp } = await import("@itwin/core-frontend");
    await NoRenderApp.startup();

    const { UiFramework } = await import("@itwin/appui-react");
    await UiFramework.initialize();

    return { IModelApp, UiFramework };
  }

  const defaultCategoriesTreeComponentProps: ComponentPropsWithoutRef<typeof categoriesTreeComponentModule.CategoriesTreeComponent> = {
    getSchemaContext: () => ({}) as any,
    selectionStorage: {} as any,
  };

  let CategoriesTreeComponent: typeof categoriesTreeComponentModule.CategoriesTreeComponent;
  let stubCategoriesTree: sinon.SinonStub;
  let stubTreeHeader: sinon.SinonStub;
  let stubTreeWidgetTranslate: sinon.SinonStub;
  let stubCategoriesVisibilityUtils: {
    showAllCategories: sinon.SinonStub;
    invertAllCategories: sinon.SinonStub;
    hideAllCategories: sinon.SinonStub;
  };

  beforeEach(async () => {
    const { presentationManager } = mockPresentationManager();
    sinon.stub(Presentation, "presentation").get(() => presentationManager.object);

    stubCategoriesTree = sinon.stub().returns(<></>);
    await td.replaceEsm("../../../tree-widget-react/components/trees/categories-tree/CategoriesTree.js", {
      ...categoriesTreeModule,
      CategoriesTree: stubCategoriesTree,
    });

    stubTreeHeader = sinon.stub().returns(<></>);
    await td.replaceEsm("../../../tree-widget-react/components/tree-header/TreeHeader.js", {
      ...treeHeaderModule,
      TreeHeader: stubTreeHeader,
    });

    stubTreeWidgetTranslate = sinon.stub().returns("test translated string");
    await td.replaceEsm("../../../tree-widget-react/TreeWidget.js", {
      ...treeWidgetModule,
      TreeWidget: {
        ...treeWidgetModule.TreeWidget,
        translate: stubTreeWidgetTranslate,
      },
    });

    stubCategoriesVisibilityUtils = {
      showAllCategories: sinon.stub(),
      invertAllCategories: sinon.stub(),
      hideAllCategories: sinon.stub(),
    };
    await td.replaceEsm("../../../tree-widget-react/components/trees/common/CategoriesVisibilityUtils.js", {
      ...categoriesVisibilityUtilsModule,
      ...stubCategoriesVisibilityUtils,
    });

    CategoriesTreeComponent = (await import("../../../tree-widget-react/components/trees/categories-tree/CategoriesTreeComponent.js")).CategoriesTreeComponent;
  });

  afterEach(() => {
    sinon.restore();
    td.reset();
  });

  const categories: CategoryInfo[] = [
    {
      categoryId: "CategoryId",
      subCategoryIds: ["SubCategoryId1", "SubCategoryId2"],
    },
  ];

  const iModel = {
    createQueryReader: () => ({
      toArray: async () => [],
    }),
    categories: {
      getCategoryInfo: async () => new Map<Id64String, IModelConnection.Categories.CategoryInfo>(),
    },
    views: {},
  } as unknown as IModelConnection;

  const viewport = {
    onDisplayStyleChanged: new BeEvent<(vp: Viewport) => void>(),
    onViewedCategoriesChanged: new BeEvent<(vp: Viewport) => void>(),
    view: {
      is3d: () => false,
    },
    iModel,
  } as unknown as Viewport;

  it("returns null if iModel is undefined", async () => {
    const { IModelApp } = await initialize();
    sinon.stub(IModelApp.viewManager, "selectedView").get(() => ({}) as Viewport);
    const result = render(<CategoriesTreeComponent {...defaultCategoriesTreeComponentProps} />);
    expect(result.container.children).to.be.empty;
    expect(stubCategoriesTree).to.not.be.called;
  });

  it("returns null if viewport is undefined", async () => {
    const { UiFramework } = await initialize();
    sinon.stub(UiFramework, "getIModelConnection").returns({} as IModelConnection);
    const result = render(<CategoriesTreeComponent {...defaultCategoriesTreeComponentProps} />);
    expect(result.container.children).to.be.empty;
    expect(stubCategoriesTree).to.not.be.called;
  });

  it("renders `CategoryTree` when iModel and viewport are defined", async () => {
    const { IModelApp, UiFramework } = await initialize();
    sinon.stub(IModelApp.viewManager, "selectedView").get(() => viewport);
    sinon.stub(UiFramework, "getIModelConnection").returns(iModel);
    const result = render(<CategoriesTreeComponent {...defaultCategoriesTreeComponentProps} density="enlarged" />);
    await waitFor(() => {
      expect(result.container.children).to.not.be.empty;
      expect(stubCategoriesTree).to.be.called;
    });
  });

  it("getLabel returns translated label of the component", async () => {
    expect(CategoriesTreeComponent.getLabel()).to.be.eq("test translated string");
    expect(stubTreeWidgetTranslate).to.be.calledWith("categoriesTree.label");
  });

  describe("header buttons", () => {
    it("renders default tree header buttons", async () => {
      const { IModelApp, UiFramework } = await initialize();
      sinon.stub(IModelApp.viewManager, "selectedView").get(() => viewport);
      sinon.stub(UiFramework, "getIModelConnection").returns(iModel);
      render(<CategoriesTreeComponent {...defaultCategoriesTreeComponentProps} />);
      await waitFor(() => {
        expect(stubTreeHeader).to.be.calledWith(sinon.match((props: TreeHeaderProps) => Children.count(props.children) === 3));
      });
    });

    it("renders user provided tree header buttons", async () => {
      const { IModelApp, UiFramework } = await initialize();
      const spy = sinon.stub().returns(<></>);
      sinon.stub(IModelApp.viewManager, "selectedView").get(() => viewport);
      sinon.stub(UiFramework, "getIModelConnection").returns(iModel);
      render(<CategoriesTreeComponent {...defaultCategoriesTreeComponentProps} headerButtons={[spy]} />);

      await waitFor(() => {
        expect(stubTreeHeader).to.be.calledWith(sinon.match((props: TreeHeaderProps) => Children.count(props.children) === 1));
        expect(spy).to.be.called;
      });
    });

    describe("<ShowAllButton />", () => {
      it("click on ShowAllButton calls expected function", async () => {
        const { user, getByRole } = render(<CategoriesTreeComponent.ShowAllButton categories={categories} viewport={viewport} density="enlarged" />);
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        expect(stubCategoriesVisibilityUtils.showAllCategories).to.be.calledWith(["CategoryId"], viewport);
      });

      it("report on click", async () => {
        const onFeatureUsedSpy = sinon.spy();
        const { user, getByRole } = render(
          <CategoriesTreeComponent.ShowAllButton categories={categories} viewport={viewport} density="enlarged" onFeatureUsed={onFeatureUsedSpy} />,
        );
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        expect(onFeatureUsedSpy).to.be.calledWith("categories-tree-showall");
      });
    });

    describe("<HideAllButton />", () => {
      it("click on HideAllButton calls expected function", async () => {
        const { user, getByRole } = render(<CategoriesTreeComponent.HideAllButton categories={categories} viewport={viewport} density="enlarged" />);
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        expect(stubCategoriesVisibilityUtils.hideAllCategories).to.be.calledWith(["CategoryId"], viewport);
      });

      it("reports on click", async () => {
        const onFeatureUsedSpy = sinon.spy();
        const { user, getByRole } = render(
          <CategoriesTreeComponent.HideAllButton categories={categories} viewport={viewport} density="enlarged" onFeatureUsed={onFeatureUsedSpy} />,
        );
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        expect(onFeatureUsedSpy).to.be.calledWith("categories-tree-hideall");
      });
    });

    describe("<InvertAllButton />", () => {
      it("click on InvertAllButton calls expected function", async () => {
        const { user, getByRole } = render(<CategoriesTreeComponent.InvertAllButton categories={categories} viewport={viewport} density="enlarged" />);
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        expect(stubCategoriesVisibilityUtils.invertAllCategories).to.be.calledWith(categories, viewport);
      });

      it("reports on click", async () => {
        const onFeatureUsedSpy = sinon.spy();
        const { user, getByRole } = render(
          <CategoriesTreeComponent.InvertAllButton categories={categories} viewport={viewport} density="enlarged" onFeatureUsed={onFeatureUsedSpy} />,
        );
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        expect(onFeatureUsedSpy).to.be.calledWith("categories-tree-invert");
      });
    });
  });
});
