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
import {
  render,
  screen,
  TestUtils,
  waitForElementToBeRemoved,
  within,
} from "./test-utils";
import userEvent from "@testing-library/user-event";
import * as moq from "typemoq";
import type {
  ExtractionStatusSingle,
  MappingSingle,
  Report,
  ReportMappingCollection,
} from "@itwin/insights-client";
import {
  ExtractorState,
} from "@itwin/insights-client";
import { ReportMappings } from "../widget/components/ReportMappings";
import type { GetSingleIModelParams, IModelOperations, OperationOptions } from "@itwin/imodels-client-management";
import { IModelState } from "@itwin/imodels-client-management";
import { REPORTS_CONFIG_BASE_URL } from "../widget/ReportsConfigUiProvider";
import type {
  SelectionManager,
  SelectionScopesManager,
} from "@itwin/presentation-frontend";
import {
  Presentation,
  SelectionChangeEvent,
} from "@itwin/presentation-frontend";
import type { BeEvent } from "@itwin/core-bentley";
import BulkExtractor from "../widget/components/BulkExtractor";

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

const mockApiConfig = {
  getAccessToken: async () => "mockAccessToken",
  baseUrl: REPORTS_CONFIG_BASE_URL,
};

const mockBulkExtractor = new BulkExtractor(mockApiConfig, []);

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
): MappingSingle[] => {
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

  return mockMappings;
};

const connectionMock = moq.Mock.ofType<IModelConnection>();
const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
const selectionScopesManagerMock = moq.Mock.ofType<SelectionScopesManager>();

jest.mock("../widget/components/Constants.ts", () => ({
  STATUS_CHECK_INTERVAL: 10,
}));

jest.mock("@itwin/appui-react", () => ({
  ...jest.requireActual("@itwin/appui-react"),
  useActiveIModelConnection: () => connectionMock.object,
}));

const mockIModelsClient = moq.Mock.ofType<IModelOperations<OperationOptions>>();

jest.mock("@itwin/imodels-client-management", () => ({
  ...jest.requireActual("@itwin/imodels-client-management"),
  IModelsClient: jest.fn().mockImplementation(() => ({
    iModels: mockIModelsClient.object,
  })),
  toArray: jest.fn().mockImplementation(async () => {
    return mockProjectIModels.iModels;
  }),
}));

const mockGetMapping = jest.fn();
const mockGetMappings = jest.fn();
const mockGetReportMappings = jest.fn();
const mockDeleteReportMapping = jest.fn();
const mockRunExtraction = jest.fn();
const mockGetExtractionStatus = jest.fn();

jest.mock("@itwin/insights-client", () => ({
  ...jest.requireActual("@itwin/insights-client"),
  MappingsClient: jest.fn().mockImplementation(() => ({
    getMapping: mockGetMapping,
    getMappings: mockGetMappings,
  })),
  ExtractionClient: jest.fn().mockImplementation(() => ({
    runExtraction: () => mockRunExtraction(),
    getExtractionStatus: () => mockGetExtractionStatus(),
  })),
  ReportsClient: jest.fn().mockImplementation(() => ({
    getReportMappings: async () => mockGetReportMappings(),
    deleteReportMapping: async () => mockDeleteReportMapping(),
    createReportMapping: () => { },
  })),
}));

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
});

afterAll(() => {
  TestUtils.terminateUiFramework();
});

afterEach(() => {
  mockGetMapping.mockClear();
  mockGetMappings.mockClear();
  mockGetReportMappings.mockClear();
  mockDeleteReportMapping.mockClear();
  mockGetExtractionStatus.mockClear();
  mockRunExtraction.mockClear();
});

