/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import faker from "@faker-js/faker";
import "@testing-library/jest-dom";
import { ReportsConfigWidget } from "../ReportsConfigWidget";
import {
  fireEvent,
  mockIModelId1,
  mockIModelsResponse,
  mockReportId,
  render,
  screen,
  waitFor,
  within,
} from "./test-utils";
import * as moq from "typemoq";
import type {
  MappingContainer,
  ReportMappingCollection,
} from "@itwin/insights-client";
import type { ReportMappingAndMapping } from "../widget/components/ReportMappings";
import type { GetSingleIModelParams } from "@itwin/imodels-client-management";
import { BeEvent } from "@itwin/core-bentley";
import { ExtractionStates } from "../widget/components/ExtractionStatus";
import { ReportMappingHorizontalTile } from "../widget/components/ReportMappingHorizontalTile";
import { EmptyLocalization } from "@itwin/core-common";
import type { BulkExtractor } from "../widget/components/BulkExtractor";
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
): MappingContainer[] => {
  const mockMappings: MappingContainer[] = mockReportMappings.mappings.map(
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
          iModel: {
            // Tie the mapping to to the iModel Id
            href: mapping.imodelId,
          },
        },
      },
    })
  );

  return mockMappings;
};

const mockReportMappingsAndMappingsFactory = (): ReportMappingAndMapping[] => {
  const reportMappings = mockReportMappingsFactory();
  const mockMappings = mockMappingsFactory(reportMappings);
  const reportMappingsAndMapping =
    reportMappings.mappings.map((reportMapping) => {
      const mapping = mockMappings.find((x) => x.mapping.id === reportMapping.mappingId)!.mapping;
      const iModelName = mockProjectIModels.iModels.find((x) => x.id === reportMapping.imodelId)!.displayName;
      const reportMappingAndMapping: ReportMappingAndMapping = {
        ...reportMapping,
        iModelName,
        mappingName: mapping.mappingName,
        mappingDescription: mapping.description ?? "",
      };
      return reportMappingAndMapping;
    });
  return reportMappingsAndMapping;
};

const mockBulkExtractor = moq.Mock.ofType<BulkExtractor>();
const mockIModelsClient = moq.Mock.ofType<IModelOperations<OperationOptions>>();

jest.mock("../widget/components/Constants.ts", () => ({
  ...jest.requireActual("../widget/components/Constants.ts"),
  STATUS_CHECK_INTERVAL: 10,
}));

const mockOdataFeedUrl = "mockOdataFeedUrl";

beforeAll(async () => {
  const localization = new EmptyLocalization();
  await ReportsConfigWidget.initialize(localization);
});

afterEach(() => {
  mockIModelsClient.reset();
  mockBulkExtractor.reset();
});

