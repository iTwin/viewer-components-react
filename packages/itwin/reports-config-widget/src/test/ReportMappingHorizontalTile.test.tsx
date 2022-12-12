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
  fireEvent,
  render,
  screen,
  TestUtils,
  waitFor,
  within,
} from "./test-utils";
import * as moq from "typemoq";
import type {
  MappingSingle,
  ReportMappingCollection,
} from "@itwin/insights-client";
import type { ReportMappingAndMapping } from "../widget/components/ReportMappings";
import type { GetSingleIModelParams, IModelOperations, OperationOptions } from "@itwin/imodels-client-management";
import { IModelState } from "@itwin/imodels-client-management";
import type {
  SelectionManager,
  SelectionScopesManager,
} from "@itwin/presentation-frontend";
import {
  Presentation,
  SelectionChangeEvent,
} from "@itwin/presentation-frontend";
import { BeEvent } from "@itwin/core-bentley";
import type BulkExtractor from "../widget/components/BulkExtractor";
import { ExtractionStates } from "../widget/components/ExtractionStatus";
import { ReportMappingHorizontalTile } from "../widget/components/ReportMappingHorizontalTile";

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

const connectionMock = moq.Mock.ofType<IModelConnection>();
const mockBulkExtractor = moq.Mock.ofType<BulkExtractor>();
const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
const selectionScopesManagerMock = moq.Mock.ofType<SelectionScopesManager>();
const mockIModelsClient = moq.Mock.ofType<IModelOperations<OperationOptions>>();

jest.mock("../widget/components/Constants.ts", () => ({
  STATUS_CHECK_INTERVAL: 10,
}));

jest.mock("@itwin/appui-react", () => ({
  ...jest.requireActual("@itwin/appui-react"),
  useActiveIModelConnection: () => connectionMock.object,
}));

const mockOdataFeedUrl = "mockOdataFeedUrl";

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
  mockIModelsClient.reset();
  mockBulkExtractor.reset();
});

