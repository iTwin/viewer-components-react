/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type {
  SelectOption,
} from "@itwin/itwinui-react";
import {
  Button,
} from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { LoadingSpinner } from "../../SharedComponents/LoadingSpinner";
import "./GroupAction.scss";
import useValidator from "../../Properties/hooks/useValidator";
import { useGroupingMappingApiConfig } from "../../context/GroupingApiConfigContext";
import { useMappingClient } from "../../context/MappingClientContext";
import { useGroupingMappingCustomUI } from "../../context/GroupingMappingCustomUIContext";
import type { GroupingCustomUI } from "../../customUI/GroupingMappingCustomUI";
import { GroupingMappingCustomUIType } from "../../customUI/GroupingMappingCustomUI";
import type { Group } from "@itwin/insights-client";
import { QueryBuilderStep } from "../QueryBuilder/QueryBuilderStep";
import { GroupDetailsStep } from "./GroupDetailsStep";
import { QueryBuilderActionPanel } from "../QueryBuilder/QueryBuilderActionPanel";
import { GroupDetailsActionPanel } from "./GroupDetailsActionPanel";
import { useVisualization } from "../hooks/useVisualization";
import { useMutation, useQueryClient } from "@tanstack/react-query";

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
  const queryClient = useQueryClient();

  const [queryGenerationType, setQueryGenerationType] = useState(
    props.queryGenerationType,
  );
  const {
    isRendering,
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

  const [currentStep, setCurrentStep] = React.useState(GroupActionStep.QueryBuilder);

  const displayStrings = React.useMemo(
    () => ({ ...defaultDisplayStrings, ...props.displayStrings }),
    [props.displayStrings]
  );

  useEffect(() => setQueryGenerationType(props.queryGenerationType), [props.queryGenerationType]);

  const fetchQueryRowCount = async (query: string) => {
    const rowCount = (await iModelConnection.createQueryReader(`SELECT count(*) FROM (${query})`).next()).value[0];
    return rowCount as number;
  };

  const { mutate, isLoading: isQueryLoading } = useMutation(fetchQueryRowCount, {
    onSuccess: (result) => {
      setQueryRowCount(result);
    },
  });

  useEffect(() => {
    if (query) {
      mutate(query);
    } else {
      setQueryRowCount(0);
    }
  }, [iModelConnection, query, mutate]);

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

  const saveGroup = async () => {
    const accessToken = await getAccessToken();
    const currentQuery = query || simpleSelectionQuery;

    return props.group
      ? mappingClient.updateGroup(
        accessToken,
        iModelId,
        props.mappingId,
        props.group.id,
        { ...details, query: currentQuery }
      )
      : mappingClient.createGroup(
        accessToken,
        iModelId,
        props.mappingId,
        { ...details, query: currentQuery }
      );
  };

  const { mutate: onSaveMutate, isLoading: isSaveLoading } = useMutation(saveGroup, {
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["groups"] });
      clearPresentationSelection();
      setDetails({
        groupName: props.group?.groupName ?? "",
        description: props.group?.description ?? "",
      });
      setCurrentStep(GroupActionStep.QueryBuilder);
      setShowValidationMessage(false);
      props.onSaveSuccess();

    },
  });

  const isQueryBuilderStep = currentStep === GroupActionStep.QueryBuilder;
  const isGroupDetailsStep = currentStep === GroupActionStep.GroupDetails;

  const isLoading = isSaveLoading || isQueryLoading;

  const isUpdating = isLoading || isRendering;

  const isBlockingActions = !(details.groupName && (query || simpleSelectionQuery)) || isRendering || isLoading;

  const onClickSave = useCallback(() => {
    onSaveMutate();
  }, [onSaveMutate]);

  const onClickBack = useCallback(() => {
    setCurrentStep(GroupActionStep.QueryBuilder);
  }, []);

  const onClickCancel = useCallback(() => {
    clearPresentationSelection();
    if (props.onClickCancel) {
      props.onClickCancel();
    }
  }, [clearPresentationSelection, props]);

  const onClickNext = useCallback(() => {
    setCurrentStep(GroupActionStep.GroupDetails);
  }, []);

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
          <QueryBuilderActionPanel onClickNext={onClickNext} />
        )}
        {isGroupDetailsStep && (
          <GroupDetailsActionPanel
            isSaveDisabled={isBlockingActions}
            onClickSave={onClickSave}
            onClickBack={onClickBack}
          />
        )}
        {props.onClickCancel && <Button
          type='button'
          id='cancel'
          onClick={onClickCancel}
        >
          Cancel
        </Button>}
      </div>
    </>
  );
};
