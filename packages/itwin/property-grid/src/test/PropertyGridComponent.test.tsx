/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { UiFramework } from "@itwin/appui-react";
import { BeEvent } from "@itwin/core-bentley";
import { IModelApp } from "@itwin/core-frontend";
import * as multiElementPropertyGrid from "../components/MultiElementPropertyGrid";
import { PropertyGridComponent } from "../PropertyGridComponent";
import { render, waitFor } from "./TestUtils";

import type { IModelConnection } from "@itwin/core-frontend";

describe("PropertyGridComponent", () => {
  const imodel = {
    isBlankConnection: () => true,
    selectionSet: {
      onChanged: new BeEvent(),
      elements: { size: 0 },
    },
  } as IModelConnection;

  before(async () => {
    sinon.stub(IModelApp, "viewManager").get(() => ({
      onSelectedViewportChanged: new BeEvent(),
    }));
    sinon.stub(IModelApp, "toolAdmin").get(() => ({
      activeToolChanged: new BeEvent(),
    }));
    sinon.stub(multiElementPropertyGrid, "MultiElementPropertyGrid").returns(<>MultiElementPropertyGrid</>);
    await UiFramework.initialize();
  });

  after(() => {
    UiFramework.terminate();
    sinon.restore();
  });

  it("returns `null` if there is no active imodel", async () => {
    UiFramework.setIModelConnection(undefined);
    const { container } = render(<PropertyGridComponent />);
    expect(container.children).to.be.empty;
  });

  it("renders `MultiElementPropertyGrid` for active imodel", async () => {
    UiFramework.setIModelConnection(imodel);
    const { getByText } = render(<PropertyGridComponent />);
    await waitFor(() => getByText("MultiElementPropertyGrid"));
  });
});
