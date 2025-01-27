/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import * as td from "testdouble";
import * as appuiReactModule from "@itwin/appui-react";
import { BeEvent } from "@itwin/core-bentley";
import * as multiElementPropertyGridModule from "../property-grid-react/components/MultiElementPropertyGrid.js";
import { render, waitFor } from "./TestUtils.js";

import type * as propertyGridComponentModule from "../property-grid-react/PropertyGridComponent.js";
import type { IModelConnection } from "@itwin/core-frontend";

describe("PropertyGridComponent", () => {
  const createIModel = () =>
    ({
      isBlankConnection: () => true,
      selectionSet: {
        onChanged: new BeEvent(),
        elements: { size: 0 },
      },
    }) as IModelConnection;
  let imodel: IModelConnection | undefined;
  let PropertyGridComponent: typeof propertyGridComponentModule.PropertyGridComponent;

  beforeEach(async () => {
    imodel = undefined;
    await td.replaceEsm("@itwin/appui-react", {
      ...appuiReactModule,
      useActiveIModelConnection: () => imodel,
    });
    await td.replaceEsm("../property-grid-react/components/MultiElementPropertyGrid.js", {
      ...multiElementPropertyGridModule,
      MultiElementPropertyGrid: () => <>MultiElementPropertyGrid</>,
    });
    PropertyGridComponent = (await import("../property-grid-react/PropertyGridComponent.js")).PropertyGridComponent;
  });

  afterEach(() => {
    sinon.restore();
    td.reset();
  });

  it("returns `null` if there is no active imodel", async () => {
    const { container } = render(<PropertyGridComponent />);
    expect(container.children).to.be.empty;
  });

  it("renders `MultiElementPropertyGrid` for active imodel", async () => {
    imodel = createIModel();
    const { getByText } = render(<PropertyGridComponent />);
    await waitFor(() => getByText("MultiElementPropertyGrid"));
  });
});
