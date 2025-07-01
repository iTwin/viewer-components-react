/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Icon } from "@stratakit/foundations";
import icon2d from "@stratakit/icons/2d.svg";
import icon3d from "@stratakit/icons/3d.svg";
import iconBisDefinitionsContainer from "@stratakit/icons/bis-definitions-container.svg";
import iconBisElement from "@stratakit/icons/bis-element.svg";

import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";

/** @beta */
export function ClassificationsTreeIcon({ node }: { node: PresentationHierarchyNode }) {
  if (node.nodeData.extendedData?.type === undefined) {
    return undefined;
  }

  const getIcon = () => {
    // FIXME: icons...
    switch (node.nodeData.extendedData!.type) {
      case "ClassificationTable":
        return iconBisDefinitionsContainer;
      case "Classification":
        return iconBisDefinitionsContainer;
      case "GeometricElement3d":
        return icon3d;
      case "GeometricElement2d":
        return icon2d;
      default:
        return iconBisElement;
    }
  };

  return <Icon href={getIcon()} />;
}
