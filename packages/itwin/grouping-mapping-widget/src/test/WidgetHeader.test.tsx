/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "../test/test-utils";
import { faker } from "@faker-js/faker";
import { WidgetHeader } from "../WidgetShell/WidgetHeader/WidgetHeader";

describe("Widget Header Component", () => {
  it("title renders", async () => {
    // Arrange
    const fakeTitle = faker.word.interjection();

    // Act
    render(<WidgetHeader title={fakeTitle} />);

    // Assert
    const title = screen.getByText(fakeTitle);
    expect(title).toHaveTextContent(fakeTitle);
  });

  it("header allows return callback", async () => {
    // Arrange
    const mockReturnFn = jest.fn();

    // Act
    const { user, container } = render(<WidgetHeader title="" returnFn={mockReturnFn} />);

    // Assert
    const returnBtn = container.getElementsByClassName("gmw-chevron")[0];
    await user.click(returnBtn);
    expect(mockReturnFn).toHaveBeenCalledTimes(1);
  });
});