describe("Report Mapping Horizontal Tile", () => {
  it("tile renders correctly", async () => {
    const firstMockMapping = mockReportMappingsAndMappingsFactory()[0];

    mockBulkExtractor
      .setup(async (x) => x.getIModelState(firstMockMapping.imodelId, firstMockMapping.iModelName, mockOdataFeedUrl))
      .returns(async () => ExtractionStates.None);

    render(
      <ReportMappingHorizontalTile
        jobStartEvent={new BeEvent()}
        mapping={firstMockMapping}
        onClickDelete={() => {}}
        bulkExtractor={mockBulkExtractor.object}
        odataFeedUrl={mockOdataFeedUrl}
      />,
    );

    mockBulkExtractor.verify(async (x) => x.getIModelState(firstMockMapping.imodelId, firstMockMapping.iModelName, mockOdataFeedUrl), moq.Times.once());
    await waitFor(() => expect(screen.getByRole("button", { name: /UpdateDataset/i })).not.toBeDisabled(), { timeout: 1000 });

    expect(screen.getByText(firstMockMapping.mappingName)).toBeInTheDocument();
    expect(screen.getByTitle(firstMockMapping.mappingDescription)).toBeInTheDocument();
    expect(screen.getByText(firstMockMapping.iModelName)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /UpdateDataset/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Remove/i })).toBeInTheDocument();
  });

  it("starting extraction sends request", async () => {
    const firstMockMapping = mockReportMappingsAndMappingsFactory()[0];
    const firstMockExtractionRequest = {
      mappings: [{ id: firstMockMapping.mappingId }],
      iModelId: firstMockMapping.imodelId,
    };

    mockBulkExtractor
      .setup(async (x) => x.runIModelExtraction(firstMockExtractionRequest))
      .returns(async () => {
        return Promise.resolve();
      });

    mockBulkExtractor
      .setup(async (x) => x.getIModelState(firstMockMapping.imodelId, firstMockMapping.iModelName, mockOdataFeedUrl))
      .returns(async () => ExtractionStates.None);

    const jobStartEvent = new BeEvent<(iModelId: string) => void>();

    const { user } = render(
      <ReportMappingHorizontalTile
        jobStartEvent={jobStartEvent}
        mapping={firstMockMapping}
        onClickDelete={() => {}}
        bulkExtractor={mockBulkExtractor.object}
        odataFeedUrl={mockOdataFeedUrl}
      />,
    );

    mockBulkExtractor.verify(async (x) => x.getIModelState(firstMockMapping.imodelId, firstMockMapping.iModelName, mockOdataFeedUrl), moq.Times.once());
    await waitFor(() => expect(screen.getByRole("button", { name: /UpdateDataset/i })).not.toBeDisabled(), { timeout: 1000 });

    const startExtractionButton = screen.getByRole("button", { name: /UpdateDataset/i });
    await user.click(startExtractionButton);

    mockBulkExtractor.verify(async (x) => x.runIModelExtraction(firstMockExtractionRequest), moq.Times.once());
  });

  it("on delete is called when remove is pressed", async () => {
    const firstMockMapping = mockReportMappingsAndMappingsFactory()[0];
    const firstMockExtractionRequest = {
      mappings: [{ id: firstMockMapping.mappingId }],
      iModelId: firstMockMapping.imodelId,
    };

    mockBulkExtractor
      .setup(async (x) => x.runIModelExtraction(firstMockExtractionRequest))
      .returns(async () => {
        return Promise.resolve();
      });

    mockBulkExtractor
      .setup(async (x) => x.getIModelState(firstMockMapping.imodelId, firstMockMapping.iModelName, mockOdataFeedUrl))
      .returns(async () => ExtractionStates.None);

    const mockOnClickDelete = jest.fn();

    const jobStartEvent = new BeEvent<(iModelId: string) => void>();

    const { user } = render(
      <ReportMappingHorizontalTile
        jobStartEvent={jobStartEvent}
        mapping={firstMockMapping}
        onClickDelete={mockOnClickDelete}
        bulkExtractor={mockBulkExtractor.object}
        odataFeedUrl={mockOdataFeedUrl}
      />,
    );

    await waitFor(() => expect(screen.getByRole("button", { name: /Remove/i })).not.toBeDisabled(), { timeout: 1000 });

    const removeButton = screen.getByRole("button", { name: /Remove/i });
    await user.click(removeButton);

    expect(mockOnClickDelete).toBeCalledTimes(1);
  });

  it("full extraction status cycle", async () => {
    const firstMockMapping = mockReportMappingsAndMappingsFactory()[0];
    const firstMockExtractionRequest = {
      mappings: [{ id: firstMockMapping.mappingId }],
      iModelId: firstMockMapping.imodelId,
    };

    mockIModelsClient
      .setup(async (x) => x.getSingle(moq.It.isObjectWith<GetSingleIModelParams>({ iModelId: mockIModelId1 })))
      .returns(async () => mockIModelsResponse[0].iModel);

    mockBulkExtractor
      .setup(async (x) => x.runIModelExtraction(firstMockExtractionRequest))
      .returns(async () => {
        return Promise.resolve();
      });

    mockBulkExtractor
      .setup(async (x) => x.getIModelState(firstMockMapping.imodelId, firstMockMapping.iModelName, mockOdataFeedUrl))
      .returns(async () => ExtractionStates.None);

    const mockOnClickDelete = jest.fn();

    const jobStartEvent = new BeEvent<(iModelId: string) => void>();

    const { user } = render(
      <ReportMappingHorizontalTile
        jobStartEvent={jobStartEvent}
        mapping={firstMockMapping}
        onClickDelete={mockOnClickDelete}
        bulkExtractor={mockBulkExtractor.object}
        odataFeedUrl={mockOdataFeedUrl}
      />,
    );

    await waitFor(() => expect(screen.getByRole("button", { name: /UpdateDataset/i })).not.toBeDisabled(), { timeout: 1000 });

    mockBulkExtractor
      .setup(async (x) => x.getIModelState(firstMockMapping.imodelId, firstMockMapping.iModelName, mockOdataFeedUrl))
      .returns(async () => ExtractionStates.Starting);

    const startExtractionButton = screen.getByRole("button", { name: /UpdateDataset/i });
    await user.click(startExtractionButton);

    mockBulkExtractor.verify(async (x) => x.runIModelExtraction(firstMockExtractionRequest), moq.Times.once());

    expect(screen.getByTitle(/Starting/i)).toBeInTheDocument();

    mockBulkExtractor.reset();
    mockBulkExtractor
      .setup(async (x) => x.getIModelState(firstMockMapping.imodelId, firstMockMapping.iModelName, mockOdataFeedUrl))
      .returns(async () => ExtractionStates.Queued);

    await waitFor(() => expect(screen.getByTitle(/Queued/i)).toBeInTheDocument(), { timeout: 1000 });

    mockBulkExtractor.reset();
    mockBulkExtractor
      .setup(async (x) => x.getIModelState(firstMockMapping.imodelId, firstMockMapping.iModelName, mockOdataFeedUrl))
      .returns(async () => ExtractionStates.Running);
    await waitFor(() => expect(screen.getByTitle(/Running/i)).toBeInTheDocument(), { timeout: 1000 });

    mockBulkExtractor.reset();
    mockBulkExtractor
      .setup(async (x) => x.getIModelState(firstMockMapping.imodelId, firstMockMapping.iModelName, mockOdataFeedUrl))
      .returns(async () => ExtractionStates.Succeeded);
    await waitFor(() => expect(screen.getByTitle(/Success/i)).toBeInTheDocument(), { timeout: 1000 });

    mockBulkExtractor.reset();
    fireEvent.animationEnd(screen.getByTestId("rcw-success-animation"));
    await waitFor(() => expect(screen.getByRole("button", { name: /UpdateDataset/i })).toBeInTheDocument(), { timeout: 1000 });
  });

  it("second tile should update status", async () => {
    const mockReportMappingsAndMappings = mockReportMappingsAndMappingsFactory();
    const firstMockMapping = mockReportMappingsAndMappings[0];
    const secondMockMapping = mockReportMappingsAndMappings[1];
    const firstMockExtractionRequest = {
      mappings: [{ id: firstMockMapping.mappingId }],
      iModelId: firstMockMapping.imodelId,
    };

    mockBulkExtractor
      .setup(async (x) => x.getIModelState(firstMockMapping.imodelId, firstMockMapping.iModelName, mockOdataFeedUrl))
      .returns(async () => ExtractionStates.None);

    const jobStartEvent = new BeEvent<(iModelId: string) => void>();

    const { user } = render(
      <div>
        <ReportMappingHorizontalTile
          jobStartEvent={jobStartEvent}
          mapping={firstMockMapping}
          onClickDelete={() => {}}
          bulkExtractor={mockBulkExtractor.object}
          odataFeedUrl={mockOdataFeedUrl}
        />
        <ReportMappingHorizontalTile
          jobStartEvent={jobStartEvent}
          mapping={secondMockMapping}
          onClickDelete={() => {}}
          bulkExtractor={mockBulkExtractor.object}
          odataFeedUrl={mockOdataFeedUrl}
        />
      </div>,
    );

    const tiles = screen.getAllByTestId("horizontal-tile");

    for (const tile of tiles) {
      const preview = within(tile);
      await waitFor(() => expect(preview.getByRole("button", { name: /UpdateDataset/i })).not.toBeDisabled(), { timeout: 1000 });
    }

    mockBulkExtractor.reset();
    mockBulkExtractor
      .setup(async (x) => x.getIModelState(firstMockMapping.imodelId, firstMockMapping.iModelName, mockOdataFeedUrl))
      .returns(async () => ExtractionStates.Queued);

    mockBulkExtractor
      .setup(async (x) => x.runIModelExtraction(firstMockExtractionRequest))
      .returns(async () => {
        return Promise.resolve();
      });

    const startExtractionButton = screen.getAllByRole("button", { name: /UpdateDataset/i })[0];
    await user.click(startExtractionButton);

    for (const tile of tiles) {
      const preview = within(tile);
      await waitFor(() => expect(preview.getByTitle(/Queued/i)).toBeInTheDocument(), { timeout: 1000 });
    }

    expect(screen.getAllByTitle(/Queued/i)).toHaveLength(2);
  });
});
