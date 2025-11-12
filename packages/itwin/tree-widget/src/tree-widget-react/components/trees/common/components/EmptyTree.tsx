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
    <Text variant="body-sm" className={"tw-filter-empty-tree-container"}>
      {TreeWidget.translate(`${base}.filtering.tooManyInstancesFocused`)}
      <Anchor
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        render={<button />}
      >
        {TreeWidget.translate(`${base}.filtering.disableInstanceFocusMode`)}
      </Anchor>
    </Text>
  );
}

/** @internal */
export function UnknownInstanceFocusError({ base }: FilterEmptyTreeProps) {
  const { toggle } = useFocusedInstancesContext();
  return (
    <Text variant="body-sm" className={"tw-filter-empty-tree-container"}>
      {TreeWidget.translate(`${base}.filtering.unknownInstanceFocusError`)}
      <Anchor
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        render={<button />}
      >
        {TreeWidget.translate(`${base}.filtering.disableInstanceFocusMode`)}
      </Anchor>
    </Text>
  );
}

interface SubTreeErrorProps {
  base: string;
  error: string;
}

/** @internal */
export function SubTreeError({ base, error }: SubTreeErrorProps) {
  return (
    <div className={"tw-filter-empty-tree-container"}>
      <Text variant={"body-sm"}>{TreeWidget.translate(`${base}.subTree.${error}`)}</Text>
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
