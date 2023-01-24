/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import { GroupAction } from "./GroupAction";
import { Groupings } from "./Grouping";
import type { Route } from "./GroupingMapping";
import { RouteStep } from "./GroupingMapping";
import { Mappings } from "./Mapping";
import { MappingAction } from "./MappingAction";
import { PropertyMenu } from "./PropertyMenu";

export const GroupingMappingRouter = ({
  currentRoute,
  navigateTo,
  goBack,
}: {
  currentRoute: Route;
  navigateTo: (toRoute: (prev: Route | undefined) => Route) => void;
  goBack: () => void;
}) => {
  const { iModelId } = useGroupingMappingApiConfig();
  const { mapping, group, groupContextCustomUI, queryGenerationType } = currentRoute.groupingRouteFields;

  switch (currentRoute.step) {
    case RouteStep.Mappings:
      return (
        <Mappings
          onClickAddMapping={() =>
            navigateTo(() => ({ step: RouteStep.MappingsAction, title: "Add Mapping", groupingRouteFields: {} }))
          }
          onClickMappingTitle={(mapping) => {
            navigateTo(() => ({
              step: RouteStep.Groups,
              groupingRouteFields: { mapping },
              title: mapping.mappingName,
            }));
          }}
          onClickMappingModify={(mapping) => {
            navigateTo(() => ({
              step: RouteStep.MappingsAction,
              groupingRouteFields: { mapping },
              title: mapping.mappingName,
            }));
          }}
        />);
    case RouteStep.MappingsAction:
      return (<MappingAction mapping={mapping} onClickCancel={goBack} onSaveSuccess={goBack} />);
    case RouteStep.Groups:
      if (mapping) {
        return (
          <Groupings
            mapping={mapping}
            onClickAddGroup={(qType) =>
              navigateTo((prev) => ({
                step: RouteStep.GroupAction,
                groupingRouteFields: { ...prev?.groupingRouteFields, queryGenerationType: qType },
                title: "Add Group",
              }))
            }
            onClickGroupTitle={(g) =>
              navigateTo((prev) => ({
                step: RouteStep.Properties,
                title: g.groupName,
                groupingRouteFields: { ...prev?.groupingRouteFields, group: g },
              }))
            }
            onClickGroupModify={(g, qType) =>
              navigateTo((prev) => ({
                step: RouteStep.GroupAction,
                title: g.groupName,
                groupingRouteFields: { ...prev?.groupingRouteFields, group: g, queryGenerationType: qType },
              }))
            }
            onClickRenderContextCustomUI={(ccUI, g) =>
              navigateTo((prev) => ({
                step: RouteStep.GroupAction,
                title: ccUI.displayName ?? "",
                groupingRouteFields: { ...prev?.groupingRouteFields, group: g, groupContextCustomUI: ccUI },
              }))
            }
          />
        );
      }
      return null;
    case RouteStep.GroupAction:
      if (mapping) {
        if (queryGenerationType) {
          return (
            <GroupAction
              mappingId={mapping.id}
              group={group}
              onClickCancel={goBack}
              onSaveSuccess={goBack}
              queryGenerationType={queryGenerationType}
            />
          );
        } else if (group && groupContextCustomUI) {
          return (
            React.createElement(groupContextCustomUI, {
              iModelId,
              mappingId: mapping.id,
              groupId: group.id,
            })
          );
        }
      }
      return null;
    case RouteStep.Properties:
      if (mapping && group) {
        return (
          <PropertyMenu
            iModelId={iModelId}
            mappingId={mapping.id}
            group={group}
            goBack={async () => goBack()}
          />
        );
      }
      return null;
    default:
      return null;
  }
};
