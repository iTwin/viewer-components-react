/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import {
  SpatialViewState,
  RemoteBriefcaseConnection,
} from "@bentley/imodeljs-frontend";
import { I18N } from "@bentley/imodeljs-i18n";

import { MarkupFrontstageProvider } from "../../../components/ui/MarkupFrontstageProvider";
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
jest.mock("@bentley/imodeljs-markup");
jest.mock("@bentley/ui-components");
jest.mock("@bentley/ui-core");
jest.mock("@bentley/ui-framework");
jest.mock("../../../MarkupFrontstage");
jest.mock("../../../components/toolbar/MarkupSettingsPanel");
jest.mock("../../../components/toolbar/MarkupToolWidget");

describe("Markup Tool Widget testing", () => {
  it("should initialize", () => {
    //arrange
    MarkupFrontstage.initialize(new I18N());
    const MockViewState = jest.fn<SpatialViewState, []>();
    const MockIModelConnection = jest.fn<RemoteBriefcaseConnection, []>();

    //act
    const markupFrontstageProvider = new MarkupFrontstageProvider(
      new MockViewState(),
      new MockIModelConnection(),
      true,
      "mock-configurable-ui-control"
    );
    //expect
    expect(markupFrontstageProvider).toBeDefined();
  });
});
