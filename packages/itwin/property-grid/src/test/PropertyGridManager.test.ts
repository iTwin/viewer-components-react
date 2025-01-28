/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { EmptyLocalization } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";
import { PropertyGridManager } from "../property-grid-react/PropertyGridManager.js";

describe("PropertyGridManager", () => {
  afterEach(() => {
    PropertyGridManager.terminate();
    sinon.restore();
  });

  it("registers localization namespace only once", async () => {
    const localization = new EmptyLocalization();
    const registerStub = sinon.stub(localization, "registerNamespace");

    await PropertyGridManager.initialize(localization);
    expect(registerStub).to.be.calledOnce;

    await PropertyGridManager.initialize(localization);
    expect(registerStub).to.be.calledOnce;
  });

  it("uses localization from `IModelApp`", async () => {
    const localization = new EmptyLocalization();
    const registerStub = sinon.stub(localization, "registerNamespace");
    sinon.stub(IModelApp, "localization").get(() => localization);

    await PropertyGridManager.initialize();
    expect(registerStub).to.be.calledOnce;
  });

  it("unregisters namespace once when terminating", async () => {
    const localization = new EmptyLocalization();
    const unregisterStub = sinon.stub(localization, "unregisterNamespace");
    await PropertyGridManager.initialize(localization);

    PropertyGridManager.terminate();
    expect(unregisterStub).to.be.calledOnce;

    PropertyGridManager.terminate();
    expect(unregisterStub).to.be.calledOnce;
  });

  describe("translate", () => {
    it("translates string", async () => {
      const localization = new EmptyLocalization();
      const getLocalizedStringStub = sinon.stub(localization, "getLocalizedString").returns("testString");
      await PropertyGridManager.initialize(localization);

      expect(PropertyGridManager.translate("testKey")).to.be.eq("testString");
      expect(getLocalizedStringStub).to.be.calledOnceWith(`${PropertyGridManager.i18nNamespace}:testKey`);
    });

    it("throws if not initialized", () => {
      expect(() => PropertyGridManager.translate("test")).to.throw();
    });
  });
});
