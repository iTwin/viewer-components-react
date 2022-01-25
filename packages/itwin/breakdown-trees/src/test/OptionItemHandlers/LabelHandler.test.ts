/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "mock-local-storage";
import { assert } from "chai";
import * as moq from "typemoq";
import sinon from "sinon";
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";
import { StoryClipPlanesProvider } from "../../Views/FunctionalityProviders";
import { LabelHandler } from "../../Views/OptionItemHandlers";
import { SectioningUtil } from "../../Views/visibility/SectioningUtil";

(global as any).sessionStorage = window.sessionStorage;

describe("LabelHandler", () => {
  const spaceLabelStorageKey = (LabelHandler as any).SPACE_LABEL_STORAGE_KEY;
  let storyClipPlanesFunctionalityProvider: StoryClipPlanesProvider;
  let setSpaceLabelVisibleSpy: sinon.SinonSpy;

  before(async () => {
    const presentationDataProviderMock = moq.Mock.ofType<IPresentationTreeDataProvider>();
    storyClipPlanesFunctionalityProvider = new StoryClipPlanesProvider("tests", presentationDataProviderMock.object, true, true);
    setSpaceLabelVisibleSpy = sinon.spy(SectioningUtil, "setSpaceLabelVisible");
  });

  afterEach(() => {
    sessionStorage.clear();
    setSpaceLabelVisibleSpy.resetHistory();
  });

  after(() => {
    setSpaceLabelVisibleSpy.restore();
  });

  it("should get the value from sessionstorage on init", async () => {
    sessionStorage.setItem(spaceLabelStorageKey, "true");
    const labelsHandlerinitTrue = new LabelHandler(storyClipPlanesFunctionalityProvider, "tests", "show Space Labels", "anyicon");
    let setTopViewState = labelsHandlerinitTrue.getIsActive();
    assert.isTrue(setTopViewState);

    sessionStorage.setItem(spaceLabelStorageKey, "false");
    const labelsHandlerinitFalse = new LabelHandler(storyClipPlanesFunctionalityProvider, "tests", "show Space Labels", "anyicon");
    setTopViewState = labelsHandlerinitFalse.getIsActive();
    assert.isFalse(setTopViewState);
  });

  it("should default to false if sessionstorage not set", async () => {
    sessionStorage.clear();
    assert.isNull(sessionStorage.getItem(spaceLabelStorageKey));
    const labelsHandler = new LabelHandler(storyClipPlanesFunctionalityProvider, "tests", "show Space Labels", "anyicon");
    const setTopViewState = labelsHandler.getIsActive();
    assert.isFalse(setTopViewState);
  });

  it("should change sessionStorage value when toggled", async () => {
    sessionStorage.setItem(spaceLabelStorageKey, "true");
    const labelsHandler = new LabelHandler(storyClipPlanesFunctionalityProvider, "tests", "show Space Labels", "anyicon");
    assert.isTrue(labelsHandler.getIsActive());
    labelsHandler.toggle();
    assert.isFalse(labelsHandler.getIsActive());
  });

  it("should call setTopView on functionality provider when toggled", async () => {
    const labelsHandler = new LabelHandler(storyClipPlanesFunctionalityProvider, "tests", "show Space Labels", "anyicon");
    assert.isTrue(setSpaceLabelVisibleSpy.calledOnce);

    labelsHandler.toggle();
    assert.isTrue(setSpaceLabelVisibleSpy.calledTwice);
  });
});
