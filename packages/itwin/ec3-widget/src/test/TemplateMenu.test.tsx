/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, screen, waitFor, waitForElementToBeRemoved } from "@testing-library/react";
import * as moq from "typemoq";
import { ReportsClient } from "@itwin/insights-client";
import faker from "@faker-js/faker";
import type { IModelConnection } from "@itwin/core-frontend";
import { renderWithContext } from "./test-utils";
import TemplateMenu from "../components/TemplateMenu";

const activeIModelConnection = moq.Mock.ofType<IModelConnection>();
const reportsClient = moq.Mock.ofType<ReportsClient>();

jest.mock("@itwin/appui-react", () => ({
  ...jest.requireActual("@itwin/appui-react"),
  useActiveIModelConnection: () => activeIModelConnection.object,
}));


describe("Templates view", () => {
  const mockedReports = Array.from(
    { length: 5 },
    (_, index) => ({
      id: index.toString(),
      displayName: "report_" + index,
      description: "desc",
      deleted: false,
      _links: {
        project: {
          href: "reportLink"
        }
      }
    })
  );

  const iTwinId = faker.datatype.uuid();
  const accessToken = faker.datatype.uuid();
  const getAccessTokenFn = async () => accessToken;

  beforeAll(async () => {
    activeIModelConnection.setup((x) => x.iTwinId).returns(() => iTwinId);
    reportsClient.setup(async (x) => x.getReports(accessToken, iTwinId)).returns(async () => mockedReports);
  });

  it("Template Menu should render successfully for creating template", async () => {
    const { container } = renderWithContext({
      component: < TemplateMenu
        goBack={async () => { }}
        created={false}
      />
    });
    expect(container.querySelector(".ec3-templateDetails")).toBeDefined();
    expect(container.querySelector(".ec3-enabled-selection")).toBeDefined();
  });

  it("Template Menu should render successfully for updating template", async () => {
    const { container } = renderWithContext({
      component: < TemplateMenu
        goBack={async () => { }}
        created={true}
      />
    });
    expect(container.querySelector(".ec3-templateDetails")).toBeDefined();
    expect(container.querySelector(".ec3-disabled-selection")).toBeDefined();
  });

  it("Reports should appear in comboBox", async () => {
    const { container } = renderWithContext({
      component: < TemplateMenu
        goBack={async () => { }}
        created={false}
      />,
      reportsClient: reportsClient.object,
      getAccessTokenFn: getAccessTokenFn,
    });

    expect(container.querySelector(".ec3-templateDetails")).toBeDefined();
    expect(container.querySelector(".ec3-enabled-selection")).toBeDefined();
    await waitForElementToBeRemoved(() => container.querySelector("[data-testid='ec3-loadingSpinner']"));

    const rootElement = container.querySelector('.ec3w-report-select-container',) as HTMLDivElement;
    const input = rootElement.querySelector('.iui-input') as HTMLInputElement;
    fireEvent.focus(input);

    const items = document.querySelectorAll('.iui-menu-item');
    items.forEach((item, index) => {
      expect(item).toHaveTextContent(`report_${index}`);
    });
  });
});
