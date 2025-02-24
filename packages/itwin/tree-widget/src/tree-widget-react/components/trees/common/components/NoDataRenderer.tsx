/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Icon, Text } from "@itwin/itwinui-react/bricks";
import { TreeWidget } from "../../../../TreeWidget.js";

interface NoDataRendererProps {
  icon?: string;
}

/** @internal */
export function NoDataRenderer({ icon }: NoDataRendererProps) {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "0.75rem", gap: "0.5rem", flexDirection: "column" }}>
      {icon ? <Icon size="large" href={icon} /> : null}
      <Text style={{ textAlign: "center" }}>{TreeWidget.translate("baseTree.dataIsNotAvailable")}</Text>
    </div>
  );
}
