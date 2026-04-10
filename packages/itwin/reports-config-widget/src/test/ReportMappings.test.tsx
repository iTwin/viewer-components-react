/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { vi } from "vitest";
import { ReportsConfigWidget } from "../ReportsConfigWidget";
import {
  act,
  mockExtractionRequestDetails,
  mockIModelId1,
  mockIModelId2,
  mockIModelsResponse,
  mockReportId,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from "./test-utils";
import * as moq from "typemoq";
import type { MappingContainer, MappingsClient, Report, ReportMappingCollection } from "@itwin/insights-client";
import { ExtractionClient, ReportsClient } from "@itwin/insights-client";
import { ReportMappings } from "../widget/components/ReportMappings";
import type { GetSingleIModelParams, IModelsClient } from "@itwin/imodels-client-management";
import { BulkExtractor } from "../widget/components/BulkExtractor";
import type { ReportMappingHorizontalTileProps } from "../widget/components/ReportMappingHorizontalTile";
import { Text } from "@itwin/itwinui-react";
import { EmptyLocalization } from "@itwin/core-common";
import type { AddMappingsModalProps } from "../widget/components/AddMappingsModal";
import type { IModelOperations, OperationOptions } from "@itwin/imodels-client-management/lib/operations";

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
    odata: {
      href: "mock-odata-feed-url",
    },
  },
};

