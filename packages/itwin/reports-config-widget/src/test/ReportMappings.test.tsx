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
import { Report, ReportMappingCollection, Mapping, MappingSingle, MappingCollection } from "@itwin/insights-client";
import { ReportMappings } from "../widget/components/ReportMappings";
import { Constants, IModel, IModelState } from "@itwin/imodels-client-management";
import { REPORTS_CONFIG_BASE_URL } from "../widget/ReportsConfigUiProvider";
import { prettyDOM } from "@testing-library/react";


const mockITwinId = faker.datatype.uuid();
// Lets work with two iModels for now.
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

const mockProjectIModels = {
  iModels: mockIModelsResponse.map((iModel) => ({ id: iModel.iModel.id, displayName: iModel.iModel.displayName })),
  _links: {
    self: {
      "href": ""
    },
    prev: null,
    next: null
  }
}

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
        `${Constants.api.baseUrl}/${mockIModelId1}`,
        async (_req, res, ctx) => {
          return res(ctx.delay(), ctx.status(200), ctx.json(mockIModelsResponse[0]))
        },
      ),
      rest.get(
        `${Constants.api.baseUrl}/${mockIModelId2}`,
        async (_req, res, ctx) => {
          return res(ctx.delay(), ctx.status(200), ctx.json(mockIModelsResponse[1]))
        },
      ),
      ...iModelHandlers
    )

    render(<ReportMappings report={mockReport} goBack={jest.fn()} />);

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i))


    const horizontalTiles = screen.getAllByTestId("horizontal-tile");

    expect(horizontalTiles).toHaveLength(mockMappings.length);


    for (let [index, horizontalTile] of horizontalTiles.entries()) {
      const reportMappingTile = within(horizontalTile);
      const iModel = mockIModelsResponse.find((iModel) => iModel.iModel.id === mockMappings[index].mapping?._links?.imodel?.href)
      expect(reportMappingTile.getByText(mockMappings[index].mapping?.mappingName ?? "")).toBeInTheDocument();
      expect(reportMappingTile.getByTitle(mockMappings[index].mapping?.description ?? "")).toBeInTheDocument();
      expect(reportMappingTile.getByText(iModel?.iModel.displayName ?? "")).toBeInTheDocument();

    }
  })

  it("search for a report mapping", async () => {
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
        `${Constants.api.baseUrl}/${mockIModelId1}`,
        async (_req, res, ctx) => {
          return res(ctx.delay(), ctx.status(200), ctx.json(mockIModelsResponse[0]))
        },
      ),
      rest.get(
        `${Constants.api.baseUrl}/${mockIModelId2}`,
        async (_req, res, ctx) => {
          return res(ctx.delay(), ctx.status(200), ctx.json(mockIModelsResponse[1]))
        },
      ),
      ...iModelHandlers
    )

    const { user } = render(<ReportMappings report={mockReport} goBack={jest.fn()} />);

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i))


    const searchButton = within(screen.getByTestId(/search-bar/i)).getByRole('button');
    await user.click(searchButton);
    const searchInput = screen.getByRole('textbox', { name: /search\-textbox/i })

    // Be an exact match on display name.
    await userEvent.type(searchInput, mockMappings[0].mapping?.mappingName ?? "");
    expect(screen.getAllByTestId("horizontal-tile")).toHaveLength(1);
    expect(screen.getByText(mockMappings[0].mapping?.mappingName ?? "")).toBeInTheDocument()


    // Be an exact match on description.
    await userEvent.clear(searchInput);
    await userEvent.type(searchInput, mockMappings[0].mapping?.description ?? "");
    expect(screen.getAllByTestId("horizontal-tile")).toHaveLength(1);
    expect(screen.getByTitle(mockMappings[0].mapping?.description ?? "")).toBeInTheDocument()

    // Be an exact match on iModel Name.
    const iModel = mockIModelsResponse.find((iModel) => iModel.iModel.id === mockMappings[0].mapping?._links?.imodel?.href)
    await userEvent.clear(searchInput);
    await userEvent.type(searchInput, iModel?.iModel.displayName ?? "");
    expect(screen.getAllByTestId("horizontal-tile")).toHaveLength(1);
    expect(screen.getByText(iModel?.iModel.displayName ?? "")).toBeInTheDocument()

  });

  it("remove a report", async () => {
    const mockReportMappings = mockReportMappingsFactory();
    let [_, iModelHandlers] = mockMappingsFactory(mockReportMappings)

    const mockReportMappingsOriginalSize = mockReportMappings.mappings!.length;

    server.use(
      rest.get(
        `${REPORTS_CONFIG_BASE_URL}/insights/reporting/reports/${mockReportId}/datasources/imodelMappings`,
        async (_req, res, ctx) => {
          return res(ctx.delay(), ctx.status(200), ctx.json(mockReportMappings))
        },
      ),
      rest.get(
        `${Constants.api.baseUrl}/${mockIModelId1}`,
        async (_req, res, ctx) => {
          return res(ctx.delay(), ctx.status(200), ctx.json(mockIModelsResponse[0]))
        },
      ),
      rest.get(
        `${Constants.api.baseUrl}/${mockIModelId2}`,
        async (_req, res, ctx) => {
          return res(ctx.delay(), ctx.status(200), ctx.json(mockIModelsResponse[1]))
        },
      ),
      ...iModelHandlers,
      rest.delete(
        `${REPORTS_CONFIG_BASE_URL}/insights/reporting/reports/${mockReportId}/datasources/imodelMappings/${mockReportMappings.mappings![0].mappingId ?? ""}`,
        async (_req, res, ctx) => {
          mockReportMappings.mappings = mockReportMappings.mappings!.filter((mapping) => mapping.mappingId !== mockReportMappings.mappings![0].mappingId ?? "")
          return res(ctx.delay(100), ctx.status(204))
        },
      ),
    )

    const { user } = render(<ReportMappings report={mockReport} goBack={jest.fn()} />);

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i))

    const firstMenuDropdown = within(screen.getAllByTestId(/tile-action-button/i)[0]).getByRole('button');
    await user.click(firstMenuDropdown);
    const removeButton = screen.getByRole('menuitem', { name: /remove/i })
    await user.click(removeButton);
    //Delete modal dialog should appear
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const deleteButton = screen.getByRole('button', {
      name: /delete/i
    })

    await user.click(deleteButton);

    await waitForElementToBeRemoved(() => screen.getByTestId(/rcw-loading-delete/i));
    await waitForElementToBeRemoved(() => screen.getByRole('dialog'))

    // Should be one less mapping
    expect(screen.getAllByTestId("horizontal-tile")).toHaveLength(mockReportMappingsOriginalSize - 1)

  });


  it("add mapping", async () => {
    const mockReportMappings = mockReportMappingsFactory();
    let [mockMappings, iModelHandlers] = mockMappingsFactory(mockReportMappings)

    // Adding an extra unmapped mapping.
    const extraMappingId = faker.datatype.uuid();
    const extraMappingName = faker.random.word();

    mockMappings.push({
      mapping: {
        id: extraMappingId,
        mappingName: extraMappingName,
        description: faker.random.words(),
        extractionEnabled: false,
        createdOn: "",
        createdBy: "",
        modifiedOn: "",
        modifiedBy: "",
        _links: {
          imodel: {
            href: ""
          }
        }
      }
    })

    const mockMappingsResponse: MappingCollection = {
      // Type guarding
      mappings: mockMappings.map((mapping) => mapping.mapping).filter((mapping): mapping is Mapping => !!mapping),
      _links: {
        next: undefined,
        self: {
          href: ""
        }
      }
    }

    server.use(
      rest.get(
        `${REPORTS_CONFIG_BASE_URL}/insights/reporting/reports/${mockReportId}/datasources/imodelMappings`,
        async (_req, res, ctx) => {
          return res(ctx.delay(), ctx.status(200), ctx.json(mockReportMappings))
        },
      ),
      rest.get(
        `${Constants.api.baseUrl}`,
        async (_req, res, ctx) => {
          return res(ctx.delay(), ctx.status(200), ctx.json(mockProjectIModels))
        },
      ),
      rest.get(
        `${Constants.api.baseUrl}/${mockIModelId1}`,
        async (_req, res, ctx) => {
          return res(ctx.delay(), ctx.status(200), ctx.json(mockIModelsResponse[0]))
        },
      ),
      rest.get(
        `${Constants.api.baseUrl}/${mockIModelId2}`,
        async (_req, res, ctx) => {
          return res(ctx.delay(), ctx.status(200), ctx.json(mockIModelsResponse[1]))
        },
      ),
      rest.get(
        `${REPORTS_CONFIG_BASE_URL}/insights/reporting/datasources/imodels/${mockProjectIModels.iModels[0].id}/mappings`,
        async (_req, res, ctx) => {
          return res(ctx.delay(), ctx.status(200), ctx.json(mockMappingsResponse))
        },
      ),
      rest.post(
        `${REPORTS_CONFIG_BASE_URL}/insights/reporting/reports/${mockReportId}/datasources/imodelMappings`,
        async (_req, res, ctx) => {
          return res(ctx.delay(), ctx.status(200), ctx.json(mockReportMappings))
        },
      ),
      ...iModelHandlers,
    )

    const { user } = render(<ReportMappings report={mockReport} goBack={jest.fn()} />);

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i))

    const addMappingButton = screen.getByRole('button', {
      name: /addmapping/i
    })

    await user.click(addMappingButton);

    await waitForElementToBeRemoved(() => screen.getByTestId(/rcw-action-loading-spinner/i));
    //Add modal dialog should appear
    const modal = screen.getByRole('dialog');
    expect(screen.getByRole('dialog')).toBeInTheDocument();


    const withinModal = within(modal);
    expect(withinModal.getByText(/addmappings/i)).toBeInTheDocument();


    const addButton = withinModal.getByRole('button', {
      name: /add/i
    });
    //Add button should be disabled
    expect(addButton).toBeDisabled();

    // Already mapped mappings are disabled
    for (let i = 0; i < mockMappings.length - 1; i++) {

      const row = screen.getByRole('row', {
        name: new RegExp(`toggle row selected ${mockMappings[i].mapping?.mappingName} ${mockMappings[i].mapping?.description}`, 'i')
      });

      const checkbox = within(row).getByRole('checkbox', {
        name: /toggle row selected/i
      });
      expect(checkbox).toBeDisabled();

    }

    // Check on new mapping
    const row = screen.getByRole('row', {
      name: new RegExp(`toggle row selected ${mockMappings[mockMappings.length - 1].mapping?.mappingName} ${mockMappings[mockMappings.length - 1].mapping?.description}`, 'i')
    });

    const checkbox = within(row).getByRole('checkbox', {
      name: /toggle row selected/i
    });

    await user.click(checkbox);

    await user.click(addButton);
    // Modal should go away
    await waitForElementToBeRemoved(() => screen.getByTestId(/rcw-action-loading-spinner/i));
    await waitForElementToBeRemoved(() => screen.getByRole('dialog'))
  })
})