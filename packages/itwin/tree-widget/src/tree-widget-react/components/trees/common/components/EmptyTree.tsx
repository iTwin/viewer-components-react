/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./EmptyTree.css";
import { Anchor, Text } from "@stratakit/bricks";
import { Icon } from "@stratakit/foundations";
import { TreeWidget } from "../../../../TreeWidget.js";
import { useFocusedInstancesContext } from "../FocusedInstancesContext.js";

interface FilterEmptyTreeProps {
  base: string;
}

/** @internal */
export function TooManyFilterMatches({ base }: FilterEmptyTreeProps) {
  return (
    <div className={"tw-filter-empty-tree-container"}>
      <Text variant={"body-sm"}>{TreeWidget.translate(`${base}.filtering.tooManyFilterMatches`)}</Text>
      <Text variant={"body-sm"}>{TreeWidget.translate(`${base}.filtering.tooManyFilterMatchesRetry`)}</Text>
    </div>
  );
}

/** @internal */
export function NoFilterMatches({ base }: FilterEmptyTreeProps) {
  return (
    <div className={"tw-filter-empty-tree-container"}>
      <Text variant={"body-sm"}>{TreeWidget.translate(`${base}.filtering.noMatches`)}</Text>
      <Text variant={"body-sm"}>{TreeWidget.translate(`${base}.filtering.noMatchesRetry`)}</Text>
    </div>
  );
}

/** @internal */
export function FilterUnknownError({ base }: FilterEmptyTreeProps) {
  return (
    <div className={"tw-filter-empty-tree-container"}>
      <Text variant={"body-sm"}>{TreeWidget.translate(`${base}.filtering.unknownFilterError`)}</Text>
    </div>
  );
}

/** @internal */
export function TooManyInstancesFocused({ base }: FilterEmptyTreeProps) {
  const { toggle } = useFocusedInstancesContext();
  return (
    <div className={"tw-filter-empty-tree-container"}>
      <Text variant={"body-sm"}>{TreeWidget.translate(`${base}.filtering.tooManyInstancesFocused`)}</Text>
      <Anchor
        style={{ textDecoration: "underline" }}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
      >
        {TreeWidget.translate(`${base}.filtering.disableInstanceFocusMode`)}
      </Anchor>
    </div>
  );
}

/** @internal */
export function UnknownInstanceFocusError({ base }: FilterEmptyTreeProps) {
  const { toggle } = useFocusedInstancesContext();
  return (
    <div className={"tw-filter-empty-tree-container"}>
      <Text variant={"body-sm"}>{TreeWidget.translate(`${base}.filtering.unknownInstanceFocusError`)}</Text>
      <Anchor
        style={{ textDecoration: "underline" }}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
      >
        {TreeWidget.translate(`${base}.filtering.disableInstanceFocusMode`)}
      </Anchor>
    </div>
  );
}



interface EmptyTreeContentProps {
  icon?: string;
}

/** @internal */
export function EmptyTreeContent({ icon }: EmptyTreeContentProps) {
  return (
    <div className={"tw-empty-tree-container"}>
      {icon ? <Icon size="large" href={icon} /> : null}
      <Text variant={"body-sm"} style={{ textAlign: "center" }}>
        {TreeWidget.translate("baseTree.dataIsNotAvailable")}
      </Text>
    </div>
  );
}
