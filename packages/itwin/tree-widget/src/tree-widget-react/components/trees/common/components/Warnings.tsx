/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./Warnings.css";
import { Text } from "@itwin/itwinui-react/bricks";
import { TreeWidget } from "../../../../TreeWidget.js";

export interface WarningProps {
  base: string;
}

export function WarningTooManyFilterMatches({ base }: WarningProps) {
  return (
    <div className={"tw-filter-warning-container"}>
      <Text variant={"body-md"}>{TreeWidget.translate(`${base}.filtering.tooManyFilterMatches`)}</Text>
      <Text variant={"body-md"}>{TreeWidget.translate(`${base}.filtering.tooManyFilterMatchesRetry`)}</Text>
    </div>
  );
}

export function WarningNoMatches({ base }: WarningProps) {
  return (
    <div className={"tw-filter-warning-container"}>
      <Text variant={"body-md"}>{TreeWidget.translate(`${base}.filtering.noMatches`)}</Text>
      <Text variant={"body-md"}>{TreeWidget.translate(`${base}.filtering.noMatchesRetry`)}</Text>
    </div>
  );
}

export function WarningFilterUnknown({ base }: WarningProps) {
  return (
    <div className={"tw-filter-warning-container"}>
      <Text variant={"body-md"}>{TreeWidget.translate(`${base}.filtering.unknownFilterError`)}</Text>
    </div>
  );
}
