/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { IModelApp, NoRenderApp, NotificationManager, OutputMessagePriority } from "@itwin/core-frontend";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { MapLayersUI } from "../mapLayers";
import { CopyActionButton } from "../ui/widget/CopyActionButton";
import { TestUtils } from "./TestUtils";

describe("CopyActionButton", () => {
  beforeAll(async () => {
    await NoRenderApp.startup({ notifications: new NotificationManager() });
    await TestUtils.initialize();
  });

  afterAll(async () => {
    TestUtils.terminateUiComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("toggles to copied state and disables the button temporarily on success", async () => {
    const onCopy = vi.fn().mockResolvedValue(undefined);
    const copyLabel = MapLayersUI.localization.getLocalizedString("mapLayers:FeatureInfoWidget.Copy");
    const copiedLabel = MapLayersUI.localization.getLocalizedString("mapLayers:FeatureInfoWidget.Copied");

    render(<CopyActionButton value="test-value" onCopy={onCopy} />);

    const copyButton = screen.getByRole("button", { name: copyLabel });
    expect(onCopy).toHaveBeenCalledTimes(0);

    await act(async () => {
      fireEvent.click(copyButton);
      await Promise.resolve();
    });

    expect(onCopy).toHaveBeenCalledWith("test-value");
    expect(onCopy).toHaveBeenCalledTimes(1);

    const copiedButton = await screen.findByRole("button", { name: copiedLabel });

    await act(async () => {
      fireEvent.click(copiedButton);
      await Promise.resolve();
    });
    expect(onCopy).toHaveBeenCalledTimes(1);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1300));
    });

    const resetButton = screen.getByRole("button", { name: copyLabel });
    await act(async () => {
      fireEvent.click(resetButton);
      await Promise.resolve();
    });
    expect(onCopy).toHaveBeenCalledTimes(2);
  });

  it("notifies user when copy fails", async () => {
    const onCopy = vi.fn().mockRejectedValue(new Error("copy failed"));
    const outputMessageSpy = vi.spyOn(IModelApp.notifications, "outputMessage");
    const copyLabel = MapLayersUI.localization.getLocalizedString("mapLayers:FeatureInfoWidget.Copy");
    const copyFailedMessage = MapLayersUI.localization.getLocalizedString("mapLayers:FeatureInfoWidget.CopyFailed");

    render(<CopyActionButton value="test-value" onCopy={onCopy} />);

    fireEvent.click(screen.getByRole("button", { name: copyLabel }));
    await Promise.resolve();

    expect(outputMessageSpy).toHaveBeenCalledTimes(1);
    const details = outputMessageSpy.mock.calls[0][0];
    expect(details.priority).toBe(OutputMessagePriority.Warning);
    expect(details.briefMessage).toBe(copyFailedMessage);
  });
});
