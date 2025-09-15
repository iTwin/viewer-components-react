/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { firstValueFrom } from "rxjs";
import sinon from "sinon";
import {
  AlwaysAndNeverDrawnElementInfo,
  SET_CHANGE_DEBOUNCE_TIME,
} from "../../../../tree-widget-react/components/trees/models-tree/internal/AlwaysAndNeverDrawnElementInfo.js";
import { createFakeSinonViewport } from "../../Common.js";

describe("AlwaysAndNeverDrawnElementInfo", () => {
  beforeEach(() => {
    // without this option tests sometimes fail with strange errors
    sinon.useFakeTimers({ shouldClearNativeTimers: true });
  });

  afterEach(() => {
    sinon.clock.restore();
  });

  function runTests(setType: "always" | "never") {
    it(`subscribes to ${setType}Drawn list changes and unsubscribes on dispose`, async () => {
      const vp = createFakeSinonViewport();
      const event = setType === "always" ? vp.onAlwaysDrawnChanged : vp.onNeverDrawnChanged;
      (() => {
        using _ = new AlwaysAndNeverDrawnElementInfo(vp);
        expect(event.numberOfListeners).to.eq(1);
      })();
      expect(event.numberOfListeners).to.eq(0);
    });

    it(`does not query when ${setType}Drawn set is empty`, async () => {
      const modelId = "0x1";

      const vp = createFakeSinonViewport({
        [`${setType}Drawn`]: new Set(),
      });
      using info = new AlwaysAndNeverDrawnElementInfo(vp);
      await sinon.clock.tickAsync(SET_CHANGE_DEBOUNCE_TIME);
      const result = await firstValueFrom(info.getElements({ setType, modelId }));
      expect(result).to.deep.eq(new Set());
      expect(vp.iModel.createQueryReader).to.not.be.called;
    });

    it(`does not query when ${setType}Drawn set is undefined`, async () => {
      const modelId = "0x1";

      const vp = createFakeSinonViewport({
        [`${setType}Drawn`]: undefined,
      });
      using info = new AlwaysAndNeverDrawnElementInfo(vp);
      await sinon.clock.tickAsync(SET_CHANGE_DEBOUNCE_TIME);
      const result = await firstValueFrom(info.getElements({ setType, modelId }));
      expect(result).to.deep.eq(new Set());
      expect(vp.iModel.createQueryReader).to.not.be.called;
    });

    it(`gets correct elements when ${setType}Drawn set is not empty`, async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const elementId = "0x3";
      const set = new Set([elementId]);
      const queryHandler = sinon.fake(() => {
        return [{ elementId, modelId, categoryId }];
      });

      const vp = createFakeSinonViewport({
        [`${setType}Drawn`]: set,
        queryHandler,
      });
      using info = new AlwaysAndNeverDrawnElementInfo(vp);
      await sinon.clock.tickAsync(SET_CHANGE_DEBOUNCE_TIME);
      const result = await firstValueFrom(info.getElements({ setType, modelId }));
      expect(result).to.deep.eq(set);
      expect(vp.iModel.createQueryReader).to.be.calledOnce;
    });

    it(`does not requery ${setType}Drawn element info when multiple calls are made`, async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const elementId = "0x3";
      const set = new Set([elementId]);
      const queryHandler = sinon.fake(() => {
        return [{ elementId, modelId, categoryId }];
      });
      const vp = createFakeSinonViewport({
        [`${setType}Drawn`]: set,
        queryHandler,
      });
      using info = new AlwaysAndNeverDrawnElementInfo(vp);
      await sinon.clock.tickAsync(SET_CHANGE_DEBOUNCE_TIME);
      const result = await firstValueFrom(info.getElements({ setType, modelId }));
      expect(result).to.deep.eq(set);

      // second request is not delayed because value is cached
      const result2 = await firstValueFrom(info.getElements({ setType, modelId }));
      expect(result2).to.deep.eq(set);
      expect(vp.iModel.createQueryReader).to.be.calledOnce;
    });

    it(`requeries when ${setType}Drawn set changes`, async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const elementId = "0x3";
      const set = new Set([elementId]);
      const queryHandler = sinon.fake(() => {
        return [{ elementId, modelId, categoryId }];
      });
      const vp = createFakeSinonViewport({
        [`${setType}Drawn`]: set,
        queryHandler,
      });
      using info = new AlwaysAndNeverDrawnElementInfo(vp);
      await sinon.clock.tickAsync(SET_CHANGE_DEBOUNCE_TIME);
      const result = await firstValueFrom(info.getElements({ setType, modelId }));
      expect(result).to.deep.eq(set);
      expect(vp.iModel.createQueryReader).to.be.calledOnce;

      const setterFunction = setType === "always" ? vp.setAlwaysDrawn : vp.setNeverDrawn;
      setterFunction(new Set(["0x4"]));

      const resultPromise2 = firstValueFrom(info.getElements({ setType, modelId }));
      await sinon.clock.tickAsync(SET_CHANGE_DEBOUNCE_TIME);
      const result2 = await resultPromise2;
      expect(result2).to.deep.eq(set);
      expect(vp.iModel.createQueryReader).to.be.calledTwice;
    });

    it(`requeries when ${setType}Drawn set changes while getElements is in progress`, async () => {
      const elementId = "0x1";
      const set = new Set([elementId]);
      const vp = createFakeSinonViewport({
        [`${setType}Drawn`]: set,
      });
      using info = new AlwaysAndNeverDrawnElementInfo(vp);
      await sinon.clock.tickAsync(SET_CHANGE_DEBOUNCE_TIME);
      await firstValueFrom(info.getElements({ setType, modelId: "0x2" }));
      expect(vp.iModel.createQueryReader).to.be.calledOnce;
      const resultPromise2 = firstValueFrom(info.getElements({ setType, modelId: "0x2" }));
      const setterFunction = setType === "always" ? vp.setAlwaysDrawn : vp.setNeverDrawn;
      setterFunction(new Set(["0x2"]));
      await sinon.clock.tickAsync(SET_CHANGE_DEBOUNCE_TIME);
      await resultPromise2;
      expect(vp.iModel.createQueryReader).to.be.calledTwice;
    });

    it(`does not requery when suppress is activated and deactivated for ${setType}Drawn`, async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const elementId = "0x3";
      const set = new Set([elementId]);
      const queryHandler = sinon.fake(() => {
        return [{ elementId, modelId, categoryId }];
      });

      const vp = createFakeSinonViewport({
        [`${setType}Drawn`]: set,
        queryHandler,
      });
      using info = new AlwaysAndNeverDrawnElementInfo(vp);
      await sinon.clock.tickAsync(SET_CHANGE_DEBOUNCE_TIME);
      const result1 = await firstValueFrom(info.getElements({ setType, modelId }));
      expect(result1).to.deep.eq(set);
      expect(vp.iModel.createQueryReader).to.be.calledOnce;
      info.suppressChangeEvents();
      info.resumeChangeEvents();
      const result2 = await firstValueFrom(info.getElements({ setType, modelId }));
      expect(vp.iModel.createQueryReader).to.be.calledOnce;
      expect(result2).to.deep.eq(set);
    });

    it(`does not requery while suppress is active and ${setType}Drawn changes`, async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const elementId = "0x3";
      const set = new Set([elementId]);
      const queryHandler = sinon.fake(() => {
        return [{ elementId, modelId, categoryId }];
      });

      const vp = createFakeSinonViewport({
        [`${setType}Drawn`]: set,
        queryHandler,
      });
      using info = new AlwaysAndNeverDrawnElementInfo(vp);
      await sinon.clock.tickAsync(SET_CHANGE_DEBOUNCE_TIME);
      const result1 = await firstValueFrom(info.getElements({ setType, modelId }));
      expect(result1).to.deep.eq(set);
      expect(vp.iModel.createQueryReader).to.be.calledOnce;
      info.suppressChangeEvents();
      vp.setAlwaysDrawn(new Set(["0x4"]));
      await sinon.clock.tickAsync(SET_CHANGE_DEBOUNCE_TIME);
      await firstValueFrom(info.getElements({ setType, modelId }));
      expect(vp.iModel.createQueryReader).to.be.calledOnce;
      expect(result1).to.deep.eq(set);
      info.resumeChangeEvents();

      await sinon.clock.tickAsync(SET_CHANGE_DEBOUNCE_TIME);
      expect(vp.iModel.createQueryReader).to.be.calledTwice;
    });

    it(`requeries when supression is removed and ${setType}Drawn changes`, async () => {
      const elementId = "0x1";
      const set = new Set([elementId]);
      const vp = createFakeSinonViewport({
        [`${setType}Drawn`]: set,
      });
      using info = new AlwaysAndNeverDrawnElementInfo(vp);
      await sinon.clock.tickAsync(SET_CHANGE_DEBOUNCE_TIME);
      await firstValueFrom(info.getElements({ setType, modelId: "0x2" }));
      expect(vp.iModel.createQueryReader).to.be.calledOnce;
      info.suppressChangeEvents();
      const setterFunction = setType === "always" ? vp.setAlwaysDrawn : vp.setNeverDrawn;
      setterFunction(new Set(["0x2"]));
      info.resumeChangeEvents();
      const resultPromise2 = firstValueFrom(info.getElements({ setType, modelId: "0x2" }));
      await sinon.clock.tickAsync(SET_CHANGE_DEBOUNCE_TIME);
      await resultPromise2;
      expect(vp.iModel.createQueryReader).to.be.calledTwice;
    });

    it(`returns empty set when model has no ${setType}Drawn elements`, async () => {
      const modelId = "0x1";
      const queryHandler = sinon.fake(() => {
        return [{ elementId: "0x30", categoryId: "0x40", modelId: "0x50" }];
      });
      const viewport = createFakeSinonViewport({
        [`${setType}Drawn`]: new Set(["0x30"]),
        queryHandler,
      });
      using info = new AlwaysAndNeverDrawnElementInfo(viewport);
      await sinon.clock.tickAsync(SET_CHANGE_DEBOUNCE_TIME);
      const result = await firstValueFrom(info.getElements({ setType, modelId }));
      expect(result).to.deep.eq(new Set());
    });

    it(`retrieves and caches ${setType}Drawn elements by category`, async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const elementId = "0x3";
      const category2Id = "0x4";
      const element2Id = "0x5";
      const queryHandler = sinon.fake(() => {
        return [
          { elementId, categoryId, modelId },
          { categoryId: category2Id, elementId: element2Id, modelId },
        ];
      });
      const viewport = createFakeSinonViewport({
        [`${setType}Drawn`]: new Set([elementId]),
        queryHandler,
      });
      using info = new AlwaysAndNeverDrawnElementInfo(viewport);
      await sinon.clock.tickAsync(SET_CHANGE_DEBOUNCE_TIME);
      const result = await firstValueFrom(info.getElements({ setType, modelId, categoryIds: categoryId }));
      expect(result).to.deep.eq(new Set([elementId]));
    });

    it(`returns empty set when category has no ${setType}Drawn elements`, async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const elementId = "0x3";
      const queryHandler = sinon.fake(() => {
        return [{ elementId, categoryId: "0x15", modelId }];
      });
      const viewport = createFakeSinonViewport({
        [`${setType}Drawn`]: new Set([elementId]),
        queryHandler,
      });
      using info = new AlwaysAndNeverDrawnElementInfo(viewport);
      await sinon.clock.tickAsync(SET_CHANGE_DEBOUNCE_TIME);
      const result = await firstValueFrom(info.getElements({ setType, modelId, categoryIds: categoryId }));
      expect(result).to.deep.eq(new Set());
    });
  }

  describe("always drawn", () => {
    runTests("always");
  });

  describe("never drawn", () => {
    runTests("never");
  });
});
