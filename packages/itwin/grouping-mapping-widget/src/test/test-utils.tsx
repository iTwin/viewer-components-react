/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render as rtlRender } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { IMappingsClient } from "@itwin/insights-client";
import type { GroupingMappingCustomUI } from "../grouping-mapping-widget";
import * as moq from "typemoq";
import type { GroupingMappingContextProps } from "../widget/components/GroupingMappingContext";
import { GroupingMappingContext } from "../widget/components/GroupingMappingContext";

export const mockAccessToken = async () => "Bearer eyJhbGci";
export const mockMappingClient = moq.Mock.ofType<IMappingsClient>();

interface WrapperProps {
  children?: React.ReactNode;
}

function render(ui: React.ReactElement, mockUIs: GroupingMappingCustomUI[] = [], { ...options } = {}) {
  const contextProps: GroupingMappingContextProps = {
    getAccessToken: mockAccessToken,
    iModelId: "mock",
    customUIs: mockUIs,
  };
  const Wrapper = ({ children }: WrapperProps) => (
    <GroupingMappingContext {...contextProps}>
      {children}
    </GroupingMappingContext>
  );

  return {
    user: userEvent.setup(),
    ...rtlRender(ui, { wrapper: Wrapper, ...options }),
  };
}

export * from "@testing-library/react";
// override React Testing Library's render with our own
export { render };
