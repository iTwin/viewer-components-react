/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render as rtlRender } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReportsConfigContextProps } from "../widget/components/ReportsConfigContext";
import { ReportsConfigContext } from "../widget/components/ReportsConfigContext";

export const mockAccessToken = async () => "Bearer eyJhbGci";

interface WrapperProps {
  children?: React.ReactNode;
}
export const mockITwinId: string = "mockiTwinId";

function render(ui: React.ReactElement, contextProps?: Partial<ReportsConfigContextProps>, { ...options } = {}) {
  const Wrapper = ({ children }: WrapperProps) => (
    <ReportsConfigContext
      getAccessToken={mockAccessToken}
      iTwinId={contextProps?.iTwinId ?? mockITwinId}
      {...contextProps}
    >
      {children}
    </ReportsConfigContext>
  );

  return {
    user: userEvent.setup(),
    ...rtlRender(ui, { wrapper: Wrapper, ...options }),
  };
}

export * from "@testing-library/react";
// override React Testing Library's render with our own
export { render };
