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
import type { GroupingMappingContextProps } from "../components/GroupingMappingContext";
import { GroupingMappingContext } from "../components/GroupingMappingContext";
import { QueryClient } from "@tanstack/react-query";

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
    queryClient: new QueryClient({
      defaultOptions: {
        queries: {
          refetchOnWindowFocus: false,
        },
      },
    }),
  };
  const Wrapper = ({ children }: WrapperProps) => <GroupingMappingContext {...contextProps}>{children}</GroupingMappingContext>;

  return {
    user: userEvent.setup(),
    ...rtlRender(ui, { wrapper: Wrapper, ...options }),
  };
}

// Re-export everything from @testing-library/react EXCEPT render,
// then export our custom render which wraps components in GroupingMappingContext.
export {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from "@testing-library/react";
export { render };
