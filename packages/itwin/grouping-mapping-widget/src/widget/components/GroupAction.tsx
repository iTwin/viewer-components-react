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
  HorizontalTabs,
  Label,
  LabeledInput,
  Small,
  Tab,
  toaster,
} from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  EmptyMessage,
  handleError,
  handleInputChange,
  LoadingSpinner,
} from "./utils";
import "./GroupAction.scss";
import useValidator, { NAME_REQUIREMENTS } from "../hooks/useValidator";
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
import { StatusIcon } from "./StatusIcon";

const defaultDisplayStrings = {
  groupDetails: "Group Details",
  groupBy: "Group By",
};

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
  const [index, setIndex] = React.useState(0);

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
    if (!validator.allValid() || !validator.check(details.groupName, NAME_REQUIREMENTS)) {
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
      props.onSaveSuccess();
    } catch (error: any) {
      handleError(error.status);
    } finally {
      setIsLoading(false);
    }
  }, [validator, setShowValidationMessage, query, simpleSelectionQuery, getAccessToken, props, mappingClient, iModelId, details, iModelConnection]);

  const createQueryBuilderComponent = () => {
    if (queryGenerationType && queryGenerationType.length > 0) {
      const selectedCustomUI = groupUIs.find(
        (e) => e.name === queryGenerationType,
      );
      if (selectedCustomUI) {
        return React.createElement(selectedCustomUI.uiComponent, {
          updateQuery: setQuery,
          isUpdating,
          resetView,
        });
      }
    }
    return <EmptyMessage message='No query generation method selected. ' />;
  };

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
      <HorizontalTabs
        activeIndex={index}
        labels={[
          <Tab key={1} label='Details' startIcon={
            validator.message(
              "groupName",
              details.groupName,
              NAME_REQUIREMENTS,
            ) ? <StatusIcon status="error" /> : undefined} />,
          <Tab key={2} label='Group By*' />,
        ]}
        type='borderless'
        onTabSelected={setIndex}
        wrapperClassName='gmw-group-add-modify-container'
        contentClassName="gmw-group-query-builder-content"
      >
        <Fieldset legend={displayStrings.groupDetails} className={index === 0 ? "gmw-group-details" : "gmw-hide"}>
          <Small className='gmw-field-legend'>
            Asterisk * indicates mandatory fields.
          </Small>
          <LabeledInput
            id='groupName'
            name='groupName'
            label='Name'
            value={details.groupName}
            required
            onChange={(event) => {
              handleInputChange(event, details, setDetails);
              validator.showMessageFor("groupName");
            }}
            message={validator.message(
              "groupName",
              details.groupName,
              NAME_REQUIREMENTS,
            )}
            status={
              validator.message(
                "groupName",
                details.groupName,
                NAME_REQUIREMENTS,
              )
                ? "negative"
                : undefined
            }
            onBlur={() => {
              validator.showMessageFor("groupName");
            }}
            onBlurCapture={(event) => {
              handleInputChange(event, details, setDetails);
              validator.showMessageFor("groupName");
            }}
          />
          <LabeledInput
            id='description'
            name='description'
            label='Description'
            value={details.description}
            onChange={(event) => {
              handleInputChange(event, details, setDetails);
            }}
          />
        </Fieldset>
        <Fieldset legend={displayStrings.groupBy} className={index === 1 ? "gmw-query-builder-container" : "gmw-hide"}>
          <Label htmlFor='query-combo-input'>Query Generation Tool</Label>
          <ComboBox
            value={queryGenerationType}
            inputProps={{
              id: "query-combo-input",
            }}
            options={getOptions}
            onChange={onChange}

          />
          {queryGenerationType && createQueryBuilderComponent()}
        </Fieldset>
      </HorizontalTabs>
      <div className='gmw-action-panel'>
        {isLoading &&
          <LoadingSpinner />
        }
        {index !== 0 ?
          <Button
            disabled={isBlockingActions}
            styleType='high-visibility'
            id='save-app'
            onClick={async () => {
              await save();
            }}
          >
            Save
          </Button> :
          <Button
            styleType='high-visibility'
            id='save-app'
            onClick={() => setIndex(1)}
          >
            Go to Group By
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
