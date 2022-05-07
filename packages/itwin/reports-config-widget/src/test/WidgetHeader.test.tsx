/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "../test/test-utils";
import { WidgetHeader } from "../widget/components/utils";
import { faker } from "@faker-js/faker";

describe("Widget Header Component", () => {
  it("title renders", async () => {
    const fakeTitle = faker.word.interjection();
    render(<WidgetHeader title={fakeTitle} />);

    const title = screen.getByText(fakeTitle);

    expect(title).toHaveTextContent(fakeTitle);
  });

  it("header allows return callback", async () => {
    const mockReturnFn = jest.fn();
    const { user } = render(
      <WidgetHeader title="" returnFn={mockReturnFn} />
    );

    const returnBtn = screen.getByRole("button");
    await user.click(returnBtn);
    expect(mockReturnFn).toHaveBeenCalledTimes(1);
  });
});