describe("Report Mapping Horizontal Tile", () => {
  it("tile renders correctly", async () => {
    const firstMockMapping = mockReportMappingsAndMappingsFactory()[0];

    mockBulkExtractor.setup(async (x) => x.getIModelState(firstMockMapping.imodelId, firstMockMapping.iModelName, mockOdataFeedUrl))
      .returns(async () => ExtractionStates.None);

    render(<ReportMappingHorizontalTile
      jobStartEvent={new BeEvent()}
      mapping={firstMockMapping}
      onClickDelete={() => { }}
      bulkExtractor={mockBulkExtractor.object}
      odataFeedUrl={mockOdataFeedUrl}
    />);

    mockBulkExtractor.verify(async (x) => x.getIModelState(firstMockMapping.imodelId, firstMockMapping.iModelName, mockOdataFeedUrl), moq.Times.once());
    await waitFor(() => expect(screen.getByRole("button", { name: "UpdateDataset" })).not.toBeDisabled(), { timeout: 1000 });

    expect(screen.getByText(firstMockMapping.mappingName)).toBeInTheDocument();
    expect(screen.getByTitle(firstMockMapping.mappingDescription)).toBeInTheDocument();
    expect(screen.getByText(firstMockMapping.iModelName)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "UpdateDataset" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("starting extraction sends request", async () => {
    const firstMockMapping = mockReportMappingsAndMappingsFactory()[0];

    mockBulkExtractor.setup(async (x) => x.runIModelExtraction(firstMockMapping.imodelId))
      .returns(async () => { return Promise.resolve(); });

    mockBulkExtractor.setup(async (x) => x.getIModelState(firstMockMapping.imodelId, firstMockMapping.iModelName, mockOdataFeedUrl))
      .returns(async () => ExtractionStates.None);

    const jobStartEvent = new BeEvent<(iModelId: string) => void>();

    const { user } = render(<ReportMappingHorizontalTile
      jobStartEvent={jobStartEvent}
      mapping={firstMockMapping}
      onClickDelete={() => { }}
      bulkExtractor={mockBulkExtractor.object}
      odataFeedUrl={mockOdataFeedUrl}
    />);

    mockBulkExtractor.verify(async (x) => x.getIModelState(firstMockMapping.imodelId, firstMockMapping.iModelName, mockOdataFeedUrl), moq.Times.once());
    await waitFor(() => expect(screen.getByRole("button", { name: "UpdateDataset" })).not.toBeDisabled(), { timeout: 1000 });

    const startExtractionButton = screen.getByRole("button", { name: "UpdateDataset" });
    await user.click(startExtractionButton);

    mockBulkExtractor.verify(async (x) => x.runIModelExtraction(firstMockMapping.imodelId), moq.Times.once());
  });

  it("on delete is called when remove is pressed", async () => {
    const firstMockMapping = mockReportMappingsAndMappingsFactory()[0];

    mockBulkExtractor.setup(async (x) => x.runIModelExtraction(firstMockMapping.imodelId))
      .returns(async () => { return Promise.resolve(); });

    mockBulkExtractor.setup(async (x) => x.getIModelState(firstMockMapping.imodelId, firstMockMapping.iModelName, mockOdataFeedUrl))
      .returns(async () => ExtractionStates.None);

    const mockOnClickDelete = jest.fn();

    const jobStartEvent = new BeEvent<(iModelId: string) => void>();

    const { user } = render(<ReportMappingHorizontalTile
      jobStartEvent={jobStartEvent}
      mapping={firstMockMapping}
      onClickDelete={mockOnClickDelete}
      bulkExtractor={mockBulkExtractor.object}
      odataFeedUrl={mockOdataFeedUrl}
    />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Remove" })).not.toBeDisabled(), { timeout: 1000 });

    const removeButton = screen.getByRole("button", { name: "Remove" });
    await user.click(removeButton);

    expect(mockOnClickDelete).toBeCalledTimes(1);
  });

  it("full extraction status cycle", async () => {
    const firstMockMapping = mockReportMappingsAndMappingsFactory()[0];

    mockIModelsClient.setup(async (x) => x.getSingle(moq.It.isObjectWith<GetSingleIModelParams>({ iModelId: mockIModelId1 })))
      .returns(async () => mockIModelsResponse[0].iModel);

    mockBulkExtractor.setup(async (x) => x.runIModelExtraction(firstMockMapping.imodelId))
      .returns(async () => { return Promise.resolve(); });

    mockBulkExtractor.setup(async (x) => x.getIModelState(firstMockMapping.imodelId, firstMockMapping.iModelName, mockOdataFeedUrl))
      .returns(async () => ExtractionStates.None);

    const mockOnClickDelete = jest.fn();

    const jobStartEvent = new BeEvent<(iModelId: string) => void>();

    const { user } = render(<ReportMappingHorizontalTile
      jobStartEvent={jobStartEvent}
      mapping={firstMockMapping}
      onClickDelete={mockOnClickDelete}
      bulkExtractor={mockBulkExtractor.object}
      odataFeedUrl={mockOdataFeedUrl}
    />);

    await waitFor(() => expect(screen.getByRole("button", { name: "UpdateDataset" })).not.toBeDisabled(), { timeout: 1000 });

    mockBulkExtractor.setup(async (x) => x.getIModelState(firstMockMapping.imodelId, firstMockMapping.iModelName, mockOdataFeedUrl))
      .returns(async () => ExtractionStates.Starting);

    mockBulkExtractor.setup((x) => x.clearIModelJob(firstMockMapping.imodelId));

    const startExtractionButton = screen.getByRole("button", { name: "UpdateDataset" });
    await user.click(startExtractionButton);

    mockBulkExtractor.verify(async (x) => x.runIModelExtraction(firstMockMapping.imodelId), moq.Times.once());

    expect(screen.getByTitle("Starting")).toBeInTheDocument();

    mockBulkExtractor.reset();
    mockBulkExtractor.setup(async (x) => x.getIModelState(firstMockMapping.imodelId, firstMockMapping.iModelName, mockOdataFeedUrl))
      .returns(async () => ExtractionStates.Queued);

    await waitFor(() => expect(screen.getByTitle("Queued")).toBeInTheDocument(), { timeout: 1000 });

    mockBulkExtractor.reset();
    mockBulkExtractor.setup(async (x) => x.getIModelState(firstMockMapping.imodelId, firstMockMapping.iModelName, mockOdataFeedUrl))
      .returns(async () => ExtractionStates.Running);
    await waitFor(() => expect(screen.getByTitle("Running")).toBeInTheDocument(), { timeout: 1000 });

    mockBulkExtractor.reset();
    mockBulkExtractor.setup(async (x) => x.getIModelState(firstMockMapping.imodelId, firstMockMapping.iModelName, mockOdataFeedUrl))
      .returns(async () => ExtractionStates.Succeeded);
    await waitFor(() => expect(screen.getByTitle("Success")).toBeInTheDocument(), { timeout: 1000 });

    mockBulkExtractor.reset();
    fireEvent.animationEnd(screen.getByTestId("rcw-success-animation"));
    await waitFor(() => expect(screen.getByRole("button", { name: "UpdateDataset" })).toBeInTheDocument(), { timeout: 1000 });

    mockBulkExtractor.verify((x) => x.clearIModelJob(firstMockMapping.imodelId), moq.Times.once());
  });

  it("second tile should update status", async () => {
    const mockReportMappingsAndMappings = mockReportMappingsAndMappingsFactory();
    const firstMockMapping = mockReportMappingsAndMappings[0];
    const secondMockMapping = mockReportMappingsAndMappings[1];

    mockBulkExtractor.setup(async (x) => x.getIModelState(firstMockMapping.imodelId, firstMockMapping.iModelName, mockOdataFeedUrl))
      .returns(async () => ExtractionStates.None);

    const jobStartEvent = new BeEvent<(iModelId: string) => void>();

    const { user } = render(
      <div>
        <ReportMappingHorizontalTile
          jobStartEvent={jobStartEvent}
          mapping={firstMockMapping}
          onClickDelete={() => { }}
          bulkExtractor={mockBulkExtractor.object}
          odataFeedUrl={mockOdataFeedUrl}
        />
        <ReportMappingHorizontalTile
          jobStartEvent={jobStartEvent}
          mapping={secondMockMapping}
          onClickDelete={() => { }}
          bulkExtractor={mockBulkExtractor.object}
          odataFeedUrl={mockOdataFeedUrl}
        />
      </div>);

    const tiles = screen.getAllByTestId("horizontal-tile");

    for (const tile of tiles) {
      const preview = within(tile);
      await waitFor(() => expect(preview.getByRole("button", { name: "UpdateDataset" })).not.toBeDisabled(), { timeout: 1000 });
    }

    mockBulkExtractor.reset();
    mockBulkExtractor.setup(async (x) => x.getIModelState(firstMockMapping.imodelId, firstMockMapping.iModelName, mockOdataFeedUrl))
      .returns(async () => ExtractionStates.Queued);

    mockBulkExtractor.setup(async (x) => x.runIModelExtraction(firstMockMapping.imodelId))
      .returns(async () => { return Promise.resolve(); });

    const startExtractionButton = screen.getAllByRole("button", { name: "UpdateDataset" })[0];
    await user.click(startExtractionButton);

    for (const tile of tiles) {
      const preview = within(tile);
      await waitFor(() => expect(preview.getByTitle("Queued")).toBeInTheDocument(), { timeout: 1000 });
    }

    expect(screen.getAllByTitle("Queued")).toHaveLength(2);
  });
});
