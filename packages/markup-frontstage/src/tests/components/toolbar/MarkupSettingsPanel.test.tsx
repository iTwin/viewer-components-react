/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Point } from "@bentley/ui-core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

import MarkupSettingsPanel from "../../../components/toolbar/MarkupSettingsPanel";
import { MarkupFrontstage } from "../../../MarkupFrontstage";
import { I18N } from "@bentley/imodeljs-i18n";

jest.mock("@bentley/imodeljs-i18n", () => ({
  I18N: jest.fn().mockImplementation(() => {
    return {
      translateWithNamespace: () => (props: { defaultProps: any }) => {
        props.defaultProps = {
          ...props.defaultProps,
          translate: () => "",
        };
        return props;
      },
    };
  }),
}));
jest.mock("../../../MarkupFrontstage");

describe("MarkupSettingsPanel tool testing", () => {
  it("should render", () => {
    //arrange
    MarkupFrontstage.initialize(new I18N());
    const { queryByTestId } = render(
      <MarkupSettingsPanel point={Point.create({ x: 0, y: 0 })} />
    );

    //act
    const settingPanel = queryByTestId("markup-settings-tool");

    //assert
    expect(settingPanel).toMatchSnapshot();
  });

  it("should render color picker dropdown when clicked on color picking button", async () => {
    //arrange
    MarkupFrontstage.initialize(new I18N());
    const { getAllByTestId } = render(
      <MarkupSettingsPanel point={Point.create({ x: 0, y: 0 })} />
    );
    const colorPicker = getAllByTestId("components-colorpicker-button");

    if (colorPicker.length > 0) {
      //act
      fireEvent.click(colorPicker[0]);
      const colorDropDown = await waitFor(() =>
        screen.getByTestId("components-colorpicker-popup-colors")
      );

      //assert
      expect(colorDropDown).toMatchSnapshot();
    }
  });

  it("should render weight picker dropdown when clicked on weight picking button", async () => {
    //arrange
    MarkupFrontstage.initialize(new I18N());
    const { getByTestId } = render(
      <MarkupSettingsPanel point={Point.create({ x: 0, y: 0 })} />
    );
    const weightPicker = getByTestId("components-weightpicker-button");

    //act
    fireEvent.click(weightPicker);
    const weightDropDown = await waitFor(() =>
      screen.getByTestId("components-weightpicker-popup-lines")
    );

    //assert
    expect(weightDropDown).toMatchSnapshot();
  });
});
