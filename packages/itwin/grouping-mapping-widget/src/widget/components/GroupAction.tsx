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
import {
  Fieldset,
  LabeledInput,
  RadioTile,
  RadioTileGroup,
  Small,
  toaster,
} from "@itwin/itwinui-react";
import type { ReactElement } from "react";
import React, { useCallback, useEffect, useState } from "react";
import {
  EmptyMessage,
  handleError,
  handleInputChange,
  WidgetHeader,
} from "./utils";
import type { IGroupTyped } from "./Grouping";
import { defaultUIMetadata } from "./Grouping";
import "./GroupAction.scss";
import ActionPanel from "./ActionPanel";
import useValidator, { NAME_REQUIREMENTS } from "../hooks/useValidator";
import { GroupQueryBuilderContainer } from "./GroupQueryBuilderContainer";
import {
  transparentOverriddenElements,
  visualizeElementsByQuery,
  zoomToElements,
} from "./viewerUtils";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import { useMappingClient } from "./context/MappingClientContext";
import { useGroupingMappingCustomUI } from "./context/GroupingMappingCustomUIContext";
import { SvgAdd } from "@itwin/itwinui-icons-react";
import SearchGroupingCustomUI from "./customUI/SearchGroupingCustomUI";
import ManualGroupingCustomUI from "./customUI/ManualGroupingCustomUI";
import type { GroupingCustomUI } from "./customUI/GroupingMappingCustomUI";
import { GroupingMappingCustomUIType } from "./customUI/GroupingMappingCustomUI";

interface GroupActionProps {
  iModelId: string;
  mappingId: string;
  group?: IGroupTyped;
  queryGenerationType?: string;
  goBack: () => Promise<void>;
  resetView: () => Promise<void>;
}

const GroupAction = (props: GroupActionProps) => {
  const iModelConnection = useActiveIModelConnection() as IModelConnection;
  const { getAccessToken } = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const groupUIs: GroupingCustomUI[] = useGroupingMappingCustomUI()
    .filter((p) => p.type === GroupingMappingCustomUIType.Grouping) as GroupingCustomUI[];

  const [details, setDetails] = useState({
    groupName: props.group?.groupName ?? "",
    description: props.group?.description ?? "",
  });
  const [query, setQuery] = useState<string>("");
  const [simpleSelectionQuery, setSimpleSelectionQuery] = useState<string>("");
  const [validator, showValidationMessage] = useValidator();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [queryGenerationType, setQueryGenerationType] = useState(
    props.queryGenerationType,
  );

  const isUpdating = isLoading || isRendering;

  const changeGroupByType = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const {
      target: { value },
    } = event;
    setQueryGenerationType(value);
    Presentation.selection.clearSelection(
      "GroupingMappingWidget",
      iModelConnection,
    );
    setQuery("");
    setSimpleSelectionQuery("");
    await props.resetView();
  };

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
      showValidationMessage(true);
      return;
    }
    try {
      setIsLoading(true);
      const currentQuery = query || simpleSelectionQuery;

      const accessToken = await getAccessToken();

      props.group
        ? await mappingClient.updateGroup(
          accessToken,
          props.iModelId,
          props.mappingId,
          props.group.id ?? "",
          { ...details, query: currentQuery },
        )
        : await mappingClient.createGroup(
          accessToken,
          props.iModelId,
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
      await props.goBack();
    } catch (error: any) {
      handleError(error.status);
      setIsLoading(false);
    }
  }, [
    validator,
    showValidationMessage,
    query,
    simpleSelectionQuery,
    getAccessToken,
    props,
    mappingClient,
    details,
    iModelConnection,
  ]);

  const createQueryBuilderComponent = () => {
    switch (queryGenerationType) {
      case "Selection": {
        return (
          <GroupQueryBuilderContainer
            setQuery={setQuery}
            isUpdating={isUpdating}
            resetView={props.resetView}
          />
        );
      }
      case "Search": {
        return (
          <SearchGroupingCustomUI
            updateQuery={setQuery}
            isUpdating={isUpdating}
            resetView={props.resetView}
          />
        );
      }
      case "Manual": {
        return (
          <ManualGroupingCustomUI
            updateQuery={setQuery}
            isUpdating={isUpdating}
            resetView={props.resetView}
          />
        );
      }
      default: {
        if (queryGenerationType && queryGenerationType.length > 0) {
          const selectedCustomUI = groupUIs.find(
            (e) => e.name === queryGenerationType,
          );
          if (selectedCustomUI) {
            return React.createElement(selectedCustomUI.uiComponent, {
              updateQuery: setQuery,
              isUpdating,
              resetView: props.resetView,
            });
          }
        }
        return <EmptyMessage message='No query generation method selected. ' />;
      }
    }
  };

  const isBlockingActions = !(
    details.groupName &&
    (query || simpleSelectionQuery) &&
    !isRendering &&
    !isLoading
  );

  const getRadioTileComponent = (
    icon: ReactElement,
    value: string,
    label: string,
  ) => {
    return (
      <RadioTile
        name={"groupby"}
        icon={icon}
        key={value}
        onChange={changeGroupByType}
        value={value}
        label={label}
        disabled={isUpdating}
        checked={queryGenerationType === value}
      />
    );
  };

  return (
    <>
      <WidgetHeader
        title={props.group ? props.group.groupName ?? "" : "Add Group"}
        returnFn={async () => {
          Presentation.selection.clearSelection(
            "GroupingMappingWidget",
            iModelConnection,
          );
          await props.goBack();
        }}
      />
      <div className='gmw-group-add-modify-container'>
        <Fieldset legend='Group Details' className='gmw-group-details'>
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
        <Fieldset legend='Group By' className='gmw-query-builder-container'>
          <RadioTileGroup className='gmw-radio-group-tile' required>
            {groupUIs.length === 0
              ? (
                defaultUIMetadata.map((p) =>
                  getRadioTileComponent(p.icon, p.name, p.displayLabel)
                )
              )
              : (
                groupUIs.map((ext) =>
                  getRadioTileComponent(ext.icon ?? <SvgAdd />, ext.name, ext.displayLabel),
                )
              )}
          </RadioTileGroup>
          {queryGenerationType && createQueryBuilderComponent()}
        </Fieldset>
      </div>
      <ActionPanel
        onSave={async () => {
          await save();
        }}
        onCancel={async () => {
          Presentation.selection.clearSelection(
            "GroupingMappingWidget",
            iModelConnection,
          );
          await props.goBack();
        }}
        isSavingDisabled={isBlockingActions}
        isLoading={isLoading}
      />
    </>
  );
};

export default GroupAction;
