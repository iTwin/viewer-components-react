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
} from "../../../../tree-widget-react/components/trees/common/internal/AlwaysAndNeverDrawnElementInfo.js";
import { createResolvablePromise } from "../../../TestUtils.js";
import { createFakeSinonViewport } from "../../Common.js";

import type { Id64Set, Id64String } from "@itwin/core-bentley";

describe("AlwaysAndNeverDrawnElementInfo", () => {
  beforeEach(() => {
    // without this option tests sometimes fail with strange errors
    sinon.useFakeTimers({ shouldClearNativeTimers: true });
  });

  afterEach(() => {
    sinon.clock.restore();
  });

  const queryRegex = /ElementInfo/;

  it("queries both always and never drawn element info if sets are not empty", async () => {
    const queryHandler = sinon.fake(() => {
      return [];
    });
    const vp = createFakeSinonViewport({
      alwaysDrawn: new Set(["1"]),
      neverDrawn: new Set(["2"]),
      queryHandler,
    });
    using _ = new AlwaysAndNeverDrawnElementInfo(vp);
    await sinon.clock.tickAsync(SET_CHANGE_DEBOUNCE_TIME);
    expect(queryHandler).to.be.calledTwice;
  });

  function runTests(setType: "always" | "never") {
    it(`subscribes to ${setType} drawn list changes and unsubscribes on dispose`, async () => {
      const vp = createFakeSinonViewport();
      const event = setType === "always" ? vp.onAlwaysDrawnChanged : vp.onNeverDrawnChanged;
      (() => {
        using _ = new AlwaysAndNeverDrawnElementInfo(vp);
        expect(event.numberOfListeners).to.eq(1);
      })();
      expect(event.numberOfListeners).to.eq(0);
    });

    it(`immediately queries ${setType} drawn element info if set is not empty`, async () => {
      const elementId = "0x1";
      const set = new Set([elementId]);
      const vp = createFakeSinonViewport({
        [`${setType}Drawn`]: set,
      });
      using _ = new AlwaysAndNeverDrawnElementInfo(vp);
      await sinon.clock.tickAsync(SET_CHANGE_DEBOUNCE_TIME);
      expect(vp.iModel.createQueryReader).to.be.calledOnceWith(sinon.match(queryRegex));
    });

    it(`retrieves and caches ${setType} drawn elements by model`, async () => {
      const modelId = "0x1";
      const categoryIds = ["0x2", "0x3"];
      const categoryElements = new Map([
        [categoryIds[0], ["0x10", "0x20"]],
        [categoryIds[1], ["0x30", "0x40"]],
      ]);
      const elements = [...categoryElements.values()].flat();
      const queryHandler = sinon.fake(() => {
        return [...categoryElements].flatMap(([categoryId, elementIds]) => elementIds.map((elementId) => ({ modelId, categoryId, elementId })));
      });
      const viewport = createFakeSinonViewport({
        [`${setType}Drawn`]: new Set(elements),
        queryHandler,
      });
      using alwaysAndNeverDrawnElementInfo = new AlwaysAndNeverDrawnElementInfo(viewport);
      await sinon.clock.tickAsync(SET_CHANGE_DEBOUNCE_TIME);
      for (let i = 0; i < 3; ++i) {
        const obs = alwaysAndNeverDrawnElementInfo.getElements({ setType, modelId });
        await expect(firstValueFrom(obs)).to.eventually.deep.eq(new Set(elements));
        expect(queryHandler).to.be.calledOnce;
      }
    });

    it(`returns empty set when model has no ${setType} drawn elements`, async () => {
      const modelId = "0x1";
      const queryHandler = sinon.fake(() => {
        return [{ elementId: "0x30", categoryId: "0x40", modelId: "0x50" }];
      });
      const viewport = createFakeSinonViewport({
        [`${setType}Drawn`]: new Set(["0x30"]),
        queryHandler,
      });
      using alwaysAndNeverDrawnElementInfo = new AlwaysAndNeverDrawnElementInfo(viewport);
      await sinon.clock.tickAsync(SET_CHANGE_DEBOUNCE_TIME);
      for (let i = 0; i < 3; ++i) {
        const obs = alwaysAndNeverDrawnElementInfo.getElements({ setType, modelId });
        await expect(firstValueFrom(obs)).to.eventually.deep.eq(new Set());
        expect(queryHandler).to.be.calledOnce;
      }
    });

    it(`returns empty set when ${setType} drawn set is empty`, async () => {
      const vp = createFakeSinonViewport();
      const modelId = "0x1";
      using alwaysAndNeverDrawnElementInfo = new AlwaysAndNeverDrawnElementInfo(vp);
      await sinon.clock.tickAsync(SET_CHANGE_DEBOUNCE_TIME);
      const obs = alwaysAndNeverDrawnElementInfo.getElements({ setType, modelId });
      await expect(firstValueFrom(obs)).to.eventually.deep.eq(new Set());
      expect(vp.iModel.createQueryReader).not.to.be.called;
    });

    it(`retrieves and caches ${setType} drawn elements by category`, async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const elements = ["0x10", "0x20"];
      const queryHandler = sinon.fake(() => {
        return elements.map((elementId) => ({ elementId, modelId, categoryId }));
      });
      const viewport = createFakeSinonViewport({
        [`${setType}Drawn`]: new Set(elements),
        queryHandler,
      });
      using alwaysAndNeverDrawnElementInfo = new AlwaysAndNeverDrawnElementInfo(viewport);
      await sinon.clock.tickAsync(SET_CHANGE_DEBOUNCE_TIME);
      for (let i = 0; i < 3; ++i) {
        const obs = alwaysAndNeverDrawnElementInfo.getElements({ setType, categoryIds: [categoryId], modelId });
        await expect(firstValueFrom(obs)).to.eventually.deep.eq(new Set(elements));
        expect(queryHandler).to.be.calledOnce;
      }
    });

    it(`updates cache when ${setType} drawn set is changed`, async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const elements = ["0x10", "0x20"];
      const queryHandler = sinon
        .stub<[string], any[]>()
        .onFirstCall()
        .returns([{ elementId: elements[0], modelId, categoryId }])
        .onSecondCall()
        .returns([{ elementId: elements[1], modelId, categoryId }]);
      const viewport = createFakeSinonViewport({ queryHandler });
      using alwaysAndNeverDrawnElementInfo = new AlwaysAndNeverDrawnElementInfo(viewport);
      for (let i = 0; i < 2; ++i) {
        const newSet = new Set([elements[i]]);
        setType === "always" ? viewport.setAlwaysDrawn(newSet) : viewport.setNeverDrawn(newSet);
        await sinon.clock.tickAsync(SET_CHANGE_DEBOUNCE_TIME);
        expect(queryHandler).to.have.callCount(i + 1);
        await expect(firstValueFrom(alwaysAndNeverDrawnElementInfo.getElements({ setType, modelId, categoryIds: [categoryId] }))).to.eventually.deep.eq(newSet);
      }
    });

    it(`doesn't query elements if ${setType} drawn set gets empty`, async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const elements = ["0x10", "0x20"];
      const queryHandler = sinon.fake(() => {
        return elements.map((elementId) => ({ elementId, modelId, categoryId }));
      });
      const viewport = createFakeSinonViewport();
      using alwaysAndNeverDrawnElementInfo = new AlwaysAndNeverDrawnElementInfo(viewport);
      const newSet = new Set<Id64String>();
      setType === "always" ? viewport.setAlwaysDrawn(newSet) : viewport.setNeverDrawn(newSet);
      await sinon.clock.tickAsync(SET_CHANGE_DEBOUNCE_TIME);

      expect(queryHandler).not.to.be.called;
      const obs = alwaysAndNeverDrawnElementInfo.getElements({ setType, modelId, categoryIds: [categoryId] });
      expect((await firstValueFrom(obs))?.size ?? 0).to.eq(0);
    });

    it(`debounces frequent changes to the ${setType} drawn set`, async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const elements = ["0x10", "0x20", "0x30"];
      const queryHandler = sinon.stub<[string], any[]>().returns([{ elementId: elements[2], modelId, categoryId }]);
      const viewport = createFakeSinonViewport({ queryHandler });

      using alwaysAndNeverDrawnElementInfo = new AlwaysAndNeverDrawnElementInfo(viewport);
      expect(queryHandler).not.to.be.called;

      const updateSet = (set: Id64Set) => (setType === "always" ? viewport.setAlwaysDrawn(set) : viewport.setNeverDrawn(set));
      updateSet(new Set<Id64String>(["0x10"]));
      updateSet(new Set<Id64String>(["0x20"]));
      const finalSet = new Set<Id64String>(["0x30"]);
      updateSet(finalSet);
      await sinon.clock.tickAsync(SET_CHANGE_DEBOUNCE_TIME);

      expect(queryHandler).to.be.calledOnce;
      await expect(firstValueFrom(alwaysAndNeverDrawnElementInfo.getElements({ setType, modelId, categoryIds: [categoryId] }))).to.eventually.deep.eq(finalSet);
    });

    it("waits until debounce period is passed and resolves with the newest result", async () => {
      const elements = ["0x20", "0x30"];
      const firstSet = new Set<Id64String>([elements[0]]);
      const secondSet = new Set<Id64String>([elements[1]]);
      const modelId = "0x1";
      const categoryId = "0x2";
      const queryHandler = sinon.stub<[string], any[]>().returns([{ elementId: elements[1], modelId, categoryId }]);
      const viewport = createFakeSinonViewport({ queryHandler });

      using alwaysAndNeverDrawnElementInfo = new AlwaysAndNeverDrawnElementInfo(viewport);
      const updateSet = (set: Id64Set) => (setType === "always" ? viewport.setAlwaysDrawn(set) : viewport.setNeverDrawn(set));

      const resultPromise = firstValueFrom(alwaysAndNeverDrawnElementInfo.getElements({ setType, modelId, categoryIds: [categoryId] }));
      updateSet(firstSet);
      updateSet(secondSet);
      await sinon.clock.tickAsync(SET_CHANGE_DEBOUNCE_TIME);

      await expect(resultPromise).to.eventually.deep.eq(secondSet);
    });

    it(`returns newest result if ${setType} drawn set is changed during the query`, async () => {
      const elements = ["0x20", "0x30"];
      const firstSet = new Set<Id64String>([elements[0]]);
      const secondSet = new Set<Id64String>([elements[1]]);
      const modelId = "0x1";
      const categoryId = "0x2";
      const firstSetInfoPromise = createResolvablePromise<any[]>();
      const secondSetInfoPromise = createResolvablePromise<any[]>();

      const queryHandler = sinon
        .stub<[string], Promise<any[]>>()
        .onFirstCall()
        .returns(firstSetInfoPromise.promise)
        .onSecondCall()
        .returns(secondSetInfoPromise.promise);
      const viewport = createFakeSinonViewport({ queryHandler });

      using alwaysAndNeverDrawnElementInfo = new AlwaysAndNeverDrawnElementInfo(viewport);
      const updateSet = (set: Id64Set) => (setType === "always" ? viewport.setAlwaysDrawn(set) : viewport.setNeverDrawn(set));

      updateSet(firstSet);
      await sinon.clock.tickAsync(SET_CHANGE_DEBOUNCE_TIME);
      const resultPromise = firstValueFrom(alwaysAndNeverDrawnElementInfo.getElements({ setType, modelId, categoryIds: [categoryId] }));

      updateSet(secondSet);
      await sinon.clock.tickAsync(SET_CHANGE_DEBOUNCE_TIME);

      firstSetInfoPromise.resolve([{ elementId: elements[0], categoryId, modelId }]);
      secondSetInfoPromise.resolve([{ elementId: elements[1], categoryId, modelId }]);

      await expect(resultPromise).to.eventually.deep.eq(secondSet);
    });
  }

  describe("always drawn", () => {
    runTests("always");
  });

  describe("never drawn", () => {
    runTests("never");
  });
});
