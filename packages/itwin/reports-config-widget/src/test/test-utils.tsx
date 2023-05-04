/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render as rtlRender } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReportsConfigContext } from "../widget/components/ReportsConfigContext";
import type { BulkExtractor } from "../widget/components/BulkExtractor";

export const mockAccessToken = async () => "Bearer eyJhbGci";

interface WrapperProps {
  children?: React.ReactNode;
}

function render(ui: React.ReactElement, contextProps?: { iModelId?: string, iTwinId?: string, bulkExtractor?: BulkExtractor }, { ...options } = {}) {
  const Wrapper = ({ children }: WrapperProps) => (
    <ReportsConfigContext
      getAccessToken={mockAccessToken}
      iTwinId={contextProps?.iTwinId ?? "mockiTwinId"}
      iModelId={contextProps?.iModelId ?? "mockiModelId"}
      bulkExtractor={contextProps?.bulkExtractor}
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
