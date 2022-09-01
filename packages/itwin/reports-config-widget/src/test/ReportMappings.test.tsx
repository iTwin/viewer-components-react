/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import faker from "@faker-js/faker";
import "@testing-library/jest-dom";
import type {
  IModelConnection,
  SelectionSet,
  SelectionSetEvent,
} from "@itwin/core-frontend";
import { NoRenderApp } from "@itwin/core-frontend";
import { ReportsConfigWidget } from "../ReportsConfigWidget";
import { setupServer } from "msw/node";
import {
  render,
  screen,
  TestUtils,
  waitForElementToBeRemoved,
  within,
} from "./test-utils";
import userEvent from "@testing-library/user-event";
import * as moq from "typemoq";
import type { RequestHandler } from "msw";
import { rest } from "msw";
import type {
  ExtractionStatusSingle,
  Mapping,
  MappingCollection,
  MappingSingle,
  Report,
  ReportMappingCollection,
} from "@itwin/insights-client";
import {
  ExtractorState,
} from "@itwin/insights-client";
import { ReportMappings } from "../widget/components/ReportMappings";
import { Constants, IModelState } from "@itwin/imodels-client-management";
import { REPORTS_CONFIG_BASE_URL } from "../widget/ReportsConfigUiProvider";
import { REFRESH_DELAY } from "../widget/components/Extraction";
import type {
  SelectionManager,
  SelectionScopesManager,
} from "@itwin/presentation-frontend";
import {
  Presentation,
  SelectionChangeEvent,
} from "@itwin/presentation-frontend";
import type { BeEvent } from "@itwin/core-bentley";

// For the extraction test
jest.setTimeout(20000);

const mockITwinId = faker.datatype.uuid();
// Lets work with two iModels for now.
const mockIModelId1 = faker.datatype.uuid();
const mockIModelId2 = faker.datatype.uuid();

const mockReportId = faker.datatype.uuid();

const mockIModelsResponse = [
  {
    iModel: {
      id: mockIModelId1,
      displayName: "rAnDoMdIsPlAynAmE1",
      name: "rAnDomName1",
      description: "rAnDoMDeScRiPtIoN1",
      createdDateTime: "2021-10-04T22:13:50.397Z",
      state: IModelState.Initialized,
      projectId: mockITwinId,
      extent: null,
      _links: {
        creator: {
          href: "",
        },
        namedVersions: {
          href: "",
        },
        changesets: {
          href: "",
        },
      },
    },
  },
  {
    iModel: {
      id: mockIModelId2,
      displayName: "rAnDoMdIsPlAynAmE2",
      name: "rAnDomName2",
      description: "rAnDoMDeScRiPtIoN2",
      createdDateTime: "2021-10-04T22:13:50.397Z",
      state: IModelState.Initialized,
      projectId: mockITwinId,
      extent: null,
      _links: {
        creator: {
          href: "",
        },
        namedVersions: {
          href: "",
        },
        changesets: {
          href: "",
        },
      },
    },
  },
];

const mockProjectIModels = {
  iModels: mockIModelsResponse.map((iModel) => ({
    id: iModel.iModel.id,
    displayName: iModel.iModel.displayName,
  })),
  _links: {
    self: {
      href: "",
    },
    prev: null,
    next: null,
  },
};

const mockReport: Report = {
  id: mockReportId,
  displayName: "mOcKRePoRt1",
  description: "mOcKRePoRtDeScRiPtIoN1",
  deleted: false,
  _links: {
    project: {
      href: "",
    },
  },
};

const mockReportMappingsFactory = (): ReportMappingCollection => {
  return {
    mappings: [
      {
        reportId: mockReportId,
        mappingId: faker.datatype.uuid(),
        imodelId: mockIModelId1,
        _links: {
          report: {
            href: "",
          },
          mapping: {
            href: "",
          },
          imodel: {
            href: "",
          },
        },
      },
      {
        reportId: mockReportId,
        mappingId: faker.datatype.uuid(),
        imodelId: mockIModelId2,
        _links: {
          report: {
            href: "",
          },
          mapping: {
            href: "",
          },
          imodel: {
            href: "",
          },
        },
      },
    ],
    _links: {
      next: undefined,
      self: {
        href: "",
      },
    },
  };
};

