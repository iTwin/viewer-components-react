/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { PropertyRecord, PropertyValueFormat } from "@itwin/appui-abstract";
import { PropertyDataChangeEvent } from "@itwin/components-react";
import { waitFor } from "@testing-library/react";
import { PropertyGridContent } from "../../components/PropertyGridContent";
import { PropertyGridSettingsMenuItem, ShowHideNullValuesSettingsMenuItem } from "../../components/SettingsDropdownMenu";
import { NullValueSettingContext } from "../../hooks/UseNullValuesSetting";
import { PropertyGridManager } from "../../PropertyGridManager";
import { createPropertyRecord, renderWithUser, stubSelectionManager } from "../TestUtils";

import type { ReactElement } from "react";
import type { PrimitiveValue } from "@itwin/appui-abstract";
import type { IModelConnection } from "@itwin/core-frontend";
import type { IPresentationPropertyDataProvider } from "@itwin/presentation-components";
import type { PropertyGridContentProps } from "../../components/PropertyGridContent";

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
            createPropertyRecord({ valueFormat: PropertyValueFormat.Primitive, value: undefined }, { name: "null-prop", displayLabel: "Null Prop" }),
          ],
        },
      };
    },
  } as unknown as IPresentationPropertyDataProvider;

  function renderWithContext(ui: ReactElement) {
    return renderWithUser(
      <NullValueSettingContext>
        {ui}
      </NullValueSettingContext>
    );
  }

  it("renders header with instance label", async () => {
    const imodel = {} as IModelConnection;
    const { getByText, queryByText } = renderWithContext(
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

    const { getByText, getByRole, user } = renderWithContext(
      <PropertyGridContent
        dataProvider={provider}
        imodel={imodel}
        onBackButton={onBackClickSpy}
      />
    );

    await waitFor(() => getByText("Test Prop"));
    const backButton = getByRole("button", { name: "header.back" });
    await user.click(backButton);
    expect(onBackClickSpy).to.be.calledOnce;
  });

  it("renders header with settings dropdown", async () => {
    const imodel = {} as IModelConnection;
    const spy = sinon.spy();

    const { getByText, getByRole, user } = renderWithContext(
      <PropertyGridContent
        dataProvider={provider}
        imodel={imodel}
        settingsMenuItems={[
          () => <PropertyGridSettingsMenuItem id="testSetting" onClick={spy}>Test Setting</PropertyGridSettingsMenuItem>,
        ]}
      />
    );

    const settingsButton = await waitFor(() => getByRole("button", { name: "settings.label" }));
    await user.click(settingsButton);

    const setting = await waitFor(() => getByText("Test Setting"));
    await user.click(setting);

    expect(spy).to.be.calledOnce;
  });

  it("allows filtering out empty values", async () => {
    const imodel = {} as IModelConnection;

    const { getByText, getByRole, queryByText, user } = renderWithContext(
      <PropertyGridContent
        dataProvider={provider}
        imodel={imodel}
        settingsMenuItems={[
          (props) => <ShowHideNullValuesSettingsMenuItem {...props} />,
        ]}
      />
    );

    await waitFor(() => {
      expect(queryByText("Test Prop")).to.not.be.null;
      expect(queryByText("Null Prop")).to.not.be.null;
    });

    const settingsButton = await waitFor(() => getByRole("button", { name: "settings.label" }));
    await user.click(settingsButton);

    const setting = await waitFor(() => getByText("settings.hide-null.label"));
    await user.click(setting);

    await waitFor(() => {
      expect(queryByText("Test Prop")).to.not.be.null;
      expect(queryByText("Null Prop")).to.be.null;
    });
  });

  it("allows editing property", async () => {
    const imodel = {} as IModelConnection;
    const stub = sinon.stub<Parameters<Required<PropertyGridContentProps>["onPropertyUpdated"]>, ReturnType<Required<PropertyGridContentProps>["onPropertyUpdated"]>>().resolves(true);

    const { findByText, findByDisplayValue, user } = renderWithContext(
      <PropertyGridContent
        dataProvider={provider}
        imodel={imodel}
        isPropertyEditingEnabled={true}
        onPropertyUpdated={stub}
      />
    );

    const propertyValue = await findByText("Prop Value");

    // enter editing mode
    await user.dblClick(propertyValue);

    const editor = await findByDisplayValue("Prop Value");
    // type ` Updated` and press enter to commit new value
    await user.type(editor, " Updated{Enter}");

    await waitFor(() => {
      expect(stub).to.be.calledOnce;
      const [{ dataProvider, newValue }] = stub.args[0];
      expect(dataProvider).to.be.eq(provider);
      expect((newValue as PrimitiveValue).value).to.be.eq("Prop Value Updated");
    });
  });
});
