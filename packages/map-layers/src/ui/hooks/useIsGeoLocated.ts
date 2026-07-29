/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { ScreenViewport } from "@itwin/core-frontend";
import React from "react";

export const useIsGeoLocated = (activeViewport: ScreenViewport | undefined) => {
  const [isGeoLocated, setIsGeoLocated] = React.useState(!!activeViewport?.iModel.isGeoLocated);
  React.useEffect(() => {
       const updateIsGeoLocated = () => setIsGeoLocated(!!activeViewport?.iModel.isGeoLocated);
    // call immediately in case the activeViewport changes after its iModel.onEcefLocationChanged has already emitted
    updateIsGeoLocated();
    return activeViewport?.iModel.onEcefLocationChanged.addListener(updateIsGeoLocated);
  }, [activeViewport?.iModel]);

  return isGeoLocated;
};
