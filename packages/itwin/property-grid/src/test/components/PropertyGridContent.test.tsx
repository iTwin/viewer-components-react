/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { PropertyRecord, PropertyValueFormat } from "@itwin/appui-abstract";
import { PropertyDataChangeEvent } from "@itwin/components-react";
import { render, waitFor } from "@testing-library/react";
import userEvents from "@testing-library/user-event";
import { PropertyGridContent, PropertyGridManager } from "../../property-grid-react";
import { createPropertyRecord, stubSelectionManager } from "../TestUtils";

import type { IModelConnection } from "@itwin/core-frontend";
import type { IPresentationPropertyDataProvider } from "@itwin/presentation-components";

describe("<PropertyGridContent />", () => {
  before(() => {
    sinon.stub(PropertyGridManager, "translate").callsFake((key) => key);
    stubSelectionManager();
  });

  after(() => {
    sinon.restore();
  });

  const provider = {
    onDataChanged: new PropertyDataChangeEvent(),
    getData: async () => {
      return {
        categories: [{
          expand: true,
          label: "Test Category",
          name: "test-category",
        }],
        label: PropertyRecord.fromString("Test Instance"),
        records: {
          ["test-category"]: [
            createPropertyRecord({ valueFormat: PropertyValueFormat.Primitive, value: "Prop Value", displayValue: "Prop Value" }, { name: "test-prop", displayLabel: "Test Prop" }),
          ],
        },
      };
    },
  } as unknown as IPresentationPropertyDataProvider;

  it("renders header with instance label", async () => {
    const imodel = {} as IModelConnection;
    const { getByText, queryByText } = render(
      <PropertyGridContent
        dataProvider={provider}
        imodel={imodel}
      />
    );

    await waitFor(() => getByText("Test Prop"));
    expect(queryByText("Test Instance")).to.not.be.null;
  });

  it("renders header with back button", async () => {
    const imodel = {} as IModelConnection;
    const onBackClickSpy = sinon.spy();

    const { getByText, getByRole } = render(
      <PropertyGridContent
        dataProvider={provider}
        imodel={imodel}
        onBackButton={onBackClickSpy}
      />
    );

    await waitFor(() => getByText("Test Prop"));
    const backButton = getByRole("button", { name: "header.back" });
    await userEvents.click(backButton);
    expect(onBackClickSpy).to.be.calledOnce;
  });
});
