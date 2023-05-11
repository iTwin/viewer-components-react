/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import * as React from "react";
import { UiFramework } from "@itwin/appui-react";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { render } from "@testing-library/react";
import * as externalSourcesTreeModule from "../../../components/trees/external-sources-tree/ExternalSourcesTree";
import * as autoSizerModule from "../../../components/utils/AutoSizer";
import { ExternalSourcesTreeComponent } from "../../../tree-widget-react";
import { TestUtils } from "../../TestUtils";

describe("<ExternalSourcesTreeComponent />", () => {

  describe("#unit", () => {
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

    it("renders `ExternalSourcesTree` with size and iModel props", async () => {
      const imodel = {} as any;
      sinon.stub(UiFramework, "getIModelConnection").returns(imodel);
      sinon.stub(autoSizerModule, "AutoSizer").callsFake((props) => <>{props.children({ width: 123, height: 456 })}</>);
      const treeStub = sinon.stub(externalSourcesTreeModule, "ExternalSourcesTree").returns(<>test result</>);

      const { getByText } = render(
        <ExternalSourcesTreeComponent />,
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
      const treeStub = sinon.stub(externalSourcesTreeModule, "ExternalSourcesTree").returns(<></>);

      const { container } = render(
        <ExternalSourcesTreeComponent />,
      );

      expect(autosizerStub).to.not.be.called;
      expect(treeStub).to.not.be.called;
      expect(container.innerHTML).to.be.empty;
    });
  });
});