const mockMappingsFactory = (
  mockReportMappings: ReportMappingCollection
): [MappingSingle[], RequestHandler[]] => {
  const mockMappings: MappingSingle[] = mockReportMappings.mappings.map(
    (mapping, index) => ({
      mapping: {
        id: mapping.mappingId,
        mappingName: `mOcKMaPpIngNaMe${index}`,
        description: `mOcKmApPInGDeScRiPtIoN${index}`,
        extractionEnabled: false,
        createdOn: "",
        createdBy: "",
        modifiedOn: "",
        modifiedBy: "",
        _links: {
          imodel: {
            // Tie the mapping to to the iModel Id
            href: mapping.imodelId,
          },
        },
      },
    })
  );

  const iModelHandlers: RequestHandler[] = mockMappings.map((mapping) =>
    rest.get(
      `${REPORTS_CONFIG_BASE_URL}/insights/reporting/datasources/imodels/${mapping.mapping._links.imodel.href
      }/mappings/${mapping.mapping.id}`,
      async (_req, res, ctx) => {
        return res(ctx.delay(), ctx.status(200), ctx.json(mapping));
      }
    )
  );

  return [mockMappings, iModelHandlers];
};

const connectionMock = moq.Mock.ofType<IModelConnection>();
const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
const selectionScopesManagerMock = moq.Mock.ofType<SelectionScopesManager>();

jest.mock("@itwin/appui-react", () => ({
  ...jest.requireActual("@itwin/appui-react"),
  useActiveIModelConnection: () => connectionMock.object,
}));

const server = setupServer();

beforeAll(async () => {
  // This is required by the i18n module within iTwin.js
  (global as any).XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest; // eslint-disable-line @typescript-eslint/no-var-requires
  await NoRenderApp.startup();
  await Presentation.initialize();
  const selectionSet = moq.Mock.ofType<SelectionSet>();
  const onChanged = moq.Mock.ofType<BeEvent<(ev: SelectionSetEvent) => void>>();
  selectionSet.setup((x) => x.elements).returns(() => new Set([]));
  selectionSet.setup((x) => x.onChanged).returns(() => onChanged.object);
  connectionMock
    .setup((x) => x.selectionSet)
    .returns(() => selectionSet.object);
  connectionMock.setup((x) => x.iModelId).returns(() => mockIModelId1);
  connectionMock.setup((x) => x.iTwinId).returns(() => mockITwinId);

  selectionManagerMock
    .setup((x) => x.selectionChange)
    .returns(() => new SelectionChangeEvent());

  selectionScopesManagerMock
    .setup(async (x) => x.getSelectionScopes(connectionMock.object))
    .returns(async () => []);
  selectionManagerMock
    .setup((x) => x.scopes)
    .returns(() => selectionScopesManagerMock.object);

  Presentation.setSelectionManager(selectionManagerMock.object);
  await TestUtils.initializeUiFramework(connectionMock.object);
  await ReportsConfigWidget.initialize();
  server.listen();
});

afterAll(() => {
  TestUtils.terminateUiFramework();
  server.close();
});

afterEach(() => {
  server.resetHandlers();
});

