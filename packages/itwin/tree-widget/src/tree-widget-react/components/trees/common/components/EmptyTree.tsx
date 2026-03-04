/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./EmptyTree.css";

import { Anchor, Text } from "@stratakit/bricks";
import { Icon } from "@stratakit/foundations";
import { useFocusedInstancesContext } from "../FocusedInstancesContext.js";
import { useTranslation } from "./LocalizationContext.js";

interface SearchEmptyTreeProps {
  base: "categoriesTree" | "modelsTree" | "classificationsTree";
}

/** @internal */
export function TooManySearchMatches({ base }: SearchEmptyTreeProps) {
  const translate = useTranslation();
  return (
    <div className={"tw-search-empty-tree-container"}>
      <Text variant={"body-sm"}>{translate(`${base}.search.tooManySearchMatches`)}</Text>
      <Text variant={"body-sm"}>{translate(`${base}.search.tooManySearchMatchesRetry`)}</Text>
    </div>
  );
}

/** @internal */
export function NoSearchMatches({ base }: SearchEmptyTreeProps) {
  const translate = useTranslation();
  return (
    <div className={"tw-search-empty-tree-container"}>
      <Text variant={"body-sm"}>{translate(`${base}.search.noMatches`)}</Text>
      <Text variant={"body-sm"}>{translate(`${base}.search.noMatchesRetry`)}</Text>
    </div>
  );
}

/** @internal */
export function SearchUnknownError({ base }: SearchEmptyTreeProps) {
  const translate = useTranslation();
  return (
    <div className={"tw-search-empty-tree-container"}>
      <Text variant={"body-sm"}>{translate(`${base}.search.unknownSearchError`)}</Text>
    </div>
  );
}

interface FocusedInstancesErrorProps {
  base: "modelsTree";
}

/** @internal */
export function TooManyInstancesFocused({ base }: FocusedInstancesErrorProps) {
  const translate = useTranslation();
  const { toggle } = useFocusedInstancesContext();
  return (
    <Text variant="body-sm" className={"tw-search-empty-tree-container"}>
      {translate(`${base}.search.tooManyInstancesFocused`)}
      <Anchor
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        render={<button />}
      >
        {translate(`${base}.search.disableInstanceFocusMode`)}
      </Anchor>
    </Text>
  );
}

/** @internal */
export function UnknownInstanceFocusError({ base }: FocusedInstancesErrorProps) {
  const translate = useTranslation();
  const { toggle } = useFocusedInstancesContext();
  return (
    <Text variant="body-sm" className={"tw-search-empty-tree-container"}>
      {translate(`${base}.search.unknownInstanceFocusError`)}
      <Anchor
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        render={<button />}
      >
        {translate(`${base}.search.disableInstanceFocusMode`)}
      </Anchor>
    </Text>
  );
}

interface SubTreeErrorProps {
  base: "modelsTree";
  error: "unknownSubTreeError";
}

/** @internal */
export function SubTreeError({ base, error }: SubTreeErrorProps) {
  const translate = useTranslation();
  return (
    <div className={"tw-search-empty-tree-container"}>
      <Text variant={"body-sm"}>{translate(`${base}.subTree.${error}`)}</Text>
    </div>
  );
}

interface EmptyTreeContentProps {
  icon?: string;
}

/** @internal */
export function EmptyTreeContent({ icon }: EmptyTreeContentProps) {
  const translate = useTranslation();
  return (
    <div className={"tw-empty-tree-container"}>
      {icon ? <Icon size="large" href={icon} /> : null}
      <Text variant={"body-sm"} style={{ textAlign: "center" }}>
        {translate("baseTree.dataIsNotAvailable")}
      </Text>
    </div>
  );
}
