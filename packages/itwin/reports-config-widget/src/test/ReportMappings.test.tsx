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
  act,
  render,
  screen,
  TestUtils,
  waitForElementToBeRemoved,
  within,
} from "./test-utils";
import * as moq from "typemoq";
import type {
  MappingSingle,
  Report,
  ReportMappingCollection,
} from "@itwin/insights-client";
import type { ReportMappingAndMapping } from "../widget/components/ReportMappings";
import { ReportMappings } from "../widget/components/ReportMappings";
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
import type { BeEvent } from "@itwin/core-bentley";
import type BulkExtractor from "../widget/components/BulkExtractor";
import type { ReportMappingHorizontalTileProps } from "../widget/components/ReportMappingHorizontalTile";
import { Text } from "@itwin/itwinui-react";

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
const mockBulkExtractor = moq.Mock.ofType<BulkExtractor>();
const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
const selectionScopesManagerMock = moq.Mock.ofType<SelectionScopesManager>();
const mockIModelsClient = moq.Mock.ofType<IModelOperations<OperationOptions>>();

interface AddMappingsModalProps {
  reportId: string;
  existingMappings: ReportMappingAndMapping[];
  show: boolean;
  returnFn: () => Promise<void>;
}

jest.mock("../widget/components/Constants.ts", () => ({
  STATUS_CHECK_INTERVAL: 10,
}));

jest.mock("../widget/components/ReportMappingHorizontalTile", () => ({
  ReportMappingHorizontalTile: (props: ReportMappingHorizontalTileProps) => {
    return (<div data-testid="horizontal-tile">
      <Text>{props.mapping.mappingName}</Text>
      <Text title={props.mapping.mappingDescription}>{props.mapping.iModelName}</Text>
    </div>);
  },
}));

jest.mock("@itwin/appui-react", () => ({
  ...jest.requireActual("@itwin/appui-react"),
  useActiveIModelConnection: () => connectionMock.object,
}));

let returnFn: () => Promise<void>;
jest.mock("../widget/components/AddMappingsModal", () => ({
  ...jest.requireActual("../widget/components/AddMappingsModal"),
  AddMappingsModal: (props: AddMappingsModalProps) => {
    returnFn = props.returnFn;
    return <div />;
  },
}));

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

jest.mock("@itwin/insights-client", () => ({
  ...jest.requireActual("@itwin/insights-client"),
  MappingsClient: jest.fn().mockImplementation(() => ({
    getMapping: mockGetMapping,
    getMappings: mockGetMappings,
  })),
  ReportsClient: jest.fn().mockImplementation(() => ({
    getReportMappings: mockGetReportMappings,
    deleteReportMapping: mockDeleteReportMapping,
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
  mockGetMapping.mockReset();
  mockGetMappings.mockReset();
  mockGetReportMappings.mockReset();
  mockDeleteReportMapping.mockReset();
  mockIModelsClient.reset();
  mockBulkExtractor.reset();
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

    render(<ReportMappings report={mockReport} bulkExtractor={mockBulkExtractor.object} goBack={jest.fn()} />);

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));

    const horizontalTiles = screen.getAllByTestId("horizontal-tile");
    assertHorizontalTiles(horizontalTiles, mockMappings);
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
      <ReportMappings report={mockReport} bulkExtractor={mockBulkExtractor.object} goBack={jest.fn()} />
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

  it("add mapping", async () => {
    const mockReportMappings = mockReportMappingsFactory();
    const mockMappings = mockMappingsFactory(mockReportMappings);

    mockIModelsClient.setup(async (x) => x.getSingle(moq.It.isObjectWith<GetSingleIModelParams>({ iModelId: mockIModelId1 })))
      .returns(async () => mockIModelsResponse[0].iModel);

    mockIModelsClient.setup(async (x) => x.getSingle(moq.It.isObjectWith<GetSingleIModelParams>({ iModelId: mockIModelId2 })))
      .returns(async () => mockIModelsResponse[1].iModel);

    mockGetMapping.mockReturnValueOnce(mockMappings[0].mapping).mockReturnValueOnce(mockMappings[1].mapping);
    mockGetReportMappings.mockReturnValueOnce(mockReportMappings.mappings);

    render(
      <ReportMappings report={mockReport} bulkExtractor={mockBulkExtractor.object} goBack={jest.fn()} />
    );

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));

    mockGetMappings.mockReturnValueOnce(mockMappings.map((m: MappingSingle) => m.mapping));

    await act(async () => {
      await returnFn();
    });

    const horizontalTiles = screen.getAllByTestId("horizontal-tile");
    assertHorizontalTiles(horizontalTiles, mockMappings);

    expect(mockGetReportMappings).toBeCalledTimes(2);
  });

  it("odata feed url", async () => {
    const { user } = render(
      <ReportMappings report={mockReport} bulkExtractor={mockBulkExtractor.object} goBack={jest.fn()} />
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

  it("update all datasets", async () => {
    const mockReportMappings = mockReportMappingsFactory();
    const mockMappings = mockMappingsFactory(mockReportMappings);

    mockIModelsClient.setup(async (x) => x.getSingle(moq.It.isObjectWith<GetSingleIModelParams>({ iModelId: mockIModelId1 })))
      .returns(async () => mockIModelsResponse[0].iModel);

    mockIModelsClient.setup(async (x) => x.getSingle(moq.It.isObjectWith<GetSingleIModelParams>({ iModelId: mockIModelId2 })))
      .returns(async () => mockIModelsResponse[1].iModel);

    mockGetMapping.mockReturnValueOnce(mockMappings[0].mapping).mockReturnValueOnce(mockMappings[1].mapping);
    mockGetReportMappings.mockReturnValueOnce(mockReportMappings.mappings);

    const iModels = mockIModelsResponse.map((iModel) => iModel.iModel.id);
    mockBulkExtractor.setup(async (x) => x.runIModelExtractions(iModels)).returns(async () => Promise.resolve());

    const { user } = render(<ReportMappings report={mockReport} bulkExtractor={mockBulkExtractor.object} goBack={jest.fn()} />);

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));

    const extractAllButton = screen.getByText(/UpdateAllDatasets/i);
    expect(extractAllButton).toBeInTheDocument();

    await user.click(extractAllButton);
    mockBulkExtractor.verify(async (x) => x.runIModelExtractions(iModels), moq.Times.once());
  });

  const assertHorizontalTiles = (horizontalTiles: HTMLElement[], mockMappings: MappingSingle[]) => {
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
  };
});
