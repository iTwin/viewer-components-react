/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import * as moq from "typemoq";
import { ImageMapLayerSettings } from "@itwin/core-common";
import { IModelApp, MapLayerSource, MapLayerSourceStatus, NotifyMessageDetails, OutputMessagePriority } from "@itwin/core-frontend";
import { getAllByRole, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MapLayersUI } from "../mapLayers";
import { MapUrlDialog } from "../ui/widget/MapUrlDialog";
import { AccessClientMock, TokenEndpointMock } from "./AccessClientMock";
import { TestUtils } from "./TestUtils";

import type { MapSubLayerProps } from "@itwin/core-common";
import type { DisplayStyle3dState, IModelConnection, MapLayerTokenEndpoint, ScreenViewport, ViewState3d } from "@itwin/core-frontend";
import type { SourceState } from "../ui/widget/MapUrlDialog";

describe("MapUrlDialog", () => {
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

  beforeAll(async () => {
    await IModelApp.startup();;
    await TestUtils.initialize();
  });

  afterAll(async () => {
    await IModelApp.shutdown();
    // await MockRender.App.shutdown();
    TestUtils.terminateUiComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
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

  const renderComponent = () => {
    return render(
      <MapUrlDialog activeViewport={viewportMock.object} onOkResult={mockModalUrlDialogOk} />
    );
  };

  const testAddAuthLayer = async (isOAuth: boolean, format: string) => {
    const sampleLayerSettings = getSampleLayerSettings(format, true);
    let endPoint: MapLayerTokenEndpoint | undefined;

    if (isOAuth) {
      endPoint = new TokenEndpointMock();
    }

    const validateSourceStub = vi.spyOn(MapLayerSource.prototype, "validateSource").mockImplementation(async () => {
      return Promise.resolve({
        status: MapLayerSourceStatus.RequireAuth,
        authInfo: { tokenEndpoint: endPoint },
      });
    });

    const spyOnOkResult = vi.fn();
    const { container, rerender } = render(
      <MapUrlDialog activeViewport={viewportMock.object} onOkResult={spyOnOkResult} />
    );

    // Select layer type
    const formatSelect = screen.getAllByRole('combobox')[0];
    await userEvent.click(formatSelect);

    // Fill Name and URL fields
    const inputs = container.querySelectorAll('input');
    await userEvent.type(inputs[0], sampleLayerSettings?.name ?? '');
    await userEvent.type(inputs[1], sampleLayerSettings?.url ?? '');

    // Click OK to trigger validation
    const okButton = container.querySelector(".map-layer-features-footer-button");
    expect(okButton).not.toBeNull();
    await userEvent.click(okButton!);

    rerender(<MapUrlDialog activeViewport={viewportMock.object} onOkResult={spyOnOkResult} />);

    if (!isOAuth) {
      // Fill credentials if not OAuth
      const credentialInputs = container.querySelectorAll('input');
      expect(credentialInputs).toHaveLength(4);
      await userEvent.type(credentialInputs[2], sampleLayerSettings?.userName ?? '');
      await userEvent.type(credentialInputs[3], sampleLayerSettings?.password ?? '');
    }

    validateSourceStub.mockImplementation(async () => {
      return Promise.resolve({
        status: MapLayerSourceStatus.Valid,
        subLayers: sampleLayerSettings?.subLayers,
      });
    });

    // Click OK again to add layer
    await userEvent.click(okButton!);
    await TestUtils.flushAsyncOperations();

    if (!sampleLayerSettings) {
      throw new Error("Invalid layer settings");
    }

    if (!isOAuth) {
      // Verify credentials in source object
      expect(spyOnOkResult).toHaveBeenCalledWith(
        expect.objectContaining({
          source: expect.objectContaining({
            userName: sampleLayerSettings.userName,
            password: sampleLayerSettings.password,
          })
        })
      );
    }
  };

  it("renders", () => {
    const { container, unmount } = renderComponent();

    const inputs = container.querySelectorAll('input');
    expect(inputs.length).to.equals(defaultNumberOfInput);

    const sourceUrlDiv = container.querySelector('.map-layer-source-url');
    expect(sourceUrlDiv).not.toBeNull();

    const selects = getAllByRole(container, 'combobox');
    expect(selects.length).to.equals(2);

    const buttons = container.querySelectorAll('button');
    expect(buttons.length).to.equals(3);

    unmount();
  });

  it("attach a valid WMS layer (with sublayers)", async () => {
    const sampleWmsLayerSettings = getSampleLayerSettings("WMS", false);
    if (!sampleWmsLayerSettings) {
      throw new Error("Invalid layer settings");
    }

    const notificationsSpy = vi.spyOn(IModelApp.notifications, 'outputMessage');
    const mockOnOkResult = vi.fn();

    vi.spyOn(MapLayerSource.prototype, 'validateSource').mockResolvedValue({
      status: MapLayerSourceStatus.Valid,
      subLayers: sampleWmsLayerSettings.subLayers
    });

    const { container, unmount } = render(
      <MapUrlDialog
        activeViewport={viewportMock.object}
        onOkResult={mockOnOkResult}
      />
    );

    const formatSelect = screen.getAllByRole('combobox')[0];
    await userEvent.click(formatSelect);

    const inputs = container.querySelectorAll('input');
    await userEvent.type(inputs[0], sampleWmsLayerSettings?.name ?? '');
    await userEvent.type(inputs[1], sampleWmsLayerSettings?.url ?? '');

    const okButton = container.querySelector(".map-layer-features-footer-button");
    expect(okButton).not.toBeNull();
    await userEvent.click(okButton!);

    await TestUtils.flushAsyncOperations();

    expect(mockOnOkResult).toHaveBeenCalledTimes(1);
    const firstCallArgs = mockOnOkResult.mock.calls[0][0];
    expect(firstCallArgs.source.name).toBe(sampleWmsLayerSettings.name);
    expect(firstCallArgs.validation.subLayers.length).toBe(sampleWmsLayerSettings.subLayers.length);

    //TODO: Add OutputMessagePriority.Info dialog message and attaching layer should itself trigger a notification message
    IModelApp.notifications.outputMessage(
      new NotifyMessageDetails(OutputMessagePriority.Info, "Messages.MapLayerAttached")
    );

    expect(notificationsSpy).toHaveBeenCalledWith(
      new NotifyMessageDetails(OutputMessagePriority.Info, "Messages.MapLayerAttached")
    );

    unmount();
  });

  it("attach a WMS layer requiring basic auth to display style", async () => {
    await testAddAuthLayer(false, "WMS");
  });

  it("attach a layer requiring EsriToken", async () => {
    await testAddAuthLayer(false, "ArcGIS");
  });

  it("attach a layer requiring Oauth and check popup opens with right URL", async () => {
    IModelApp.mapLayerFormatRegistry.setAccessClient("ArcGIS", new AccessClientMock());
    const openStub = vi.spyOn(window, 'open');

    await testAddAuthLayer(true, "ArcGIS");

    expect(openStub).toHaveBeenCalled();
    const firstCall = openStub.mock.calls[0];
    expect(firstCall[0]).toBe(TokenEndpointMock.loginUrl);
  });

  it("should not display user preferences options if iTwinConfig is undefined", () => {
    const { container, unmount } = renderComponent();
    const radioInputs = container.querySelectorAll('input[type="radio"]');
    expect(radioInputs.length).toBe(0);
    unmount();
  });

  it("should display user preferences options if iTwinConfig is defined AND option is ON", () => {
    vi.spyOn(MapLayersUI, 'iTwinConfig', 'get').mockReturnValue({
      get: () => Promise.resolve(undefined),
      save: () => Promise.resolve(undefined),
      delete: () => Promise.resolve(undefined),
    });
    const { container, unmount } = renderComponent();
    const radioInputs = container.querySelectorAll('input[type="radio"]');
    expect(radioInputs.length).toBe(0);
    unmount();
  });

  it("should display user preferences options if iTwinConfig is defined AND option is ON", () => {
    vi.spyOn(MapLayersUI, 'iTwinConfig', 'get').mockReturnValue({
      get: () => Promise.resolve(undefined),
      save: () => Promise.resolve(undefined),
      delete: () => Promise.resolve(undefined),
    });

    const { container, unmount } = render(
      <MapUrlDialog
        mapLayerOptions={{ showUserPreferencesStorageOptions: true }}
        activeViewport={viewportMock.object}
        onOkResult={mockModalUrlDialogOk}
      />
    );

    const radioInputs = container.querySelectorAll('input[type="radio"]');
    expect(radioInputs.length).toBe(2);
    unmount();
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

    const mockOnOkResult = vi.fn();

    vi.spyOn(MapLayerSource.prototype, "validateSource").mockResolvedValue({
      status: MapLayerSourceStatus.Valid,
      subLayers: sampleLayerSettings.subLayers
    });

    const { container, unmount } = render(
      <MapUrlDialog
        activeViewport={viewportMock.object}
        onOkResult={mockOnOkResult}
      />
    );

    const formatSelect = screen.getAllByRole('combobox')[0];
    await userEvent.click(formatSelect);

    const inputs = container.querySelectorAll('input');
    await userEvent.type(inputs[0], sampleLayerSettings.name);
    await userEvent.type(inputs[1], sampleLayerSettings.url);

    const okButton = container.querySelector(".map-layer-features-footer-button");
    expect(okButton).not.toBeNull();
    await userEvent.click(okButton!);

    await TestUtils.flushAsyncOperations();

    //TODO: Move this in AttachLayerPanel
    // const cloned = ImageMapLayerSettings.fromJSON({
    //   ...sampleLayerSettings.toJSON(),
    //   subLayers: [{ name: "subLayer1", visible: true }]
    // });

    // expect(displayStyleMock.object.attachMapLayer)
    //   .toHaveBeenCalledWith({
    //     settings: cloned,
    //     mapLayerIndex: {index: -1, isOverlay: false}
    //   });

    // expect(spyMessage).toHaveBeenCalledWith(
    //   new NotifyMessageDetails(OutputMessagePriority.Info, "Messages.MapLayerAttached")
    // );

    unmount();
  });
});
