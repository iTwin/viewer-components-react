/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { afterEach, describe, expect, it, vi } from "vitest";
import { EmptyLocalization } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";
import { PropertyGridManager } from "../property-grid-react/PropertyGridManager.js";

describe("PropertyGridManager", () => {
  afterEach(() => {
    PropertyGridManager.terminate();
  });

  it("registers localization namespace only once", async () => {
    const localization = new EmptyLocalization();
    const registerStub = vi.spyOn(localization, "registerNamespace");

    await PropertyGridManager.initialize(localization);
    expect(registerStub).toHaveBeenCalledOnce();

    await PropertyGridManager.initialize(localization);
    expect(registerStub).toHaveBeenCalledOnce();
  });

  it("uses localization from `IModelApp`", async () => {
    const localization = new EmptyLocalization();
    const registerStub = vi.spyOn(localization, "registerNamespace");
    vi.spyOn(IModelApp, "localization", "get").mockReturnValue(localization);

    await PropertyGridManager.initialize();
    expect(registerStub).toHaveBeenCalledOnce();
  });

  it("unregisters namespace once when terminating", async () => {
    const localization = new EmptyLocalization();
    const unregisterStub = vi.spyOn(localization, "unregisterNamespace");
    await PropertyGridManager.initialize(localization);

    PropertyGridManager.terminate();
    expect(unregisterStub).toHaveBeenCalledOnce();

    PropertyGridManager.terminate();
    expect(unregisterStub).toHaveBeenCalledOnce();
  });

  describe("translate", () => {
    it("translates string", async () => {
      const localization = new EmptyLocalization();
      const getLocalizedStringStub = vi.spyOn(localization, "getLocalizedString").mockReturnValue("testString");
      await PropertyGridManager.initialize(localization);

      expect(PropertyGridManager.translate("testKey")).toBe("testString");
      expect(getLocalizedStringStub).toHaveBeenCalledExactlyOnceWith(`${PropertyGridManager.i18nNamespace}:testKey`, undefined);
    });

    it("throws if not initialized", () => {
      expect(() => PropertyGridManager.translate("test")).toThrow();
    });
  });
});