const mockReportMappingsFactory = (): ReportMappingCollection => {
  return {
    mappings: [
      {
        reportId: mockReportId,
        mappingId: "mockMappingId1",
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
        mappingId: "mockMappingId2",
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

const mockMappingsFactory = (mockReportMappings: ReportMappingCollection): MappingContainer[] => {
  const mockMappings: MappingContainer[] = mockReportMappings.mappings.map((mapping, index) => ({
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
        iModel: {
          // Tie the mapping to to the iModel Id
          href: mapping.imodelId,
        },
      },
    },
  }));

  return mockMappings;
};

vi.mock("../widget/components/Constants.ts", async () => ({
  ...(await vi.importActual("../widget/components/Constants.ts")),
  STATUS_CHECK_INTERVAL: 10,
}));

vi.mock("../widget/components/ReportMappingHorizontalTile", () => ({
  ReportMappingHorizontalTile: (props: ReportMappingHorizontalTileProps) => {
    return (
      <div data-testid="horizontal-tile">
        <Text>{props.mapping.mappingName}</Text>
        <Text title={props.mapping.mappingDescription}>{props.mapping.iModelName}</Text>
      </div>
    );
  },
}));

let onClose: () => Promise<void>;
vi.mock("../widget/components/AddMappingsModal", async () => ({
  ...(await vi.importActual("../widget/components/AddMappingsModal")),
  AddMappingsModal: (props: AddMappingsModalProps) => {
    onClose = props.onClose;
    return <div data-testid="add-mappings-modal" />;
  },
}));

vi.mock("@itwin/imodels-client-management", async () => ({
  ...(await vi.importActual("@itwin/imodels-client-management")),

  toArray: vi.fn().mockImplementation(async () => {
    return mockProjectIModels.iModels;
  }),
}));

const mockGetMapping = vi.fn();
const mockGetMappings = vi.fn();
const mockGetReportMappings = vi.fn();

const mockIModelsClient = moq.Mock.ofType<IModelsClient>();
const mockIModelsClientOperations = moq.Mock.ofType<IModelOperations<OperationOptions>>();
const mockReportsClient = moq.Mock.ofType<ReportsClient>();
const mockMappingsClient = moq.Mock.ofType<MappingsClient>();

beforeAll(async () => {
  const localization = new EmptyLocalization();
  await ReportsConfigWidget.initialize(localization);
  mockIModelsClientOperations
    .setup(async (x) => x.getSingle(moq.It.isObjectWith<GetSingleIModelParams>({ iModelId: mockIModelId1 })))
    .returns(async () => mockIModelsResponse[0].iModel);
  mockIModelsClientOperations
    .setup(async (x) => x.getSingle(moq.It.isObjectWith<GetSingleIModelParams>({ iModelId: mockIModelId2 })))
    .returns(async () => mockIModelsResponse[1].iModel);
  mockIModelsClient.setup((x) => x.iModels).returns(() => mockIModelsClientOperations.object);
  mockReportsClient.setup(async (x) => x.getReportMappings(moq.It.isAny(), moq.It.isAny())).returns(mockGetReportMappings);
  mockMappingsClient.setup(async (x) => x.getMappings(moq.It.isAny(), moq.It.isAny())).returns(mockGetMappings);
  mockMappingsClient.setup(async (x) => x.getMapping(moq.It.isAny(), moq.It.isAny())).returns(mockGetMapping);
});

afterEach(() => {
  mockGetMapping.mockReset();
  mockGetMappings.mockReset();
  mockGetReportMappings.mockReset();
});

describe("Report Mappings View", () => {
  it("shows all report mappings", async () => {
    const mockReportMappings = mockReportMappingsFactory();
    const mockMappings = mockMappingsFactory(mockReportMappings);

    mockGetMapping.mockReturnValueOnce(mockMappings[0].mapping).mockReturnValueOnce(mockMappings[1].mapping);
    mockGetReportMappings.mockReturnValueOnce(mockReportMappings.mappings);

    render(<ReportMappings report={mockReport} onClickClose={vi.fn()} />, {
      reportsClient: mockReportsClient.object,
      mappingsClient: mockMappingsClient.object,
      iModelsClient: mockIModelsClient.object,
    });

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));

    const horizontalTiles = screen.getAllByTestId("horizontal-tile");
    assertHorizontalTiles(horizontalTiles, mockMappings);
  });

  it("search for a report mapping", async () => {
    const mockReportMappings = mockReportMappingsFactory();
    const mockMappings = mockMappingsFactory(mockReportMappings);

    mockGetMapping.mockReturnValueOnce(mockMappings[0].mapping).mockReturnValueOnce(mockMappings[1].mapping);
    mockGetReportMappings.mockReturnValueOnce(mockReportMappings.mappings);

    const { user } = render(<ReportMappings report={mockReport} onClickClose={vi.fn()} />, {
      reportsClient: mockReportsClient.object,
      mappingsClient: mockMappingsClient.object,
      iModelsClient: mockIModelsClient.object,
    });

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));

    const searchButton = screen.getByTestId(/rcw-search-button/i);

    await user.click(searchButton);
    const searchInput = screen.getByRole("textbox", {
      name: /search\-textbox/i,
    });

    // Be an exact match on display name.
    await user.type(searchInput, mockMappings[0].mapping.mappingName);
    expect(screen.getAllByTestId("horizontal-tile")).toHaveLength(1);
    expect(screen.getByText(mockMappings[0].mapping.mappingName)).toBeInTheDocument();

    // Be an exact match on description.
    await user.clear(searchInput);
    await user.type(searchInput, mockMappings[0].mapping.description ?? "");
    expect(screen.getAllByTestId("horizontal-tile")).toHaveLength(1);
    expect(screen.getByTitle(mockMappings[0].mapping.description ?? "")).toBeInTheDocument();

    // Be an exact match on iModel Name.
    const iModel = mockIModelsResponse.find((mockIModel) => mockIModel.iModel.id === mockMappings[0].mapping._links.iModel.href);
    await user.clear(searchInput);
    await user.type(searchInput, iModel?.iModel.displayName ?? "");
    expect(screen.getAllByTestId("horizontal-tile")).toHaveLength(1);
    expect(screen.getByText(iModel?.iModel.displayName ?? "")).toBeInTheDocument();
  });

  it("add mapping", async () => {
    const mockReportMappings = mockReportMappingsFactory();
    const mockMappings = mockMappingsFactory(mockReportMappings);

    mockGetMapping.mockReturnValueOnce(mockMappings[0].mapping).mockReturnValueOnce(mockMappings[1].mapping);
    mockGetReportMappings.mockReturnValueOnce(mockReportMappings.mappings);

    const { user } = render(<ReportMappings report={mockReport} onClickClose={vi.fn()} />, {
      reportsClient: mockReportsClient.object,
      mappingsClient: mockMappingsClient.object,
      iModelsClient: mockIModelsClient.object,
    });

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));

    mockGetMappings.mockReturnValueOnce(mockMappings.map((m: MappingContainer) => m.mapping));

    const addMappingButton = screen.getByRole("button", {
      name: /addmapping/i,
    });

    await user.click(addMappingButton);

    const addMappingsModal = await screen.findByTestId("add-mappings-modal");
    expect(addMappingsModal).toBeInTheDocument();

    await act(async () => {
      await onClose();
    });

    const horizontalTiles = screen.getAllByTestId("horizontal-tile");
    assertHorizontalTiles(horizontalTiles, mockMappings);

    expect(mockGetReportMappings).toBeCalledTimes(2);
  });

  it("odata feed url", async () => {
    const { user } = render(<ReportMappings report={mockReport} onClickClose={vi.fn()} />, {
      reportsClient: mockReportsClient.object,
      mappingsClient: mockMappingsClient.object,
      iModelsClient: mockIModelsClient.object,
    });

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));

    const urlTextbox = screen.getByRole("textbox", {
      name: /odatafeedurl/i,
    });
    expect(urlTextbox).toBeInTheDocument();
    expect(screen.getByDisplayValue(`mock-odata-feed-url`)).toBeInTheDocument();

    const copyButton = screen.getByRole("button", {
      name: /copy/i,
    });

    await user.click(copyButton);
    expect(screen.getByText(/copiedtoclipboard/i)).toBeInTheDocument();
  });

  it("update all datasets", async () => {
    const mockReportMappings = mockReportMappingsFactory();
    const mockMappings = mockMappingsFactory(mockReportMappings);

    mockGetMapping.mockReturnValueOnce(mockMappings[0].mapping).mockReturnValueOnce(mockMappings[1].mapping);
    mockGetReportMappings.mockReturnValueOnce(mockReportMappings.mappings);

    const bulkExtractor = new BulkExtractor(new ReportsClient(), new ExtractionClient(), vi.fn().mockResolvedValue("mockAccessToken"), vi.fn, vi.fn);

    const runIModelExtractionsMock = vi.spyOn(bulkExtractor, "runIModelExtractions").mockImplementation(async () => Promise.resolve());

    const { user } = render(<ReportMappings report={mockReport} onClickClose={vi.fn()} />, {
      reportsClient: mockReportsClient.object,
      mappingsClient: mockMappingsClient.object,
      iModelsClient: mockIModelsClient.object,
      bulkExtractor,
    });

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));

    const extractAllButton = screen.getByText(/UpdateAllDatasets/i);
    expect(extractAllButton).toBeInTheDocument();

    await user.click(extractAllButton);
    await waitFor(() => expect(extractAllButton).toBeEnabled());

    // Check that the mocked method was called with the expected arguments
    expect(runIModelExtractionsMock).toHaveBeenCalledWith(mockExtractionRequestDetails);
  });

  const assertHorizontalTiles = (horizontalTiles: HTMLElement[], mockMappings: MappingContainer[]) => {
    expect(horizontalTiles).toHaveLength(mockMappings.length);

    for (const [index, horizontalTile] of horizontalTiles.entries()) {
      const reportMappingTile = within(horizontalTile);
      const mockiModel = mockIModelsResponse.find((iModel) => iModel.iModel.id === mockMappings[index].mapping._links.iModel.href);
      expect(reportMappingTile.getByText(mockMappings[index].mapping.mappingName)).toBeInTheDocument();
      expect(reportMappingTile.getByTitle(mockMappings[index].mapping.description ?? "")).toBeInTheDocument();
      expect(reportMappingTile.getByText(mockiModel?.iModel.displayName ?? "")).toBeInTheDocument();
    }
  };
});
