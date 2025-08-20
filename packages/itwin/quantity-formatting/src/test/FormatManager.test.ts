/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { beforeEach, describe, expect, it, vi } from "vitest";
import { BeEvent } from "@itwin/core-bentley";
import { IModelApp } from "@itwin/core-frontend";
import type { FormatDefinition, FormatsProvider } from "@itwin/core-quantity";
import type { FormatSet } from "@itwin/ecschema-metadata";
import { FormatManager, FormatSetFormatsProvider } from "../api/FormatManager.js";
import { getUsedKindOfQuantitiesFromIModel } from "../api/Utils.js";

// Mock dependencies
vi.mock("@itwin/core-frontend", () => ({
  IModelApp: {
    formatsProvider: undefined,
    quantityFormatter: {
      activeUnitSystem: "metric",
      onActiveFormattingUnitSystemChanged: new BeEvent(),
    },
  },
}));

vi.mock("@itwin/ecschema-metadata", () => ({
  SchemaFormatsProvider: vi.fn(),
  SchemaItem: {
    parseFullName: vi.fn((name: string) => {
      const parts = name.split(".");
      return parts.length === 2 ? [parts[0], parts[1]] : ["", name];
    }),
  },
  SchemaItemType: {
    KindOfQuantity: "KindOfQuantity",
  },
  SchemaKey: vi.fn(),
  SchemaMatchType: {
    Latest: "Latest",
  },
}));

describe("getUsedKindOfQuantitiesFromIModel", () => {
  let mockIModel: any;

  beforeEach(() => {
    mockIModel = {
      createQueryReader: vi.fn(),
    };
  });

  it("should return KindOfQuantity full names", async () => {
    const mockRows = [
      ["AecUnits.LENGTH"],
      ["AecUnits.AREA"],
      ["Units.VOLUME"],
    ];

    const mockReader = {
      toArray: vi.fn().mockResolvedValue(mockRows),
    };

    mockIModel.createQueryReader.mockReturnValue(mockReader);

    const result = await getUsedKindOfQuantitiesFromIModel(mockIModel);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      kindOfQuantityFullName: "AecUnits.LENGTH",
    });
    expect(result[1]).toEqual({
      kindOfQuantityFullName: "AecUnits.AREA",
    });
    expect(result[2]).toEqual({
      kindOfQuantityFullName: "Units.VOLUME",
    });
  });

  it("should return empty array when query fails", async () => {
    mockIModel.createQueryReader.mockImplementation(() => {
      throw new Error("Query failed");
    });

    const result = await getUsedKindOfQuantitiesFromIModel(mockIModel);

    expect(result).toEqual([]);
  });

  it("should return empty array when reader fails", async () => {
    const mockReader = {
      toArray: vi.fn().mockRejectedValue(new Error("Reader failed")),
    };

    mockIModel.createQueryReader.mockReturnValue(mockReader);

    const result = await getUsedKindOfQuantitiesFromIModel(mockIModel);

    expect(result).toEqual([]);
  });

  it("should handle empty result set", async () => {
    const mockReader = {
      toArray: vi.fn().mockResolvedValue([]),
    };

    mockIModel.createQueryReader.mockReturnValue(mockReader);

    const result = await getUsedKindOfQuantitiesFromIModel(mockIModel);

    expect(result).toEqual([]);
  });
});

