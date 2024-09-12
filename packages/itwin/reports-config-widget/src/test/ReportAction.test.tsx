/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import faker from "@faker-js/faker";
import "@testing-library/jest-dom";
import { ReportsConfigWidget } from "../ReportsConfigWidget";
import { render, screen, waitForElementToBeRemoved } from "./test-utils";
import { ReportAction } from "../widget/components/ReportAction";
import userEvent from "@testing-library/user-event";
import { EmptyLocalization } from "@itwin/core-common";
import type { Report } from "@itwin/insights-client";
import { ReportsClient } from "@itwin/insights-client";

beforeAll(async () => {
  const localization = new EmptyLocalization();
  await ReportsConfigWidget.initialize(localization);
});

describe("Reports Action", () => {
  it("required fields should be filled out", async () => {
    const mockReturnFn = jest.fn();

    render(<ReportAction onClickCancel={jest.fn()} onSaveSuccess={mockReturnFn} />);

    const addButton = screen.getByRole("button", {
      name: /add/i,
    });
    const cancelButton = screen.getByRole("button", {
      name: /cancel/i,
    });

    expect(cancelButton).toBeEnabled();
    expect(addButton).toBeDisabled();
  });

  it("should be able to add report", async () => {
    const mockReturnFn = jest.fn();
    const mockReport: Report = {
      id: faker.datatype.uuid(),
      displayName: "mOcKRePoRt1",
      description: "",
      deleted: false,
      _links: {
        project: {
          href: "",
        },
        odata: {
          href: "",
        },
      },
    };

    const reportsClient = new ReportsClient();

    jest.spyOn(reportsClient, "createReport").mockImplementation(
      async () =>
        new Promise((resolve) =>
          setTimeout(() => {
            resolve(mockReport);
          }, 100),
        ),
    );

    const { user } = render(<ReportAction onClickCancel={jest.fn()} onSaveSuccess={mockReturnFn} />, { reportsClient });

    const addButton = screen.getByRole("button", {
      name: /add/i,
    });
    const cancelButton = screen.getByRole("button", {
      name: /cancel/i,
    });
    const nameInput = screen.getByRole("textbox", {
      name: /name/i,
    });
    const descriptionInput = screen.getByRole("textbox", {
      name: /description/i,
    });

    await userEvent.type(nameInput, "mOcKTeXt");
    await userEvent.type(descriptionInput, "moCk DeScRiPtIoN");
    expect(cancelButton).toBeEnabled();
    expect(addButton).toBeEnabled();

    await user.click(addButton);

    expect(addButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
    expect(nameInput).toBeDisabled();

    await waitForElementToBeRemoved(() => screen.getByTestId(/loading\-spinner/i));

    expect(mockReturnFn).toHaveBeenCalledTimes(1);
  });

  it("No duplicate underscores in the beginning of name", async () => {
    const mockReturnFn = jest.fn();

    const { user } = render(<ReportAction onClickCancel={jest.fn()} onSaveSuccess={mockReturnFn} />);

    const addButton = screen.getByRole("button", {
      name: /add/i,
    });

    const nameInput = screen.getByRole("textbox", {
      name: /name/i,
    });

    await userEvent.type(nameInput, "__testName");
    await user.click(addButton);
    expect(screen.getByText(/validators\.noduplicateunderscore/i)).toBeInTheDocument();
  });

  it("Only begin with letters or underscores of name", async () => {
    const mockReturnFn = jest.fn();

    const { user } = render(<ReportAction onClickCancel={jest.fn()} onSaveSuccess={mockReturnFn} />);

    const addButton = screen.getByRole("button", {
      name: /add/i,
    });

    const nameInput = screen.getByRole("textbox", {
      name: /name/i,
    });

    await userEvent.type(nameInput, "$testName");
    await user.click(addButton);
    expect(screen.getByText(/validators\.onlybeginswithletterorunderscore/i)).toBeInTheDocument();
  });

  it("Only letters underscores and digits of name", async () => {
    const mockReturnFn = jest.fn();

    const { user } = render(<ReportAction onClickCancel={jest.fn()} onSaveSuccess={mockReturnFn} />);

    const addButton = screen.getByRole("button", {
      name: /add/i,
    });

    const nameInput = screen.getByRole("textbox", {
      name: /name/i,
    });

    await userEvent.type(nameInput, "_# ");
    await user.click(addButton);
    expect(screen.getByText(/validators\.FollowedByLettersUnderscoresSpacesAndDigits/i)).toBeInTheDocument();
  });

  it("check for character limits of name", async () => {
    const mockReturnFn = jest.fn();

    const { user } = render(<ReportAction onClickCancel={jest.fn()} onSaveSuccess={mockReturnFn} />);

    const addButton = screen.getByRole("button", {
      name: /add/i,
    });

    const nameInput = screen.getByRole("textbox", {
      name: /name/i,
    });

    await userEvent.type(nameInput, faker.random.alpha(200));
    await user.click(addButton);
    expect(screen.getByText(/validators\.charlimit/i)).toBeInTheDocument();
  });
});
