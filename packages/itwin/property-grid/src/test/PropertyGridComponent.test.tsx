/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { UiFramework } from "@itwin/appui-react";
import { BeEvent } from "@itwin/core-bentley";
import { render, waitFor } from "@testing-library/react";
import * as multiElementPropertyGrid from "../components/MultiElementPropertyGrid";
import { PropertyGridComponent } from "../PropertyGridComponent";

import type { IModelConnection } from "@itwin/core-frontend";

describe("PropertyGridComponent", () => {
  const imodel = {
    isBlankConnection: () => true,
    selectionSet: {
      onChanged: new BeEvent(),
    },
  } as IModelConnection;

  before(async () => {
    await UiFramework.initialize(undefined);
    sinon.stub(multiElementPropertyGrid, "MultiElementPropertyGrid").returns(<>MultiElementPropertyGrid</>);
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
