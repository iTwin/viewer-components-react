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
  let logErrorStub: ReturnType<typeof vi.spyOn>;
  let logWarningStub: ReturnType<typeof vi.spyOn>;
  let storage: IModelAppUserPreferencesStorage;

  beforeEach(() => {
    userPreferencesStub = vi.spyOn(IModelApp, "userPreferences", "get");
    logErrorStub = vi.spyOn(Logger, "logError");
    logWarningStub = vi.spyOn(Logger, "logWarning");
    userPreferencesStub.mockReturnValue(imodelUserPreferences);
    storage = new IModelAppUserPreferencesStorage();
  });

  afterEach(() => {
    userPreferencesStub.mockReset();
    logErrorStub.mockReset();
    logWarningStub.mockReset();
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
      expect(logErrorStub).toHaveBeenCalledWith("PropertyGrid", expect.stringContaining("Invalid Key"));
    });

    it("logs warning if `IModelApp.userPreferences` not defined", async () => {
      userPreferencesStub.mockReset();
      userPreferencesStub.mockReturnValue(undefined);
      await storage.set("test-key", "test-value");
      expect(logWarningStub).toHaveBeenCalledWith("PropertyGrid", expect.stringContaining("'IModelApp.userPreferences' not defined"));
    });

    it("logs warning only once if `IModelApp.userPreferences` not defined", async () => {
      userPreferencesStub.mockReset();
      userPreferencesStub.mockReturnValue(undefined);
      await storage.set("test-key", "test-value");
      await storage.set("test-key-2", "test-value-2");
      expect(logWarningStub).toHaveBeenCalledTimes(1);
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
      expect(logErrorStub).toHaveBeenCalledWith("PropertyGrid", expect.stringContaining("Invalid Key"));
    });

    it("logs warning if `IModelApp.userPreferences` not defined", async () => {
      userPreferencesStub.mockReset();
      userPreferencesStub.mockReturnValue(undefined);
      expect(await storage.get("test-key")).toBeUndefined();
      expect(logWarningStub).toHaveBeenCalledWith("PropertyGrid", expect.stringContaining("'IModelApp.userPreferences' not defined"));
    });

    it("logs warning only once if `IModelApp.userPreferences` not defined", async () => {
      userPreferencesStub.mockReset();
      userPreferencesStub.mockReturnValue(undefined);
      await storage.get("test-key");
      await storage.get("test-key-2");
      expect(logWarningStub).toHaveBeenCalledTimes(1);
    });
  });
});
