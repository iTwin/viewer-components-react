/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import sinon from "sinon";
import { PropertyRecord, PropertyValueFormat } from "@itwin/appui-abstract";
import { PresentationPropertyDataProvider } from "@itwin/presentation-components";
import { render, waitFor } from "@testing-library/react";
import { SingleElementPropertyGrid } from "../../property-grid-react";
import { createPropertyRecord, stubFavoriteProperties, stubPresentation } from "../TestUtils";

import type { IModelConnection } from "@itwin/core-frontend";
import type { InstanceKey } from "@itwin/presentation-common";

describe("<SingleElementPropertyGrid />", () => {
  before(() => {
    stubPresentation();
    stubFavoriteProperties();

    sinon.stub(PresentationPropertyDataProvider.prototype, "getData").callsFake(async () => {
      return {
        categories: [{ expand: true, label: "Test Category", name: "test-category" }],
        label: PropertyRecord.fromString("Test Instance"),
        records: {
          ["test-category"]: [
            createPropertyRecord({ valueFormat: PropertyValueFormat.Primitive, value: "Prop Value", displayValue: "Prop Value" }, { name: "test-prop", displayLabel: "Test Prop" }),
          ],
        },
      };
    });
  });

  after(() => {
    sinon.restore();
  });

  it("renders", async () => {
    const imodel = {} as IModelConnection;
    const instanceKey: InstanceKey = { id: "0x10", className: "TestClass" };

    const { getByText } = render(
      <SingleElementPropertyGrid
        imodel={imodel}
        instanceKey={instanceKey}
      />
    );

    await waitFor(() => getByText("Test Prop"));
  });
});
