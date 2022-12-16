/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useEffect } from "react";
import { useGroupHilitedElementsContext } from "./context/GroupHilitedElementsContext";
import GroupAction from "./GroupAction";
import { Groupings } from "./Grouping";
import type { Route } from "./GroupingMapping";
import { RouteStep } from "./GroupingMapping";
import { Mappings } from "./Mapping";
import MappingAction from "./MappingAction";
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

  if (currentRoute.step === RouteStep.Mappings) {
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
  } else if (currentRoute.step === RouteStep.MappingsAction) {
    if (currentRoute.mapping) {
      return <MappingAction mapping={currentRoute.mapping} onClose={goBack} />;
    }
    return <MappingAction onClose={goBack} />;
  } else if (currentRoute.mapping) {
    if (currentRoute.step === RouteStep.Groups) {
      if (currentRoute.step === RouteStep.Groups) {
        return (
          // TODO on unmount have it destroy the context contents
          // TODO somehow make the highlighting optionial
          // abstract out the properties option
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
    } else if (currentRoute.step === RouteStep.GroupAction && currentRoute.queryGenerationType) {
      return <GroupAction mappingId={currentRoute.mapping.id} group={currentRoute.group} onClose={goBack} queryGenerationType={currentRoute.queryGenerationType} />;
    }
    //  else if (currentRoute.group && currentRoute.step === RouteStep.Properties) {

    // }
  }
  return null;
};
