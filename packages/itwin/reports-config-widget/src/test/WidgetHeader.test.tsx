/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { vi } from "vitest";
import { render, screen } from "../test/test-utils";
import { WidgetHeader } from "../widget/components/utils";
import { faker } from "@faker-js/faker";
import { EmptyLocalization } from "@itwin/core-common";
import { ReportsConfigWidget } from "../ReportsConfigWidget";

describe("Widget Header Component", () => {
  beforeAll(async () => {
    const localization = new EmptyLocalization();
    await ReportsConfigWidget.initialize(localization);
  });

  it("title renders", async () => {
    const fakeTitle = faker.word.interjection();
    render(<WidgetHeader title={fakeTitle} />);

    const title = screen.getByText(fakeTitle);

    expect(title).toHaveTextContent(fakeTitle);
  });

  it("header allows return callback", async () => {
    const mockReturnFn = vi.fn();
    const { user, container } = render(<WidgetHeader title="" returnFn={mockReturnFn} />);

    const returnBtn = container.getElementsByClassName("rcw-chevron")[0];
    await user.click(returnBtn);
    expect(mockReturnFn).toHaveBeenCalledTimes(1);
  });
});
