/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type {
  SelectOption,
} from "@itwin/itwinui-react";
import {
  Button,
  toaster,
} from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  handleError,
  LoadingSpinner,
} from "./utils";
import "./GroupAction.scss";
import useValidator from "../hooks/useValidator";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import { useMappingClient } from "./context/MappingClientContext";
import { useGroupingMappingCustomUI } from "./context/GroupingMappingCustomUIContext";
import type { GroupingCustomUI } from "./customUI/GroupingMappingCustomUI";
import { GroupingMappingCustomUIType } from "./customUI/GroupingMappingCustomUI";
import type { Group } from "@itwin/insights-client";
import { QueryBuilderStep } from "./QueryBuilderStep";
import { GroupDetailsStep } from "./GroupDetailsStep";
import { QueryBuilderActionPanel } from "./QueryBuilderActionPanel";
import { GroupDetailsActionPanel } from "./GroupDetailsActionPanel";
import { useVisualization } from "../hooks/useVisualization";

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
  shouldVisualize: boolean;
  group?: Group;
  queryGenerationType: string;
  onSaveSuccess: () => void;
  onClickCancel?: () => void;
  displayStrings?: Partial<typeof defaultDisplayStrings>;
}

export const GroupAction = (props: GroupActionProps) => {
  const { getAccessToken, iModelId, iModelConnection } = useGroupingMappingApiConfig();
  if (!iModelConnection) {
    throw new Error("This component requires an active iModelConnection.");
  }
  const mappingClient = useMappingClient();
  const groupUIs: GroupingCustomUI[] = useGroupingMappingCustomUI().customUIs
    .filter((p) => p.type === GroupingMappingCustomUIType.Grouping) as GroupingCustomUI[];
  const [details, setDetails] = useState({
    groupName: props.group?.groupName ?? "",
    description: props.group?.description ?? "",
  });
  const [query, setQuery] = useState<string>("");
  const [queryRowCount, setQueryRowCount] = useState<number>(0);

  const [validator, setShowValidationMessage] = useValidator();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [queryGenerationType, setQueryGenerationType] = useState(
    props.queryGenerationType,
  );
  const {
    isRendering,
    setIsRendering,
    simpleSelectionQuery,
    setSimpleSelectionQuery,
    clearPresentationSelection,
    resetView,
  } = useVisualization(
    props.shouldVisualize,
    iModelConnection,
    query,
    queryGenerationType
  );
  const isUpdating = isLoading || isRendering;
  const [currentStep, setCurrentStep] = React.useState(GroupActionStep.QueryBuilder);

  const displayStrings = React.useMemo(
    () => ({ ...defaultDisplayStrings, ...props.displayStrings }),
    [props.displayStrings]
  );

  useEffect(() => setQueryGenerationType(props.queryGenerationType), [props.queryGenerationType]);

  useEffect(() => {
    const fetchQueryRowCount = async () => {
      try {
        if (!query || query === "") {
          setQueryRowCount(0);
          return;
        }
        setIsLoading(true);
        const result = await iModelConnection.queryRowCount(query);
        setQueryRowCount(result);
      } catch {
        toaster.negative("Query failed to resolve.");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchQueryRowCount();
  }, [iModelConnection, query, setIsRendering]);

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
      clearPresentationSelection();
      setQuery("");
      setSimpleSelectionQuery("");
      await resetView();
    },
    [clearPresentationSelection, resetView, setSimpleSelectionQuery]
  );

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
      clearPresentationSelection();
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
  }, [validator, setShowValidationMessage, query, simpleSelectionQuery, getAccessToken, props, mappingClient, iModelId, details, clearPresentationSelection]);

  const isQueryBuilderStep = currentStep === GroupActionStep.QueryBuilder;
  const isGroupDetailsStep = currentStep === GroupActionStep.GroupDetails;
  return (
    <>
      <div className="gmw-group-add-modify-container">
        <QueryBuilderStep
          queryRowCount={queryRowCount}
          isHidden={!isQueryBuilderStep}
          queryGenerationType={queryGenerationType}
          groupUIs={groupUIs}
          isUpdating={isUpdating}
          resetView={resetView}
          setQuery={setQuery}
          onChange={onChange}
          getOptions={getOptions}
          displayStrings={{ ...displayStrings }}
          group={props.group}
        />
        {isGroupDetailsStep && <GroupDetailsStep
          details={details}
          setDetails={setDetails}
          validator={validator}
          displayStrings={{ ...displayStrings }}
        />}
      </div>
      <div className='gmw-action-panel'>
        {isLoading &&
          <LoadingSpinner />
        }
        {isQueryBuilderStep && (
          <QueryBuilderActionPanel onClickNext={() => setCurrentStep(GroupActionStep.GroupDetails)} />
        )}
        {isGroupDetailsStep && (
          <GroupDetailsActionPanel
            isSaveDisabled={isBlockingActions}
            onClickSave={save}
            onClickBack={() => setCurrentStep(GroupActionStep.QueryBuilder)}
          />
        )}
        {props.onClickCancel && <Button
          type='button'
          id='cancel'
          onClick={() => {
            clearPresentationSelection();
            props.onClickCancel && props.onClickCancel();
          }}
        >
          Cancel
        </Button>}
      </div>
    </>
  );
};
