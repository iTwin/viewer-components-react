/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useMemo } from "react";
import { useReportingAction } from "../../../common/UseFeatureReporting";
import { useHierarchyVisibility } from "../UseHierarchyVisibility";
import { useMultiCheckboxHandler } from "../UseMultiCheckboxHandler";
import { createIModelAccess } from "../Utils";
import { BaseTree } from "./BaseTree";
import { TreeRenderer } from "./TreeRenderer";

import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { HierarchyVisibilityHandler } from "../UseHierarchyVisibility";
import type { ComponentPropsWithoutRef } from "react";

type BaseTreeProps = ComponentPropsWithoutRef<typeof BaseTree>;
type UseHierarchyVisibilityProps = Parameters<typeof useHierarchyVisibility>[0];
type VisibilityTreeProps = Omit<BaseTreeProps, "treeRenderer" | "imodelAccess"> &
  Omit<UseHierarchyVisibilityProps, "visibilityHandlerFactory"> & {
    visibilityHandlerFactory: (imodelAccess: ECClassHierarchyInspector) => HierarchyVisibilityHandler;
  };

/** @internal */
export function VisibilityTree({ visibilityHandlerFactory, ...props }: VisibilityTreeProps) {
  const { imodel, getSchemaContext } = props;
  const imodelAccess = useMemo(() => createIModelAccess({ imodel, getSchemaContext }), [imodel, getSchemaContext]);
  const { getCheckboxState, onCheckboxClicked } = useHierarchyVisibility({
    visibilityHandlerFactory: useCallback(() => visibilityHandlerFactory(imodelAccess), [visibilityHandlerFactory, imodelAccess]),
  });
  return (
    <BaseTree
      {...props}
      imodelAccess={imodelAccess}
      treeRenderer={(treeProps) => <VisibilityTreeRenderer {...treeProps} getCheckboxState={getCheckboxState} onCheckboxClicked={onCheckboxClicked} />}
    />
  );
}

type TreeRendererProps = ComponentPropsWithoutRef<typeof TreeRenderer>;

function VisibilityTreeRenderer({
  getCheckboxState,
  onCheckboxClicked: onClick,
  reportUsage,
  ...props
}: TreeRendererProps & ReturnType<typeof useHierarchyVisibility> & Pick<BaseTreeProps, "reportUsage">) {
  const { onCheckboxClicked } = useMultiCheckboxHandler({ rootNodes: props.rootNodes, isNodeSelected: props.isNodeSelected, onClick });
  const reportingOnCheckboxClicked = useReportingAction({ featureId: "visibility-change", action: onCheckboxClicked, reportUsage });

  const checkboxProps: TreeRendererProps["checkboxProps"] = useMemo(
    () => ({
      variant: "eyeball",
      getCheckboxState,
      onCheckboxClicked: reportingOnCheckboxClicked,
    }),
    [getCheckboxState, reportingOnCheckboxClicked],
  );

  return <TreeRenderer {...props} checkboxProps={checkboxProps} />;
}
