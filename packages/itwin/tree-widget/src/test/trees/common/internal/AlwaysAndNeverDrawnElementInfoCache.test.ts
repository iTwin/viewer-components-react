/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { firstValueFrom } from "rxjs";
import { vi } from "vitest";
import {
  AlwaysAndNeverDrawnElementInfoCache,
  SET_CHANGE_DEBOUNCE_TIME,
} from "../../../../tree-widget-react/components/trees/common/internal/caches/AlwaysAndNeverDrawnElementInfoCache.js";
import { createFakeViewport } from "../../Common.js";

import type { Id64String } from "@itwin/core-bentley";
import type { MapEntry } from "../../../../tree-widget-react/components/trees/common/internal/caches/AlwaysAndNeverDrawnElementInfoCache.js";
import type { ChildrenTree } from "../../../../tree-widget-react/components/trees/common/internal/Utils.js";

describe("AlwaysAndNeverDrawnElementInfoCache", () => {
  beforeEach(() => {
    // Use fake timers to reliably advance time in tests
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function runTests(setType: "always" | "never") {
    it(`subscribes to ${setType}Drawn list changes and unsubscribes on dispose`, async () => {
      using vp = createFakeViewport();
      const event = setType === "always" ? vp.onAlwaysDrawnChanged : vp.onNeverDrawnChanged;
      (() => {
        using _ = new AlwaysAndNeverDrawnElementInfoCache({ viewport: vp });
        expect(event.numberOfListeners).toBe(1);
      })();
      expect(event.numberOfListeners).toBe(0);
    });

    it(`does not query when ${setType}Drawn set is empty`, async () => {
      const modelId = "0x1";

      using vp = createFakeViewport({
        [`${setType}Drawn`]: new Set(),
      });

      using info = new AlwaysAndNeverDrawnElementInfoCache({ viewport: vp });
      await vi.advanceTimersByTimeAsync(SET_CHANGE_DEBOUNCE_TIME);
      const result = await firstValueFrom(info.getElementsTree({ setType, modelId }));
      expect(result).toEqual(new Map());
      expect(vp.iModel.createQueryReader).not.toHaveBeenCalled();
    });

    it(`does not query when ${setType}Drawn set is undefined`, async () => {
      const modelId = "0x1";

      using vp = createFakeViewport({
        [`${setType}Drawn`]: undefined,
      });

      using info = new AlwaysAndNeverDrawnElementInfoCache({ viewport: vp });
      await vi.advanceTimersByTimeAsync(SET_CHANGE_DEBOUNCE_TIME);
      const result = await firstValueFrom(info.getElementsTree({ setType, modelId }));
      expect(result).toEqual(new Map());
      expect(vp.iModel.createQueryReader).not.toHaveBeenCalled();
    });

    it(`gets correct elements when ${setType}Drawn set is not empty`, async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const elementId = "0x3";
      const set = new Set([elementId]);
      const queryHandler = vi.fn(() => {
        return [{ rootCategoryId: categoryId, modelId, categoryId, elementsPath: elementId }];
      });

      using vp = createFakeViewport({
        [`${setType}Drawn`]: set,
        queryHandler,
      });

      using info = new AlwaysAndNeverDrawnElementInfoCache({ viewport: vp });
      await vi.advanceTimersByTimeAsync(SET_CHANGE_DEBOUNCE_TIME);
      const result = await firstValueFrom(info.getElementsTree({ setType, modelId }));
      const expectedResult: ChildrenTree<MapEntry> = new Map();
      expectedResult.set(categoryId, { children: new Map([[elementId, { categoryId, isInAlwaysOrNeverDrawnSet: true }]]), isInAlwaysOrNeverDrawnSet: false });
      expect(result).toEqual(expectedResult);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
    });

    it(`does not requery ${setType}Drawn element info when multiple calls are made`, async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const elementId = "0x3";
      const set = new Set([elementId]);
      const queryHandler = vi.fn(() => {
        return [{ rootCategoryId: categoryId, modelId, categoryId, elementsPath: elementId }];
      });
      using vp = createFakeViewport({
        [`${setType}Drawn`]: set,
        queryHandler,
      });

      using info = new AlwaysAndNeverDrawnElementInfoCache({ viewport: vp });
      await vi.advanceTimersByTimeAsync(SET_CHANGE_DEBOUNCE_TIME);
      const result = await firstValueFrom(info.getElementsTree({ setType, modelId }));
      const expectedResult: ChildrenTree<MapEntry> = new Map();
      expectedResult.set(categoryId, { children: new Map([[elementId, { categoryId, isInAlwaysOrNeverDrawnSet: true }]]), isInAlwaysOrNeverDrawnSet: false });
      expect(result).toEqual(expectedResult);

      // second request is not delayed because value is cached
      const result2 = await firstValueFrom(info.getElementsTree({ setType, modelId }));
      expect(result2).toEqual(expectedResult);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
    });

    it(`requeries when ${setType}Drawn set changes`, async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const elementId = "0x3";
      const set = new Set([elementId]);
      const queryHandler = vi.fn(() => {
        return [{ rootCategoryId: categoryId, modelId, categoryId, elementsPath: elementId }];
      });
      using vp = createFakeViewport({
        [`${setType}Drawn`]: set,
        queryHandler,
      });

      using info = new AlwaysAndNeverDrawnElementInfoCache({ viewport: vp });
      await vi.advanceTimersByTimeAsync(SET_CHANGE_DEBOUNCE_TIME);
      const result = await firstValueFrom(info.getElementsTree({ setType, modelId }));
      const expectedResult: ChildrenTree<MapEntry> = new Map();
      expectedResult.set(categoryId, { children: new Map([[elementId, { categoryId, isInAlwaysOrNeverDrawnSet: true }]]), isInAlwaysOrNeverDrawnSet: false });
      expect(result).toEqual(expectedResult);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();

      const setterFunction = (ids: Set<Id64String>) => {
        if (setType === "always") {
          vp.setAlwaysDrawn({ elementIds: ids });
          return;
        }
        vp.setNeverDrawn({ elementIds: ids });
      };
      setterFunction(new Set(["0x4"]));

      const resultPromise2 = firstValueFrom(info.getElementsTree({ setType, modelId }));
      await vi.advanceTimersByTimeAsync(SET_CHANGE_DEBOUNCE_TIME);
      const result2 = await resultPromise2;
      expect(result2).toEqual(expectedResult);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledTimes(2);
    });

    it(`requeries when ${setType}Drawn set changes while getElements is in progress`, async () => {
      const elementId = "0x1";
      const set = new Set([elementId]);
      using vp = createFakeViewport({
        [`${setType}Drawn`]: set,
      });

      using info = new AlwaysAndNeverDrawnElementInfoCache({ viewport: vp });
      await vi.advanceTimersByTimeAsync(SET_CHANGE_DEBOUNCE_TIME);
      await firstValueFrom(info.getElementsTree({ setType, modelId: "0x2" }));
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
      const resultPromise2 = firstValueFrom(info.getElementsTree({ setType, modelId: "0x2" }));
      const setterFunction = (ids: Set<Id64String>) => {
        if (setType === "always") {
          vp.setAlwaysDrawn({ elementIds: ids });
          return;
        }
        vp.setNeverDrawn({ elementIds: ids });
      };
      setterFunction(new Set(["0x2"]));
      await vi.advanceTimersByTimeAsync(SET_CHANGE_DEBOUNCE_TIME);
      await resultPromise2;
      expect(vp.iModel.createQueryReader).toHaveBeenCalledTimes(2);
    });

    it(`does not requery when suppress is activated and deactivated for ${setType}Drawn`, async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const elementId = "0x3";
      const set = new Set([elementId]);
      const queryHandler = vi.fn(() => {
        return [{ rootCategoryId: categoryId, modelId, categoryId, elementsPath: elementId }];
      });

      using vp = createFakeViewport({
        [`${setType}Drawn`]: set,
        queryHandler,
      });

      using info = new AlwaysAndNeverDrawnElementInfoCache({ viewport: vp });
      await vi.advanceTimersByTimeAsync(SET_CHANGE_DEBOUNCE_TIME);
      const result1 = await firstValueFrom(info.getElementsTree({ setType, modelId }));
      const expectedResult: ChildrenTree<MapEntry> = new Map();
      expectedResult.set(categoryId, { children: new Map([[elementId, { categoryId, isInAlwaysOrNeverDrawnSet: true }]]), isInAlwaysOrNeverDrawnSet: false });
      expect(result1).toEqual(expectedResult);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
      info.suppressChangeEvents();
      info.resumeChangeEvents();
      const result2 = await firstValueFrom(info.getElementsTree({ setType, modelId }));
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
      expect(result2).toEqual(expectedResult);
    });

    it(`does not requery while suppress is active and ${setType}Drawn changes`, async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const elementId = "0x3";
      const set = new Set([elementId]);
      const queryHandler = vi.fn(() => {
        return [{ rootCategoryId: categoryId, modelId, categoryId, elementsPath: elementId }];
      });

      using vp = createFakeViewport({
        [`${setType}Drawn`]: set,
        queryHandler,
      });
      using info = new AlwaysAndNeverDrawnElementInfoCache({ viewport: vp });
      await vi.advanceTimersByTimeAsync(SET_CHANGE_DEBOUNCE_TIME);
      const result1 = await firstValueFrom(info.getElementsTree({ setType, modelId }));
      const expectedResult: ChildrenTree<MapEntry> = new Map();
      expectedResult.set(categoryId, { children: new Map([[elementId, { categoryId, isInAlwaysOrNeverDrawnSet: true }]]), isInAlwaysOrNeverDrawnSet: false });
      expect(result1).toEqual(expectedResult);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
      info.suppressChangeEvents();
      const setterFunction = (ids: Set<Id64String>) => {
        if (setType === "always") {
          vp.setAlwaysDrawn({ elementIds: ids });
          return;
        }
        vp.setNeverDrawn({ elementIds: ids });
      };
      setterFunction(new Set(["0x4"]));
      await vi.advanceTimersByTimeAsync(SET_CHANGE_DEBOUNCE_TIME);
      await firstValueFrom(info.getElementsTree({ setType, modelId }));
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
      expect(result1).toEqual(expectedResult);
      info.resumeChangeEvents();

      await vi.advanceTimersByTimeAsync(SET_CHANGE_DEBOUNCE_TIME);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledTimes(2);
    });

    it(`requeries when suppression is removed and ${setType}Drawn changes`, async () => {
      const elementId = "0x1";
      const set = new Set([elementId]);
      using vp = createFakeViewport({
        [`${setType}Drawn`]: set,
      });
      using info = new AlwaysAndNeverDrawnElementInfoCache({ viewport: vp });
      await vi.advanceTimersByTimeAsync(SET_CHANGE_DEBOUNCE_TIME);
      await firstValueFrom(info.getElementsTree({ setType, modelId: "0x2" }));
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
      info.suppressChangeEvents();
      const setterFunction = (ids: Set<Id64String>) => {
        if (setType === "always") {
          vp.setAlwaysDrawn({ elementIds: ids });
          return;
        }
        vp.setNeverDrawn({ elementIds: ids });
      };
      setterFunction(new Set(["0x2"]));
      info.resumeChangeEvents();
      const resultPromise2 = firstValueFrom(info.getElementsTree({ setType, modelId: "0x2" }));
      await vi.advanceTimersByTimeAsync(SET_CHANGE_DEBOUNCE_TIME);
      await resultPromise2;
      expect(vp.iModel.createQueryReader).toHaveBeenCalledTimes(2);
    });

    it(`returns empty set when model has no ${setType}Drawn elements`, async () => {
      const modelId = "0x1";
      const queryHandler = vi.fn(() => {
        return [{ rootCategoryId: "0x40", categoryId: "0x40", modelId: "0x50", elementsPath: "0x30" }];
      });
      using viewport = createFakeViewport({
        [`${setType}Drawn`]: new Set(["0x30"]),
        queryHandler,
      });
      using info = new AlwaysAndNeverDrawnElementInfoCache({ viewport });
      await vi.advanceTimersByTimeAsync(SET_CHANGE_DEBOUNCE_TIME);
      const result = await firstValueFrom(info.getElementsTree({ setType, modelId }));
      expect(result).toEqual(new Map());
    });

    it(`retrieves and caches ${setType}Drawn elements by category`, async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const elementId = "0x3";
      const category2Id = "0x4";
      const element2Id = "0x5";
      const queryHandler = vi.fn(() => {
        return [
          { rootCategoryId: categoryId, modelId, categoryId, elementsPath: elementId },
          { rootCategoryId: category2Id, modelId, categoryId: category2Id, elementsPath: element2Id },
        ];
      });
      using viewport = createFakeViewport({
        [`${setType}Drawn`]: new Set([elementId]),
        queryHandler,
      });
      using info = new AlwaysAndNeverDrawnElementInfoCache({ viewport });
      await vi.advanceTimersByTimeAsync(SET_CHANGE_DEBOUNCE_TIME);
      const result = await firstValueFrom(info.getElementsTree({ setType, modelId, categoryIds: categoryId }));
      const expectedResult: ChildrenTree<MapEntry> = new Map();
      expectedResult.set(elementId, { categoryId, isInAlwaysOrNeverDrawnSet: true });
      expect(result).toEqual(expectedResult);
    });

    it(`retrieves and caches ${setType}Drawn elements by parent element`, async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const elementId = "0x3";
      const childElementId = "0x4";
      const queryHandler = vi.fn(() => {
        return [{ rootCategoryId: categoryId, modelId, categoryId, elementsPath: `${elementId};${childElementId}` }];
      });
      using viewport = createFakeViewport({
        [`${setType}Drawn`]: new Set([elementId, childElementId]),
        queryHandler,
      });
      using info = new AlwaysAndNeverDrawnElementInfoCache({ viewport });
      await vi.advanceTimersByTimeAsync(SET_CHANGE_DEBOUNCE_TIME);
      const result = await firstValueFrom(info.getElementsTree({ setType, modelId, categoryIds: categoryId, parentElementIdsPath: [elementId] }));
      const expectedResult: ChildrenTree<MapEntry> = new Map();
      expectedResult.set(childElementId, { categoryId, isInAlwaysOrNeverDrawnSet: true });
      expect(result).toEqual(expectedResult);
    });

    it(`returns empty set when category has no ${setType}Drawn elements`, async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const elementId = "0x3";
      const queryHandler = vi.fn(() => {
        return [{ rootCategoryId: "0x15", categoryId: "0x15", modelId, elementsPath: elementId }];
      });
      using viewport = createFakeViewport({
        [`${setType}Drawn`]: new Set([elementId]),
        queryHandler,
      });
      using info = new AlwaysAndNeverDrawnElementInfoCache({ viewport });
      await vi.advanceTimersByTimeAsync(SET_CHANGE_DEBOUNCE_TIME);
      const result = await firstValueFrom(info.getElementsTree({ setType, modelId, categoryIds: categoryId }));
      expect(result).toEqual(new Map());
    });
  }

  describe("always drawn", () => {
    runTests("always");
  });

  describe("never drawn", () => {
    runTests("never");
  });
});
