/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, TestUtils, waitForElementToBeRemoved } from "../test/test-utils";
import { Reports } from "../widget/components/Reports";
import { NoRenderApp } from "@itwin/core-frontend";
import { ReportsConfigWidget } from "../ReportsConfigWidget";
import { rest } from 'msw'
import { setupServer } from 'msw/node'
import { ActiveIModel, useActiveIModel } from "../widget/hooks/useActiveIModel";
import faker from "@faker-js/faker";

const mockITwinId = faker.datatype.uuid();
const mockIModelId = faker.datatype.uuid();

jest.mock('../widget/hooks/useActiveIModel', () => ({
  useActiveIModel: () => {
    const activeIModel: ActiveIModel = { iTwinId: mockITwinId, iModelId: mockIModelId }
    return activeIModel
  }
}))

const server = setupServer()

beforeAll(async () => {
  await TestUtils.initializeUiFramework();
  await NoRenderApp.startup();
  ReportsConfigWidget.initialize(TestUtils.localization)
  server.listen();

});

afterAll(() => {
  TestUtils.terminateUiFramework();
  server.close();
})

afterEach(() => server.resetHandlers())

describe("Reports Component", () => {

  it("call to action button should be clickable with no reports", async () => {

    server.use(
      rest.get(
        'https://api.bentley.com/insights/reporting/reports',
        async (_req, res, ctx) => {
          return res(ctx.delay(500), ctx.status(200), ctx.json({ reports: [] }))
        },
      ),
    )

    const { user } = render(<Reports />);

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i))

    const ctaButton = screen.getByRole('button', { name: /createonereportcta/i })

    await user.click(ctaButton);

    screen.debug()

  });
});
