/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { EC3ConfigurationsClient, EC3JobsClient, IEC3ConfigurationsClient, IEC3JobsClient, IOdataClient, IReportsClient, ODataClient, ReportsClient } from "@itwin/insights-client";
import { fireEvent, render, RenderResult, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { ApiContext, GetAccessTokenFn } from "../components/api/APIContext"

export interface RenderParameters {
  component: React.ReactNode,
  ec3ConfigurationsClient?: IEC3ConfigurationsClient,
  ec3JobsClient?: IEC3JobsClient,
  reportsClient?: IReportsClient,
  oDataClient?: IOdataClient,
  getAccessTokenFn?: GetAccessTokenFn
}

export function renderWithContext({
  component, ec3ConfigurationsClient, ec3JobsClient, reportsClient, oDataClient, getAccessTokenFn
}: RenderParameters): RenderResult {
  return render(
    <ApiContext.Provider value={{
      reportsClient: reportsClient ?? new ReportsClient(),
      oDataClient: oDataClient ?? new ODataClient(),
      ec3JobsClient: ec3JobsClient ?? new EC3JobsClient(),
      ec3ConfigurationsClient: ec3ConfigurationsClient ?? new EC3ConfigurationsClient(),
      getAccessTokenFn: getAccessTokenFn ?? (async () => ""),
    }}>
      {component}
    </ApiContext.Provider>
  )
}

export async function simulateInput(rootElement: HTMLElement, text: string) {
  const input = rootElement.querySelector(".iui-select-button") as HTMLInputElement;
  await userEvent.click(input);
  const item = screen.getByText(text);
  await userEvent.click(item);
  expect(input.querySelector(".iui-content")).toHaveTextContent(text);
}

export async function simulateCombobox(rootElement: HTMLElement, text: string) {
  const input = rootElement.querySelector(".iui-input") as HTMLInputElement;
  fireEvent.focus(input);
  const item = screen.getByText(text);
  await userEvent.click(item);
  expect(input.value).toEqual(text);
}

export async function simulateTextInput(rootElement: HTMLElement, text: string) {
  const input = rootElement as HTMLInputElement;
  fireEvent.change(input, { target: { value: text } });
  expect(input.value).toEqual(text);
}

export function getComboboxOptions(rootElement: HTMLElement) {
  const input = rootElement.querySelector('.iui-input') as HTMLInputElement;
  fireEvent.focus(input);
  return document.querySelectorAll('.iui-menu-item');
}

export async function getInputOptions(rootElement: HTMLElement) {
  const input = rootElement.querySelector(".iui-select-button") as HTMLInputElement;
  await userEvent.click(input);
  return document.querySelectorAll(".iui-menu-item");
}
