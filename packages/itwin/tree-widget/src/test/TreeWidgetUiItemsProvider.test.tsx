/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { createRef } from "react";
import sinon from "sinon";
import { UiFramework } from "@itwin/appui-react";
import { BeEvent } from "@itwin/core-bentley";
import { IModelApp } from "@itwin/core-frontend";
import * as selectableTreeModule from "../components/SelectableTree";
import { createTreeWidget } from "../components/TreeWidgetUiItemsProvider";
import * as useTreeTransientStateModule from "../components/utils/UseTreeTransientState";
import { TreeWidget } from "../TreeWidget";
import { render, TestUtils, waitFor } from "./TestUtils";

import type { IModelConnection } from "@itwin/core-frontend";

describe("createTreeWidget", () => {
  beforeEach(async () => {
    sinon.stub(IModelApp, "viewManager").get(() => ({ onSelectedViewportChanged: new BeEvent() }));

    const ref = createRef<HTMLDivElement>();
    sinon.stub(useTreeTransientStateModule, "useTreeTransientState").callsFake(() => ref);

    await TestUtils.initialize();
  });

  afterEach(() => {
    TestUtils.terminate();
    sinon.restore();
  });

  it("renders supplied trees", () => {
    const widgetComponentStub = sinon.stub(selectableTreeModule, "SelectableTree").returns(null);
    const trees: selectableTreeModule.TreeDefinition[] = [
      {
        id: "tree",
        getLabel: () => "Tree Label",
        render: () => <div>Tree Content</div>,
      },
    ];
    const widget = createTreeWidget({ trees });
    render(<>{widget.content}</>);

    expect(widgetComponentStub).to.be.called;
    const [props] = widgetComponentStub.args[0];
    expect(props.trees).to.be.eq(trees);
  });

  it("renders error message if tree component throws", async () => {
    UiFramework.setIModelConnection({
      isBlankConnection: () => true,
      selectionSet: {
        onChanged: new BeEvent(),
        elements: { size: 0 },
      },
    } as IModelConnection);

    function TestTree(): React.ReactElement {
      throw new Error("Error");
    }

    const trees: selectableTreeModule.TreeDefinition[] = [
      {
        id: "tree",
        getLabel: () => "Tree Label",
        render: () => <TestTree />,
      },
    ];
    const widget = createTreeWidget({ trees });
    const { queryByText } = render(<>{widget.content}</>);

    await waitFor(() => expect(queryByText(TreeWidget.translate("error"))).to.not.be.null);
  });
});
