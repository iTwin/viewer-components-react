/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { firstValueFrom, of, Subject } from "rxjs";
import sinon from "sinon";
import { using } from "@itwin/core-bentley";
import { AlwaysAndNeverDrawnElementInfo } from "../../../../components/trees/stateless/models-tree/internal/AlwaysAndNeverDrawnElementInfo";
import { createModelsTreeQueryHandler } from "../../../../components/trees/stateless/models-tree/internal/ModelsTreeQueryHandler";
import { createFakeModelsTreeQueryHandler, createFakeSinonViewport } from "../../Common";

import type { Id64Set, Id64String } from "@itwin/core-bentley";
import type { ElementInfo } from "../../../../components/trees/stateless/models-tree/internal/ModelsTreeQueryHandler";
import type { IModelConnection } from "@itwin/core-frontend";

describe("AlwaysAndNeverDrawnElementInfo", () => {
  let fakeTimers: sinon.SinonFakeTimers;
  before(() => {
    fakeTimers = sinon.useFakeTimers();
  });

  after(() => {
    fakeTimers.restore();
  });

  it("queries both always and never drawn element info if sets are not empty", async () => {
    const vp = createFakeSinonViewport({
      alwaysDrawn: new Set(["1"]),
      neverDrawn: new Set(["2"]),
    });
    const queryProvider = createFakeModelsTreeQueryHandler();
    await using(new AlwaysAndNeverDrawnElementInfo(vp, queryProvider), async (_) => {
      await fakeTimers.runAllAsync();
      expect(queryProvider.queryElementInfo).to.be.calledTwice;
    });
  });

  function runTests(setType: "always" | "never") {
    it(`subscribes to ${setType} drawn list changes and unsubscribes on dispose`, async () => {
      const vp = createFakeSinonViewport();
      const event = setType === "always" ? vp.onAlwaysDrawnChanged : vp.onNeverDrawnChanged;
      using(new AlwaysAndNeverDrawnElementInfo(vp, createFakeModelsTreeQueryHandler()), (_) => {
        expect(event.numberOfListeners).to.eq(1);
      });
      expect(event.numberOfListeners).to.eq(0);
    });

    it(`immediately queries ${setType} drawn element info if set is not empty`, async () => {
      const elementId = "0x1";
      const set = new Set([elementId]);
      const vp = createFakeSinonViewport({
        [`${setType}Drawn`]: set,
      });
      const queryProvider = createFakeModelsTreeQueryHandler();
      await using(new AlwaysAndNeverDrawnElementInfo(vp, queryProvider), async (_) => {
        await fakeTimers.runAllAsync();
        expect(queryProvider.queryElementInfo).to.be.calledOnceWith(set);
      });
    });

    it(`retrieves and caches ${setType} drawn elements by model`, async () => {
      const modelId = "0x1";
      const categoryIds = ["0x2", "0x3"];
      const categoryElements = new Map([
        [categoryIds[0], ["0x10", "0x20"]],
        [categoryIds[1], ["0x30", "0x40"]],
      ]);
      const elements = [...categoryElements.values()].flat();
      const queryHandler = createFakeModelsTreeQueryHandler({
        modelCategories: new Map([[modelId, categoryIds]]),
        categoryElements,
      });
      const viewport = createFakeSinonViewport({
        [`${setType}Drawn`]: new Set(elements),
      });
      await using(new AlwaysAndNeverDrawnElementInfo(viewport, queryHandler), async (info) => {
        await fakeTimers.runAllAsync();
        for (let i = 0; i < 3; ++i) {
          const obs = info.getElements({ setType, modelId });
          await expect(firstValueFrom(obs)).to.eventually.deep.eq(new Set(elements));
          expect(queryHandler.queryElementInfo).to.be.calledOnce;
        }
      });
    });

    it(`returns empty set when model has no ${setType} drawn elements`, async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const elements = ["0x10", "0x20"];
      const queryHandler = createFakeModelsTreeQueryHandler({
        modelCategories: new Map([[modelId, [categoryId]]]),
        categoryElements: new Map([[categoryId, elements]]),
      });
      const viewport = createFakeSinonViewport({
        [`${setType}Drawn`]: new Set(["0x30"]),
      });
      await using(new AlwaysAndNeverDrawnElementInfo(viewport, queryHandler), async (info) => {
        await fakeTimers.runAllAsync();
        for (let i = 0; i < 3; ++i) {
          const obs = info.getElements({ setType, modelId });
          await expect(firstValueFrom(obs)).to.eventually.deep.eq(new Set());
          expect(queryHandler.queryElementInfo).to.be.calledOnce;
        }
      });
    });

    it(`returns empty set when ${setType} drawn set is empty`, async () => {
      const vp = createFakeSinonViewport();
      const modelId = "0x1";
      const queryHandler = createFakeModelsTreeQueryHandler();
      await using(new AlwaysAndNeverDrawnElementInfo(vp, queryHandler), async (info) => {
        await fakeTimers.runAllAsync();
        const obs = info.getElements({ setType, modelId });
        await expect(firstValueFrom(obs)).to.eventually.deep.eq(new Set());
        expect(queryHandler.queryElementInfo).not.to.be.called;
      });
    });

    it(`retrieves and caches ${setType} drawn elements by category`, async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const elements = ["0x10", "0x20"];
      const queryHandler = createFakeModelsTreeQueryHandler({
        modelCategories: new Map([[modelId, [categoryId]]]),
        categoryElements: new Map([[categoryId, elements]]),
      });
      const viewport = createFakeSinonViewport({
        [`${setType}Drawn`]: new Set(elements),
      });
      await using(new AlwaysAndNeverDrawnElementInfo(viewport, queryHandler), async (info) => {
        await fakeTimers.runAllAsync();
        for (let i = 0; i < 3; ++i) {
          const obs = info.getElements({ setType, categoryId, modelId });
          await expect(firstValueFrom(obs)).to.eventually.deep.eq(new Set(elements));
          expect(queryHandler.queryElementInfo).to.be.calledOnce;
        }
      });
    });

    it(`can reset cache of ${setType} drawn elements`, async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const elements = ["0x10", "0x20"];
      const queryHandler = createFakeModelsTreeQueryHandler({
        modelCategories: new Map([[modelId, [categoryId]]]),
        categoryElements: new Map([[categoryId, elements]]),
      });
      const viewport = createFakeSinonViewport({
        [`${setType}Drawn`]: new Set(elements),
      });
      await using(new AlwaysAndNeverDrawnElementInfo(viewport, queryHandler), async (info) => {
        await fakeTimers.runAllAsync();

        let obs = info.getElements({ setType, categoryId, modelId });
        await expect(firstValueFrom(obs)).to.eventually.deep.eq(new Set(elements));
        expect(queryHandler.queryElementInfo).to.be.calledOnce;

        obs = info.getElements({ setType, modelId });
        await expect(firstValueFrom(obs)).to.eventually.deep.eq(new Set(elements));
        expect(queryHandler.queryElementInfo).to.be.calledOnce;

        info.reset();
        await fakeTimers.runAllAsync();

        obs = info.getElements({ setType, categoryId, modelId });
        await expect(firstValueFrom(obs)).to.eventually.deep.eq(new Set(elements));
        expect(queryHandler.queryElementInfo).to.be.calledTwice;

        obs = info.getElements({ setType, modelId });
        await expect(firstValueFrom(obs)).to.eventually.deep.eq(new Set(elements));
        expect(queryHandler.queryElementInfo).to.be.calledTwice;
      });
    });

    it(`updates cache when ${setType} drawn set is changed`, async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const elements = ["0x10", "0x20"];
      const queryHandler = createFakeModelsTreeQueryHandler({
        modelCategories: new Map([[modelId, [categoryId]]]),
        categoryElements: new Map([[categoryId, elements]]),
      });
      const viewport = createFakeSinonViewport();
      await using(new AlwaysAndNeverDrawnElementInfo(viewport, queryHandler), async (info) => {
        for (let i = 0; i < 2; ++i) {
          const newSet = new Set([elements[i]]);
          setType === "always" ? viewport.setAlwaysDrawn(newSet) : viewport.setNeverDrawn(newSet);
          await fakeTimers.runAllAsync();
          expect(queryHandler.queryElementInfo).to.have.callCount(i + 1);
          await expect(firstValueFrom(info.getElements({ setType, modelId, categoryId }))).to.eventually.deep.eq(newSet);
        }
      });
    });

    it(`doesn't query elements if ${setType} drawn set gets empty`, async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const elements = ["0x10", "0x20"];
      const queryHandler = createFakeModelsTreeQueryHandler({
        modelCategories: new Map([[modelId, [categoryId]]]),
        categoryElements: new Map([[categoryId, elements]]),
      });
      const viewport = createFakeSinonViewport();

      const debounceTime = 20;
      await using(new AlwaysAndNeverDrawnElementInfo(viewport, queryHandler, debounceTime), async (info) => {
        const newSet = new Set<Id64String>();
        setType === "always" ? viewport.setAlwaysDrawn(newSet) : viewport.setNeverDrawn(newSet);
        await fakeTimers.tickAsync(debounceTime);

        expect(queryHandler.queryElementInfo).not.to.be.called;
        const obs = info.getElements({ setType, modelId, categoryId });
        expect((await firstValueFrom(obs))?.size ?? 0).to.eq(0);
      });
    });

    it(`debounces frequent changes to the ${setType} drawn set`, async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const elements = ["0x10", "0x20", "0x30"];
      const queryHandler = createFakeModelsTreeQueryHandler({
        modelCategories: new Map([[modelId, [categoryId]]]),
        categoryElements: new Map([[categoryId, elements]]),
      });
      const viewport = createFakeSinonViewport();

      const debounceTime = 20;
      await using(new AlwaysAndNeverDrawnElementInfo(viewport, queryHandler, debounceTime), async (info) => {
        expect(queryHandler.queryElementInfo).not.to.be.called;

        const updateSet = (set: Id64Set) => (setType === "always" ? viewport.setAlwaysDrawn(set) : viewport.setNeverDrawn(set));
        updateSet(new Set<Id64String>(["0x10"]));
        updateSet(new Set<Id64String>(["0x20"]));
        const finalSet = new Set<Id64String>(["0x30"]);
        updateSet(finalSet);
        await fakeTimers.tickAsync(debounceTime);

        expect(queryHandler.queryElementInfo).to.be.calledOnceWith(finalSet);
        await expect(firstValueFrom(info.getElements({ setType, modelId, categoryId }))).to.eventually.deep.eq(finalSet);
      });
    });

    it("waits until debounce period is passed and resolves with the newest result", async () => {
      const elements = ["0x20", "0x30"];
      const firstSet = new Set<Id64String>([elements[0]]);
      const secondSet = new Set<Id64String>([elements[1]]);
      const modelId = "0x1";
      const categoryId = "0x2";
      const queryHandler = sinon.stub(createModelsTreeQueryHandler({} as unknown as IModelConnection));

      queryHandler.queryElementInfo.callsFake((idSet) => {
        if (idSet === firstSet) {
          return of({ elementId: elements[0], modelId, categoryId });
        }
        if (idSet === secondSet) {
          return of({ elementId: elements[1], modelId, categoryId });
        }
        throw new Error(`Unexpected set in query: ${idSet}`);
      });

      const viewport = createFakeSinonViewport();

      const debounceTime = 20;
      await using(new AlwaysAndNeverDrawnElementInfo(viewport, queryHandler, debounceTime), async (info) => {
        const updateSet = (set: Id64Set) => (setType === "always" ? viewport.setAlwaysDrawn(set) : viewport.setNeverDrawn(set));

        const resultPromise = firstValueFrom(info.getElements({ setType, modelId, categoryId }));
        updateSet(firstSet);
        updateSet(secondSet);
        await fakeTimers.tickAsync(debounceTime);

        await expect(resultPromise).to.eventually.deep.eq(secondSet);
      });
    });

    it(`returns newest result if ${setType} drawn set is changed during the query`, async () => {
      const elements = ["0x20", "0x30"];
      const firstSet = new Set<Id64String>([elements[0]]);
      const secondSet = new Set<Id64String>([elements[1]]);
      const modelId = "0x1";
      const categoryId = "0x2";
      const queryHandler = sinon.stub(createModelsTreeQueryHandler({} as unknown as IModelConnection));

      const firstSetInfoSubject = new Subject<ElementInfo>();
      const secondSetInfoSubject = new Subject<ElementInfo>();
      queryHandler.queryElementInfo.callsFake((idSet) => {
        if (idSet === firstSet) {
          return firstSetInfoSubject;
        }
        if (idSet === secondSet) {
          return secondSetInfoSubject;
        }
        throw new Error(`Unexpected set in query: ${idSet}`);
      });

      const viewport = createFakeSinonViewport();

      const debounceTime = 20;
      await using(new AlwaysAndNeverDrawnElementInfo(viewport, queryHandler, debounceTime), async (info) => {
        const updateSet = (set: Id64Set) => (setType === "always" ? viewport.setAlwaysDrawn(set) : viewport.setNeverDrawn(set));

        updateSet(firstSet);
        await fakeTimers.tickAsync(debounceTime);
        const resultPromise = firstValueFrom(info.getElements({ setType, modelId, categoryId }));

        updateSet(secondSet);
        await fakeTimers.tickAsync(debounceTime);

        firstSetInfoSubject.next({ elementId: elements[0], categoryId, modelId });
        firstSetInfoSubject.complete();

        secondSetInfoSubject.next({ elementId: elements[1], categoryId, modelId });
        secondSetInfoSubject.complete();

        await expect(resultPromise).to.eventually.deep.eq(secondSet);
      });
    });

    it(`cancels initial query if ${setType} drawn set is immediately changed`, async () => {
      const elements = ["0x20", "0x30"];
      const firstSet = new Set<Id64String>([elements[0]]);
      const secondSet = new Set<Id64String>([elements[1]]);
      const modelId = "0x1";
      const categoryId = "0x2";
      const queryHandler = sinon.stub(createModelsTreeQueryHandler({} as unknown as IModelConnection));

      const firstSetInfoSubject = new Subject<ElementInfo>();
      const secondSetInfoSubject = new Subject<ElementInfo>();
      queryHandler.queryElementInfo.callsFake((idSet) => {
        if (idSet === firstSet) {
          return firstSetInfoSubject;
        }
        if (idSet === secondSet) {
          return secondSetInfoSubject;
        }
        throw new Error(`Unexpected set in query: ${idSet}`);
      });

      const viewport = createFakeSinonViewport({
        [`${setType}Drawn`]: firstSet,
      });

      const debounceTime = 20;
      await using(new AlwaysAndNeverDrawnElementInfo(viewport, queryHandler, debounceTime), async (info) => {
        const updateSet = (set: Id64Set) => (setType === "always" ? viewport.setAlwaysDrawn(set) : viewport.setNeverDrawn(set));

        updateSet(secondSet);
        await fakeTimers.tickAsync(debounceTime);

        firstSetInfoSubject.next({ elementId: elements[0], categoryId, modelId });
        firstSetInfoSubject.complete();

        secondSetInfoSubject.next({ elementId: elements[1], categoryId, modelId });
        secondSetInfoSubject.complete();

        await expect(firstValueFrom(info.getElements({ setType, modelId, categoryId }))).to.eventually.deep.eq(secondSet);
      });
    });
  }

  describe("always drawn", () => {
    runTests("always");
  });

  describe("never drawn", () => {
    runTests("never");
  });
});
