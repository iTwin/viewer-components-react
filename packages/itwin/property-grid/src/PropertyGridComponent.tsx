/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useActiveIModelConnection } from "@itwin/appui-react";
import { MultiElementPropertyGrid } from "./components/MultiElementPropertyGrid";
import { PreferencesContextProvider } from "./PropertyGridPreferencesContext";

import type { MultiElementPropertyGridProps } from "./components/MultiElementPropertyGrid";
import type { PreferencesStorage } from "./api/PreferencesStorage";

/**
 * Props for `PropertyGridComponent`.
 * @public
 */
export interface PropertyGridComponentProps extends Omit<MultiElementPropertyGridProps, "imodel"> {
  /**
   * Custom storage that should be used for persisting preferences.
   * Defaults to `IModelAppUserPreferencesStorage` that uses `IModelApp.userPreferences`.
   */
  preferencesStorage?: PreferencesStorage;
}

/**
 * Component that renders `MultiElementPropertyGrid` if there is active iModel connection.
 * @public
 */
export function PropertyGridComponent({ preferencesStorage, ...props }: PropertyGridComponentProps) {
  const imodel = useActiveIModelConnection();
  if (!imodel) {
    return null;
  }

  return (
    <PreferencesContextProvider storage={preferencesStorage}>
      <MultiElementPropertyGrid {...props} imodel={imodel} />
    </PreferencesContextProvider>
  );
}
