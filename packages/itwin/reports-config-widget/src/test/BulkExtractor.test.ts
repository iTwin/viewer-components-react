import { assert } from "chai";
import * as moq from "typemoq";
import { ExtractionClient, ExtractionState, MappingsClient, ReportsClient } from "@itwin/insights-client";
/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { BulkExtractor } from "../widget/components/BulkExtractor";
import { ExtractionStates } from "../widget/components/ExtractionStatus";

import type { AccessToken } from "@itwin/core-bentley";

jest.mock("../widget/components/Constants.ts", () => ({
  STATUS_CHECK_INTERVAL: -1,
}));

jest.mock("../widget/components/ExtractionToast.tsx", () => ({
  FailedExtractionToast: jest.fn(),
  SuccessfulExtractionToast: jest.fn(),
}));

const mockRunExtraction = moq.Mock.ofType<(accessToken: AccessToken, iModelId: string) => Promise<{ id: string }>>();
const mockGetStatus = moq.Mock.ofType<(accessToken: AccessToken, jobId: string) => Promise<{ state: ExtractionState }>>();
const mockGetReportMappings = moq.Mock.ofType<(accessToken: AccessToken, reportId: string) => Promise<{ imodelId: string }[]>>();

jest.mock("@itwin/insights-client", () => ({
  ...jest.requireActual("@itwin/insights-client"),
  ReportsClient: jest.fn().mockImplementation(() => ({
    getReportMappings: mockGetReportMappings.object,
  })),
  ExtractionClient: jest.fn().mockImplementation(() => ({
    runExtraction: mockRunExtraction.object,
    getExtractionStatus: mockGetStatus.object,
  })),
}));

afterEach(() => {
  mockRunExtraction.reset();
  mockGetStatus.reset();
});

const mockToastCallback = jest.fn();

const mockGetAccessToken = async () => "mockAccessToken";

const mockIModelId = "mockIModelId";
const mockIModelId1 = "mockIModelId1";
const mockReportId = "mockReportId";
const mockRunId = "mockRunId";
const mockRunId1 = "mockRunId1";

