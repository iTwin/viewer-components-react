/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { Configuration } from "./EC3/Template";
import type { EC3ConfigPropsWithCallbacks } from "./EC3/EC3Config";

export type TemplateProps = Omit<EC3ConfigPropsWithCallbacks, "iTwinId" | "clientId"> & {
  onClickCreate?: () => void;
  onClickTemplateTitle?: (template: Configuration) => void;
};
