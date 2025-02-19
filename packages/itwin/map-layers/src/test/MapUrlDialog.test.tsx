/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import * as enzyme from "enzyme";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { ImageMapLayerSettings } from "@itwin/core-common";
import { IModelApp, MapLayerSource, MapLayerSourceStatus, MockRender, NotifyMessageDetails, OutputMessagePriority } from "@itwin/core-frontend";
import { Select } from "@itwin/itwinui-react";
import { MapLayersUI } from "../mapLayers";
import { MapUrlDialog } from "../ui/widget/MapUrlDialog";
import { AccessClientMock, TokenEndpointMock } from "./AccessClientMock";
import { TestUtils } from "./TestUtils";

import type { MapSubLayerProps } from "@itwin/core-common";
import type { DisplayStyle3dState, IModelConnection, MapLayerTokenEndpoint, ScreenViewport, ViewState3d } from "@itwin/core-frontend";
import type { SourceState } from "../ui/widget/MapUrlDialog";
describe("MapUrlDialog", () => {
  const sandbox = sinon.createSandbox();
  const viewportMock = moq.Mock.ofType<ScreenViewport>();
  const viewMock = moq.Mock.ofType<ViewState3d>();
  const displayStyleMock = moq.Mock.ofType<DisplayStyle3dState>();
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const defaultNumberOfInput = 2;

  const getSampleLayerSettings = (formatId: string, fakeCredentials: boolean) => {
    const sampleWmsSubLayers: MapSubLayerProps[] = [{ name: "subLayer1" }, { name: "subLayer2" }];
    const sampleWmsLayerSettings = ImageMapLayerSettings.fromJSON({
      formatId,
      name: "Test Map",
      visible: true,
      transparentBackground: true,
      subLayers: sampleWmsSubLayers,
      accessKey: undefined,
      transparency: 0,
      url: "https://server/wms",
    });

    if (fakeCredentials) {
      const sampleWmsLayerSettingsCred = sampleWmsLayerSettings?.clone({});
      sampleWmsLayerSettingsCred?.setCredentials("testUser", "TestPassword");
      return sampleWmsLayerSettingsCred;
    }

    return sampleWmsLayerSettings;
  };

  const testAddAuthLayer = async (isOAuth: boolean, format: string) => {
    const sampleLayerSettings = getSampleLayerSettings(format, true);
    let endPoint: MapLayerTokenEndpoint | undefined;
    if (isOAuth) {
      endPoint = new TokenEndpointMock();
    }
    const validateSourceStub = sandbox.stub(MapLayerSource.prototype, "validateSource").callsFake(async function (_ignoreCache?: boolean) {
      return Promise.resolve({
        status: MapLayerSourceStatus.RequireAuth,
        authInfo: { tokenEndpoint: endPoint },
      });
    });

    const spyOnOkResult = sandbox.fake();
    const component = enzyme.mount(<MapUrlDialog activeViewport={viewportMock.object} onOkResult={spyOnOkResult} />);
    const layerTypeSelect = component.find(Select).at(0);
    await (layerTypeSelect.props() as any).onChange(format);

    // First, lets fill the 'Name' and 'URL' fields
    const allInputs = component.find("input");
    expect(allInputs.length).to.equals(defaultNumberOfInput);
    allInputs.at(0).simulate("change", { target: { value: sampleLayerSettings?.name } });
    allInputs.at(1).simulate("change", { target: { value: sampleLayerSettings?.url } });

    // We need to click the 'Ok' button a first time to trigger the layer source
    // validation and make the credentials fields appear
    let okButton = component.find(".map-layer-features-footer-button").at(0);
    expect(okButton.length).to.equals(1);
    okButton.simulate("click");

    await TestUtils.flushAsyncOperations();

    component.update();
    if (!isOAuth) {
      const allInputs2 = component.find("input");
      expect(allInputs2.length).to.equals(defaultNumberOfInput + 2);

      // Fill the credentials fields
      allInputs2.at(2).simulate("change", { target: { value: sampleLayerSettings?.userName } });
      allInputs2.at(3).simulate("change", { target: { value: sampleLayerSettings?.password } });
    }
    // We need to fake 'valideSource' again, this time we want to simulate a successfully validation
    validateSourceStub.restore();
    sandbox.stub(MapLayerSource.prototype, "validateSource").callsFake(async function (_ignoreCache?: boolean) {
      return Promise.resolve({
        status: MapLayerSourceStatus.Valid,
        subLayers: sampleLayerSettings.subLayers,
      });
    });

    // By clicking the 'ok' button we expect the layer to be added to the display style
    okButton = component.find(".map-layer-features-footer-button").at(0);
    expect(okButton.length).to.equals(1);
    okButton.simulate("click");

    await TestUtils.flushAsyncOperations();

    if (!sampleLayerSettings) {
      assert.fail("Invalid layer settings");
    }

    if (!isOAuth) {
      // Make sure credentials are returned part of the source object
      const firstCallArgs = spyOnOkResult.args[0];
      expect(firstCallArgs[0].source.userName).to.equals(sampleLayerSettings.userName);
      expect(firstCallArgs[0].source.password).to.equals(sampleLayerSettings.password);
    }

    /*
    TODO: Move this in AttachLayerPanel
    if (!isOAuth) {
      displayStyleMock.verify((x) => x.attachMapLayer({settings: sampleLayerSettings, mapLayerIndex: {index: -1, isOverlay: false}}), moq.Times.once());

      spyMessage.calledWithExactly(new NotifyMessageDetails(OutputMessagePriority.Info, "Messages.MapLayerAttached"));
    }
    */
    component.unmount();
  };

  before(async () => {
    await MockRender.App.startup();
    await TestUtils.initialize();
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiComponents();
  });

  afterEach(() => {
    sandbox.restore();
  });

  beforeEach(() => {
    displayStyleMock.reset();
    displayStyleMock.setup((ds) => ds.attachMapLayer(moq.It.isAny()));
    imodelMock.reset();
    imodelMock.setup((iModel) => iModel.iModelId).returns(() => "fakeGuid");
    imodelMock.setup((iModel) => iModel.iTwinId).returns(() => "fakeGuid");

    viewMock.reset();
    viewMock.setup((view) => view.iModel).returns(() => imodelMock.object);
    viewportMock.reset();
    viewportMock.setup((viewport) => viewport.iModel).returns(() => viewMock.object.iModel);
    viewportMock.setup((viewport) => viewport.view).returns(() => viewMock.object);
    viewportMock.setup((viewport) => viewport.displayStyle).returns(() => displayStyleMock.object);
  });

  const mockModalUrlDialogOk = (_result?: SourceState) => {};

  it("renders", () => {
    const component = enzyme.mount(<MapUrlDialog activeViewport={viewportMock.object} onOkResult={mockModalUrlDialogOk} />);
    const allInputs = component.find("input");

    expect(allInputs.length).to.equals(defaultNumberOfInput);

    const layerTypeSelect = component.find(Select);
    expect(layerTypeSelect.length).to.equals(2);

    const allButtons = component.find("button");
    expect(allButtons.length).to.equals(3);

    component.unmount();
  });

  it("attach a valid WMS layer (with sublayers)", async () => {
    const sampleWmsLayerSettings = getSampleLayerSettings("WMS", false);
    if (!sampleWmsLayerSettings) {
      assert.fail("Invalid layer settings");
    }

    const spyMessage = sandbox.spy(IModelApp.notifications, "outputMessage");
    const spyOnOkResult = sandbox.fake();

    sandbox.stub(MapLayerSource.prototype, "validateSource").callsFake(async function (_ignoreCache?: boolean) {
      return Promise.resolve({ status: MapLayerSourceStatus.Valid, subLayers: sampleWmsLayerSettings.subLayers });
    });

    const component = enzyme.mount(<MapUrlDialog activeViewport={viewportMock.object} onOkResult={spyOnOkResult} />);
    const layerTypeSelect = component.find(Select).at(0);
    await (layerTypeSelect.props() as any).onChange("WMS");

    const allInputs = component.find("input");
    expect(allInputs.length).to.equals(defaultNumberOfInput);
    allInputs.at(0).simulate("change", { target: { value: sampleWmsLayerSettings?.name } });
    allInputs.at(1).simulate("change", { target: { value: sampleWmsLayerSettings?.url } });

    const okButton = component.find(".map-layer-features-footer-button").at(0);
    expect(okButton.length).to.equals(1);
    okButton.simulate("click");

    await TestUtils.flushAsyncOperations();

    expect(spyOnOkResult.calledOnce).to.be.true;
    const firstCallArgs = spyOnOkResult.args[0];
    expect(firstCallArgs[0].source.name).to.equals(sampleWmsLayerSettings.name);
    expect(firstCallArgs[0].validation.subLayers.length).to.equals(sampleWmsLayerSettings.subLayers.length);

    spyMessage.calledWithExactly(new NotifyMessageDetails(OutputMessagePriority.Info, "Messages.MapLayerAttached"));

    component.unmount();
  });

  it("attach a WMS layer requiring basic auth to display style", async () => {
    await testAddAuthLayer(false, "WMS");
  });

  it("attach a layer requiring EsriToken", async () => {
    await testAddAuthLayer(false, "ArcGIS");
  });

  it("attach a layer requiring Oauth and check popup opens with right URL", async () => {
    IModelApp.mapLayerFormatRegistry.setAccessClient("ArcGIS", new AccessClientMock());
    const openStub = sinon.stub((global as any).window, "open");
    await testAddAuthLayer(true, "ArcGIS");
    expect(openStub.called).to.true;
    const firstCall = openStub.getCall(0);
    expect(firstCall.firstArg).to.equals(TokenEndpointMock.loginUrl);
  });

  it("should not display user preferences options if iTwinConfig is undefined ", () => {
    const component = enzyme.mount(<MapUrlDialog activeViewport={viewportMock.object} onOkResult={mockModalUrlDialogOk} />);
    const allRadios = component.find('input[type="radio"]');
    expect(allRadios.length).equals(0);
    allRadios.forEach((radio) => {
      expect(radio.props().disabled).to.be.true;
    });
  });

  it("should not display user preferences options if iTwinConfig is defined but the option is OFF ", () => {
    sandbox.stub(MapLayersUI, "iTwinConfig").get(() => ({
      get: undefined,
      save: undefined,
      delete: undefined,
    }));
    const component = enzyme.mount(<MapUrlDialog activeViewport={viewportMock.object} onOkResult={mockModalUrlDialogOk} />);
    const allRadios = component.find('input[type="radio"]');
    expect(allRadios.length).equals(0);
    allRadios.forEach((radio) => {
      expect(radio.props().disabled).to.be.true;
    });
  });

  it("should display user preferences options if iTwinConfig is defined AND option is ON", () => {
    sandbox.stub(MapLayersUI, "iTwinConfig").get(() => ({
      get: undefined,
      save: undefined,
      delete: undefined,
    }));
    const component = enzyme.mount(
      <MapUrlDialog
        mapLayerOptions={{ showUserPreferencesStorageOptions: true }}
        activeViewport={viewportMock.object}
        onOkResult={mockModalUrlDialogOk}
      />,
    );
    const allRadios = component.find('input[type="radio"]');
    expect(allRadios.length).to.equals(2);
  });

  it("attach a valid layer with a single non-visible sublayer", async () => {
    const sampleLayerSettings = ImageMapLayerSettings.fromJSON({
      formatId: "WMS",
      name: "TestLayer",
      visible: true,
      transparentBackground: true,
      subLayers: [{ name: "subLayer1", visible: false }],
      accessKey: undefined,
      transparency: 0,
      url: "https://server/MapServer",
    });

    sandbox.stub(MapLayerSource.prototype, "validateSource").callsFake(async function (_ignoreCache?: boolean) {
      return Promise.resolve({ status: MapLayerSourceStatus.Valid, subLayers: sampleLayerSettings.subLayers });
    });

    const component = enzyme.mount(<MapUrlDialog activeViewport={viewportMock.object} onOkResult={mockModalUrlDialogOk} />);
    const layerTypeSelect = component.find(Select).at(0);
    await (layerTypeSelect.props() as any).onChange("WMS");

    const allInputs = component.find("input");
    expect(allInputs.length).to.equals(defaultNumberOfInput);
    allInputs.at(0).simulate("change", { target: { value: sampleLayerSettings?.name } });
    allInputs.at(1).simulate("change", { target: { value: sampleLayerSettings?.url } });

    const okButton = component.find(".map-layer-features-footer-button").at(0);
    expect(okButton.length).to.equals(1);
    okButton.simulate("click");

    await TestUtils.flushAsyncOperations();

    // TODO: Move this in AttachLayerPanel
    // // Check that single sub-layer visibility has been forced to true (was initially false)
    // const cloned = ImageMapLayerSettings.fromJSON({...sampleLayerSettings.toJSON(), subLayers:  [{ name: "subLayer1", visible: true }]});

    // displayStyleMock.verify((x) => x.attachMapLayer({settings: cloned, mapLayerIndex: {index: -1, isOverlay: false}}), moq.Times.once());

    // spyMessage.calledWithExactly(new NotifyMessageDetails(OutputMessagePriority.Info, "Messages.MapLayerAttached"));

    component.unmount();
  });
});
