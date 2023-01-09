/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useEffect } from "react";
import { useGroupHilitedElementsContext } from "./context/GroupHilitedElementsContext";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import GroupAction from "./GroupAction";
import { Groupings } from "./Grouping";
import type { Route } from "./GroupingMapping";
import { RouteStep } from "./GroupingMapping";
import { Mappings } from "./Mapping";
import MappingAction from "./MappingAction";
import { PropertyMenu } from "./PropertyMenu";
import { clearEmphasizedElements, clearHiddenElements, clearOverriddenElements } from "./viewerUtils";

export const GroupingMappingRouter = ({
  routingHistory,
  navigateTo,
  goBack,
}: {
  // Maybe we don't need the entire route history? Remove at the end of this if it's still not needed.
  routingHistory: Route[];
  navigateTo: (toRoute: Route) => void;
  goBack: () => void;
}) => {
  const { setShowGroupColor, setHiddenGroupsIds } = useGroupHilitedElementsContext();
  const { iModelId } = useGroupingMappingApiConfig();
  const currentRoute = routingHistory[routingHistory.length - 1];

  // Clean up group visualization when in mappings
  useEffect(() => {
    if (routingHistory.length === 1) {
      setShowGroupColor(false);
      setHiddenGroupsIds([]);
      clearOverriddenElements();
      clearEmphasizedElements();
      clearHiddenElements();
    }
  }, [routingHistory, setHiddenGroupsIds, setShowGroupColor]);

  switch (currentRoute.step) {
    case RouteStep.Mappings:
      return (
        <Mappings
          onClickAddMapping={() =>
            navigateTo({ step: RouteStep.MappingsAction, title: "Add Mapping" })
          }
          onClickMappingTitle={(mapping) => {
            navigateTo({ step: RouteStep.Groups, mapping, title: mapping.mappingName });
          }}
          onClickMappingModify={(mapping) => {
            navigateTo({
              step: RouteStep.MappingsAction,
              mapping,
              title: mapping.mappingName,
            });
          }}
        />
      );
    case RouteStep.MappingsAction:
      return <MappingAction mapping={currentRoute.mapping} onClose={goBack} />;
    case RouteStep.Groups:
      if (currentRoute.mapping) {
        return (
          <Groupings
            mapping={currentRoute.mapping}
            onClickAddGroup={(qType) =>
              navigateTo({
                ...currentRoute,
                step: RouteStep.GroupAction,
                queryGenerationType: qType,
                title: "Add Group",
              })
            }
            onClickGroupTitle={(group) => navigateTo({
              ...currentRoute,
              step: RouteStep.Properties,
              group,
              title: group.groupName,
            })}
            onClickGroupModify={(group, qType) =>
              navigateTo({
                ...currentRoute,
                step: RouteStep.GroupAction,
                queryGenerationType: qType,
                title: group.groupName,
                group,
              })
            }
            onClickRenderContextCustomUI={(ccUI, group) =>
              navigateTo({
                ...currentRoute,
                step: RouteStep.GroupAction,
                groupContextCustomUI: ccUI,
                group,
              })
            }
          />
        );
      }
      return null;
    case RouteStep.GroupAction:
      if (currentRoute.mapping) {
        if (currentRoute.queryGenerationType) {
          return <GroupAction mappingId={currentRoute.mapping.id} group={currentRoute.group} onClose={goBack} queryGenerationType={currentRoute.queryGenerationType} />;
        } else if (currentRoute.group && currentRoute.groupContextCustomUI) {
          return (
            React.createElement(currentRoute.groupContextCustomUI, {
              iModelId,
              mappingId: currentRoute.mapping.id,
              groupId: currentRoute.group.id,
            })
          );
        }
      }
      return null;
    case RouteStep.Properties:
      if (currentRoute.mapping && currentRoute.group) {
        return (<PropertyMenu iModelId={iModelId} mappingId={currentRoute.mapping.id} group={currentRoute.group} goBack={async () => goBack()} />);
      }
      return null;
    default:
      return null;
  }
};
