import { Point } from "@bentley/ui-core";
import { render } from "@testing-library/react";
import React from "react";

import MarkupSettingsPanel from "../../../components/toolbar/MarkupSettings";
import { MarkupFrontstage } from "../../../MarkupFrontstage";
import { I18N } from "@bentley/imodeljs-i18n";

jest.mock("../../../MarkupFrontstage");
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

describe("MarkupSettings tool testing", () => {
  it("should render", () => {
    // //arrange
    MarkupFrontstage.initialize(new I18N());
    const { queryByTestId } = render(
      <MarkupSettingsPanel point={Point.create({ x: 0, y: 0 })} />
    );

    //act
    const settingPanel = queryByTestId("markup-settings-tool");

    //assert
    expect(settingPanel).toMatchSnapshot();
  });
});
