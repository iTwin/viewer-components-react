/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import 'mock-local-storage';
import { LabelHandler } from "../../components/trees/OptionItemHandlers";
import { StoryClipPlanesProvider } from "../../components/trees/FunctionalityProviders";
import { SectioningUtil } from "../../components/trees/visibility/SectioningUtil";
import { assert } from "chai";
import * as moq from "typemoq";
import sinon from "sinon";
import { IPresentationTreeDataProvider } from "@bentley/presentation-components";

(global as any).sessionStorage = window.sessionStorage;

describe("LabelHandler", () => {
  const spaceLabelStorageKey = (LabelHandler as any).SPACE_LABEL_STORAGE_KEY;
  let storyClipPlanesFunctionalityProvider: StoryClipPlanesProvider;
  let setSpaceLabelVisibleSpy: any;

  before(async () => {
    const presentationDataProviderMock = moq.Mock.ofType<IPresentationTreeDataProvider>();
    storyClipPlanesFunctionalityProvider = new StoryClipPlanesProvider("tests", presentationDataProviderMock.object, true, true);
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  after(() => {
    setSpaceLabelVisibleSpy.restore();
  });

  it("should get the value from sessionstorage on init", async () => {
    sessionStorage.setItem(spaceLabelStorageKey, "true");
    const labelsHandlerinitTrue = new LabelHandler(storyClipPlanesFunctionalityProvider, "tests", "show Space Labels", "anyicon");
    let setTopViewState = labelsHandlerinitTrue.isActive();
    assert.isTrue(setTopViewState);

    sessionStorage.setItem(spaceLabelStorageKey, "false");
    const labelsHandlerinitFalse = new LabelHandler(storyClipPlanesFunctionalityProvider, "tests", "show Space Labels", "anyicon");
    setTopViewState = labelsHandlerinitFalse.isActive();
    assert.isFalse(setTopViewState);
  });

  it("should default to false if sessionstorage not set", async () => {
    sessionStorage.clear();
    assert.isNull(sessionStorage.getItem(spaceLabelStorageKey));
    const labelsHandler = new LabelHandler(storyClipPlanesFunctionalityProvider, "tests", "show Space Labels", "anyicon");
    let setTopViewState = labelsHandler.isActive();
    assert.isFalse(setTopViewState);
  });

  it("should change sessionStorage value when toggled", async () => {
    sessionStorage.setItem(spaceLabelStorageKey, "true");
    const labelsHandler = new LabelHandler(storyClipPlanesFunctionalityProvider, "tests", "show Space Labels", "anyicon");
    assert.isTrue(labelsHandler.isActive());
    labelsHandler.toggle();
    assert.isFalse(labelsHandler.isActive());
  });

  it("should call setTopView on functionality provider when toggled", async () => {
    setSpaceLabelVisibleSpy = sinon.spy(SectioningUtil, "setSpaceLabelVisible");
    const labelsHandler = new LabelHandler(storyClipPlanesFunctionalityProvider, "tests", "show Space Labels", "anyicon");
    assert.equal(setSpaceLabelVisibleSpy.callCount, 1);

    labelsHandler.toggle();
    assert.equal(setSpaceLabelVisibleSpy.callCount, 2);
  });
});
