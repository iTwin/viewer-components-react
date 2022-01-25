/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "mock-local-storage";
import { assert } from "chai";
import * as moq from "typemoq";
import { TopViewHandler } from "../../Views/OptionItemHandlers";
import type { ToggledTopFitViewFunctionalityProvider } from "../../Views/FunctionalityProviders";

(global as any).sessionStorage = window.sessionStorage;

describe("TopViewHandler", () => {
  const topViewStorageKey = (TopViewHandler as any).TOP_VIEW_STORAGE_KEY;

  before(async () => {
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("should get the value from sessionstorage on init", async () => {
    sessionStorage.setItem(topViewStorageKey, "true");
    const topViewHandlerinitTrue = new TopViewHandler([], "tests", "show top view", "anyicon");
    let setTopViewState = topViewHandlerinitTrue.getIsActive();
    assert.isTrue(setTopViewState);

    sessionStorage.setItem(topViewStorageKey, "false");
    const topViewHandlerinitFalse = new TopViewHandler([], "tests", "show top view", "anyicon");
    setTopViewState = topViewHandlerinitFalse.getIsActive();
    assert.isFalse(setTopViewState);
  });

  it("should default to false if sessionstorage not set", async () => {
    sessionStorage.clear();
    assert.isNull(sessionStorage.getItem(topViewStorageKey));
    const topViewHandler = new TopViewHandler([], "tests", "show top view", "anyicon");
    const setTopViewState = topViewHandler.getIsActive();
    assert.isFalse(setTopViewState);
  });

  it("should change sessionStorage value when toggled", async () => {
    sessionStorage.setItem(topViewStorageKey, "true");
    const topViewHandler = new TopViewHandler([], "tests", "show top view", "anyicon");
    assert.isTrue(topViewHandler.getIsActive());
    topViewHandler.toggle();
    assert.isFalse(topViewHandler.getIsActive());
  });

  it("should call setTopView on functionality provider when toggled", async () => {
    const fitViewFunctionalityProviderMock = moq.Mock.ofType<ToggledTopFitViewFunctionalityProvider>();

    const topViewHandler = new TopViewHandler([fitViewFunctionalityProviderMock.object], "tests", "show top view", "anyicon");

    fitViewFunctionalityProviderMock.verify((x) => x.setTopView(moq.It.isAny()), moq.Times.once());
    topViewHandler.toggle();

    fitViewFunctionalityProviderMock.verify((x) => x.setTopView(moq.It.isAny()), moq.Times.exactly(2));
  });
});
