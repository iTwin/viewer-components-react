/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render as rtlRender } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReportsConfigContextProps } from "../widget/components/ReportsConfigContext";
import { ReportsConfigContext } from "../widget/components/ReportsConfigContext";
import { IModelState } from "@itwin/imodels-client-management";

export const mockAccessToken = async () => "Bearer eyJhbGci";

export const mockIModelId1 = "mockIModelId1";
export const mockIModelId2 = "mockIModelId2";

export const mockMappingId1 = "mockMappingId1";
export const mockMappingId2 = "mockMappingId2";

export const mockReportId = "mockReportId";
export const mockITwinId: string = "mockiTwinId";

export const mockIModelsResponse = [
  {
    iModel: {
      id: mockIModelId1,
      displayName: "rAnDoMdIsPlAynAmE1",
      name: "rAnDomName1",
      description: "rAnDoMDeScRiPtIoN1",
      createdDateTime: "2021-10-04T22:13:50.397Z",
      state: IModelState.Initialized,
      iTwinId: mockITwinId,
      extent: null,
      getCreator: async () => undefined,
      _links: {
        creator: {
          href: "",
        },
        namedVersions: {
          href: "",
        },
        changesets: {
          href: "",
        },
        upload: undefined,
        complete: undefined,
      },
    },
  },
  {
    iModel: {
      id: mockIModelId2,
      displayName: "rAnDoMdIsPlAynAmE2",
      name: "rAnDomName2",
      description: "rAnDoMDeScRiPtIoN2",
      createdDateTime: "2021-10-04T22:13:50.397Z",
      state: IModelState.Initialized,
      iTwinId: mockITwinId,
      extent: null,
      getCreator: async () => undefined,
      _links: {
        creator: {
          href: "",
        },
        namedVersions: {
          href: "",
        },
        changesets: {
          href: "",
        },
        upload: undefined,
        complete: undefined,
      },
    },
  },
];

export const mockExtractionRequestDetails = [
  {
    iModelId: mockIModelId1,
    mappings: [{ id: mockMappingId1 }],
  },
  {
    iModelId: mockIModelId2,
    mappings: [{ id: mockMappingId2 }],
  },
];

interface WrapperProps {
  children?: React.ReactNode;
}

function render(ui: React.ReactElement, contextProps?: Partial<ReportsConfigContextProps>, { ...options } = {}) {
  const Wrapper = ({ children }: WrapperProps) => (
    <ReportsConfigContext getAccessToken={mockAccessToken} iTwinId={contextProps?.iTwinId ?? mockITwinId} {...contextProps}>
      {children}
    </ReportsConfigContext>
  );

  return {
    user: userEvent.setup(),
    ...rtlRender(ui, { wrapper: Wrapper, ...options }),
  };
}

// Re-export everything from @testing-library/react except render
export { act, cleanup, fireEvent, screen, waitFor, waitForElementToBeRemoved, within } from "@testing-library/react";
export { render };
