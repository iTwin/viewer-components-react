/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { StagePanelLocation, StagePanelSection, StageUsage } from "@itwin/appui-react";
import { render } from "@testing-library/react";
import * as propertyGridComponent from "../PropertyGridComponent";
import { PropertyGridManager } from "../PropertyGridManager";
import { PropertyGridUiItemsProvider } from "../PropertyGridUiItemsProvider";

describe("PropertyGridUiItemsProvider", () => {
  before(() => {
    sinon.stub(PropertyGridManager, "translate").callsFake((key) => key);
  });

  after(() => {
    sinon.restore();
  });

  it("provides widgets to default location", () => {
    const provider = new PropertyGridUiItemsProvider();

    expect(provider.provideWidgets("", StageUsage.General, StagePanelLocation.Right, StagePanelSection.End)).to.not.be.empty;
    expect(provider.provideWidgets("", StageUsage.General, StagePanelLocation.Right, StagePanelSection.Start)).to.be.empty;
    expect(provider.provideWidgets("", StageUsage.General, StagePanelLocation.Left, StagePanelSection.Start)).to.be.empty;
  });

  it("provides widgets to preferred location", () => {
    const provider = new PropertyGridUiItemsProvider({
      defaultPanelLocation: StagePanelLocation.Left,
      defaultPanelSection: StagePanelSection.End,
    });

    expect(provider.provideWidgets("", StageUsage.General, StagePanelLocation.Right, StagePanelSection.End)).to.be.empty;
    expect(provider.provideWidgets("", StageUsage.General, StagePanelLocation.Left, StagePanelSection.End)).to.not.be.empty;
    expect(provider.provideWidgets("", StageUsage.General, StagePanelLocation.Left, StagePanelSection.Start)).to.be.empty;
  });

  it("renders property grid component", () => {
    const propertyGridComponentStub = sinon.stub(propertyGridComponent, "PropertyGridComponent").returns(<></>);
    const provider = new PropertyGridUiItemsProvider();
    const [widget] = provider.provideWidgets("", StageUsage.General, StagePanelLocation.Right, StagePanelSection.End);
    render(<>{widget.content}</>);

    expect(propertyGridComponentStub).to.be.called;
  });
});
