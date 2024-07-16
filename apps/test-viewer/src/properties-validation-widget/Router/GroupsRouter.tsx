/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React, { useState } from "react";
import { useGroupingMappingApiConfig, GroupAction, GroupsVisualization, CDMClient, useMappingsOperations } from "@itwin/grouping-mapping-widget";
import type { Route } from "../GroupingMapping";
import { RouteStep } from "../GroupingMapping";
import { RulesAction } from "../RulesAction";
import { PropertyMenu, ValidationRule } from "../PropertyTable/PropertyMenu";
import { TableData } from "../PropertyTable/PropertyTable";
import { Results } from "../Results/Results";

export const GroupsRouter = ({
  currentRoute,
  navigateTo,
  goBack,
}: {
  currentRoute: Route;
  navigateTo: (toRoute: (prev: Route | undefined) => Route) => void;
  goBack: () => void;
}) => {
  const { iModelId } = useGroupingMappingApiConfig();
  const { mapping, group, property, rule, groupContextCustomUI, queryGenerationType } = currentRoute.groupingRouteFields;
  const [ruleList, setRuleList] = useState<ValidationRule[]>([]);
  const [resultsData, setResultsData] = useState<TableData>({ headers: [], data: [] });

  switch (currentRoute.step) {
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
          <PropertyMenu
            mapping={mapping}
            group={group}
            ruleList={ruleList}
            setRuleList={setRuleList}
            onClickAddRuleProperty={() =>
              navigateTo((prev) => ({
                step: RouteStep.PropertyAction,
                title: "Add Validation Property",
                groupingRouteFields: { ...prev?.groupingRouteFields },
              }))
            }
            onClickModifyRuleProperty={(rule) =>
              navigateTo((prev) => ({
                step: RouteStep.PropertyAction,
                title: rule.name,
                groupingRouteFields: { ...prev?.groupingRouteFields, rule: rule },
              }))
            }
            onClickResults={(tableData: TableData) => {
              setResultsData(tableData);
              navigateTo((prev) => ({
                step: RouteStep.Results,
                title: "Results",
                groupingRouteFields: { ...prev?.groupingRouteFields },
              }));
            }}
          />
        );
      }
      return null;
    case RouteStep.PropertyAction: {
      if (mapping && group) {
        return (
          <RulesAction
            mappingId={mapping.id}
            group={group}
            rule={rule}
            onSaveSuccess={(newRule: ValidationRule, oldRule: ValidationRule | undefined) => {
              if (oldRule) {
                const index = ruleList.findIndex(
                  (r) => r.name === oldRule.name && r.onProperty.id === oldRule.onProperty.id && r.function === oldRule.function,
                );
                const newRuleList = [...ruleList];
                newRuleList[index] = newRule;
                setRuleList(newRuleList);
              } else {
                setRuleList([...ruleList, newRule]);
              }
              goBack();
            }}
            onClickCancel={goBack}
          />
        );
      }
      return null;
    }
    case RouteStep.Results: {
      return <Results tableData={resultsData} />;
    }
    default:
      return null;
  }
};
