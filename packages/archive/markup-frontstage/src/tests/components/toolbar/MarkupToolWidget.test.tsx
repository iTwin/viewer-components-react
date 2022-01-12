/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { I18N } from "@bentley/imodeljs-i18n";
import { UiFramework } from "@bentley/ui-framework";
import "@testing-library/jest-dom/extend-expect";
import { render } from "@testing-library/react";
import React from "react";
import configureMockStore from "redux-mock-store";
import { MarkupToolWidget } from "../../../components/toolbar/MarkupToolWidget";
import { MarkupFrontstage } from "../../../MarkupFrontstage";

jest.mock("@bentley/imodeljs-frontend");
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
      registerNamespace: () => {
        return jest.fn();
      },
      unregisterNamespace: () => {
        return jest.fn();
      },
    };
  }),
}));
jest.mock("@bentley/ui-components");
jest.mock("../../../MarkupFrontstage");

const mockStore = configureMockStore([]);

describe("Markup Tool Widget testing", () => {
  let store: any;

  beforeEach(async () => {
    store = mockStore({
      sampleAppState: { placeHolder: false },
      testDifferentFrameworkKey: {
        configurableUiState: {
          snapMode: 1,
          toolPrompt: "test tool prompt",
          theme: "test-theme",
          widgetOpacity: 100,
        },
        sessionState: {
          numItemsSelected: 0,
          availableSelectionScopes: [
            { id: "testId", label: "testPresentationSelectionScope" },
          ],
          activeSelectionScope: "testScope",
          iModelId: "testIModelId",
        },
      },
    });
    await UiFramework.initialize(store, new I18N());
  });

  afterEach(() => {
    UiFramework.terminate();
  });

  it("should render", () => {
    //arrange
    MarkupFrontstage.initialize(new I18N());
    const { queryByTestId } = render(
      <MarkupToolWidget
        isEditable={false}
        closeMarkupFrontstageAsync={jest.fn()}
      />
    );
    //act
    const toolWidget = queryByTestId("markup-tool-widget-container");

    //expect
    expect(toolWidget).toBeInTheDocument();
    expect(toolWidget?.firstChild).toHaveClass("markupVerticalToolbar");
  });
});
