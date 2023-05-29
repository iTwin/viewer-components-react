/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { Logger } from "@itwin/core-bentley";
import { IModelApp } from "@itwin/core-frontend";
import { DefaultPreferencesStorage } from "../../property-grid-react";
import { createFunctionStub } from "../TestUtils";

import type { PreferenceArg, UserPreferencesAccess } from "@itwin/core-frontend";

describe("DefaultPreferencesStorage", () => {
  const imodelUserPreferences = {
    save: createFunctionStub<UserPreferencesAccess["save"]>(),
    get: createFunctionStub<UserPreferencesAccess["get"]>(),
  };

  let userPreferencesStub: sinon.SinonStub;
  let loggerStub: sinon.SinonStub;
  let storage: DefaultPreferencesStorage;

  before(() => {
    userPreferencesStub = sinon.stub(IModelApp, "userPreferences");
    loggerStub = sinon.stub(Logger, "logError");
  });

  after(() => {
    sinon.restore();
  });

  beforeEach(() => {
    userPreferencesStub.get(() => imodelUserPreferences);
    storage = new DefaultPreferencesStorage();
  });

  afterEach(() => {
    userPreferencesStub.reset();
    loggerStub.reset();
    imodelUserPreferences.get.reset();
    imodelUserPreferences.save.reset();
  });

  describe("set", () => {
    it("saves value in `IModelApp.UserPreferences`", async () => {
      await storage.set("test-key", "test-value");
      expect(imodelUserPreferences.save).to.be.calledWith(
        sinon.match((props: PreferenceArg) =>  props.key === "test-key" && props.content === "test-value")
      );
    });

    it("logs error if `IModelApp.UserPreferences.save` throws" , async () => {
      imodelUserPreferences.save.throws(new Error("Invalid Key"));
      await storage.set("test-key", "test-value");
      expect(loggerStub).to.be.calledWith("PropertyGrid", sinon.match("Invalid Key"));
    });
  });

  describe("get", () => {
    it("gets value from `IModelApp.UserPreferences`", async () => {
      imodelUserPreferences.get.resolves("test-value");
      expect(await storage.get("test-key")).to.be.eq("test-value");
    });

    it("logs error if `IModelApp.UserPreferences.get` throws" , async () => {
      imodelUserPreferences.get.throws(new Error("Invalid Key"));
      await storage.get("test-key");
      expect(loggerStub).to.be.calledWith("PropertyGrid", sinon.match("Invalid Key"));
    });

    it("returns `undefined` if `IModelApp.userPreferences` not defined", async () => {
      userPreferencesStub.reset();
      userPreferencesStub.get(() => undefined);
      expect(await storage.get("test-key")).to.be.undefined;
    });
  });
});
