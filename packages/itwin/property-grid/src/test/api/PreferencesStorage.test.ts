/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Logger } from "@itwin/core-bentley";
import { IModelApp } from "@itwin/core-frontend";
import { IModelAppUserPreferencesStorage } from "../../property-grid-react/api/PreferencesStorage.js";
import { createFunctionStub } from "../TestUtils.js";

import type { UserPreferencesAccess } from "@itwin/core-frontend";

describe("IModelAppUserPreferencesStorage", () => {
  const imodelUserPreferences = {
    save: createFunctionStub<UserPreferencesAccess["save"]>(),
    get: createFunctionStub<UserPreferencesAccess["get"]>(),
  };

  let userPreferencesStub: ReturnType<typeof vi.spyOn>;
  let loggerStub: ReturnType<typeof vi.spyOn>;
  let storage: IModelAppUserPreferencesStorage;

  beforeEach(() => {
    userPreferencesStub = vi.spyOn(IModelApp, "userPreferences", "get");
    loggerStub = vi.spyOn(Logger, "logError");
    userPreferencesStub.mockReturnValue(imodelUserPreferences);
    storage = new IModelAppUserPreferencesStorage();
  });

  afterEach(() => {
    userPreferencesStub.mockReset();
    loggerStub.mockReset();
    imodelUserPreferences.get.mockReset();
    imodelUserPreferences.save.mockReset();
  });

  describe("set", () => {
    it("saves value in `IModelApp.userPreferences`", async () => {
      await storage.set("test-key", "test-value");
      expect(imodelUserPreferences.save).toHaveBeenCalledWith(expect.objectContaining({ key: "test-key", content: "test-value" }));
    });

    it("logs error if `IModelApp.userPreferences.save` throws", async () => {
      imodelUserPreferences.save.mockImplementation(() => {
        throw new Error("Invalid Key");
      });
      await storage.set("test-key", "test-value");
      expect(loggerStub).toHaveBeenCalledWith("PropertyGrid", expect.stringContaining("Invalid Key"));
    });

    it("logs error if `IModelApp.userPreferences` not defined", async () => {
      userPreferencesStub.mockReset();
      userPreferencesStub.mockReturnValue(undefined);
      await storage.set("test-key", "test-value");
      expect(loggerStub).toHaveBeenCalledWith("PropertyGrid", expect.stringContaining("'IModelApp.userPreferences' not defined"));
    });
  });

  describe("get", () => {
    it("gets value from `IModelApp.userPreferences`", async () => {
      imodelUserPreferences.get.mockResolvedValue("test-value");
      expect(await storage.get("test-key")).toBe("test-value");
    });

    it("logs error if `IModelApp.userPreferences.get` throws", async () => {
      imodelUserPreferences.get.mockImplementation(() => {
        throw new Error("Invalid Key");
      });
      await storage.get("test-key");
      expect(loggerStub).toHaveBeenCalledWith("PropertyGrid", expect.stringContaining("Invalid Key"));
    });

    it("logs error if `IModelApp.userPreferences` not defined", async () => {
      userPreferencesStub.mockReset();
      userPreferencesStub.mockReturnValue(undefined);
      expect(await storage.get("test-key")).toBeUndefined();
      expect(loggerStub).toHaveBeenCalledWith("PropertyGrid", expect.stringContaining("'IModelApp.userPreferences' not defined"));
    });
  });
});
