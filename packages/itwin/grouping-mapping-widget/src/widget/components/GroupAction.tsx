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
  SidenavButton,
  SideNavigation,
  Small,
  toaster,
} from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useState } from "react";
import {
  EmptyMessage,
  handleError,
  handleInputChange,
  WidgetHeader,
} from "./utils";
import type { GroupType } from "./Grouping";
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
import { useGroupExtension } from "./context/GroupExtensionContext";
import ManualExtension from "./extension/ManualExtension";
import SearchExtension from "./extension/SearchExtension";
import { SvgCursor, SvgDraw, SvgSearch } from "@itwin/itwinui-icons-react";

interface GroupActionProps {
  iModelId: string;
  mappingId: string;
  group?: GroupType;
  queryGenerationType?: string;
  goBack: () => Promise<void>;
  resetView: () => Promise<void>;
}

const GroupAction = ({
  iModelId,
  mappingId,
  group,
  queryGenerationType,
  goBack,
  resetView,
}: GroupActionProps) => {
  const iModelConnection = useActiveIModelConnection() as IModelConnection;
  const { getAccessToken } = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const groupExtension = useGroupExtension();

  const [details, setDetails] = useState({
    groupName: group?.groupName ?? "",
    description: group?.description ?? "",
  });
  const [query, setQuery] = useState<string>("");
  const [simpleSelectionQuery, setSimpleSelectionQuery] = useState<string>("");
  const [validator, showValidationMessage] = useValidator();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [currentPropertyList, setCurrentPropertyList] = React.useState<
    PropertyRecord[]
  >([]);
  const [queryBuilder, setQueryBuilder] = React.useState<QueryBuilder>(
    new QueryBuilder(undefined),
  );
  const [localQueryGenerationType, setQueryGenerationType] =
    React.useState(queryGenerationType);

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
    await resetView();
  };

  useEffect(() => {
    const removeListener = Presentation.selection.selectionChange.addListener(
      async (
        evt: SelectionChangeEventArgs,
        selectionProvider: ISelectionProvider,
      ) => {
        if (localQueryGenerationType === "Selection") {
          const selection = selectionProvider.getSelection(
            evt.imodel,
            evt.level,
          );
          const query =
            selection.instanceKeys.size > 0
              ? `SELECT ECInstanceId FROM ${selection.instanceKeys.keys().next().value
              }`
              : "";
          setSimpleSelectionQuery(query);
        }
      },
    );
    return () => {
      removeListener();
    };
  }, [iModelConnection, localQueryGenerationType]);

  useEffect(() => {
    const reemphasize = async () => {
      try {
        if (!query || query === "") {
          return;
        }

        if (
          localQueryGenerationType === "Selection" &&
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
  }, [iModelConnection, query, currentPropertyList, localQueryGenerationType]);

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

      group
        ? await mappingClient.updateGroup(
          accessToken,
          iModelId,
          mappingId,
          group.id ?? "",
          { ...details, query: currentQuery },
        )
        : await mappingClient.createGroup(accessToken, iModelId, mappingId, {
          ...details,
          query: currentQuery,
        });
      Presentation.selection.clearSelection(
        "GroupingMappingWidget",
        iModelConnection,
      );
      await goBack();
    } catch (error: any) {
      handleError(error.status);
      setIsLoading(false);
    }
  }, [
    details,
    goBack,
    group,
    iModelConnection,
    iModelId,
    mappingId,
    query,
    showValidationMessage,
    simpleSelectionQuery,
    validator,
    getAccessToken,
    mappingClient,
  ]);

  const queryGenerationComponent = () => {
    switch (localQueryGenerationType) {
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
          <SearchExtension
            updateQuery={updateQuery}
            isUpdating={isUpdating}
            resetView={resetView}
          />
        );
      }
      case "Manual": {
        return (
          <ManualExtension
            updateQuery={updateQuery}
            isUpdating={isUpdating}
            resetView={resetView}
          />
        );
      }
      default: {
        if (localQueryGenerationType && localQueryGenerationType.length > 0) {
          const selectedExtension = groupExtension.extensions?.find(
            (e) => e.name === localQueryGenerationType,
          );
          if (selectedExtension) {
            return React.createElement(selectedExtension.uiComponent, {
              updateQuery,
              isUpdating: isLoading || isRendering,
              resetView,
            });
          }
        }
        return <EmptyMessage message="No query generation method selected. " />;
      }
    }
  };

  const isBlockingActions = !(
    details.groupName &&
    (query || simpleSelectionQuery) &&
    !isRendering &&
    !isLoading
  );

  return (
    <>
      <WidgetHeader
        title={group ? group.groupName ?? "" : "Add Group"}
        returnFn={async () => {
          Presentation.selection.clearSelection(
            "GroupingMappingWidget",
            iModelConnection,
          );
          await goBack();
        }}
      />
      <div className="group-add-modify-container">
        <Fieldset legend="Group Details" className="group-details">
          <Small className="field-legend">
            Asterisk * indicates mandatory fields.
          </Small>
          <LabeledInput
            id="groupName"
            name="groupName"
            label="Name"
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
            id="description"
            name="description"
            label="Description"
            value={details.description}
            onChange={(event) => {
              handleInputChange(event, details, setDetails);
            }}
          />
        </Fieldset>
        <Fieldset legend="Group By" className="query-builder-container">
          <RadioTileGroup className="radio-group-tile" required>
            {groupExtension.extendsDefault && (
              <>
                <RadioTile
                  name={"groupby"}
                  icon={<SvgCursor />}
                  onChange={changeGroupByType}
                  value={"Selection"}
                  label={"Selection"}
                  disabled={isLoading || isRendering}
                  checked={localQueryGenerationType === "Selection"}
                />
                <RadioTile
                  icon={<SvgSearch />}
                  name={"groupby"}
                  onChange={changeGroupByType}
                  value={"Search"}
                  label={"Query Keywords"}
                  disabled={isLoading || isRendering}
                  checked={localQueryGenerationType === "Search"}
                />
                <RadioTile
                  icon={<SvgDraw />}
                  name={"groupby"}
                  onChange={changeGroupByType}
                  value={"Manual"}
                  label={"Manual Query"}
                  disabled={isLoading || isRendering}
                  checked={localQueryGenerationType === "Manual"}
                />
                {groupExtension.extensions?.map((ext) => (
                  <RadioTile
                    key={ext.name}
                    icon={ext.icon}
                    name={"groupby"}
                    onChange={changeGroupByType}
                    value={ext.name}
                    label={ext.displayLabel}
                    disabled={isLoading || isRendering}
                    checked={localQueryGenerationType === ext.name}
                  />
                ))}
              </>
            )}
          </RadioTileGroup>
          {localQueryGenerationType && queryGenerationComponent()}
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
          await goBack();
        }}
        isSavingDisabled={isBlockingActions}
        isLoading={isLoading}
      />
    </>
  );
};

export default GroupAction;
