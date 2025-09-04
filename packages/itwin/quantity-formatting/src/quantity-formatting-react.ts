/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

/**
 * @packageDocumentation
 * @module QuantityFormatting
 */

// Export main class for localization initialization
export { QuantityFormatting } from "./QuantityFormatting.js";

// Export API classes
export {
  FormatManager,
  FormatSetFormatsProvider,
  type FormatManagerInitializeOptions,
  type FormatSetChangedEventArgs,
  type OnIModelOpenOptions,
} from "./api/FormatManager.js";

// Export utility functions
export {
  getUsedKindOfQuantitiesFromIModel
} from "./api/Utils.js";

// Export React components here
export { QuantityFormatPanel } from "./components/quantityformat/QuantityFormatPanel.js";
export { FormatSample } from "./components/quantityformat/FormatSample.js";
export { FormatPanel } from "./components/quantityformat/FormatPanel.js";
export { FormatSelector } from "./components/quantityformat/FormatSelector.js";
