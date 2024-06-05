/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { IEC3ConfigurationsClient, IEC3JobsClient, IOdataClient, IReportsClient } from "@itwin/insights-client";
import type { RenderResult } from "@testing-library/react";
import { act } from "@testing-library/react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import type { GetAccessTokenFn } from "../components/api/APIContext";
import { ApiContext } from "../components/api/APIContext";
import * as moq from "typemoq";
import { EC3Config } from "../components/EC3/EC3Config";

export interface RenderParameters {
  component: React.ReactNode;
  ec3ConfigurationsClient?: IEC3ConfigurationsClient;
  ec3JobsClient?: IEC3JobsClient;
  reportsClient?: IReportsClient;
  oDataClient?: IOdataClient;
  getAccessTokenFn?: GetAccessTokenFn;
  iTwinId?: string;
}

export const mockITwinId = "mockedITwinId";

export async function renderWithContext({
  component,
  ec3ConfigurationsClient,
  ec3JobsClient,
  reportsClient,
  oDataClient,
  getAccessTokenFn,
}: RenderParameters): Promise<RenderResult> {
  let result: RenderResult;
  await act(async () => {
    result = render(
      <ApiContext.Provider
        value={{
          reportsClient: reportsClient ?? moq.Mock.ofType<IReportsClient>().object,
          oDataClient: oDataClient ?? moq.Mock.ofType<IOdataClient>().object,
          ec3JobsClient: ec3JobsClient ?? moq.Mock.ofType<IEC3JobsClient>().object,
          ec3ConfigurationsClient: ec3ConfigurationsClient ?? moq.Mock.ofType<IEC3ConfigurationsClient>().object,
          config: new EC3Config({
            iTwinId: mockITwinId,
            clientId: "",
            redirectUri: "",
            getAccessToken: getAccessTokenFn ?? (async () => ""),
          }),
        }}
      >
        {component}
      </ApiContext.Provider>,
    );
  });
  return result!;
}

export async function simulateInput(rootElement: HTMLElement, text: string) {
  const input = rootElement.querySelector(".iui-select-button") as HTMLInputElement;
  await act(async () => {
    await userEvent.click(input);
  });
  const item = screen.getByText(text);
  await act(async () => {
    await userEvent.click(item);
  });
  expect(input.querySelector(".iui-content")).toHaveTextContent(text);
}

export async function simulateCombobox(rootElement: HTMLElement, text: string) {
  Element.prototype.scrollIntoView = jest.fn();
  const input = rootElement.querySelector(".iui-input") as HTMLInputElement;
  await act(async () => {
    fireEvent.focus(input);
  });
  const item = screen.getByText(text);
  await act(async () => {
    await userEvent.click(item);
  });
  expect(input.value).toEqual(text);
}

export async function simulateTextInput(rootElement: HTMLElement, text: string) {
  const input = rootElement as HTMLInputElement;
  await act(async () => {
    fireEvent.change(input, { target: { value: text } });
  });
  expect(input.value).toEqual(text);
}

export async function getComboboxOptions(rootElement: HTMLElement) {
  const input = rootElement.querySelector(".iui-input") as HTMLInputElement;
  await act(async () => {
    fireEvent.focus(input);
  });
  return document.querySelectorAll(".iui-menu-item");
}

export async function getInputOptions(rootElement: HTMLElement) {
  const input = rootElement.querySelector(".iui-select-button") as HTMLInputElement;
  await act(async () => {
    await userEvent.click(input);
  });
  return document.querySelectorAll(".iui-menu-item");
}

export async function simulateClick(button: HTMLElement) {
  await act(async () => {
    await userEvent.click(button);
  });
}
