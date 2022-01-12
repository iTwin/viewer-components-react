/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Point } from "@bentley/ui-core";
import "@testing-library/jest-dom/extend-expect";
import { render } from "@testing-library/react";
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

jest.mock("@bentley/ui-components");
jest.mock("@bentley/ui-framework");
jest.mock("../../../MarkupFrontstage");

describe("MarkupSettingsPanel tool testing", () => {
  it("should render", async() => {
    //arrange
    await MarkupFrontstage.initialize(new I18N());
    const { queryByTestId } = render(
      <MarkupSettingsPanel point={Point.create({ x: 0, y: 0 })} />
    );

    //act
    const settingPanel = queryByTestId("markup-settings-tool");

    //assert
    expect(settingPanel).toBeInTheDocument();
  });

});
