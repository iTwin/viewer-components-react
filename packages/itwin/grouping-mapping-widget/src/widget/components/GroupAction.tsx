/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { IModelConnection } from "@itwin/core-frontend";
import type {
  ISelectionProvider,
  SelectionChangeEventArgs,
} from "@itwin/presentation-frontend";
import { Presentation } from "@itwin/presentation-frontend";
import { useActiveIModelConnection } from "@itwin/appui-react";
import type {
  SelectOption,
} from "@itwin/itwinui-react";
import {
  Button,
  ComboBox,
  Fieldset,
  Label,
  toaster,
} from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  handleError,
  LoadingSpinner,
} from "./utils";
import "./GroupAction.scss";
import useValidator from "../hooks/useValidator";
import {
  clearEmphasizedElements,
  clearOverriddenElements,
  transparentOverriddenElements,
  visualizeElementsByQuery,
  zoomToElements,
} from "./viewerUtils";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import { useMappingClient } from "./context/MappingClientContext";
import { useGroupingMappingCustomUI } from "./context/GroupingMappingCustomUIContext";
import type { GroupingCustomUI } from "./customUI/GroupingMappingCustomUI";
import { GroupingMappingCustomUIType } from "./customUI/GroupingMappingCustomUI";
import type { Group } from "@itwin/insights-client";
import { useGroupHilitedElementsContext } from "./context/GroupHilitedElementsContext";
import { visualizeGroupColors } from "./groupsHelpers";
import { QueryBuilderCustomUI } from "./QueryBuilderCustomUI";
import { GroupDetails } from "./GroupDetails";

const defaultDisplayStrings = {
  groupDetails: "Group Details",
  groupBy: "Group By",
};

enum GroupActionStep {
  QueryBuilder,
  GroupDetails,
}

export interface GroupActionProps {
  mappingId: string;
  group?: Group;
  queryGenerationType: string;
  onSaveSuccess: () => void;
  onClickCancel?: () => void;
  displayStrings?: Partial<typeof defaultDisplayStrings>;
}

