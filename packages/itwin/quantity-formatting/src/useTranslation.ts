/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { QuantityFormatting } from "./QuantityFormatting.js";
import { useCallback } from "react";

/**
 * Hook for accessing localized strings in quantity formatting components.
 * Uses the QuantityFormatting.localization static instance.
 */
export function useTranslation() {
  const translate = useCallback((key: string): string => {
    // Key already includes the namespace prefix (e.g., "QuantityFormat:labels.samplePreview")
    return QuantityFormatting.localization.getLocalizedString(key);
  }, []); // Empty dependency array since QuantityFormatting.localization is static

  return { translate };
}
