/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./EmptyTree.css";

import { Anchor, Text } from "@stratakit/bricks";
import { Icon } from "@stratakit/foundations";
import { TreeWidget } from "../../../../TreeWidget.js";
import { useFocusedInstancesContext } from "../FocusedInstancesContext.js";

interface SearchEmptyTreeProps {
  base: string;
}

/** @internal */
export function TooManySearchMatches({ base }: SearchEmptyTreeProps) {
  return (
    <div className={"tw-search-empty-tree-container"}>
      <Text variant={"body-sm"}>{TreeWidget.translate(`${base}.search.tooManySearchMatches`)}</Text>
      <Text variant={"body-sm"}>{TreeWidget.translate(`${base}.search.tooManySearchMatchesRetry`)}</Text>
    </div>
  );
}

/** @internal */
export function NoSearchMatches({ base }: SearchEmptyTreeProps) {
  return (
    <div className={"tw-search-empty-tree-container"}>
      <Text variant={"body-sm"}>{TreeWidget.translate(`${base}.search.noMatches`)}</Text>
      <Text variant={"body-sm"}>{TreeWidget.translate(`${base}.search.noMatchesRetry`)}</Text>
    </div>
  );
}

/** @internal */
export function SearchUnknownError({ base }: SearchEmptyTreeProps) {
  return (
    <div className={"tw-search-empty-tree-container"}>
      <Text variant={"body-sm"}>{TreeWidget.translate(`${base}.search.unknownSearchError`)}</Text>
    </div>
  );
}

/** @internal */
export function TooManyInstancesFocused({ base }: SearchEmptyTreeProps) {
  const { toggle } = useFocusedInstancesContext();
  return (
    <Text variant="body-sm" className={"tw-search-empty-tree-container"}>
      {TreeWidget.translate(`${base}.search.tooManyInstancesFocused`)}
      <Anchor
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        render={<button />}
      >
        {TreeWidget.translate(`${base}.search.disableInstanceFocusMode`)}
      </Anchor>
    </Text>
  );
}

/** @internal */
export function UnknownInstanceFocusError({ base }: SearchEmptyTreeProps) {
  const { toggle } = useFocusedInstancesContext();
  return (
    <Text variant="body-sm" className={"tw-search-empty-tree-container"}>
      {TreeWidget.translate(`${base}.search.unknownInstanceFocusError`)}
      <Anchor
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        render={<button />}
      >
        {TreeWidget.translate(`${base}.search.disableInstanceFocusMode`)}
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
    <div className={"tw-search-empty-tree-container"}>
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
