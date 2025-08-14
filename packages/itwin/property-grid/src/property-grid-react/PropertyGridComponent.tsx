/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useActiveIModelConnection } from "@itwin/appui-react";
import { SchemaMetadataContextProvider } from "@itwin/presentation-components";
import { MultiElementPropertyGrid } from "./components/MultiElementPropertyGrid.js";
import { TelemetryContextProvider } from "./hooks/UseTelemetryContext.js";
import { PreferencesContextProvider } from "./PropertyGridPreferencesContext.js";

import type { TelemetryContextProviderProps } from "./hooks/UseTelemetryContext.js";
import type { MultiElementPropertyGridProps } from "./components/MultiElementPropertyGrid.js";
import type { PreferencesStorage } from "./api/PreferencesStorage.js";
import type { IModelConnection } from "@itwin/core-frontend";

/**
 * Props for `PropertyGridComponent`.
 * @public
 */
export interface PropertyGridComponentProps extends Omit<MultiElementPropertyGridProps, "imodel">, TelemetryContextProviderProps {
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
export function PropertyGridComponent({ preferencesStorage, onPerformanceMeasured, onFeatureUsed, ...props }: PropertyGridComponentProps) {
  const imodel = useActiveIModelConnection();
  if (!imodel) {
    return null;
  }

  return (
    <SchemaMetadataContextProvider imodel={imodel} schemaContextProvider={getSchemaContext}>
      <TelemetryContextProvider onPerformanceMeasured={onPerformanceMeasured} onFeatureUsed={onFeatureUsed}>
        <PreferencesContextProvider storage={preferencesStorage}>
          <MultiElementPropertyGrid {...props} imodel={imodel} />
        </PreferencesContextProvider>
      </TelemetryContextProvider>
    </SchemaMetadataContextProvider>
  );
}

function getSchemaContext(imodel: IModelConnection) {
  return imodel.schemaContext;
}
