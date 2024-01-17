/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import { UiFramework } from "@itwin/appui-react";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import * as externalSourcesTreeModule from "../../../components/trees/external-sources-tree/ExternalSourcesTree";
import * as autoSizerModule from "../../../components/utils/AutoSizer";
import { ExternalSourcesTreeComponent, TreeWidget } from "../../../tree-widget-react";
import { render, TestUtils } from "../../TestUtils";

describe("<ExternalSourcesTreeComponent />", () => {
  before(async () => {
    await NoRenderApp.startup();
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
      const result = ExternalSourcesTreeComponent.getLabel();
      expect(translateSpy).to.be.calledWith("externalSources");
      expect(result).to.eq("test label");
    });
  });

  it("renders `ExternalSourcesTree` with size and iModel props", async () => {
    const imodel = {} as any;
    sinon.stub(UiFramework, "getIModelConnection").returns(imodel);
    sinon.stub(autoSizerModule, "AutoSizer").callsFake((props) => <>{props.children({ width: 123, height: 456 })}</>);
    const treeStub = sinon.stub(externalSourcesTreeModule, "ExternalSourcesTree").returns(<>test result</>);

    const { getByText } = render(<ExternalSourcesTreeComponent />);

    expect(treeStub).to.be.calledWith({
      width: 123,
      height: 456,
      iModel: imodel,
    });
    getByText("test result");
  });

  it("returns `null` if there's no active iModel", async () => {
    sinon.stub(UiFramework, "getIModelConnection").returns(undefined);
    const autosizerStub = sinon.stub(autoSizerModule, "AutoSizer").callsFake((props) => <>{props.children({ width: 123, height: 456 })}</>);
    const treeStub = sinon.stub(externalSourcesTreeModule, "ExternalSourcesTree").returns(<></>);

    const { container } = render(<ExternalSourcesTreeComponent />);

    expect(autosizerStub).to.not.be.called;
    expect(treeStub).to.not.be.called;
    expect(container.innerHTML).to.be.empty;
  });
});
