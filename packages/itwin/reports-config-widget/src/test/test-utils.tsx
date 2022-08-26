/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render as rtlRender } from "@testing-library/react";
import { ReportsApiConfigContext } from "../widget/context/ReportsApiConfigContext";
import type { Store } from "redux";
import { combineReducers, createStore } from "redux";
import {
  FrameworkReducer,
  SyncUiEventDispatcher,
  UiFramework,
} from "@itwin/appui-react";
import type { IModelConnection } from "@itwin/core-frontend";
import { ReportsConfigWidget } from "../ReportsConfigWidget";
import userEvent from "@testing-library/user-event";
import { REPORTS_CONFIG_BASE_URL } from "../widget/ReportsConfigUiProvider";

export const mockAccessToken = async () => "Bearer eyJhbGci";

interface WrapperProps {
  children?: React.ReactNode;
}

function render(ui: React.ReactElement, { ...options } = {}) {
  const Wrapper = ({ children }: WrapperProps) => (
    <ReportsApiConfigContext.Provider
      value={{
        getAccessToken: mockAccessToken,
        baseUrl: REPORTS_CONFIG_BASE_URL,
      }}
    >
      {children}
    </ReportsApiConfigContext.Provider>
  );

  return {
    user: userEvent.setup(),
    ...rtlRender(ui, { wrapper: Wrapper, ...options }),
  };
}

export * from "@testing-library/react";
// override React Testing Library's render with our own
export { render };

export class TestUtils {
  public static createAppStore(): Store {
    const rootReducer = combineReducers({
      frameworkState: FrameworkReducer,
    });

    return createStore(
      rootReducer,
      (window as any).__REDUX_DEVTOOLS_EXTENSION__ &&
      (window as any).__REDUX_DEVTOOLS_EXTENSION__()
    );
  }

  public static async initializeUiFramework(_?: IModelConnection) {
    const store = this.createAppStore();

    await UiFramework.initialize(store);

    // Set the iModelConnection in the Redux store
    // Can not get it to function as intended. Store does not update with the iModel connection
    // if (imodel)
    //   UiFramework.setIModelConnection(imodel);

    SyncUiEventDispatcher.setTimeoutPeriod(0); // disables non-immediate event processing.
  }

  public static terminateUiFramework() {
    ReportsConfigWidget.terminate();
  }
}
