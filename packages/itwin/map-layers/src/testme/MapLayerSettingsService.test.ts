/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import type { GuidString } from "@itwin/core-bentley";
import { Guid } from "@itwin/core-bentley";
import { MapLayerSource, MockRender } from "@itwin/core-frontend";

import { MapLayerPreferences } from "../MapLayerPreferences";
import { restore, setup } from "./UserPreferencesMock";

describe("MapLayerPreferences", () => {
  const iTwinId: GuidString = Guid.createValue();
  const iModelId: GuidString = Guid.createValue();
  const testName: string = `test${Guid.createValue()}`;

  beforeEach(async () => {
    await MockRender.App.startup();
    setup();
  });

  afterEach(async () => {
    restore();
    vi.restoreAllMocks();
    await MockRender.App.shutdown();
  });

  it("should store and retrieve layer", async () => {
    const layer = MapLayerSource.fromJSON({
      url: "test12345",
      name: testName,
      formatId: "test12345",
      transparentBackground: true,
    });
    expect(layer).toBeDefined();
    let sources = await MapLayerPreferences.getSources(iTwinId, iModelId);
    let foundSource = sources.some((value) => value.name === testName);
    expect(foundSource).toBe(false);

    sources = await MapLayerPreferences.getSources(iTwinId);
    foundSource = sources.some((value) => value.name === testName);
    expect(foundSource).toBe(false);

    const success = await MapLayerPreferences.storeSource(layer!, iTwinId, iModelId, false);
    expect(success).toBe(true);

    sources = await MapLayerPreferences.getSources(iTwinId, iModelId);
    foundSource = sources.some((value) => value.name === testName);
    expect(foundSource).toBe(true);
  });

  it("should store and retrieve layer without ModelId", async () => {
    const layer = MapLayerSource.fromJSON({
      url: "test12345",
      name: testName,
      formatId: "test12345",
      transparentBackground: true,
    });

    expect(layer).toBeDefined();
    let sources = await MapLayerPreferences.getSources(iTwinId);
    let foundSource = sources.some((value) => value.name === testName);
    expect(foundSource).toBe(false);

    const success = await MapLayerPreferences.storeSource(layer!, iTwinId);
    expect(success).toBe(true);

    sources = await MapLayerPreferences.getSources(iTwinId);
    foundSource = sources.some((value) => value.name === testName);
    expect(foundSource).toBe(true);
  });

  it("should not be able to store model setting if same setting exists as project setting", async () => {
    const layer = MapLayerSource.fromJSON({
      url: "test12345",
      name: testName,
      formatId: "test12345",
      transparentBackground: true,
    });
    let success = await MapLayerPreferences.storeSource(layer!, iTwinId, iModelId, false);
    expect(success).toBe(true);
    success = await MapLayerPreferences.storeSource(layer!, iTwinId, iModelId, true);
    expect(success).toBe(false);
  });

  it("should be able to store project setting if same setting exists as project setting", async () => {
    const layer = MapLayerSource.fromJSON({
      url: "test12345",
      name: testName,
      formatId: "test12345",
      transparentBackground: true,
    });
    let success = await MapLayerPreferences.storeSource(layer!, iTwinId, iModelId, true);
    expect(success).toBe(true);
    success = await MapLayerPreferences.storeSource(layer!, iTwinId, iModelId, false);
    expect(success).toBe(true);
  });

  it("should be able to store the same settings twice without iTwinId and iModelId", async () => {
    const layer = MapLayerSource.fromJSON({
      url: "test12345",
      name: testName,
      formatId: "test12345",
      transparentBackground: true,
    });
    let success = await MapLayerPreferences.storeSource(layer!, iTwinId);
    expect(success).toBe(true);
    success = await MapLayerPreferences.storeSource(layer!, iTwinId);
    expect(success).toBe(true);
  });

  it("should be able to delete a mapSource stored on project and imodel level", async () => {
    const layer = MapLayerSource.fromJSON({
      url: "test12345",
      name: testName,
      formatId: "test12345",
      transparentBackground: true,
    });

    expect(layer).toBeDefined();

    expect(await MapLayerPreferences.storeSource(layer!, iTwinId, iModelId, true)).toBe(true);
    await MapLayerPreferences.deleteByName(layer!, iTwinId, iModelId);
    expect(await MapLayerPreferences.getByUrl(layer!.url, iTwinId, iModelId)).toBeUndefined();

    expect(await MapLayerPreferences.storeSource(layer!, iTwinId, iModelId, true)).toBe(true);
    await MapLayerPreferences.deleteByName(layer!, iTwinId, iModelId);
    expect(await MapLayerPreferences.getByUrl(layer!.url, iTwinId, iModelId)).toBeUndefined();
  });

  it("should be able to delete a mapSource stored without iTwinId and iModelId", async () => {
    const layer = MapLayerSource.fromJSON({
      url: "test12345",
      name: testName,
      formatId: "test12345",
      transparentBackground: true,
    });

    expect(layer).toBeDefined();

    expect(await MapLayerPreferences.storeSource(layer!, iTwinId)).toBe(true);
    await MapLayerPreferences.deleteByName(layer!, iTwinId);
    expect(await MapLayerPreferences.getByUrl(layer!.url, iTwinId)).toBeUndefined();
  });
});
