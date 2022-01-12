/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ViewStateProps } from "@bentley/imodeljs-common";
import { EmphasizeElementsProps } from "@bentley/imodeljs-frontend";

/**
 * View State props with markup svg.
 */
export interface MarkupViewStateProps extends ViewStateProps {
  /** Emphasized Elements if any as JSON */
  emphasizedElementsProps?: EmphasizeElementsProps;
  /**
   * Markup SVG if any as string
   * @todo add geo location of SVG with respect to the viewer in future.
   */
  markup?: string;
}