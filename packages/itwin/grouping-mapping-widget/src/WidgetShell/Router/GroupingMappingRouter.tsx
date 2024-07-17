/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { useGroupingMappingApiConfig } from "../../components/context/GroupingApiConfigContext";
import { GroupAction } from "../../components/Groups/Editing/GroupAction";
import type { Route } from "../GroupingMapping";
import { RouteStep } from "../GroupingMapping";
import { GroupPropertyAction } from "../../components/Properties/GroupProperties/GroupPropertyAction";
import { Mappings } from "../../components/Mappings/Mappings";
import { MappingAction } from "../../components/Mappings/Editing/MappingAction";
import { PropertyMenuWithVisualization } from "../../components/Properties/PropertyMenuWithVisualization";
import { GroupsVisualization } from "../../components/Groups/GroupsVisualization";

export const GroupingMappingRouter = ({
  currentRoute,
  navigateTo,
  goBack,
  hideRefreshIcon,
}: {
  currentRoute: Route;
  navigateTo: (toRoute: (prev: Route | undefined) => Route) => void;
  goBack: () => void;
  hideRefreshIcon?: boolean;
}) => {
  const { iModelId } = useGroupingMappingApiConfig();
  const { mapping, group, property, groupContextCustomUI, queryGenerationType } = currentRoute.groupingRouteFields;

  switch (currentRoute.step) {
    case RouteStep.Mappings:
      return (
        <Mappings
          onClickAddMapping={() => navigateTo(() => ({ step: RouteStep.MappingsAction, title: "Add Mapping", groupingRouteFields: {} }))}
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
          hideRefreshIcon={hideRefreshIcon}
        />
      );
    case RouteStep.MappingsAction:
      return <MappingAction mapping={mapping} onClickCancel={goBack} onSaveSuccess={goBack} />;
    case RouteStep.Groups:
      if (mapping) {
        return (
          <GroupsVisualization
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
            onClickRenderContextCustomUI={(ccUI, g, displayLabel) =>
              navigateTo((prev) => ({
                step: RouteStep.GroupContextCustomUI,
                title: displayLabel,
                groupingRouteFields: { ...prev?.groupingRouteFields, group: g, groupContextCustomUI: ccUI },
              }))
            }
            hideRefreshIcon={hideRefreshIcon}
          />
        );
      }
      return null;
    case RouteStep.GroupAction:
      if (mapping) {
        if (queryGenerationType) {
          return (
            <GroupAction
              shouldVisualize
              mappingId={mapping.id}
              group={group}
              onClickCancel={goBack}
              onSaveSuccess={goBack}
              queryGenerationType={queryGenerationType}
            />
          );
        }
      }
      return null;
    case RouteStep.GroupContextCustomUI:
      if (mapping && group && groupContextCustomUI) {
        return React.createElement(groupContextCustomUI, {
          iModelId,
          mappingId: mapping.id,
          groupId: group.id,
        });
      }
      return null;
    case RouteStep.Properties:
      if (mapping && group) {
        return (
          <PropertyMenuWithVisualization
            mapping={mapping}
            group={group}
            color="red"
            onClickAddGroupProperty={() =>
              navigateTo((prev) => ({ step: RouteStep.PropertyAction, title: "Add Property", groupingRouteFields: { ...prev?.groupingRouteFields } }))
            }
            onClickModifyGroupProperty={(gp) =>
              navigateTo((prev) => ({
                step: RouteStep.PropertyAction,
                title: gp.propertyName,
                groupingRouteFields: { ...prev?.groupingRouteFields, property: gp },
              }))
            }
            onClickAddCalculatedProperty={() =>
              navigateTo((prev) => ({
                step: RouteStep.CalculatedPropertyAction,
                title: "Create Calculated Property",
                groupingRouteFields: { ...prev?.groupingRouteFields },
              }))
            }
            onClickModifyCalculatedProperty={(cp) =>
              navigateTo((prev) => ({
                step: RouteStep.CalculatedPropertyAction,
                title: cp.propertyName,
                groupingRouteFields: { ...prev?.groupingRouteFields, calculatedProperty: cp },
              }))
            }
            onClickAddCustomCalculationProperty={() =>
              navigateTo((prev) => ({
                step: RouteStep.CustomCalculationPropertyAction,
                title: "Create Custom Calculation",
                groupingRouteFields: { ...prev?.groupingRouteFields },
              }))
            }
            onClickModifyCustomCalculation={(cc) =>
              navigateTo((prev) => ({
                step: RouteStep.CustomCalculationPropertyAction,
                title: cc.propertyName,
                groupingRouteFields: { ...prev?.groupingRouteFields, customCalculation: cc },
              }))
            }
            hideRefreshIcon={hideRefreshIcon}
          />
        );
      }
      return null;
    case RouteStep.PropertyAction: {
      if (mapping && group) {
        return <GroupPropertyAction mappingId={mapping.id} group={group} groupProperty={property} onSaveSuccess={goBack} onClickCancel={goBack} />;
      }
      return null;
    }
    default:
      return null;
  }
};
