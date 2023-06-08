/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { render, waitFor } from "@testing-library/react";
import userEvents from "@testing-library/user-event";
import { createShowNullValuesSettingProvider, PropertyGridManager, SettingsDropdownMenu } from "../../property-grid-react";

import type { IPresentationPropertyDataProvider } from "@itwin/presentation-components";

describe("<SettingsDropdownMenu />", () => {
  before(() => {
    sinon.stub(PropertyGridManager, "translate").callsFake((key) => key);
  });

  after(() => {
    sinon.restore();
  });

  it("renders nothing if no settings provided", async () => {
    const { container } = render(<SettingsDropdownMenu dataProvider={{} as IPresentationPropertyDataProvider} showNullValues={true} setShowNullValues={async () => {}} />);
    expect(container.children).to.have.lengthOf(0);
  });

  it("renders provided settings", async () => {
    const spy = sinon.spy();
    const { getByRole, getByText } = render(
      <SettingsDropdownMenu
        dataProvider={{} as IPresentationPropertyDataProvider}
        showNullValues={true}
        setShowNullValues={async () => {}}
        settingProviders={[
          () => [{ id: "test-setting", label: "Test Setting", action: spy }],
        ]}
      />
    );

    const dropdownButton = getByRole("button", { name: "settings.label" });
    await userEvents.click(dropdownButton);

    const setting = await waitFor(() => getByText("Test Setting"));
    await userEvents.click(setting);

    await waitFor(() => expect(spy).to.be.calledOnce);
  });

  describe("'hide null value' setting", () => {
    [true, false].map((persist) => {
      it(`calls 'setShowNullValues' with 'options.persist: ${persist}'`, async () => {
        const spy = sinon.spy();
        const { getByRole, getByText } = render(
          <SettingsDropdownMenu
            dataProvider={{} as IPresentationPropertyDataProvider}
            showNullValues={true}
            setShowNullValues={spy}
            settingProviders={[
              createShowNullValuesSettingProvider(persist),
            ]}
          />
        );

        const dropdownButton = getByRole("button", { name: "settings.label" });
        await userEvents.click(dropdownButton);

        const setting = await waitFor(() => getByText("settings.hide-null.label"));
        await userEvents.click(setting);

        await waitFor(() => expect(spy).to.be.calledOnceWith(false, sinon.match((options) => options.persist === persist)));
      });
    });
  });

  describe("'show null value' setting", () => {
    [true, false].map((persist) => {
      it(`calls 'setShowNullValues' with 'options.persist: ${persist}'`, async () => {
        const spy = sinon.spy();
        const { getByRole, getByText } = render(
          <SettingsDropdownMenu
            dataProvider={{} as IPresentationPropertyDataProvider}
            showNullValues={false}
            setShowNullValues={spy}
            settingProviders={[
              createShowNullValuesSettingProvider(persist),
            ]}
          />
        );

        const dropdownButton = getByRole("button", { name: "settings.label" });
        await userEvents.click(dropdownButton);

        const setting = await waitFor(() => getByText("settings.show-null.label"));
        await userEvents.click(setting);

        await waitFor(() => expect(spy).to.be.calledOnceWith(true, sinon.match((options) => options.persist === persist)));
      });
    });
  });
});
