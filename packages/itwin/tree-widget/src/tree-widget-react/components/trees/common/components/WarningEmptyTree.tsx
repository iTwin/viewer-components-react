/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./WarningEmptyTree.css";
import { Icon, Text } from "@itwin/itwinui-react/bricks";
import { TreeWidget } from "../../../../TreeWidget.js";

interface WarningProps {
  base: string;
}

/** @internal */
export function TooManyFilterMatches({ base }: WarningProps) {
  return (
    <div className={"tw-filter-warning-container"}>
      <Text variant={"body-sm"}>{TreeWidget.translate(`${base}.filtering.tooManyFilterMatches`)}</Text>
      <Text variant={"body-sm"}>{TreeWidget.translate(`${base}.filtering.tooManyFilterMatchesRetry`)}</Text>
    </div>
  );
}

/** @internal */
export function NoFilterMatches({ base }: WarningProps) {
  return (
    <div className={"tw-filter-warning-container"}>
      <Text variant={"body-sm"}>{TreeWidget.translate(`${base}.filtering.noMatches`)}</Text>
      <Text variant={"body-sm"}>{TreeWidget.translate(`${base}.filtering.noMatchesRetry`)}</Text>
    </div>
  );
}

/** @internal */
export function FilterUnknownError({ base }: WarningProps) {
  return (
    <div className={"tw-filter-warning-container"}>
      <Text variant={"body-sm"}>{TreeWidget.translate(`${base}.filtering.unknownFilterError`)}</Text>
    </div>
  );
}

interface EmptyTreeContentProps {
  icon?: string;
}

/** @internal */
export function EmptyTreeContent({ icon }: EmptyTreeContentProps) {
  return (
    <div className={"tw-empty-tree-warning-container"}>
      {icon ? <Icon size="large" href={icon} /> : null}
      <Text variant={"body-sm"} style={{ textAlign: "center" }}>
        {TreeWidget.translate("baseTree.dataIsNotAvailable")}
      </Text>
    </div>
  );
}
