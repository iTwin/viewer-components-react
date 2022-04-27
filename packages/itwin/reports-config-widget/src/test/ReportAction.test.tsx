/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import faker from "@faker-js/faker";
import { NoRenderApp } from "@itwin/core-frontend";
import { setupServer } from "msw/lib/types/node";
import { ReportsConfigWidget } from "../ReportsConfigWidget";
import { ActiveIModel } from "../widget/hooks/useActiveIModel";
import { TestUtils } from "./test-utils";


const mockITwinId = faker.datatype.uuid();
const mockIModelId = faker.datatype.uuid();

jest.mock('../widget/hooks/useActiveIModel', () => ({
  useActiveIModel: () => {
    const activeIModel: ActiveIModel = { iTwinId: mockITwinId, iModelId: mockIModelId }
    return activeIModel
  }
}))

jest.mock('../widget/components/ReportMappings', () => ({ ReportMappings: () => 'MockReportMappings' }));

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

describe("Reports Action", () => {


});