describe("FormatManager", () => {
  let testFormatSet1: FormatSet;
  let testFormatSet2: FormatSet;
  let mockFormatsProvider: FormatsProvider;

  beforeEach(() => {
    // Reset the singleton instance before each test
    FormatManager.terminate();

    // Create test format sets
    testFormatSet1 = {
      name: "TestSet1",
      label: "Test Format Set 1",
      formats: {
        "test.format1": {
          type: "Decimal",
          precision: 2,
          label: "Test Format 1",
        } as FormatDefinition,
        "test.format2": {
          type: "Decimal",
          precision: 4,
          label: "Test Format 2",
        } as FormatDefinition,
      },
    };

    testFormatSet2 = {
      name: "TestSet2",
      label: "Test Format Set 2",
      formats: {
        "test.format3": {
          type: "Scientific",
          precision: 3,
          label: "Test Format 3",
        } as FormatDefinition,
      },
    };

    // Create mock formats provider
    mockFormatsProvider = {
      getFormat: vi.fn().mockResolvedValue(undefined),
    } as unknown as FormatsProvider;

    // Reset IModelApp mock
    (IModelApp as any).formatsProvider = undefined;
  });

  describe("Initialization", () => {
    it("should initialize with format sets", async () => {
      await FormatManager.initialize({
        formatSets: [testFormatSet1, testFormatSet2],
        fallbackProvider: mockFormatsProvider,
      });

      const manager = FormatManager.instance;
      expect(manager).toBeDefined();
      expect(manager!.formatSets).toHaveLength(2);
      expect(manager!.formatSets[0].name).toBe("TestSet1");
      expect(manager!.formatSets[1].name).toBe("TestSet2");
      expect(manager!.fallbackFormatsProvider).toBe(mockFormatsProvider);
    });

    it("should throw error if already initialized", async () => {
      await FormatManager.initialize({
        formatSets: [testFormatSet1],
      });

      await expect(
        FormatManager.initialize({
          formatSets: [testFormatSet2],
        })
      ).rejects.toThrow("FormatManager is already initialized");
    });

    it("should return undefined instance when not initialized", () => {
      expect(FormatManager.instance).toBeUndefined();
    });
  });

  describe("Format Set Management", () => {
    beforeEach(async () => {
      await FormatManager.initialize({
        formatSets: [testFormatSet1],
      });
    });

    it("should set format sets", () => {
      const manager = FormatManager.instance!;
      const onFormatSetsChangedSpy = vi.fn();
      manager.onFormatSetsChanged.addListener(onFormatSetsChangedSpy);

      manager.formatSets = [testFormatSet1, testFormatSet2];

      expect(manager.formatSets).toHaveLength(2);
      expect(onFormatSetsChangedSpy).toHaveBeenCalledWith([testFormatSet1, testFormatSet2]);
    });

    it("should add format set", () => {
      const manager = FormatManager.instance!;
      const onFormatSetsChangedSpy = vi.fn();
      manager.onFormatSetsChanged.addListener(onFormatSetsChangedSpy);

      manager.addFormatSet(testFormatSet2);

      expect(manager.formatSets).toHaveLength(2);
      expect(manager.getFormatSet("TestSet2")).toBe(testFormatSet2);
      expect(onFormatSetsChangedSpy).toHaveBeenCalled();
    });

    it("should replace existing format set with same name", () => {
      const manager = FormatManager.instance!;
      const updatedFormatSet = { ...testFormatSet1, label: "Updated Label" };

      manager.addFormatSet(updatedFormatSet);

      expect(manager.formatSets).toHaveLength(1);
      expect(manager.getFormatSet("TestSet1")!.label).toBe("Updated Label");
    });

    it("should remove format set", () => {
      const manager = FormatManager.instance!;
      manager.addFormatSet(testFormatSet2);

      const result = manager.removeFormatSet("TestSet2");

      expect(result).toBe(true);
      expect(manager.formatSets).toHaveLength(1);
      expect(manager.getFormatSet("TestSet2")).toBeUndefined();
    });

    it("should return false when removing non-existent format set", () => {
      const manager = FormatManager.instance!;

      const result = manager.removeFormatSet("NonExistent");

      expect(result).toBe(false);
    });

    it("should clear active format set when removing it", () => {
      const manager = FormatManager.instance!;
      manager.setActiveFormatSet(testFormatSet1);

      manager.removeFormatSet("TestSet1");

      expect(manager.activeFormatSet).toBeUndefined();
      expect(manager.activeFormatSetFormatsProvider).toBeUndefined();
    });
  });

  describe("Active Format Set", () => {
    beforeEach(async () => {
      await FormatManager.initialize({
        formatSets: [testFormatSet1, testFormatSet2],
      });
    });

    it("should set active format set", () => {
      const manager = FormatManager.instance!;
      const onActiveFormatSetChangedSpy = vi.fn();
      manager.onActiveFormatSetChanged.addListener(onActiveFormatSetChangedSpy);

      manager.setActiveFormatSet(testFormatSet1);

      expect(manager.activeFormatSet).toBe(testFormatSet1);
      expect(manager.activeFormatSetFormatsProvider).toBeDefined();
      expect(onActiveFormatSetChangedSpy).toHaveBeenCalledWith({
        previousFormatSet: undefined,
        currentFormatSet: testFormatSet1,
      });
    });

    it("should change active format set", () => {
      const manager = FormatManager.instance!;
      const onActiveFormatSetChangedSpy = vi.fn();

      manager.setActiveFormatSet(testFormatSet1);
      manager.onActiveFormatSetChanged.addListener(onActiveFormatSetChangedSpy);
      manager.setActiveFormatSet(testFormatSet2);

      expect(manager.activeFormatSet).toBe(testFormatSet2);
      expect(onActiveFormatSetChangedSpy).toHaveBeenCalledWith({
        previousFormatSet: testFormatSet1,
        currentFormatSet: testFormatSet2,
      });
    });
  });

  describe("Fallback Formats Provider", () => {
    beforeEach(async () => {
      await FormatManager.initialize({
        formatSets: [testFormatSet1],
      });
    });

    it("should set fallback formats provider", () => {
      const manager = FormatManager.instance!;

      manager.fallbackFormatsProvider = mockFormatsProvider;

      expect(manager.fallbackFormatsProvider).toBe(mockFormatsProvider);
    });

    it("should update active format set provider when fallback changes", () => {
      const manager = FormatManager.instance!;
      manager.setActiveFormatSet(testFormatSet1);
      const originalProvider = manager.activeFormatSetFormatsProvider;

      manager.fallbackFormatsProvider = mockFormatsProvider;

      expect(manager.activeFormatSetFormatsProvider).not.toBe(originalProvider);
      expect(manager.activeFormatSetFormatsProvider!.fallbackProvider).toBe(mockFormatsProvider);
    });
  });

  describe("iModel Lifecycle", () => {
    let mockIModel: any;

    beforeEach(async () => {
      await FormatManager.initialize({
        formatSets: [testFormatSet1],
        setupSchemaFormatSetOnIModelOpen: true, // Enable for testing schema format setup
      });

      mockIModel = {
        schemaContext: {
          getSchema: vi.fn().mockResolvedValue({
            getItems: vi.fn().mockReturnValue([]),
          }),
        },
        createQueryReader: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
      };
    });

    it("should handle iModel open", async () => {
      const manager = FormatManager.instance!;
      manager.setActiveFormatSet(testFormatSet1);

      await manager.onIModelOpen(mockIModel);

      expect((IModelApp as any).formatsProvider).toBe(manager.activeFormatSetFormatsProvider);
    });

    it("should exclude used KindOfQuantities when option is set", async () => {
      const manager = FormatManager.instance!;

      // Mock the private method to verify it's not called
      const addUsedFormatsSpy = vi.spyOn(manager as any, "_addUsedFormatsFromIModel");

      await manager.onIModelOpen(mockIModel, {
        excludeUsedKindOfQuantities: true,
      });

      expect(addUsedFormatsSpy).not.toHaveBeenCalled();
    });

    it("should include used KindOfQuantities by default", async () => {
      const manager = FormatManager.instance!;

      // Mock the private method to verify it's called
      const addUsedFormatsSpy = vi.spyOn(manager as any, "_addUsedFormatsFromIModel").mockResolvedValue(undefined);

      await manager.onIModelOpen(mockIModel);

      expect(addUsedFormatsSpy).toHaveBeenCalled();
    });

    it("should include used KindOfQuantities when explicitly set to false", async () => {
      const manager = FormatManager.instance!;

      // Mock the private method to verify it's called
      const addUsedFormatsSpy = vi.spyOn(manager as any, "_addUsedFormatsFromIModel").mockResolvedValue(undefined);

      await manager.onIModelOpen(mockIModel, {
        excludeUsedKindOfQuantities: false,
      });

      expect(addUsedFormatsSpy).toHaveBeenCalled();
    });

    it("should handle iModel close", async () => {
      const manager = FormatManager.instance!;
      await manager.onIModelOpen(mockIModel);

      await manager.onIModelClose();

      expect(manager.fallbackFormatsProvider).toBeUndefined();
    });
  });

  describe("Cleanup", () => {
    it("should cleanup listeners on dispose", async () => {
      await FormatManager.initialize({
        formatSets: [testFormatSet1],
      });

      const manager = FormatManager.instance!;
      const removeListenerSpy = vi.fn();
      (manager as any)._removeListeners.push(removeListenerSpy);

      manager[Symbol.dispose]();

      expect(removeListenerSpy).toHaveBeenCalled();
    });

    it("should terminate and cleanup", async () => {
      await FormatManager.initialize({
        formatSets: [testFormatSet1],
      });

      expect(FormatManager.instance).toBeDefined();

      FormatManager.terminate();

      expect(FormatManager.instance).toBeUndefined();
    });
  });
});

