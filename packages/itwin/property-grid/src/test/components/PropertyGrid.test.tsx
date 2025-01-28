/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import sinon from "sinon";
import { PropertyRecord, PropertyValueFormat } from "@itwin/appui-abstract";
import { KeySet } from "@itwin/presentation-common";
import { PresentationPropertyDataProvider } from "@itwin/presentation-components";
import { PropertyGrid } from "../../property-grid-react/components/PropertyGrid.js";
import { PropertyGridManager } from "../../property-grid-react/PropertyGridManager.js";
import { createPropertyRecord, render, stubFavoriteProperties, stubPresentation, stubSelectionManager, waitFor } from "../TestUtils.js";

import type { IModelConnection } from "@itwin/core-frontend";

describe("<PropertyGrid />", () => {
  let selectionManager: ReturnType<typeof stubSelectionManager>;

  before(() => {
    sinon.stub(PropertyGridManager, "translate").callsFake((key) => key);

    selectionManager = stubSelectionManager();
    stubPresentation();
    stubFavoriteProperties();

    sinon.stub(PresentationPropertyDataProvider.prototype, "getData").callsFake(async () => {
      return {
        categories: [{ expand: true, label: "Test Category", name: "test-category" }],
        label: PropertyRecord.fromString("Test Instance"),
        records: {
          ["test-category"]: [
            createPropertyRecord(
              { valueFormat: PropertyValueFormat.Primitive, value: "Prop Value", displayValue: "Prop Value" },
              { name: "test-prop", displayLabel: "Test Prop" },
            ),
          ],
        },
      };
    });
  });

  after(() => {
    sinon.restore();
  });

  it("renders content", async () => {
    const imodel = {} as IModelConnection;
    selectionManager.getSelection.returns(new KeySet());

    const { getByText } = render(<PropertyGrid imodel={imodel} />);

    await waitFor(() => getByText("Test Prop"));
  });

  it("renders info message when too many elements selected", async () => {
    const imodel = {} as IModelConnection;
    const keys = Array(500)
      .fill(0)
      .map((_, i) => ({ id: `0x${i}`, className: "TestClass" }));
    selectionManager.getSelection.returns(new KeySet(keys));

    const { getByText } = render(<PropertyGrid imodel={imodel} />);

    await waitFor(() => getByText("selection.too-many-elements-selected"));
  });

  it("renders header controls when too many elements selected", async () => {
    const imodel = {} as IModelConnection;
    const keys = Array(500)
      .fill(0)
      .map((_, i) => ({ id: `0x${i}`, className: "TestClass" }));
    selectionManager.getSelection.returns(new KeySet(keys));

    const { getByText } = render(<PropertyGrid imodel={imodel} headerControls={[<div key={1}>TestControl</div>]} />);

    await waitFor(() => getByText("TestControl"));
  });
});
