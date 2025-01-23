/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { EmptyLocalization } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";
import { TreeWidget } from "../TreeWidget.js";

describe("TreeWidget", () => {
  afterEach(() => {
    TreeWidget.terminate();
    sinon.restore();
  });

  it("registers localization namespace only once", async () => {
    const localization = new EmptyLocalization();
    const registerStub = sinon.stub(localization, "registerNamespace");

    await TreeWidget.initialize(localization);
    expect(registerStub).to.be.calledOnce;

    await TreeWidget.initialize(localization);
    expect(registerStub).to.be.calledOnce;
  });

  it("uses localization from IModelApp", async () => {
    const localization = new EmptyLocalization();
    const registerStub = sinon.stub(localization, "registerNamespace");
    sinon.stub(IModelApp, "localization").get(() => localization);

    await TreeWidget.initialize();
    expect(registerStub).to.be.calledOnce;
  });

  it("unregisters namespace once when terminating", async () => {
    const localization = new EmptyLocalization();
    const unregisterStub = sinon.stub(localization, "unregisterNamespace");
    await TreeWidget.initialize(localization);

    TreeWidget.terminate();
    expect(unregisterStub).to.be.calledOnce;

    TreeWidget.terminate();
    expect(unregisterStub).to.be.calledOnce;
  });

  it("`translate` translates string", async () => {
    const localization = new EmptyLocalization();
    const getLocalizedStringStub = sinon.stub(localization, "getLocalizedString").returns("testString");
    await TreeWidget.initialize(localization);

    expect(TreeWidget.translate("testKey")).to.be.eq("testString");
    expect(getLocalizedStringStub).to.be.calledOnceWith(`${TreeWidget.i18nNamespace}:testKey`);
  });

  it("`translate` throws if not initialized", () => {
    expect(() => TreeWidget.translate("test")).to.throw();
  });
});