describe("BulkExtractor", () => {
  it("should return status none for unknown iModel", async () => {
    const sut = new BulkExtractor(new ReportsClient(), new ExtractionClient(), new MappingsClient(), mockGetAccessToken, mockToastCallback, mockToastCallback);
    const result = await sut.getIModelState(mockIModelId, "", "");
    assert.strictEqual(result, ExtractionStates.None);
  });

  it("should return running status for started extraction", async () => {
    mockRunExtraction.setup(async (x) => x(moq.It.isAny(), mockIModelId)).returns(async () => ({ id: mockRunId }));

    mockGetStatus.setup(async (x) => x(moq.It.isAny(), mockRunId)).returns(async () => ({ state: ExtractionState.Running }));

    const sut = new BulkExtractor(new ReportsClient(), new ExtractionClient(), new MappingsClient(), mockGetAccessToken, mockToastCallback, mockToastCallback);
    await sut.runIModelExtraction(mockIModelId);
    const result = await sut.getIModelState(mockIModelId, "", "");
    assert.strictEqual(result, ExtractionStates.Running);
  });

  it("should return failed status for failed extraction", async () => {
    mockRunExtraction.setup(async (x) => x(moq.It.isAny(), mockIModelId)).returns(async () => ({ id: mockRunId }));

    mockGetStatus.setup(async (x) => x(moq.It.isAny(), mockRunId)).returns(async () => ({ state: ExtractionState.Failed }));

    const sut = new BulkExtractor(new ReportsClient(), new ExtractionClient(), new MappingsClient(), mockGetAccessToken, mockToastCallback, mockToastCallback);
    await sut.runIModelExtraction(mockIModelId);
    const result = await sut.getIModelState(mockIModelId, "", "");
    assert.strictEqual(result, ExtractionStates.Failed);
  });

  it("full status check cycle", async () => {
    mockRunExtraction.setup(async (x) => x(moq.It.isAny(), mockIModelId)).returns(async () => ({ id: mockRunId }));

    mockGetStatus.setup(async (x) => x(moq.It.isAny(), mockRunId)).returns(async () => ({ state: ExtractionState.Queued }));

    mockGetStatus.setup(async (x) => x(moq.It.isAny(), mockRunId)).returns(async () => ({ state: ExtractionState.Running }));

    mockGetStatus.setup(async (x) => x(moq.It.isAny(), mockRunId)).returns(async () => ({ state: ExtractionState.Succeeded }));

    const sut = new BulkExtractor(new ReportsClient(), new ExtractionClient(), new MappingsClient(), mockGetAccessToken, mockToastCallback, mockToastCallback);
    await sut.runIModelExtraction(mockIModelId);

    let result = await sut.getIModelState(mockIModelId, "", "");
    assert.strictEqual(result, ExtractionStates.Queued);

    result = await sut.getIModelState(mockIModelId, "", "");
    assert.strictEqual(result, ExtractionStates.Running);

    result = await sut.getIModelState(mockIModelId, "", "");
    assert.strictEqual(result, ExtractionStates.Succeeded);
  });

  it("two started jobs should return status", async () => {
    const mockIModelIds = [mockIModelId, mockIModelId1];

    mockRunExtraction.setup(async (x) => x(moq.It.isAny(), mockIModelId)).returns(async () => ({ id: mockRunId }));

    mockRunExtraction.setup(async (x) => x(moq.It.isAny(), mockIModelId1)).returns(async () => ({ id: mockRunId1 }));

    mockGetStatus.setup(async (x) => x(moq.It.isAny(), mockRunId)).returns(async () => ({ state: ExtractionState.Queued }));

    mockGetStatus.setup(async (x) => x(moq.It.isAny(), mockRunId1)).returns(async () => ({ state: ExtractionState.Queued }));

    const sut = new BulkExtractor(new ReportsClient(), new ExtractionClient(), new MappingsClient(), mockGetAccessToken, mockToastCallback, mockToastCallback);

    await sut.runIModelExtractions(mockIModelIds);

    const result1 = await sut.getIModelState(mockIModelId, "", "");
    const result2 = await sut.getIModelState(mockIModelId1, "", "");

    assert.strictEqual(result1, ExtractionStates.Queued);
    assert.strictEqual(result2, ExtractionStates.Queued);
  });

  it("should return status none for unknown report", async () => {
    const sut = new BulkExtractor(new ReportsClient(), new ExtractionClient(), new MappingsClient(), mockGetAccessToken, mockToastCallback, mockToastCallback);
    const result = await sut.getReportState(mockReportId);
    assert.strictEqual(result, ExtractionStates.None);
  });

  it("should return status running for running report", async () => {
    mockRunExtraction.setup(async (x) => x(moq.It.isAny(), mockIModelId)).returns(async () => ({ id: mockRunId }));

    mockGetStatus.setup(async (x) => x(moq.It.isAny(), mockRunId)).returns(async () => ({ state: ExtractionState.Running }));

    mockGetReportMappings.setup(async (x) => x(moq.It.isAny(), mockReportId)).returns(async () => [{ imodelId: mockIModelId }]);

    const sut = new BulkExtractor(new ReportsClient(), new ExtractionClient(), new MappingsClient(), mockGetAccessToken, mockToastCallback, mockToastCallback);

    await sut.runReportExtractions([mockReportId]);

    const result = await sut.getReportState(mockReportId);
    assert.strictEqual(result, ExtractionStates.Running);
  });

  it("should return status running for both iModels in report", async () => {
    mockRunExtraction.setup(async (x) => x(moq.It.isAny(), mockIModelId)).returns(async () => ({ id: mockRunId }));

    mockRunExtraction.setup(async (x) => x(moq.It.isAny(), mockIModelId1)).returns(async () => ({ id: mockRunId1 }));

    mockGetStatus.setup(async (x) => x(moq.It.isAny(), mockRunId)).returns(async () => ({ state: ExtractionState.Running }));

    mockGetStatus.setup(async (x) => x(moq.It.isAny(), mockRunId1)).returns(async () => ({ state: ExtractionState.Running }));

    mockGetReportMappings.setup(async (x) => x(moq.It.isAny(), mockReportId)).returns(async () => [{ imodelId: mockIModelId }, { imodelId: mockIModelId1 }]);

    const sut = new BulkExtractor(new ReportsClient(), new ExtractionClient(), new MappingsClient(), mockGetAccessToken, mockToastCallback, mockToastCallback);

    await sut.runReportExtractions([mockReportId]);

    const result1 = await sut.getIModelState(mockIModelId, "", "");
    const result2 = await sut.getIModelState(mockIModelId1, "", "");

    assert.strictEqual(result1, ExtractionStates.Running);
    assert.strictEqual(result2, ExtractionStates.Running);
  });

  it("should return lowest progress status for extractions in report", async () => {
    mockRunExtraction.setup(async (x) => x(moq.It.isAny(), mockIModelId)).returns(async () => ({ id: mockRunId }));

    mockRunExtraction.setup(async (x) => x(moq.It.isAny(), mockIModelId1)).returns(async () => ({ id: mockRunId1 }));

    mockGetStatus.setup(async (x) => x(moq.It.isAny(), mockRunId)).returns(async () => ({ state: ExtractionState.Running }));

    mockGetStatus.setup(async (x) => x(moq.It.isAny(), mockRunId1)).returns(async () => ({ state: ExtractionState.Queued }));

    mockGetReportMappings.setup(async (x) => x(moq.It.isAny(), mockReportId)).returns(async () => [{ imodelId: mockIModelId }, { imodelId: mockIModelId1 }]);

    const sut = new BulkExtractor(new ReportsClient(), new ExtractionClient(), new MappingsClient(), mockGetAccessToken, mockToastCallback, mockToastCallback);

    await sut.runReportExtractions([mockReportId]);

    const result = await sut.getReportState(mockReportId);
    assert.strictEqual(result, ExtractionStates.Queued);
  });

  it("should return status failed if one of the extractions in report failed", async () => {
    mockRunExtraction.setup(async (x) => x(moq.It.isAny(), mockIModelId)).returns(async () => ({ id: mockRunId }));

    mockRunExtraction.setup(async (x) => x(moq.It.isAny(), mockIModelId1)).returns(async () => ({ id: mockRunId1 }));

    mockGetStatus.setup(async (x) => x(moq.It.isAny(), mockRunId)).returns(async () => ({ state: ExtractionState.Succeeded }));

    mockGetStatus.setup(async (x) => x(moq.It.isAny(), mockRunId1)).returns(async () => ({ state: ExtractionState.Failed }));

    mockGetReportMappings.setup(async (x) => x(moq.It.isAny(), mockReportId)).returns(async () => [{ imodelId: mockIModelId1 }, { imodelId: mockIModelId1 }]);

    const sut = new BulkExtractor(new ReportsClient(), new ExtractionClient(), new MappingsClient(), mockGetAccessToken, mockToastCallback, mockToastCallback);

    await sut.runReportExtractions([mockReportId]);

    const result = await sut.getReportState(mockReportId);
    assert.strictEqual(result, ExtractionStates.Failed);
  });

  it("full report extraction status check cycle", async () => {
    mockRunExtraction.setup(async (x) => x(moq.It.isAny(), mockIModelId)).returns(async () => ({ id: mockRunId }));

    mockGetStatus.setup(async (x) => x(moq.It.isAny(), mockRunId)).returns(async () => ({ state: ExtractionState.Queued }));

    mockGetStatus.setup(async (x) => x(moq.It.isAny(), mockRunId)).returns(async () => ({ state: ExtractionState.Running }));

    mockGetStatus.setup(async (x) => x(moq.It.isAny(), mockRunId)).returns(async () => ({ state: ExtractionState.Succeeded }));

    mockGetReportMappings.setup(async (x) => x(moq.It.isAny(), mockReportId)).returns(async () => [{ imodelId: mockIModelId }]);

    const sut = new BulkExtractor(new ReportsClient(), new ExtractionClient(), new MappingsClient(), mockGetAccessToken, mockToastCallback, mockToastCallback);
    await sut.runReportExtractions([mockReportId]);

    let result = await sut.getReportState(mockReportId);
    assert.strictEqual(result, ExtractionStates.Queued);

    result = await sut.getReportState(mockReportId);
    assert.strictEqual(result, ExtractionStates.Running);

    result = await sut.getReportState(mockReportId);
    assert.strictEqual(result, ExtractionStates.Succeeded);
  });
});
