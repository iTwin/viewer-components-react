/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import BulkExtractor from "../widget/components/BulkExtractor";
import { REPORTS_CONFIG_BASE_URL } from "../widget/ReportsConfigUiProvider";
import { ExtractionStates } from "../widget/components/ExtractionStatus";
import { assert } from "chai";

jest.mock('../widget/components/Constants.ts', () => ({
  STATUS_CHECK_INTERVAL: -1,
}));

jest.mock('../widget/components/ExtractionToast.tsx', () => (
  {
    FailedExtractionToast: jest.fn(),
    SuccessfulExtractionToast: jest.fn(),
  }));

const mockRunExtraction = jest.fn();
const mockGetStatus = jest.fn();

jest.mock("@itwin/insights-client", () => ({
  ...jest.requireActual("@itwin/insights-client"),
  ReportsClient: jest.fn().mockImplementation(() => ({

  })),
  ExtractionClient: jest.fn().mockImplementation(() => ({
    runExtraction: mockRunExtraction,
    getExtractionStatus: mockGetStatus,
  })),
}));

beforeAll(() => {
  //jest.useFakeTimers();
});

afterEach(() => {
  mockRunExtraction.mockReset();
  mockGetStatus.mockReset();

  // mockRunExtraction.mockClear();
  // mockGetStatus.mockClear();
});

describe("BulkExtractor", () => {
  const mockApiConfig = {
    getAccessToken: async () => "mockAccessToken",
    baseUrl: "",
  };

  it("should return status none for unknown iModel", async () => {
    const sut = new BulkExtractor(mockApiConfig);
    const result = await sut.getIModelState("mockIModelId", "mockIModelName", "mockFeedUrl");
    assert.strictEqual(result, ExtractionStates.None);
  });

  it("should return running status for started extraction", async () => {
    mockRunExtraction.mockReturnValueOnce({
      id: "mockRunId",
    });

    const time1 = performance.now();
    const sut = new BulkExtractor(mockApiConfig);
    const time2 = performance.now();
    await sut.runIModelExtraction("mockIModelId");
    const time3 = performance.now();
    const result = await sut.getIModelState("mockIModelId", "mockIModelName", "mockFeedUrl");
    const time4 = performance.now();
    console.log("create bulk extractor:", time2 - time1);
    console.log("run extraction:", time3 - time2);
    console.log("get last state:", time4 - time3);
    assert.strictEqual(result, ExtractionStates.Starting);
  });

  it("should return queued status after delay", async () => {
    mockRunExtraction.mockReturnValueOnce({
      id: "mockRunId",
    });

    mockGetStatus.mockReturnValueOnce({
      state: "Queued",
    });

    const sut = new BulkExtractor(mockApiConfig);
    await sut.runIModelExtraction("mockIModelId");

    const result = await sut.getIModelState("mockIModelId", "mockIModelName", "mockFeedUrl");
    assert.strictEqual(result, ExtractionStates.Queued);

    expect(mockRunExtraction).toHaveBeenCalledTimes(1);
    expect(mockGetStatus).toHaveBeenCalledTimes(1);
  });

  it("full status check cycle", async () => {
    mockRunExtraction.mockReturnValueOnce({
      id: "mockRunId",
    });

    mockGetStatus.mockReturnValueOnce({
      state: "Queued",
    });

    mockGetStatus.mockReturnValueOnce({
      state: "Running",
    });

    mockGetStatus.mockReturnValueOnce({
      state: "Succeeded",
    });

    const sut = new BulkExtractor(mockApiConfig);
    await sut.runIModelExtraction("mockIModelId");


    let result = await sut.getIModelState("mockIModelId", "mockIModelName", "mockFeedUrl");
    assert.strictEqual(result, ExtractionStates.Queued);

    result = await sut.getIModelState("mockIModelId", "mockIModelName", "mockFeedUrl");
    assert.strictEqual(result, ExtractionStates.Running);

    result = await sut.getIModelState("mockIModelId", "mockIModelName", "mockFeedUrl");
    assert.strictEqual(result, ExtractionStates.Succeeded);

    expect(mockRunExtraction).toHaveBeenCalledTimes(1);
    expect(mockGetStatus).toHaveBeenCalledTimes(3);
  });

  it("two started jobs should return status", async () => {
    mockRunExtraction.mockReturnValueOnce({
      id: "mockRunId1",
    });

    mockRunExtraction.mockReturnValueOnce({
      id: "mockRunId2",
    });

    const mockIModelIds = ["mockIModelId1", "mockIModelId2"];

    const sut = new BulkExtractor(mockApiConfig);

    await sut.runIModelExtractions(mockIModelIds);

    mockGetStatus.mockReturnValueOnce({
      state: "Queued",
    });

    mockGetStatus.mockReturnValueOnce({
      state: "Queued",
    });

    const result1 = await sut.getIModelState("mockIModelId1", "mockIModelName1", "mockFeedUrl1");
    const result2 = await sut.getIModelState("mockIModelId2", "mockIModelName2", "mockFeedUrl2");

    assert.strictEqual(result1, ExtractionStates.Queued);
    assert.strictEqual(result2, ExtractionStates.Queued);

    expect(mockRunExtraction).toHaveBeenCalledTimes(2);
  });
});
