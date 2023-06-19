/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import { UiFramework } from "@itwin/appui-react";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { render } from "@testing-library/react";
import * as imodelContentTreeModule from "../../../components/trees/imodel-content-tree/IModelContentTree";
import * as autoSizerModule from "../../../components/utils/AutoSizer";
import { IModelContentTreeComponent, TreeWidget } from "../../../tree-widget-react";
import { TestUtils } from "../../TestUtils";

describe("<IModelContentTreeComponent />", () => {
  before(async () => {
    // TODO: remove this eslint rule when tree-widget uses itwinjs-core 4.0.0 version
    await NoRenderApp.startup(); // eslint-disable-line @itwin/no-internal
    await TestUtils.initialize();
  });

  after(async () => {
    TestUtils.terminate();
    await IModelApp.shutdown();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("getLabel", () => {
    it("returns translated label of the component", () => {
      const translateSpy = sinon.stub(TreeWidget, "translate").returns("test label");
      const result = IModelContentTreeComponent.getLabel();
      expect(translateSpy).to.be.calledWith("imodelContent");
      expect(result).to.eq("test label");
    });
  });

  it("renders `IModelContentTree` with size and iModel props", async () => {
    const imodel = {} as any;
    sinon.stub(UiFramework, "getIModelConnection").returns(imodel);
    sinon.stub(autoSizerModule, "AutoSizer").callsFake((props) => <>{props.children({ width: 123, height: 456 })}</>);
    const treeStub = sinon.stub(imodelContentTreeModule, "IModelContentTree").returns(<>test result</>);

    const { getByText } = render(
      <IModelContentTreeComponent />,
    );

    expect(treeStub).to.be.calledOnceWith({
      width: 123,
      height: 456,
      iModel: imodel,
    });
    getByText("test result");
  });

  it("returns `null` if there's no active iModel", async () => {
    sinon.stub(UiFramework, "getIModelConnection").returns(undefined);
    const autosizerStub = sinon.stub(autoSizerModule, "AutoSizer").callsFake((props) => <>{props.children({ width: 123, height: 456 })}</>);
    const treeStub = sinon.stub(imodelContentTreeModule, "IModelContentTree").returns(<></>);

    const { container } = render(
      <IModelContentTreeComponent />,
    );

    expect(autosizerStub).to.not.be.called;
    expect(treeStub).to.not.be.called;
    expect(container.innerHTML).to.be.empty;
  });
});
