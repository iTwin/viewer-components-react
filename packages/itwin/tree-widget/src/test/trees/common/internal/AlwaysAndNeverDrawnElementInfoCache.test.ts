/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { firstValueFrom } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ALWAYS_NEVER_BUFFER_THRESHOLD,
  AlwaysAndNeverDrawnElementInfoCache,
  SET_CHANGE_DEBOUNCE_TIME,
} from "../../../../tree-widget-react/components/trees/common/internal/caches/AlwaysAndNeverDrawnElementInfoCache.js";
import { createResolvablePromise } from "../../../TestUtils.js";
import { createFakeViewport } from "../../Common.js";

import type { Id64String } from "@itwin/core-bentley";
import type { TreeWidgetViewport } from "../../../../tree-widget-react.js";

describe("AlwaysAndNeverDrawnElementInfoCache", () => {
  beforeEach(() => {
    // Use fake timers to reliably advance time in tests
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function runTests(setType: "always" | "never", setterFunction: (ids: Set<Id64String>, vp: TreeWidgetViewport) => void) {
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
      const result = await firstValueFrom(info.getAlwaysOrNeverDrawnElements({ setType, modelId, elementCategoryPath: [] }));
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
      const result = await firstValueFrom(info.getAlwaysOrNeverDrawnElements({ setType, modelId, elementCategoryPath: [] }));
      expect(result).toEqual(new Map());
      expect(vp.iModel.createQueryReader).not.toHaveBeenCalled();
    });

    it(`gets correct elements when ${setType}Drawn set is not empty`, async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const elementId = "0x3";
      const set = new Set([elementId]);
      const queryHandler = vi.fn(() => {
        return [{ categoryElementPath: `${categoryId};${elementId}`, modelId }];
      });

      using vp = createFakeViewport({
        [`${setType}Drawn`]: set,
        queryHandler,
      });

      using info = new AlwaysAndNeverDrawnElementInfoCache({ viewport: vp });
      await vi.advanceTimersByTimeAsync(SET_CHANGE_DEBOUNCE_TIME);
      const result = await firstValueFrom(info.getAlwaysOrNeverDrawnElements({ setType, modelId, elementCategoryPath: [] }));
      const expectedResult = new Map([[categoryId, [elementId]]]);
      expect(result).toEqual(expectedResult);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
    });

    it(`does not requery ${setType}Drawn element info when multiple calls are made`, async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const elementId = "0x3";
      const set = new Set([elementId]);
      const queryHandler = vi.fn(() => {
        return [{ categoryElementPath: `${categoryId};${elementId}`, modelId }];
      });
      using vp = createFakeViewport({
        [`${setType}Drawn`]: set,
        queryHandler,
      });

      using info = new AlwaysAndNeverDrawnElementInfoCache({ viewport: vp });
      await vi.advanceTimersByTimeAsync(SET_CHANGE_DEBOUNCE_TIME);
      const result = await firstValueFrom(info.getAlwaysOrNeverDrawnElements({ setType, modelId, elementCategoryPath: [] }));
      const expectedResult = new Map([[categoryId, [elementId]]]);
      expect(result).toEqual(expectedResult);

      // second request is not delayed because value is cached
      const result2 = await firstValueFrom(info.getAlwaysOrNeverDrawnElements({ setType, modelId, elementCategoryPath: [] }));
      expect(result2).toEqual(expectedResult);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
    });

    it(`requeries when ${setType}Drawn set changes`, async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const elementId = "0x3";
      const set = new Set([elementId]);
      const queryHandler = vi.fn(() => {
        return [{ categoryElementPath: `${categoryId};${elementId}`, modelId }];
      });
      using vp = createFakeViewport({
        [`${setType}Drawn`]: set,
        queryHandler,
      });

      using info = new AlwaysAndNeverDrawnElementInfoCache({ viewport: vp });
      await vi.advanceTimersByTimeAsync(SET_CHANGE_DEBOUNCE_TIME);
      const result = await firstValueFrom(info.getAlwaysOrNeverDrawnElements({ setType, modelId, elementCategoryPath: [] }));
      const expectedResult = new Map([[categoryId, [elementId]]]);
      expect(result).toEqual(expectedResult);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();

      setterFunction(new Set(["0x4"]), vp);

      const resultPromise2 = firstValueFrom(info.getAlwaysOrNeverDrawnElements({ setType, modelId, elementCategoryPath: [] }));
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
      await firstValueFrom(info.getAlwaysOrNeverDrawnElements({ setType, modelId: "0x2", elementCategoryPath: [] }));
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
      const resultPromise2 = firstValueFrom(info.getAlwaysOrNeverDrawnElements({ setType, modelId: "0x2", elementCategoryPath: [] }));
      setterFunction(new Set(["0x2"]), vp);
      await vi.advanceTimersByTimeAsync(SET_CHANGE_DEBOUNCE_TIME);
      await resultPromise2;
      expect(vp.iModel.createQueryReader).toHaveBeenCalledTimes(2);
    });

    it(`finishes pending request when suppression is activated for ${setType}Drawn after event fires but before debounce time has passed`, async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const elementId = "0x3";
      const set = new Set([elementId]);
      const queryHandler = vi
        .fn()
        .mockReturnValueOnce([{ categoryElementPath: `${categoryId};${elementId}`, modelId }])
        .mockReturnValueOnce([{ categoryElementPath: `${categoryId};0x4`, modelId }]);

      using vp = createFakeViewport({
        [`${setType}Drawn`]: set,
        queryHandler,
      });

      using info = new AlwaysAndNeverDrawnElementInfoCache({ viewport: vp });
      await vi.advanceTimersByTimeAsync(SET_CHANGE_DEBOUNCE_TIME);
      const result1 = await firstValueFrom(info.getAlwaysOrNeverDrawnElements({ setType, modelId, elementCategoryPath: [] }));
      expect(result1).toEqual(new Map([[categoryId, [elementId]]]));
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();

      setterFunction(new Set(["0x4"]), vp);

      info.suppressChangeEvents();
      const promiseResult2 = firstValueFrom(info.getAlwaysOrNeverDrawnElements({ setType, modelId, elementCategoryPath: [] }));
      await vi.advanceTimersByTimeAsync(SET_CHANGE_DEBOUNCE_TIME);
      const result2 = await promiseResult2;
      const expectedResult2 = new Map([[categoryId, ["0x4"]]]);
      info.resumeChangeEvents();
      const result3 = await firstValueFrom(info.getAlwaysOrNeverDrawnElements({ setType, modelId, elementCategoryPath: [] }));
      expect(result2).toEqual(expectedResult2);
      expect(result3).toEqual(expectedResult2);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledTimes(2);
    });

    it(`does not requery when suppress is activated and deactivated for ${setType}Drawn`, async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const elementId = "0x3";
      const set = new Set([elementId]);
      const queryHandler = vi.fn(() => {
        return [{ categoryElementPath: `${categoryId};${elementId}`, modelId }];
      });

      using vp = createFakeViewport({
        [`${setType}Drawn`]: set,
        queryHandler,
      });

      using info = new AlwaysAndNeverDrawnElementInfoCache({ viewport: vp });
      await vi.advanceTimersByTimeAsync(SET_CHANGE_DEBOUNCE_TIME);
      const result1 = await firstValueFrom(info.getAlwaysOrNeverDrawnElements({ setType, modelId, elementCategoryPath: [] }));
      const expectedResult = new Map([[categoryId, [elementId]]]);
      expect(result1).toEqual(expectedResult);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
      info.suppressChangeEvents();
      info.resumeChangeEvents();
      const result2 = await firstValueFrom(info.getAlwaysOrNeverDrawnElements({ setType, modelId, elementCategoryPath: [] }));
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
      expect(result2).toEqual(expectedResult);
    });

    it(`does not requery while suppress is active and ${setType}Drawn changes`, async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const elementId = "0x3";
      const set = new Set([elementId]);
      const queryHandler = vi.fn(() => {
        return [{ categoryElementPath: `${categoryId};${elementId}`, modelId }];
      });

      using vp = createFakeViewport({
        [`${setType}Drawn`]: set,
        queryHandler,
      });
      using info = new AlwaysAndNeverDrawnElementInfoCache({ viewport: vp });
      await vi.advanceTimersByTimeAsync(SET_CHANGE_DEBOUNCE_TIME);
      const result1 = await firstValueFrom(info.getAlwaysOrNeverDrawnElements({ setType, modelId, elementCategoryPath: [] }));
      const expectedResult = new Map([[categoryId, [elementId]]]);
      expect(result1).toEqual(expectedResult);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
      info.suppressChangeEvents();

      setterFunction(new Set(["0x4"]), vp);
      await vi.advanceTimersByTimeAsync(SET_CHANGE_DEBOUNCE_TIME);
      await firstValueFrom(info.getAlwaysOrNeverDrawnElements({ setType, modelId, elementCategoryPath: [] }));
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
      expect(result1).toEqual(expectedResult);
      info.resumeChangeEvents();

      await vi.advanceTimersByTimeAsync(SET_CHANGE_DEBOUNCE_TIME);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledTimes(2);
    });

    it(`executes number of queries based on buffer threshold for ${setType}Drawn`, async () => {
      // For this test no need to check if debounce time is working
      vi.useRealTimers();

      const modelId = "0x1";
      // Always drawn cache makes multiple queries if number of elements in always/never drawn set is above a threshold,
      const set = new Set(
        Array(ALWAYS_NEVER_BUFFER_THRESHOLD + 1)
          .fill(0)
          .map((_, i) => `0x${i}`),
      );

      using vp = createFakeViewport({
        [`${setType}Drawn`]: set,
      });
      using info = new AlwaysAndNeverDrawnElementInfoCache({ viewport: vp });
      await firstValueFrom(info.getAlwaysOrNeverDrawnElements({ setType, modelId, elementCategoryPath: [] }));
      // First time the set is just above the threshold, so there should be 2 queries
      expect(vp.iModel.createQueryReader).toHaveBeenCalledTimes(2);
      const newSet = new Set(
        Array(ALWAYS_NEVER_BUFFER_THRESHOLD * 2 + 1)
          .fill(0)
          .map((_, i) => `0x${i}`),
      );
      setterFunction(newSet, vp);
      // Second set contains more than twice the threshold, so there should be 3 new queries
      await firstValueFrom(info.getAlwaysOrNeverDrawnElements({ setType, modelId, elementCategoryPath: [] }));
      expect(vp.iModel.createQueryReader).toHaveBeenCalledTimes(5); // 2 previous + 3 new
    });

    it(`cancels scheduled queries when ${setType}Drawn changes without suppression`, async () => {
      // For this test no need to check if debounce time is working
      vi.useRealTimers();

      const modelId = "0x1";
      // Set contains > 2x the threshold to ensure 3 queries are scheduled
      const set = new Set(
        Array(ALWAYS_NEVER_BUFFER_THRESHOLD * 2 + 1)
          .fill(0)
          .map((_, i) => `0x${i}`),
      );

      const queryStartedPromise = createResolvablePromise<void>();
      const queryPausePromise = createResolvablePromise<void>();
      using vp = createFakeViewport({
        [`${setType}Drawn`]: set,
        queryHandler: vi
          .fn()
          .mockImplementationOnce(async () => {
            queryStartedPromise.resolve();
            await queryPausePromise.promise;
            return [{ categoryElementPath: "0x2;0x3", modelId: "0x1" }];
          })
          .mockImplementation(() => {
            return [{ categoryElementPath: "0x5;0x4", modelId: "0x1" }];
          }),
      });

      using info = new AlwaysAndNeverDrawnElementInfoCache({ viewport: vp });
      const firstPromise = firstValueFrom(info.getAlwaysOrNeverDrawnElements({ setType, modelId, elementCategoryPath: [] }));
      await queryStartedPromise.promise;
      // Before making the changes make sure that the first query has started,
      // Since cache is executing two queries at the same time, 2 queries should have been started by now
      // In total 3 queries should be executed to process the initial set
      // Since first query is paused, expect that the third one is not called
      expect(vp.iModel.createQueryReader).toHaveBeenCalledTimes(2);

      const newSet = new Set(
        Array(ALWAYS_NEVER_BUFFER_THRESHOLD * 2 + 1)
          .fill(0)
          .map((_, i) => `0x${i}`),
      );

      setterFunction(newSet, vp);
      queryPausePromise.resolve();
      // After change, set still contains > 2x the threshold, so there should be 3 new queries executed.
      const firstResult = await firstPromise;
      expect(vp.iModel.createQueryReader).toHaveBeenCalledTimes(5); // 2 on the first run, 3 after the change

      // Second request should not make any new requests
      const secondResult = await firstValueFrom(info.getAlwaysOrNeverDrawnElements({ setType, modelId, elementCategoryPath: [] }));
      const expectedResult = new Map([["0x5", ["0x4"]]]);
      expect(secondResult).toEqual(expectedResult);
      expect(firstResult).toEqual(expectedResult);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledTimes(5);
    });

    it(`returns latest values when suppress is not active and ${setType}Drawn changes during query execution`, async () => {
      // For this test no need to check if debounce time is working
      vi.useRealTimers();

      const modelId = "0x1";
      // Should make 3 queries for the initial set
      const set = new Set(
        Array(ALWAYS_NEVER_BUFFER_THRESHOLD * 2 + 1)
          .fill(0)
          .map((_, i) => `0x${i}`),
      );

      const queryStartedPromise = createResolvablePromise<void>();
      const queryPausePromise = createResolvablePromise<void>();
      using vp = createFakeViewport({
        [`${setType}Drawn`]: set,
        queryHandler: vi
          .fn()
          .mockImplementationOnce(async () => {
            queryStartedPromise.resolve();
            await queryPausePromise.promise;
            return [{ categoryElementPath: "0x2;0x3", modelId: "0x1" }];
          })
          .mockImplementation((...args) => {
            const restartToken = args[2].restartToken as string;
            if (restartToken.endsWith("-0")) {
              return [{ categoryElementPath: "0x2;0x4", modelId: "0x1" }];
            }
            if (restartToken.endsWith("-1")) {
              return [{ categoryElementPath: "0x2;0x5", modelId: "0x1" }];
            }
            return [{ categoryElementPath: "0x2;0x6", modelId: "0x1" }];
          }),
      });

      using info = new AlwaysAndNeverDrawnElementInfoCache({ viewport: vp });
      const resultPromise = firstValueFrom(info.getAlwaysOrNeverDrawnElements({ setType, modelId, elementCategoryPath: [] }));
      await queryStartedPromise.promise;
      // At first there should have been 2 queries started,
      // Since the first query is paused, the 3rd query should not have been called
      expect(vp.iModel.createQueryReader).toHaveBeenCalledTimes(2);

      const newSet = new Set(
        Array(ALWAYS_NEVER_BUFFER_THRESHOLD + 1)
          .fill(0)
          .map((_, i) => `0x${i}`),
      );
      setterFunction(newSet, vp);
      queryPausePromise.resolve();
      const result = await resultPromise;
      // Set has changed during execution, since the new set contains more than the threshold,
      // There should be 2 new queries executed
      expect(vp.iModel.createQueryReader).toHaveBeenCalledTimes(4); // 2 on first run, 2 after the change
      expect(result).toEqual(new Map([["0x2", ["0x4", "0x5"]]]));
    });

    it(`returns values that were at the time of the call when suppress is active and ${setType}Drawn changes during query execution`, async () => {
      // For this test no need to check if debounce time is working
      vi.useRealTimers();

      const modelId = "0x1";
      // There should be 3 queries for the initial set
      const set = new Set(
        Array(ALWAYS_NEVER_BUFFER_THRESHOLD * 2 + 1)
          .fill(0)
          .map((_, i) => `0x${i}`),
      );

      const queryStartedPromise = createResolvablePromise<void>();
      const queryPausePromise = createResolvablePromise<void>();
      using vp = createFakeViewport({
        [`${setType}Drawn`]: set,
        queryHandler: vi
          .fn()
          .mockImplementationOnce(async () => {
            queryStartedPromise.resolve();
            await queryPausePromise.promise;
            return [{ categoryElementPath: "0x2;0x3", modelId: "0x1" }];
          })
          .mockImplementation((...args) => {
            const restartToken = args[2].restartToken as string;
            if (restartToken.endsWith("-0")) {
              return [{ categoryElementPath: "0x2;0x4", modelId: "0x1" }];
            }
            if (restartToken.endsWith("-1")) {
              return [{ categoryElementPath: "0x2;0x5", modelId: "0x1" }];
            }
            return [{ categoryElementPath: "0x2;0x6", modelId: "0x1" }];
          }),
      });

      using info = new AlwaysAndNeverDrawnElementInfoCache({ viewport: vp });
      await queryStartedPromise.promise;
      info.suppressChangeEvents();
      // Request is made when suppress is active, so changes to always/never drawn set should not affect the result
      const resultPromise = firstValueFrom(info.getAlwaysOrNeverDrawnElements({ setType, modelId, elementCategoryPath: [] }));
      info.resumeChangeEvents();

      // New set requires 3 queries
      const newSet = new Set(
        Array(ALWAYS_NEVER_BUFFER_THRESHOLD * 3 + 1)
          .fill(0)
          .map((_, i) => `0x${i}`),
      );
      setterFunction(newSet, vp);
      queryPausePromise.resolve();
      const result = await resultPromise;
      // Changed values have not been requested yet. The initial set required 3 queries,
      // results can be checked: 0x3 - first query, 0x5 - second query, 0x6 - third query.
      expect(vp.iModel.createQueryReader).toHaveBeenCalledTimes(3);
      expect(result).toEqual(new Map([["0x2", ["0x5", "0x3", "0x6"]]]));
    });

    it(`requeries when suppression is removed and ${setType}Drawn changes`, async () => {
      const elementId = "0x1";
      const set = new Set([elementId]);
      using vp = createFakeViewport({
        [`${setType}Drawn`]: set,
      });
      using info = new AlwaysAndNeverDrawnElementInfoCache({ viewport: vp });
      await vi.advanceTimersByTimeAsync(SET_CHANGE_DEBOUNCE_TIME);
      await firstValueFrom(info.getAlwaysOrNeverDrawnElements({ setType, modelId: "0x2", elementCategoryPath: [] }));
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
      info.suppressChangeEvents();

      setterFunction(new Set(["0x2"]), vp);
      info.resumeChangeEvents();
      const resultPromise2 = firstValueFrom(info.getAlwaysOrNeverDrawnElements({ setType, modelId: "0x2", elementCategoryPath: [] }));
      await vi.advanceTimersByTimeAsync(SET_CHANGE_DEBOUNCE_TIME);
      await resultPromise2;
      expect(vp.iModel.createQueryReader).toHaveBeenCalledTimes(2);
    });

    it(`returns empty set when model has no ${setType}Drawn elements`, async () => {
      const modelId = "0x1";
      const queryHandler = vi.fn(() => {
        return [{ categoryElementPath: "0x40;0x30", modelId: "0x50" }];
      });
      using viewport = createFakeViewport({
        [`${setType}Drawn`]: new Set(["0x30"]),
        queryHandler,
      });
      using info = new AlwaysAndNeverDrawnElementInfoCache({ viewport });
      await vi.advanceTimersByTimeAsync(SET_CHANGE_DEBOUNCE_TIME);
      const result = await firstValueFrom(info.getAlwaysOrNeverDrawnElements({ setType, modelId, elementCategoryPath: [] }));
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
          { categoryElementPath: `${categoryId};${elementId}`, modelId },
          { categoryElementPath: `${category2Id};${element2Id}`, modelId },
        ];
      });
      using viewport = createFakeViewport({
        [`${setType}Drawn`]: new Set([elementId]),
        queryHandler,
      });
      using info = new AlwaysAndNeverDrawnElementInfoCache({ viewport });
      await vi.advanceTimersByTimeAsync(SET_CHANGE_DEBOUNCE_TIME);
      const result = await firstValueFrom(info.getAlwaysOrNeverDrawnElements({ setType, modelId, elementCategoryPath: [{ categoryIds: categoryId }] }));
      expect(result).toEqual(new Map([[categoryId, [elementId]]]));
    });

    it(`retrieves and caches ${setType}Drawn elements by parent element`, async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const elementId = "0x3";
      const childElementId = "0x4";
      const queryHandler = vi.fn(() => {
        return [{ categoryElementPath: `${categoryId};${elementId};${categoryId};${childElementId}`, modelId }];
      });
      using viewport = createFakeViewport({
        [`${setType}Drawn`]: new Set([elementId, childElementId]),
        queryHandler,
      });
      using info = new AlwaysAndNeverDrawnElementInfoCache({ viewport });
      await vi.advanceTimersByTimeAsync(SET_CHANGE_DEBOUNCE_TIME);
      const result = await firstValueFrom(
        info.getAlwaysOrNeverDrawnElements({
          setType,
          modelId,
          elementCategoryPath: [{ categoryIds: categoryId, elementIds: elementId }, { categoryIds: categoryId }],
        }),
      );
      expect(result).toEqual(new Map([[categoryId, [childElementId]]]));
    });

    it(`returns empty set when category has no ${setType}Drawn elements`, async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const elementId = "0x3";
      const queryHandler = vi.fn(() => {
        return [{ categoryElementPath: `0x15;${elementId}`, modelId }];
      });
      using viewport = createFakeViewport({
        [`${setType}Drawn`]: new Set([elementId]),
        queryHandler,
      });
      using info = new AlwaysAndNeverDrawnElementInfoCache({ viewport });
      await vi.advanceTimersByTimeAsync(SET_CHANGE_DEBOUNCE_TIME);
      const result = await firstValueFrom(info.getAlwaysOrNeverDrawnElements({ setType, modelId, elementCategoryPath: [{ categoryIds: categoryId }] }));
      expect(result).toEqual(new Map());
    });
  }

  describe("always drawn", () => {
    const setterFunction = (ids: Set<Id64String>, vp: TreeWidgetViewport) => {
      vp.setAlwaysDrawn({ elementIds: ids });
    };
    runTests("always", setterFunction);
  });

  describe("never drawn", () => {
    const setterFunction = (ids: Set<Id64String>, vp: TreeWidgetViewport) => {
      vp.setNeverDrawn({ elementIds: ids });
    };
    runTests("never", setterFunction);
  });
});
