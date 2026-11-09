/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./EmptyTree.css";

import { Link, Typography } from "@mui/material";
import { Icon } from "@stratakit/mui";
import { useFocusedInstancesContext } from "../contexts/FocusedInstancesContext.js";
import { useTranslation } from "../contexts/LocalizationContext.js";

interface SearchEmptyTreeProps {
  base: "categoriesTree" | "modelsTree" | "classificationsTree";
}

/** @internal */
export function TooManySearchMatches({ base }: SearchEmptyTreeProps) {
  const translate = useTranslation();
  return (
    <div className={"tw-search-empty-tree-container"}>
      <Typography variant={"body-sm"}>{translate(`${base}.search.tooManySearchMatches`)}</Typography>
      <Typography variant={"body-sm"}>{translate(`${base}.search.tooManySearchMatchesRetry`)}</Typography>
    </div>
  );
}

/** @internal */
export function NoSearchMatches({ base }: SearchEmptyTreeProps) {
  const translate = useTranslation();
  return (
    <div className={"tw-search-empty-tree-container"}>
      <Typography variant={"body-sm"}>{translate(`${base}.search.noMatches`)}</Typography>
      <Typography variant={"body-sm"}>{translate(`${base}.search.noMatchesRetry`)}</Typography>
    </div>
  );
}

/** @internal */
export function SearchUnknownError({ base }: SearchEmptyTreeProps) {
  const translate = useTranslation();
  return (
    <div className={"tw-search-empty-tree-container"}>
      <Typography variant={"body-sm"}>{translate(`${base}.search.unknownSearchError`)}</Typography>
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
    <Typography variant="body-sm" className={"tw-search-empty-tree-container"}>
      {translate(`${base}.search.tooManyInstancesFocused`)}
      <Link
        render={<button />}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
      >
        {translate(`${base}.search.disableInstanceFocusMode`)}
      </Link>
    </Typography>
  );
}

/** @internal */
export function UnknownInstanceFocusError({ base }: FocusedInstancesErrorProps) {
  const translate = useTranslation();
  const { toggle } = useFocusedInstancesContext();
  return (
    <Typography variant="body-sm" className={"tw-search-empty-tree-container"}>
      {translate(`${base}.search.unknownInstanceFocusError`)}
      <Link
        render={<button />}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
      >
        {translate(`${base}.search.disableInstanceFocusMode`)}
      </Link>
    </Typography>
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
      <Typography variant={"body-sm"}>{translate(`${base}.subTree.${error}`)}</Typography>
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
      <Typography variant={"body-sm"} style={{ textAlign: "center" }}>
        {translate("baseTree.dataIsNotAvailable")}
      </Typography>
    </div>
  );
}