export const GroupAction = (props: GroupActionProps) => {
  const iModelConnection = useActiveIModelConnection() as IModelConnection;
  const { showGroupColor, groups, hiddenGroupsIds, hilitedElementsQueryCache } = useGroupHilitedElementsContext();
  const { getAccessToken, iModelId } = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const groupUIs: GroupingCustomUI[] = useGroupingMappingCustomUI().customUIs
    .filter((p) => p.type === GroupingMappingCustomUIType.Grouping) as GroupingCustomUI[];
  const [details, setDetails] = useState({
    groupName: props.group?.groupName ?? "",
    description: props.group?.description ?? "",
  });
  const [query, setQuery] = useState<string>("");
  const [simpleSelectionQuery, setSimpleSelectionQuery] = useState<string>("");
  const [validator, setShowValidationMessage] = useValidator();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [queryGenerationType, setQueryGenerationType] = useState(
    props.queryGenerationType,
  );
  const isUpdating = isLoading || isRendering;
  const [currentStep, setCurrentStep] = React.useState(GroupActionStep.QueryBuilder);

  useEffect(() => {
    if (!iModelConnection) {
      throw new Error("This component requires an active iModelConnection.");
    }
  }, [iModelConnection]);

  const displayStrings = { ...defaultDisplayStrings, ...props.displayStrings };

  useEffect(() => setQueryGenerationType(props.queryGenerationType), [props.queryGenerationType]);

  const resetView = useCallback(async () => {
    if (showGroupColor) {
      await visualizeGroupColors(iModelConnection, groups, groups, hiddenGroupsIds, hilitedElementsQueryCache);
    } else {
      clearOverriddenElements();
    }
    clearEmphasizedElements();
  }, [groups, hiddenGroupsIds, hilitedElementsQueryCache, iModelConnection, showGroupColor]);

  useEffect(() => {
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
    return () => {
      removeListener();
    };
  }, [iModelConnection, queryGenerationType]);

  useEffect(() => {
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
        toaster.negative("Sorry, we have failed to generate a valid query. 😔");
      } finally {
        setIsRendering(false);
      }
    };

    void reemphasize();
  }, [iModelConnection, query]);

  useEffect(() => {
    Presentation.selection.clearSelection(
      "GroupingMappingWidget",
      iModelConnection,
    );
  }, [iModelConnection]);

  const save = useCallback(async () => {
    if (!validator.allValid()) {
      setShowValidationMessage(true);
      return;
    }
    try {
      setIsLoading(true);
      const currentQuery = query || simpleSelectionQuery;

      const accessToken = await getAccessToken();

      props.group
        ? await mappingClient.updateGroup(
          accessToken,
          iModelId,
          props.mappingId,
          props.group.id ?? "",
          { ...details, query: currentQuery },
        )
        : await mappingClient.createGroup(
          accessToken,
          iModelId,
          props.mappingId,
          {
            ...details,
            query: currentQuery,
          },
        );
      Presentation.selection.clearSelection(
        "GroupingMappingWidget",
        iModelConnection,
      );
      setDetails({
        groupName: props.group?.groupName ?? "",
        description: props.group?.description ?? "",
      });
      setCurrentStep(GroupActionStep.QueryBuilder);
      setShowValidationMessage(false);
      props.onSaveSuccess();
    } catch (error: any) {
      handleError(error.status);
    } finally {
      setIsLoading(false);
    }
  }, [validator, setShowValidationMessage, query, simpleSelectionQuery, getAccessToken, props, mappingClient, iModelId, details, iModelConnection]);

  const isBlockingActions = !(
    details.groupName &&
    (query || simpleSelectionQuery) &&
    !isRendering &&
    !isLoading
  );

  const getOptions = useMemo(
    (): SelectOption<string>[] =>
      groupUIs.map((ui) => ({
        label: ui.displayLabel,
        value: ui.name,
        icon: ui.icon,
      })),
    [groupUIs]
  );

  const onChange = useCallback(
    async (value: string) => {
      setQueryGenerationType(value);
      Presentation.selection.clearSelection(
        "GroupingMappingWidget",
        iModelConnection,
      );
      setQuery("");
      setSimpleSelectionQuery("");
      await resetView();
    },
    [iModelConnection, resetView]
  );

  return (
    <>
      <div className="gmw-group-add-modify-container">
        <Fieldset legend={displayStrings.groupBy} className={
          currentStep === GroupActionStep.QueryBuilder
            ? "gmw-query-builder-container"
            : "gmw-hide"
        }>
          <span>
            <Label htmlFor='query-combo-input'>Query Generation Tool</Label>
            <ComboBox
              value={queryGenerationType}
              inputProps={{
                id: "query-combo-input",
              }}
              options={getOptions}
              onChange={onChange}
            />
          </span>
          <QueryBuilderCustomUI
            queryGenerationType={queryGenerationType}
            groupUIs={groupUIs}
            isUpdating={isUpdating}
            resetView={resetView}
            setQuery={setQuery}
          />
        </Fieldset>
        <Fieldset
          legend={displayStrings.groupDetails}
          className={
            currentStep === GroupActionStep.GroupDetails
              ? "gmw-group-details"
              : "gmw-hide"
          }>
          <GroupDetails
            details={details}
            setDetails={setDetails}
            validator={validator}
          />
        </Fieldset>
      </div>
      <div className='gmw-action-panel'>
        {isLoading &&
          <LoadingSpinner />
        }
        {currentStep !== GroupActionStep.QueryBuilder ?
          <>
            <Button
              id='save-app'
              onClick={() => setCurrentStep(GroupActionStep.QueryBuilder)}
            >
              Back
            </Button>
            <Button
              disabled={isBlockingActions}
              styleType='high-visibility'
              id='save-app'
              onClick={async () => {
                await save();
              }}
            >
              Save
            </Button>
          </> :
          <Button
            styleType='high-visibility'
            id='save-app'
            onClick={() => setCurrentStep(GroupActionStep.GroupDetails)}
          >
            Next
          </Button>
        }
        <Button
          type='button'
          id='cancel'
          onClick={props.onClickCancel ? async () => {
            Presentation.selection.clearSelection(
              "GroupingMappingWidget",
              iModelConnection,
            );
            props.onClickCancel && props.onClickCancel();
          } : undefined}
        >
          Cancel
        </Button>
      </div>
    </>
  );
};