describe("Report Mappings View", () => {
  it("shows all report mappings", async () => {
    const mockReportMappings = mockReportMappingsFactory();
    const [mockMappings, iModelHandlers] =
      mockMappingsFactory(mockReportMappings);

    server.use(
      rest.get(
        `${REPORTS_CONFIG_BASE_URL}/insights/reporting/reports/${mockReportId}/datasources/imodelMappings`,
        async (_req, res, ctx) => {
          return res(
            ctx.delay(),
            ctx.status(200),
            ctx.json(mockReportMappings)
          );
        }
      ),
      rest.get(
        `${Constants.api.baseUrl}/${mockIModelId1}`,
        async (_req, res, ctx) => {
          return res(
            ctx.delay(),
            ctx.status(200),
            ctx.json(mockIModelsResponse[0])
          );
        }
      ),
      rest.get(
        `${Constants.api.baseUrl}/${mockIModelId2}`,
        async (_req, res, ctx) => {
          return res(
            ctx.delay(),
            ctx.status(200),
            ctx.json(mockIModelsResponse[1])
          );
        }
      ),
      ...iModelHandlers
    );

    render(<ReportMappings report={mockReport} goBack={jest.fn()} />);

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));

    const horizontalTiles = screen.getAllByTestId("horizontal-tile");

    expect(horizontalTiles).toHaveLength(mockMappings.length);

    for (const [index, horizontalTile] of horizontalTiles.entries()) {
      const reportMappingTile = within(horizontalTile);
      const mockiModel = mockIModelsResponse.find(
        (iModel) =>
          iModel.iModel.id === mockMappings[index].mapping._links.imodel.href
      );
      expect(
        reportMappingTile.getByText(
          mockMappings[index].mapping.mappingName
        )
      ).toBeInTheDocument();
      expect(
        reportMappingTile.getByTitle(
          mockMappings[index].mapping.description ?? ""
        )
      ).toBeInTheDocument();
      expect(
        reportMappingTile.getByText(mockiModel?.iModel.displayName ?? "")
      ).toBeInTheDocument();
    }
  });

  it("search for a report mapping", async () => {
    const mockReportMappings = mockReportMappingsFactory();
    const [mockMappings, iModelHandlers] =
      mockMappingsFactory(mockReportMappings);

    server.use(
      rest.get(
        `${REPORTS_CONFIG_BASE_URL}/insights/reporting/reports/${mockReportId}/datasources/imodelMappings`,
        async (_req, res, ctx) => {
          return res(
            ctx.delay(),
            ctx.status(200),
            ctx.json(mockReportMappings)
          );
        }
      ),
      rest.get(
        `${Constants.api.baseUrl}/${mockIModelId1}`,
        async (_req, res, ctx) => {
          return res(
            ctx.delay(),
            ctx.status(200),
            ctx.json(mockIModelsResponse[0])
          );
        }
      ),
      rest.get(
        `${Constants.api.baseUrl}/${mockIModelId2}`,
        async (_req, res, ctx) => {
          return res(
            ctx.delay(),
            ctx.status(200),
            ctx.json(mockIModelsResponse[1])
          );
        }
      ),
      ...iModelHandlers
    );

    const { user } = render(
      <ReportMappings report={mockReport} goBack={jest.fn()} />
    );

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));

    const searchButton = within(screen.getByTestId(/search-bar/i)).getByRole(
      "button"
    );
    await user.click(searchButton);
    const searchInput = screen.getByRole("textbox", {
      name: /search\-textbox/i,
    });

    // Be an exact match on display name.
    await user.type(searchInput, mockMappings[0].mapping.mappingName);
    expect(screen.getAllByTestId("horizontal-tile")).toHaveLength(1);
    expect(
      screen.getByText(mockMappings[0].mapping.mappingName)
    ).toBeInTheDocument();

    // Be an exact match on description.
    await user.clear(searchInput);
    await user.type(searchInput, mockMappings[0].mapping.description ?? "");
    expect(screen.getAllByTestId("horizontal-tile")).toHaveLength(1);
    expect(
      screen.getByTitle(mockMappings[0].mapping.description ?? "")
    ).toBeInTheDocument();

    // Be an exact match on iModel Name.
    const iModel = mockIModelsResponse.find(
      (mockIModel) =>
        mockIModel.iModel.id === mockMappings[0].mapping._links.imodel.href
    );
    await user.clear(searchInput);
    await user.type(searchInput, iModel?.iModel.displayName ?? "");
    expect(screen.getAllByTestId("horizontal-tile")).toHaveLength(1);
    expect(
      screen.getByText(iModel?.iModel.displayName ?? "")
    ).toBeInTheDocument();
  });

  it("remove a report mapping", async () => {
    const mockReportMappings = mockReportMappingsFactory();
    const [_, iModelHandlers] = mockMappingsFactory(mockReportMappings);

    const mockReportMappingsOriginalSize = mockReportMappings.mappings.length;

    server.use(
      rest.get(
        `${REPORTS_CONFIG_BASE_URL}/insights/reporting/reports/${mockReportId}/datasources/imodelMappings`,
        async (_req, res, ctx) => {
          return res(
            ctx.delay(),
            ctx.status(200),
            ctx.json(mockReportMappings)
          );
        }
      ),
      rest.get(
        `${Constants.api.baseUrl}/${mockIModelId1}`,
        async (_req, res, ctx) => {
          return res(
            ctx.delay(),
            ctx.status(200),
            ctx.json(mockIModelsResponse[0])
          );
        }
      ),
      rest.get(
        `${Constants.api.baseUrl}/${mockIModelId2}`,
        async (_req, res, ctx) => {
          return res(
            ctx.delay(),
            ctx.status(200),
            ctx.json(mockIModelsResponse[1])
          );
        }
      ),
      ...iModelHandlers,
      rest.delete(
        `${REPORTS_CONFIG_BASE_URL}/insights/reporting/reports/${mockReportId}/datasources/imodelMappings/${mockReportMappings.mappings[0].mappingId
        }`,
        async (_req, res, ctx) => {
          mockReportMappings.mappings = mockReportMappings.mappings.filter(
            (mapping) =>
              mapping.mappingId !== mockReportMappings.mappings[0].mappingId
          );
          return res(ctx.delay(100), ctx.status(204));
        }
      )
    );

    const { user } = render(
      <ReportMappings report={mockReport} goBack={jest.fn()} />
    );

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));

    const firstMenuDropdown = within(
      screen.getAllByTestId(/tile-action-button/i)[0]
    ).getByRole("button");
    await user.click(firstMenuDropdown);
    const removeButton = screen.getByRole("menuitem", { name: /remove/i });
    await user.click(removeButton);
    // Delete modal dialog should appear
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const deleteButton = screen.getByRole("button", {
      name: /delete/i,
    });

    await user.click(deleteButton);

    await waitForElementToBeRemoved(() =>
      screen.getByTestId(/rcw-loading-delete/i)
    );
    await waitForElementToBeRemoved(() => screen.getByRole("dialog"));

    // Should be one less mapping
    expect(screen.getAllByTestId("horizontal-tile")).toHaveLength(
      mockReportMappingsOriginalSize - 1
    );
  });

  it("add mapping", async () => {
    const mockReportMappings = mockReportMappingsFactory();
    const [mockMappings, iModelHandlers] =
      mockMappingsFactory(mockReportMappings);

    // Adding an extra unmapped mapping.
    const extraMappingId = faker.datatype.uuid();
    const extraMappingName = "mOcKNaMeExTrA";
    const extraMappingDescription = "mOcKDeScRiPtIoNeXtRa";

    mockMappings.push({
      mapping: {
        id: extraMappingId,
        mappingName: extraMappingName,
        description: extraMappingDescription,
        extractionEnabled: false,
        createdOn: "",
        createdBy: "",
        modifiedOn: "",
        modifiedBy: "",
        _links: {
          imodel: {
            href: "",
          },
        },
      },
    });

    const mockMappingsResponse: MappingCollection = {
      // Type guarding
      mappings: mockMappings
        .map((mapping) => mapping.mapping)
        .filter((mapping): mapping is Mapping => !!mapping),
      _links: {
        next: undefined,
        self: {
          href: "",
        },
      },
    };

    server.use(
      rest.get(
        `${REPORTS_CONFIG_BASE_URL}/insights/reporting/reports/${mockReportId}/datasources/imodelMappings`,
        async (_req, res, ctx) => {
          return res(
            ctx.delay(),
            ctx.status(200),
            ctx.json(mockReportMappings)
          );
        }
      ),
      rest.get(`${Constants.api.baseUrl}`, async (_req, res, ctx) => {
        return res(ctx.delay(), ctx.status(200), ctx.json(mockProjectIModels));
      }),
      rest.get(
        `${Constants.api.baseUrl}/${mockIModelId1}`,
        async (_req, res, ctx) => {
          return res(
            ctx.delay(),
            ctx.status(200),
            ctx.json(mockIModelsResponse[0])
          );
        }
      ),
      rest.get(
        `${Constants.api.baseUrl}/${mockIModelId2}`,
        async (_req, res, ctx) => {
          return res(
            ctx.delay(),
            ctx.status(200),
            ctx.json(mockIModelsResponse[1])
          );
        }
      ),
      rest.get(
        `${REPORTS_CONFIG_BASE_URL}/insights/reporting/datasources/imodels/${mockProjectIModels.iModels[0].id}/mappings`,
        async (_req, res, ctx) => {
          return res(
            ctx.delay(),
            ctx.status(200),
            ctx.json(mockMappingsResponse)
          );
        }
      ),
      rest.post(
        `${REPORTS_CONFIG_BASE_URL}/insights/reporting/reports/${mockReportId}/datasources/imodelMappings`,
        async (_req, res, ctx) => {
          return res(
            ctx.delay(),
            ctx.status(200),
            ctx.json(mockReportMappings)
          );
        }
      ),
      ...iModelHandlers
    );

    const { user } = render(
      <ReportMappings report={mockReport} goBack={jest.fn()} />
    );

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));

    const addMappingButton = screen.getByRole("button", {
      name: /addmapping/i,
    });

    await user.click(addMappingButton);

    await waitForElementToBeRemoved(() =>
      screen.getByTestId(/rcw-action-loading-spinner/i)
    );
    // Add modal dialog should appear
    const modal = screen.getByRole("dialog");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const withinModal = within(modal);
    expect(withinModal.getByText(/addmappings/i)).toBeInTheDocument();

    const addButton = withinModal.getByRole("button", {
      name: /add/i,
    });
    // Add button should be disabled
    expect(addButton).toBeDisabled();

    // Already mapped mappings are disabled
    for (let i = 0; i < mockMappings.length - 1; i++) {
      const row = screen.getByRole("row", {
        name: new RegExp(
          `${mockMappings[i].mapping.mappingName} ${mockMappings[i].mapping.description}`,
          "i"
        ),
      });

      const checkbox = within(row).getByRole("checkbox");
      expect(checkbox).toBeDisabled();
    }

    // Click on checkbox on new mapping
    const unmappedRow = screen.getByRole("row", {
      name: new RegExp(
        `${mockMappings[mockMappings.length - 1].mapping.mappingName
        } ${mockMappings[mockMappings.length - 1].mapping.description}`,
        "i"
      ),
    });

    const enabledCheckbox = within(unmappedRow).getByRole("checkbox");

    await user.click(enabledCheckbox);

    await user.click(addButton);
    // Modal should go away
    await waitForElementToBeRemoved(() =>
      screen.getByTestId(/rcw-action-loading-spinner/i)
    );
    await waitForElementToBeRemoved(() => screen.getByRole("dialog"));
  });

  it("odata feed url", async () => {
    const mockReportMappings = mockReportMappingsFactory();
    const [_, iModelHandlers] = mockMappingsFactory(mockReportMappings);

    server.use(
      rest.get(
        `${REPORTS_CONFIG_BASE_URL}/insights/reporting/reports/${mockReportId}/datasources/imodelMappings`,
        async (_req, res, ctx) => {
          return res(
            ctx.delay(),
            ctx.status(200),
            ctx.json(mockReportMappings)
          );
        }
      ),
      rest.get(
        `${Constants.api.baseUrl}/${mockIModelId1}`,
        async (_req, res, ctx) => {
          return res(
            ctx.delay(),
            ctx.status(200),
            ctx.json(mockIModelsResponse[0])
          );
        }
      ),
      rest.get(
        `${Constants.api.baseUrl}/${mockIModelId2}`,
        async (_req, res, ctx) => {
          return res(
            ctx.delay(),
            ctx.status(200),
            ctx.json(mockIModelsResponse[1])
          );
        }
      ),
      ...iModelHandlers
    );

    const { user } = render(
      <ReportMappings report={mockReport} goBack={jest.fn()} />
    );

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));

    const urlTextbox = screen.getByRole("textbox", {
      name: /odatafeedurl/i,
    });
    expect(urlTextbox).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(
        `https://api.bentley.com/insights/reporting/odata/${mockReport.id}`
      )
    ).toBeInTheDocument();

    const copyButton = screen.getByRole("button", {
      name: /copy/i,
    });

    await user.click(copyButton);
    expect(screen.getByText(/copiedtoclipboard/i)).toBeInTheDocument();
  });

  it("full extraction", async () => {
    const mockReportMappings = mockReportMappingsFactory();
    const [_, iModelHandlers] = mockMappingsFactory(mockReportMappings);

    const delay = REFRESH_DELAY + 1000;

    // Faking timers currently makes all promise based queries from RTL become unpredictable.
    // https://github.com/testing-library/dom-testing-library/issues/988
    // Should come back to this later.
    // Consequently, this test will be a bit slower.
    // jest.useFakeTimers()

    Element.prototype.scrollIntoView = jest.fn();

    const mockIModel = mockIModelsResponse[0].iModel;
    const mockRunId = faker.datatype.uuid();

    const mockExtractionResponse = {
      run: {
        id: mockRunId,
        _links: {
          status: {
            href: "",
          },
        },
      },
    };

    let mockStatusResponse: ExtractionStatusSingle = {
      status: {
        state: ExtractorState.Queued,
        reason: "",
        containsIssues: false,
        _links: {
          logs: {
            href: "",
          },
        },
      },
    };

    server.use(
      rest.get(
        `${REPORTS_CONFIG_BASE_URL}/insights/reporting/reports/${mockReportId}/datasources/imodelMappings`,
        async (_req, res, ctx) => {
          return res(
            ctx.delay(),
            ctx.status(200),
            ctx.json(mockReportMappings)
          );
        }
      ),
      rest.get(
        `${Constants.api.baseUrl}/${mockIModelId1}`,
        async (_req, res, ctx) => {
          return res(
            ctx.delay(),
            ctx.status(200),
            ctx.json(mockIModelsResponse[0])
          );
        }
      ),
      rest.get(
        `${Constants.api.baseUrl}/${mockIModelId2}`,
        async (_req, res, ctx) => {
          return res(
            ctx.delay(),
            ctx.status(200),
            ctx.json(mockIModelsResponse[1])
          );
        }
      ),
      ...iModelHandlers,
      rest.post(
        `${REPORTS_CONFIG_BASE_URL}/insights/reporting/datasources/imodels/${mockIModel.id}/extraction/run`,
        async (_req, res, ctx) => {
          return res(
            ctx.delay(800),
            ctx.status(200),
            ctx.json(mockExtractionResponse)
          );
        }
      ),
      rest.get(
        `${REPORTS_CONFIG_BASE_URL}/insights/reporting/datasources/extraction/status/${mockRunId}`,
        async (_req, res, ctx) => {
          return res(
            ctx.delay(),
            ctx.status(200),
            ctx.json(mockStatusResponse)
          );
        }
      )
    );

    render(<ReportMappings report={mockReport} goBack={jest.fn()} />);

    // https://github.com/testing-library/user-event/issues/833
    const user = userEvent.setup({ delay: null });

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));

    const comboBox = screen.getByRole("combobox", {
      name: /updatedataset/i,
    });
    await user.type(comboBox, mockIModel.displayName);

    const option = screen.getByRole("menuitem", {
      name: mockIModel.displayName,
    });

    await user.click(option);

    // Combobox should have correct status
    const extractionComponent = screen.getByTestId("extraction-combo-box");
    expect(
      within(extractionComponent).getByDisplayValue(mockIModel.displayName)
    ).toBeInTheDocument();
    // Should be two in the document. One in the status and the other in the list.
    // TODO Assert that it is in the correct HorizontalTile
    const startingStates = await screen.findAllByTitle(/starting/i);
    expect(startingStates).toHaveLength(2);

    const loadingStates = await screen.findAllByTitle(/loading/i);
    expect(loadingStates).toHaveLength(2);

    // act(() => {
    //   jest.advanceTimersByTime(2000)
    // });
    const queuedStates = await screen.findAllByTitle(/queued/i, undefined, {
      timeout: delay,
    });
    expect(queuedStates).toHaveLength(2);

    mockStatusResponse = {
      status: {
        state: ExtractorState.Running,
        reason: "",
        containsIssues: false,
        _links: {
          logs: {
            href: "",
          },
        },
      },
    };

    const runningStates = await screen.findAllByTitle(/running/i, undefined, {
      timeout: delay,
    });
    expect(runningStates).toHaveLength(2);

    mockStatusResponse = {
      status: {
        state: ExtractorState.Succeeded,
        reason: "",
        containsIssues: false,
        _links: {
          logs: {
            href: "",
          },
        },
      },
    };

    const succeededStates = await screen.findAllByTitle(/success/i, undefined, {
      timeout: delay,
    });
    expect(succeededStates).toHaveLength(2);
  });
});
