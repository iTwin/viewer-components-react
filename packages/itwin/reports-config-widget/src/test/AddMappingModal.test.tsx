/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { vi } from "vitest";
import faker from "@faker-js/faker";
import { ReportsConfigWidget } from "../ReportsConfigWidget";
import { mockIModelId1, mockIModelId2, mockIModelsResponse, mockITwinId, mockReportId, render, screen, waitFor, within } from "./test-utils";
import * as moq from "typemoq";
import type { MappingContainer, MappingsClient, ReportMappingCollection, ReportsClient } from "@itwin/insights-client";
import type { ReportMappingAndMapping } from "../widget/components/ReportMappings";
import type { GetSingleIModelParams, IModelsClient } from "@itwin/imodels-client-management";
import { AddMappingsModal } from "../widget/components/AddMappingsModal";
import { EmptyLocalization } from "@itwin/core-common";
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
        iModel: {
          href: "",
        },
      },
    },
  });

  return mockMappings;
};

const mockReportMappingsAndMappingsFactory = (mockMappings: MappingContainer[], reportMappings: ReportMappingCollection): ReportMappingAndMapping[] => {
  const reportMappingsAndMapping = reportMappings.mappings.map((reportMapping) => {
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

vi.mock("@itwin/imodels-client-management", async () => ({
  ...(await vi.importActual("@itwin/imodels-client-management")),
  toArray: vi.fn().mockImplementation(async () => {
    return mockProjectIModels.iModels;
  }),
}));

const mockGetMappings = vi.fn();
const mockCreateReportMapping = vi.fn();

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
  mockReportsClient.setup(async (x) => x.createReportMapping(moq.It.isAny(), moq.It.isAny(), moq.It.isAny())).returns(mockCreateReportMapping);
  mockMappingsClient.setup(async (x) => x.getMappings(moq.It.isAny(), moq.It.isAny())).returns(mockGetMappings);
});

afterEach(() => {
  mockGetMappings.mockReset();
  mockIModelsClient.reset();
});

describe("Add Mapping Modal", () => {
  it("Adding mapping sends create request", async () => {
    const mockReportMappings = mockReportMappingsFactory();
    const mockMappings = mockMappingsFactory(mockReportMappings);
    const mockReportMappingsAndMappings = mockReportMappingsAndMappingsFactory(mockMappings, mockReportMappings);

    mockGetMappings.mockReturnValueOnce({ mappings: mockMappings.map((m: MappingContainer) => m.mapping) });

    const { user } = render(
      <AddMappingsModal
        show={true}
        reportId={mockReportId}
        existingMappings={mockReportMappingsAndMappings}
        onClose={vi.fn()}
        defaultIModelId={mockIModelId1}
      />,
      { iTwinId: mockITwinId, reportsClient: mockReportsClient.object, mappingsClient: mockMappingsClient.object, iModelsClient: mockIModelsClient.object },
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const modal = screen.getByRole("dialog");
    const withinModal = within(modal);
    expect(withinModal.getByText(/addmappings/i)).toBeInTheDocument();

    const addButton = withinModal.getByRole("button", {
      name: /add/i,
    });

    await waitFor(() => screen.getByRole("row"));

    // Already mapped mappings are disabled
    for (let i = 0; i < mockMappings.length - 1; i++) {
      const row = screen.getByRole("row", {
        name: new RegExp(`${mockMappings[i].mapping.mappingName} ${mockMappings[i].mapping.description}`, "i"),
      });

      const checkbox = within(row).getByRole("checkbox");
      expect(checkbox).toBeDisabled();
    }

    // Click on checkbox on new mapping
    const unmappedRow = screen.getByRole("row", {
      name: new RegExp(`${mockMappings[mockMappings.length - 1].mapping.mappingName} ${mockMappings[mockMappings.length - 1].mapping.description}`, "i"),
    });

    const enabledCheckbox = within(unmappedRow).getByRole("checkbox");

    await user.click(enabledCheckbox);
    await user.click(addButton);

    expect(mockCreateReportMapping).toBeCalledTimes(1);
  });
});
