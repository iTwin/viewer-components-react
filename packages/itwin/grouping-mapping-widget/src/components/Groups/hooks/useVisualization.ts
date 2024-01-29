/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { IModelConnection } from "@itwin/core-frontend";
import { toaster } from "@itwin/itwinui-react";
import type { ISelectionProvider, SelectionChangeEventArgs } from "@itwin/presentation-frontend";
import { Presentation } from "@itwin/presentation-frontend";
import { useCallback, useEffect, useState } from "react";
import { useGroupHilitedElementsContext } from "../../context/GroupHilitedElementsContext";
import { visualizeGroupColors } from "../groupsHelpers";
import { clearEmphasizedElements, clearOverriddenElements, transparentOverriddenElements, visualizeElementsByQuery, zoomToElements } from "../../../common/viewerUtils";

export const useVisualization = (shouldVisualize: boolean, iModelConnection: IModelConnection, query: string, queryGenerationType: string) => {
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const { showGroupColor, hiddenGroupsIds, overlappedElementsMetadata: { overlappedElementGroupPairs }, setNumberOfVisualizedGroups} = useGroupHilitedElementsContext();
  const [simpleSelectionQuery, setSimpleSelectionQuery] = useState<string>("");

  const resetView = useCallback(async () => {
    if (!shouldVisualize) return;
    if (showGroupColor) {
      await visualizeGroupColors(hiddenGroupsIds, overlappedElementGroupPairs, setNumberOfVisualizedGroups);
    } else {
      clearOverriddenElements();
    }
    clearEmphasizedElements();
  }, [hiddenGroupsIds, overlappedElementGroupPairs, setNumberOfVisualizedGroups, shouldVisualize, showGroupColor]);

  useEffect(() => {
    if (!shouldVisualize) return;
    const removeListener = Presentation.selection.selectionChange.addListener(
      async (
        evt: SelectionChangeEventArgs,
        selectionProvider: ISelectionProvider,
      ) => {
        if (queryGenerationType === "Selection") {
          const selection = selectionProvider.getSelection(
            evt.imodel,
            evt.level,
          );
          const query = selection.instanceKeys.size > 0
            ? `SELECT ECInstanceId FROM ${selection.instanceKeys.keys().next().value}`
            : "";
          setSimpleSelectionQuery(query);
        }
      },
    );
    return removeListener;
  }, [iModelConnection, queryGenerationType, shouldVisualize]);

  useEffect(() => {
    if (!shouldVisualize) return;
    const reemphasize = async () => {
      try {
        if (!query || query === "") {
          return;
        }
        setIsRendering(true);
        transparentOverriddenElements();
        const resolvedHiliteIds = await visualizeElementsByQuery(
          query,
          "red",
          iModelConnection,
        );
        await zoomToElements(resolvedHiliteIds);
      } catch {
        toaster.negative("Sorry, we have failed to generate a valid query.");
      } finally {
        setIsRendering(false);
      }
    };

    void reemphasize();
  }, [iModelConnection, query, shouldVisualize]);

  const clearPresentationSelection = useCallback(() =>
    shouldVisualize && Presentation.selection.clearSelection(
      "GroupingMappingWidget",
      iModelConnection,
    ), [iModelConnection, shouldVisualize]);

  useEffect(() => {
    clearPresentationSelection();
  }, [clearPresentationSelection, iModelConnection]);

  return { isRendering, setIsRendering, simpleSelectionQuery, setSimpleSelectionQuery, clearPresentationSelection, resetView };

};
