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
import "./GroupAction.scss";
import ActionPanel from "./ActionPanel";
import useValidator, { NAME_REQUIREMENTS } from "../hooks/useValidator";
import type { PropertyRecord } from "@itwin/appui-abstract";
import { GroupQueryBuilderContainer } from "./GroupQueryBuilderContainer";
import { QueryBuilder } from "./QueryBuilder";
import {
  transparentOverriddenElements,
  visualizeElementsByQuery,
  zoomToElements,
} from "./viewerUtils";
import { GroupQueryBuilderContext } from "./context/GroupQueryBuilderContext";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import { useMappingClient } from "./context/MappingClientContext";
import { useCustomUIProvider } from "./context/CustomUIProviderContext";
import ManualUIProvider from "./provider/ManualUIProvider";
import SearchUIProvider from "./provider/SearchUIProvider";
import { SvgAdd, SvgCursor, SvgDraw, SvgSearch } from "@itwin/itwinui-icons-react";

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
  const uiProviders = useCustomUIProvider();

  const [details, setDetails] = useState({
    groupName: props.group?.groupName ?? "",
    description: props.group?.description ?? "",
  });
  const [query, setQuery] = useState<string>("");
  const [simpleSelectionQuery, setSimpleSelectionQuery] = useState<string>("");
  const [validator, showValidationMessage] = useValidator();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [currentPropertyList, setCurrentPropertyList] = useState<
  PropertyRecord[]
  >([]);
  const [queryBuilder, setQueryBuilder] = useState<QueryBuilder>(
    new QueryBuilder(undefined),
  );
  const [queryGenerationType, setQueryGenerationType] = useState(
    props.queryGenerationType,
  );
  const resetView = props.resetView;

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
          const query =
            selection.instanceKeys.size > 0
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

        if (
          queryGenerationType === "Selection" &&
          currentPropertyList.length === 0
        ) {
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
  }, [iModelConnection, query, currentPropertyList, queryGenerationType]);

  useEffect(() => {
    Presentation.selection.clearSelection(
      "GroupingMappingWidget",
      iModelConnection,
    );
  }, [iModelConnection]);

  const updateQuery = useCallback(
    (newQuery: string) => {
      setQuery(newQuery);
    },
    [setQuery],
  );

  const isUpdating = isLoading || isRendering;

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

  const queryGenerationComponent = () => {
    switch (queryGenerationType) {
      case "Selection": {
        return (
          <GroupQueryBuilderContext.Provider
            value={{
              currentPropertyList,
              setCurrentPropertyList,
              query,
              setQuery,
              queryBuilder,
              setQueryBuilder,
              isLoading,
              isRendering,
              resetView,
            }}
          >
            <GroupQueryBuilderContainer />
          </GroupQueryBuilderContext.Provider>
        );
      }
      case "Search": {
        return (
          <SearchUIProvider
            updateQuery={updateQuery}
            isUpdating={isUpdating}
            resetView={props.resetView}
          />
        );
      }
      case "Manual": {
        return (
          <ManualUIProvider
            updateQuery={updateQuery}
            isUpdating={isUpdating}
            resetView={props.resetView}
          />
        );
      }
      default: {
        if (queryGenerationType && queryGenerationType.length > 0) {
          const selectedUIProvider = uiProviders.find(
            (e) => e.name === queryGenerationType,
          );
          if (selectedUIProvider) {
            return React.createElement(selectedUIProvider.uiComponent, {
              updateQuery,
              isUpdating,
              resetView,
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
        disabled={isLoading || isRendering}
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
            {uiProviders.length === 0
              ? (
                <>
                  {getRadioTileComponent(<SvgCursor />, "Selection", "Selection")}
                  {getRadioTileComponent(<SvgSearch />, "Search", "Query Keywords")}
                  {getRadioTileComponent(<SvgDraw />, "Manual", "Manual Query")}
                </>
              )
              : (
                uiProviders.map((ext) =>
                  getRadioTileComponent(ext.icon ?? <SvgAdd />, ext.name, ext.displayLabel),
                )
              )}
          </RadioTileGroup>
          {queryGenerationType && queryGenerationComponent()}
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
