/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import 'mock-local-storage';
import { ClipAtSpacesHandler } from "../../components/trees/OptionItemHandlers";
import { StoryClipPlanesProvider } from "../../components/trees/FunctionalityProviders";
import { assert } from "chai";
import * as moq from "typemoq";
import { IPresentationTreeDataProvider } from "@bentley/presentation-components";

(global as any).sessionStorage = window.sessionStorage;

describe("ClipAtSpacesHandler", () => {
  const clipAtSpaceStorageKey = (ClipAtSpacesHandler as any).CLIP_AT_SPACE_STORAGE_KEY;
  let storyClipPlanesFunctionalityProvider: StoryClipPlanesProvider;

  before(async () => {
    const presentationDataProviderMock = moq.Mock.ofType<IPresentationTreeDataProvider>();
    storyClipPlanesFunctionalityProvider = new StoryClipPlanesProvider("tests", presentationDataProviderMock.object, false, false);
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  after(() => {
  });

  it("should get the value from sessionstorage on init", async () => {
    sessionStorage.setItem(clipAtSpaceStorageKey, "true");
    const clipAtSpacesHandler = new ClipAtSpacesHandler(storyClipPlanesFunctionalityProvider, false, "tests", "Clip At Spaces", "anyicon");
    let clipAtSpace = clipAtSpacesHandler.isActive();
    assert.isTrue(clipAtSpace);

    sessionStorage.setItem(clipAtSpaceStorageKey, "false");
    const clipAtSpacesHandlerFalse = new ClipAtSpacesHandler(storyClipPlanesFunctionalityProvider, true, "tests", "Clip At Spaces", "anyicon");
    clipAtSpace = clipAtSpacesHandlerFalse.isActive();
    assert.isFalse(clipAtSpace);
  });

  it("should default to passed parameter if sessionstorage not set", async () => {
    sessionStorage.clear();
    assert.isNull(sessionStorage.getItem(clipAtSpaceStorageKey));
    const clipAtSpacesHandler = new ClipAtSpacesHandler(storyClipPlanesFunctionalityProvider, true, "tests", "Clip At Spaces", "anyicon");
    const clipAtSpaces = clipAtSpacesHandler.isActive();
    assert.isTrue(clipAtSpaces);
  });

  it("should change sessionStorage value when toggled", async () => {
    sessionStorage.setItem(clipAtSpaceStorageKey, "true");
    const clipAtSpacesHandler = new ClipAtSpacesHandler(storyClipPlanesFunctionalityProvider, true, "tests", "Clip At Spaces", "anyicon");
    assert.isTrue(clipAtSpacesHandler.isActive());
    clipAtSpacesHandler.toggle();
    assert.isFalse(clipAtSpacesHandler.isActive());
  });

  it("should change the value of clipAtSpaces in functionality provider when toggled", async () => {
    const clipAtSpacesHandler = new ClipAtSpacesHandler(storyClipPlanesFunctionalityProvider, true, "tests", "Clip At Spaces", "anyicon");
    assert.isTrue(storyClipPlanesFunctionalityProvider.clipAtSpaces);

    clipAtSpacesHandler.toggle();
    assert.isFalse(storyClipPlanesFunctionalityProvider.clipAtSpaces);
  });
});
