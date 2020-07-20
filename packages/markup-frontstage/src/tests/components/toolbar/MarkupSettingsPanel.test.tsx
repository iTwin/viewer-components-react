/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Point } from "@bentley/ui-core";
import "@testing-library/jest-dom/extend-expect";
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
    const { queryByTestId, queryAllByTestId } = render(
      <MarkupSettingsPanel point={Point.create({ x: 0, y: 0 })} />
    );

    //act
    const settingPanel = queryByTestId("markup-settings-tool");
    const strokeButton = queryByTestId("stroke-color-picker-button");
    const fillButton = queryByTestId("fill-color-picker-button");
    const strokeWeightButton = queryByTestId("stroke-weight-picker-button");
    const alphaSlider = queryAllByTestId("alpha-slider");
    const textColorButton = queryByTestId("text-color-picker-button");

    //assert
    expect(settingPanel).toBeInTheDocument();
    expect(strokeButton).toBeInTheDocument();
    expect(fillButton).toBeInTheDocument();
    expect(strokeWeightButton).toBeInTheDocument();
    if (alphaSlider.length > 0) {
      expect(alphaSlider[0]).toBeInTheDocument();
    }
    expect(textColorButton).toBeInTheDocument();
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
      expect(colorDropDown).toBeInTheDocument();
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
    expect(weightDropDown).toBeInTheDocument();
  });
});