describe("Report Mappings View", () => {
  it("shows all report mappings", async () => {

    const mockReportMappings = mockReportMappingsFactory();
    const mockMappings = mockMappingsFactory(mockReportMappings);

    mockIModelsClient.setup(async (x) => x.getSingle(moq.It.isObjectWith<GetSingleIModelParams>({ iModelId: mockIModelId1 })))
      .returns(async () => mockIModelsResponse[0].iModel);

    mockIModelsClient.setup(async (x) => x.getSingle(moq.It.isObjectWith<GetSingleIModelParams>({ iModelId: mockIModelId2 })))
      .returns(async () => mockIModelsResponse[1].iModel);

    mockGetMapping.mockReturnValueOnce(mockMappings[0].mapping).mockReturnValueOnce(mockMappings[1].mapping);
    mockGetReportMappings.mockReturnValueOnce(mockReportMappings.mappings);

    render(<ReportMappings report={mockReport} bulkExtractor={mockBulkExtractor} goBack={jest.fn()} />);

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
    const mockMappings = mockMappingsFactory(mockReportMappings);

    mockIModelsClient.setup(async (x) => x.getSingle(moq.It.isObjectWith<GetSingleIModelParams>({ iModelId: mockIModelId1 })))
      .returns(async () => mockIModelsResponse[0].iModel);

    mockIModelsClient.setup(async (x) => x.getSingle(moq.It.isObjectWith<GetSingleIModelParams>({ iModelId: mockIModelId2 })))
      .returns(async () => mockIModelsResponse[1].iModel);
    mockGetMapping.mockReturnValueOnce(mockMappings[0].mapping).mockReturnValueOnce(mockMappings[1].mapping);
    mockGetReportMappings.mockReturnValueOnce(mockReportMappings.mappings);

    const { user } = render(
      <ReportMappings report={mockReport} bulkExtractor={mockBulkExtractor} goBack={jest.fn()} />
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
    const mockMappings = mockMappingsFactory(mockReportMappings);
    const mockReportMappingsOriginalSize = mockReportMappings.mappings.length;

    mockIModelsClient.setup(async (x) => x.getSingle(moq.It.isObjectWith<GetSingleIModelParams>({ iModelId: mockIModelId1 })))
      .returns(async () => mockIModelsResponse[0].iModel);

    mockIModelsClient.setup(async (x) => x.getSingle(moq.It.isObjectWith<GetSingleIModelParams>({ iModelId: mockIModelId2 })))
      .returns(async () => mockIModelsResponse[1].iModel);

    mockGetMapping.mockReturnValueOnce(mockMappings[0].mapping).mockReturnValueOnce(mockMappings[1].mapping);
    mockGetReportMappings.mockReturnValueOnce(mockReportMappings.mappings).mockReturnValueOnce(mockReportMappings.mappings.filter(
      (mapping) =>
        mapping.mappingId !== mockReportMappings.mappings[0].mappingId
    ));

    mockDeleteReportMapping.mockImplementation(() => {
      mockReportMappings.mappings = mockReportMappings.mappings.filter(
        (mapping) =>
          mapping.mappingId !== mockReportMappings.mappings[0].mappingId
      );
      return;
    });

    const { user } = render(
      <ReportMappings report={mockReport} bulkExtractor={mockBulkExtractor} goBack={jest.fn()} />
    );

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));

    mockIModelsClient.setup(async (x) => x.getSingle(moq.It.isObjectWith<GetSingleIModelParams>({ iModelId: mockIModelId1 })))
      .returns(async () => mockIModelsResponse[0].iModel);

    mockIModelsClient.setup(async (x) => x.getSingle(moq.It.isObjectWith<GetSingleIModelParams>({ iModelId: mockIModelId2 })))
      .returns(async () => mockIModelsResponse[1].iModel);

    mockGetMapping.mockReturnValueOnce(mockMappings[0].mapping).mockReturnValueOnce(mockMappings[1].mapping);

    const removeButton = screen.getAllByTitle("Remove")[0];
    await user.click(removeButton);
    // Delete modal dialog should appear
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const modal = screen.getByRole("dialog");

    const withinModal = within(modal);

    const deleteButton = withinModal.getByRole("button", {
      name: /delete/i,
    });

    await user.click(deleteButton);

    await waitForElementToBeRemoved(() => screen.getByRole("dialog"));

    expect(mockDeleteReportMapping).toBeCalledTimes(1);
    expect(mockReportMappings.mappings.length).toBe(mockReportMappingsOriginalSize - 1);

    expect(mockGetReportMappings).toBeCalledTimes(2);
    // Should be one less mapping
    expect(screen.getAllByTestId("horizontal-tile")).toHaveLength(
      mockReportMappingsOriginalSize - 1
    );
  });

  it("add mapping", async () => {
    const mockReportMappings = mockReportMappingsFactory();
    const mockMappings =
      mockMappingsFactory(mockReportMappings);

    mockIModelsClient.setup(async (x) => x.getSingle(moq.It.isObjectWith<GetSingleIModelParams>({ iModelId: mockIModelId1 })))
      .returns(async () => mockIModelsResponse[0].iModel);

    mockIModelsClient.setup(async (x) => x.getSingle(moq.It.isObjectWith<GetSingleIModelParams>({ iModelId: mockIModelId2 })))
      .returns(async () => mockIModelsResponse[1].iModel);

    mockGetMapping.mockReturnValueOnce(mockMappings[0].mapping).mockReturnValueOnce(mockMappings[1].mapping);
    mockGetReportMappings.mockReturnValueOnce(mockReportMappings.mappings);

    mockIModelsClient.setup((x) => x.getMinimalList(moq.It.isAny()))
      .returns(() => [] as any);

    const { user } = render(
      <ReportMappings report={mockReport} bulkExtractor={mockBulkExtractor} goBack={jest.fn()} />
    );

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));

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

    mockGetMappings.mockReturnValueOnce(mockMappings.map((m: MappingSingle) => m.mapping));

    const addMappingButton = screen.getByRole("button", {
      name: /addmapping/i,
    });

    await user.click(addMappingButton);

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

    await waitForElementToBeRemoved(() => screen.getByRole("dialog"));
  });

  it("odata feed url", async () => {
    const { user } = render(
      <ReportMappings report={mockReport} bulkExtractor={mockBulkExtractor} goBack={jest.fn()} />
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
    const mockMappings = mockMappingsFactory(mockReportMappings);

    const delay = 1000;

    Element.prototype.scrollIntoView = jest.fn();
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

    const mockStatusResponse: ExtractionStatusSingle = {
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

    mockIModelsClient.setup(async (x) => x.getSingle(moq.It.isObjectWith<GetSingleIModelParams>({ iModelId: mockIModelId1 })))
      .returns(async () => mockIModelsResponse[0].iModel);

    mockIModelsClient.setup(async (x) => x.getSingle(moq.It.isObjectWith<GetSingleIModelParams>({ iModelId: mockIModelId2 })))
      .returns(async () => mockIModelsResponse[1].iModel);

    mockGetMapping.mockReturnValueOnce(mockMappings[0].mapping).mockReturnValueOnce(mockMappings[1].mapping);
    mockRunExtraction.mockReturnValueOnce(mockExtractionResponse.run);
    mockGetExtractionStatus.mockReturnValue(mockStatusResponse.status);
    mockGetReportMappings.mockReturnValueOnce(mockReportMappings.mappings);

    render(<ReportMappings report={mockReport} bulkExtractor={mockBulkExtractor} goBack={jest.fn()} />);

    // https://github.com/testing-library/user-event/issues/833
    const user = userEvent.setup({ delay: null });

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));

    const update = screen.getAllByTitle("UpdateDataset")[0];
    await user.click(update);

    // TODO Assert that it is in the correct HorizontalTile
    const startingStates = await screen.findAllByTitle(/starting/i);
    expect(startingStates).toHaveLength(1);

    mockStatusResponse.status.state = ExtractorState.Queued;

    const queuedStates = await screen.findAllByTitle(/queued/i, undefined, {
      timeout: delay,
    });
    expect(queuedStates).toHaveLength(1);

    mockStatusResponse.status.state = ExtractorState.Running;

    const runningStates = await screen.findAllByTitle(/running/i, undefined, {
      timeout: delay,
    });
    expect(runningStates).toHaveLength(1);

    mockStatusResponse.status.state = ExtractorState.Succeeded;

    const succeededStates = await screen.findAllByTitle(/success/i, undefined, {
      timeout: delay,
    });
    expect(succeededStates).toHaveLength(1);
  });
});
