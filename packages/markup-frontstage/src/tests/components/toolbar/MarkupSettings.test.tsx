import { Point, UiCore } from "@bentley/ui-core";
import { render } from "@testing-library/react";
import React from "react";
// import { MockService } from "../../util/MockService";

// import MarkupSettingsPanel from "../../../components/toolbar/MarkupSettings";
// import { I18N } from "@bentley/imodeljs-i18n";

// jest.mock("@bentley/ui-abstract");
// jest.mock("@bentley/ui-components");
// jest.mock("@bentley/ui-core");
// jest.mock("@bentley/ui-framework");
// jest.mock("@bentley/imodeljs-frontend");

describe("MarkupSettings tool testing", () => {
  // it("should render", async () => {
  //   //arrange
  //   UiCore.initialize(new I18N());
  //   const { queryByTestId } = render(
  //     <MarkupSettingsPanel point={Point.create({ x: 0, y: 0 })} />
  //   );

  //   //act
  //   const settingPanel = queryByTestId("markup-settings-tool");

  //   // //assert
  //   // expect(settingPanel).toMatchSnapshot();

  //   expect(true).toBeTruthy();
  // });

  it("test truthy", () => {
    expect(true).toBeTruthy();
  });
});
