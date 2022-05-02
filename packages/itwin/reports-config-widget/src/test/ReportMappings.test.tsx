/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import faker from "@faker-js/faker";
import "@testing-library/jest-dom";
import { NoRenderApp } from "@itwin/core-frontend";
import { ReportsConfigWidget } from "../ReportsConfigWidget";
import { setupServer } from 'msw/node'
import { ActiveIModel } from "../widget/hooks/useActiveIModel";
import { render, TestUtils, screen, waitForElementToBeRemoved, within } from "./test-utils";
import ReportAction from "../widget/components/ReportAction";
import userEvent from "@testing-library/user-event";
import { RequestHandler, rest } from "msw";
import { Report, ReportMappingCollection, Mapping, MappingSingle } from "@itwin/insights-client";
import { ReportMappings } from "../widget/components/ReportMappings";
import { IModel, IModelState } from "@itwin/imodels-client-management";
import { REPORTS_CONFIG_BASE_URL } from "../widget/ReportsConfigUiProvider";
import { prettyDOM } from "@testing-library/react";


const mockITwinId = faker.datatype.uuid();
const mockIModelId1 = faker.datatype.uuid();
const mockIModelId2 = faker.datatype.uuid();
const mockReportId = faker.datatype.uuid();


jest.mock('../widget/hooks/useActiveIModel', () => ({
  useActiveIModel: () => {
    const activeIModel: ActiveIModel = { iTwinId: mockITwinId, iModelId: mockIModelId1 }
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

const mockIModelsResponse = [{
  iModel: {
    id: mockIModelId1,
    displayName: faker.random.word(),
    name: faker.random.word(),
    description: faker.random.words(),
    createdDateTime: "2021-10-04T22:13:50.397Z",
    state: IModelState.Initialized,
    projectId: mockITwinId,
    extent: null,
    _links: {
      creator: {
        href: ""
      },
      namedVersions: {
        href: ""
      },
      changesets: {
        href: ""
      }
    }
  }
},
{
  iModel: {
    id: mockIModelId2,
    displayName: faker.random.word(),
    name: faker.random.word(),
    description: faker.random.words(),
    createdDateTime: "2021-10-04T22:13:50.397Z",
    state: IModelState.Initialized,
    projectId: mockITwinId,
    extent: null,
    _links: {
      creator: {
        href: ""
      },
      namedVersions: {
        href: ""
      },
      changesets: {
        href: ""
      }
    }
  }
}]

const mockReport: Report = {
  id: mockReportId,
  displayName: faker.random.word(),
  description: faker.random.words(),
  deleted: false,
  _links: {
    project: {
      href: ""
    }
  }
}
const mockReportMappingsFactory = (): ReportMappingCollection => {
  return {
    mappings: [
      {
        reportId: mockReportId,
        mappingId: faker.datatype.uuid(),
        imodelId: mockIModelId1,
        _links: {
          report: {
            href: ""
          },
          mapping: {
            href: ""
          },
          imodel: {
            href: ""
          }
        }
      },
      {
        reportId: mockReportId,
        mappingId: faker.datatype.uuid(),
        imodelId: mockIModelId2,
        _links: {
          report: {
            href: ""
          },
          mapping: {
            href: ""
          },
          imodel: {
            href: ""
          }
        }
      },
    ],
    _links: {
      next: undefined,
      self: {
        href: ""
      }
    }
  }
}

const mockMappingsFactory = (mockReportMappings: ReportMappingCollection): [MappingSingle[], RequestHandler[]] => {

  const mockMappings: MappingSingle[] = mockReportMappings.mappings!.map((mapping) => ({
    mapping: {
      id: mapping.mappingId,
      mappingName: faker.random.word(),
      description: faker.random.words(),
      extractionEnabled: false,
      createdOn: "",
      createdBy: "",
      modifiedOn: "",
      modifiedBy: "",
      _links: {
        imodel: {
          // Tie the mapping to to the iModel Id
          href: mapping.imodelId
        }
      }
    }
  }))

  const iModelHandlers: RequestHandler[] = mockMappings.map((mapping) => (rest.get(
    `${REPORTS_CONFIG_BASE_URL}/insights/reporting/datasources/imodels/${mapping.mapping?._links?.imodel?.href ?? ""}/mappings/${mapping.mapping?.id}`,
    async (_req, res, ctx) => {
      return res(ctx.delay(), ctx.status(200), ctx.json(mapping))
    },
  )))

  return [mockMappings, iModelHandlers]
}


describe(("Report Mappings View"), () => {
  it("shows all report mappings", async () => {
    const mockReportMappings = mockReportMappingsFactory();
    const [mockMappings, iModelHandlers] = mockMappingsFactory(mockReportMappings)

    server.use(
      rest.get(
        `${REPORTS_CONFIG_BASE_URL}/insights/reporting/reports/${mockReportId}/datasources/imodelMappings`,
        async (_req, res, ctx) => {
          return res(ctx.delay(), ctx.status(200), ctx.json(mockReportMappings))
        },
      ),
      rest.get(
        `${REPORTS_CONFIG_BASE_URL}/imodels/${mockIModelId1}`,
        async (_req, res, ctx) => {
          return res(ctx.delay(), ctx.status(200), ctx.json(mockIModelsResponse[0]))
        },
      ),
      rest.get(
        `${REPORTS_CONFIG_BASE_URL}/imodels/${mockIModelId2}`,
        async (_req, res, ctx) => {
          return res(ctx.delay(), ctx.status(200), ctx.json(mockIModelsResponse[1]))
        },
      ),
      ...iModelHandlers
    )

    const { user } = render(<ReportMappings report={mockReport} goBack={jest.fn()} />);

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i))


    const horizontalTiles = screen.getAllByTestId("horizontal-tile");
    //TODO check for all descriptions and names and imodels
    expect(horizontalTiles).toHaveLength(mockMappings.length);


    for (let [index, horizontalTile] of horizontalTiles.entries()) {
      const reportMappingTile = within(horizontalTile);
      const iModel = mockIModelsResponse.find((iModel) => iModel.iModel.id === mockMappings[index].mapping?._links?.imodel?.href)
      expect(reportMappingTile.getByText(mockMappings[index].mapping?.mappingName ?? "")).toBeInTheDocument();
      expect(reportMappingTile.getByTitle(mockMappings[index].mapping?.description ?? "")).toBeInTheDocument();
      expect(reportMappingTile.getByText(iModel?.iModel.displayName ?? "")).toBeInTheDocument();

    }



    // screen.debug()

  })


})