describe("FormatSetFormatsProvider", () => {
  let testFormatSet: FormatSet;
  let mockFallbackProvider: FormatsProvider;
  let provider: FormatSetFormatsProvider;

  beforeEach(() => {
    testFormatSet = {
      name: "TestSet",
      label: "Test Format Set",
      formats: {
        "test.format1": {
          type: "Decimal",
          precision: 2,
          label: "Test Format 1",
        } as FormatDefinition,
      },
    };

    mockFallbackProvider = {
      getFormat: vi.fn().mockImplementation((name: string) => {
        if (name === "fallback.format") {
          return Promise.resolve({
            type: "Decimal",
            precision: 1,
            label: "Fallback Format",
          } as FormatDefinition);
        }
        return Promise.resolve(undefined);
      }),
    } as unknown as FormatsProvider;

    provider = new FormatSetFormatsProvider(testFormatSet, mockFallbackProvider);
  });

  describe("Format Retrieval", () => {
    it("should get format from format set", async () => {
      const format = await provider.getFormat("test.format1");

      expect(format).toBeDefined();
      expect(format!.precision).toBe(2);
      expect(format!.label).toBe("Test Format 1");
    });

    it("should get format from fallback provider", async () => {
      const format = await provider.getFormat("fallback.format");

      expect(format).toBeDefined();
      expect(format!.precision).toBe(1);
      expect(format!.label).toBe("Fallback Format");
      expect(mockFallbackProvider.getFormat).toHaveBeenCalledWith("fallback.format");
    });

    it("should return undefined for non-existent format", async () => {
      const format = await provider.getFormat("non.existent");

      expect(format).toBeUndefined();
    });

    it("should parse schema item names correctly", async () => {
      // Mock SchemaItem.parseFullName to test name parsing
      const { SchemaItem } = await import("@itwin/ecschema-metadata");
      const parseFullNameSpy = vi.mocked(SchemaItem.parseFullName).mockReturnValue(["test", "format1"]);

      const format = await provider.getFormat("test:format1");

      expect(format).toBeDefined();
      expect(SchemaItem.parseFullName).toHaveBeenCalledWith("test:format1");

      // Restore the original implementation
      parseFullNameSpy.mockRestore();
    });
  });

  describe("Format Modification", () => {
    it("should add format", async () => {
      const onFormatsChangedSpy = vi.fn();
      provider.onFormatsChanged.addListener(onFormatsChangedSpy);

      const newFormat: FormatDefinition = {
        type: "Scientific",
        precision: 3,
        label: "New Format",
      };

      await provider.addFormat("test.newformat", newFormat);

      expect(testFormatSet.formats["test.newformat"]).toBe(newFormat);
      expect(onFormatsChangedSpy).toHaveBeenCalledWith({
        formatsChanged: ["test.newformat"],
      });
    });

    it("should remove format", async () => {
      const onFormatsChangedSpy = vi.fn();
      provider.onFormatsChanged.addListener(onFormatsChangedSpy);

      await provider.removeFormat("test.format1");

      expect(testFormatSet.formats["test.format1"]).toBeUndefined();
      expect(onFormatsChangedSpy).toHaveBeenCalledWith({
        formatsChanged: ["test.format1"],
      });
    });
  });

  describe("Fallback Provider Management", () => {
    it("should clear fallback provider", () => {
      provider.clearFallbackProvider();

      expect(provider.fallbackProvider).toBeUndefined();
    });

    it("should access format set and fallback provider", () => {
      expect(provider.formatSet).toBe(testFormatSet);
      expect(provider.fallbackProvider).toBe(mockFallbackProvider);
    });
  });

  describe("Without Fallback Provider", () => {
    beforeEach(() => {
      provider = new FormatSetFormatsProvider(testFormatSet);
    });

    it("should work without fallback provider", async () => {
      const format = await provider.getFormat("test.format1");
      expect(format).toBeDefined();

      const nonExistentFormat = await provider.getFormat("non.existent");
      expect(nonExistentFormat).toBeUndefined();
    });

    it("should have undefined fallback provider", () => {
      expect(provider.fallbackProvider).toBeUndefined();
    });
  });
});
