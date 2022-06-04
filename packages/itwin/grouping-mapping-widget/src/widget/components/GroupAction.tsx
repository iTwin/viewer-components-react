/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { IModelConnection } from "@itwin/core-frontend";
import type {
  ISelectionProvider,
  SelectionChangeEventArgs,
} from "@itwin/presentation-frontend";
import {
  Presentation,
} from "@itwin/presentation-frontend";
import { useActiveIModelConnection } from "@itwin/appui-react";
import { Button, Fieldset, LabeledInput, LabeledTextarea, RadioTile, RadioTileGroup, Small, Text, toaster } from "@itwin/itwinui-react";
import React, { useCallback, useContext, useEffect, useState } from "react";
import { fetchIdsFromQuery, handleError, handleInputChange, LoadingSpinner, WidgetHeader } from "./utils";
import type { GroupType } from "./Grouping";
import "./GroupAction.scss";
import ActionPanel from "./ActionPanel";
import useValidator, { NAME_REQUIREMENTS } from "../hooks/useValidator";
import type { PropertyRecord } from "@itwin/appui-abstract";
import { GroupQueryBuilderContainer } from "./GroupQueryBuilderContainer";
import { GroupQueryBuilderContext } from "./GroupQueryBuilderContext";
import { QueryBuilder } from "./QueryBuilder";
import {
  transparentOverriddenElements,
  visualizeElementsById,
  zoomToElements,
} from "./viewerUtils";
import { SvgCursor, SvgSearch } from "@itwin/itwinui-icons-react";
import { ReportingClient } from "@itwin/insights-client";
import { ApiContext } from "./GroupingMapping";

interface GroupActionProps {
  iModelId: string;
  mappingId: string;
  group?: GroupType;
  goBack: () => Promise<void>;
  resetView: () => Promise<void>;
}

const GroupAction = ({
  iModelId,
  mappingId,
  group,
  goBack,
  resetView,
}: GroupActionProps) => {
  const iModelConnection = useActiveIModelConnection() as IModelConnection;
  const apiContext = useContext(ApiContext);
  const [details, setDetails] = useState({
    groupName: group?.groupName ?? "",
    description: group?.description ?? "",
  });
  const [query, setQuery] = useState<string>("");
  const [simpleQuery, setSimpleQuery] = useState<string>("");
  const [validator, showValidationMessage] = useValidator();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [currentPropertyList, setCurrentPropertyList] = React.useState<PropertyRecord[]>([]);
  const [queryBuilder, setQueryBuilder] = React.useState<QueryBuilder>(
    new QueryBuilder(undefined),
  );
  const [groupByType, setGroupByType] = React.useState("Selection");
  const [searchInput, setSearchInput] = React.useState("");

  const changeGroupByType = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const {
      target: { value },
    } = event;
    setGroupByType(value);
    Presentation.selection.clearSelection(
      "GroupingMappingWidget",
      iModelConnection,
    );
    setQuery("");
    await resetView();
  };

  useEffect(() => {
    const removeListener = Presentation.selection.selectionChange.addListener(
      async (
        evt: SelectionChangeEventArgs,
        selectionProvider: ISelectionProvider,
      ) => {
        const selection = selectionProvider.getSelection(evt.imodel, evt.level);
        const query = selection.instanceKeys.size > 0 ? `SELECT ECInstanceId FROM ${selection.instanceKeys.keys().next().value}` : "";
        setSimpleQuery(query);
      },
    );
    return () => {
      removeListener();
    };
  }, [iModelConnection]);

  useEffect(() => {
    const reemphasize = async () => {
      try {
        if (!query || query === "") {
          return;
        }

        if (groupByType === "Selection" && currentPropertyList.length === 0) {
          return;
        }

        setIsRendering(true);
        transparentOverriddenElements();
        const ids = await fetchIdsFromQuery(query ?? "", iModelConnection);
        const resolvedHiliteIds = await visualizeElementsById(
          ids,
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
  }, [iModelConnection, query, currentPropertyList, groupByType]);

  useEffect(() => {
    Presentation.selection.clearSelection(
      "GroupingMappingWidget",
      iModelConnection,
    );
  }, [iModelConnection]);

  const isWrappedInQuotes = (text: string) => {
    return text.startsWith(`"`) && text.endsWith(`"`);
  };

  const needsAndOperator = (token: string, index: number, searchQuery: string[]) => isWrappedInQuotes(token) || (index === 1 && isWrappedInQuotes(searchQuery[0]));
  // Temporary until ECViews become available for use.
  const generateSearchQuery = (searchQuery: string[]) => {
    if (searchQuery.length === 0) {
      setQuery("");
      return;
    }

    let generatedSearchQuery =
      `SELECT be.ECInstanceId, be.ECClassId FROM bis.geometricelement3d be `;
    generatedSearchQuery += `LEFT JOIN bis.SpatialCategory cat ON be.Category.Id = cat.ECInstanceID LEFT JOIN ecdbmeta.ECClassDef ecc ON be.ECClassId = ecc.ECInstanceId `;
    generatedSearchQuery += `LEFT JOIN bis.PhysicalType pt ON be.TypeDefinition.Id = pt.ECInstanceID`;
    generatedSearchQuery += ` WHERE `;
    generatedSearchQuery += `((${searchQuery.map((token, index) =>
      `${index === 0 ? "" : needsAndOperator(token, index, searchQuery) ? "AND" : "OR"} be.codevalue LIKE '%${isWrappedInQuotes(token) ? token.slice(1, -1) : token}%'`
    ).join(" ")}) OR (${searchQuery.map((token, index) =>
      `${index === 0 ? "" : needsAndOperator(token, index, searchQuery) ? "AND" : "OR"} be.userlabel LIKE '%${isWrappedInQuotes(token) ? token.slice(1, -1) : token}%'`
    ).join(" ")})) OR ((${searchQuery.map((token, index) =>
      `${index === 0 ? "" : needsAndOperator(token, index, searchQuery) ? "AND" : "OR"} cat.codevalue LIKE '%${isWrappedInQuotes(token) ? token.slice(1, -1) : token}%'`
    ).join(" ")}) OR (${searchQuery.map((token, index) =>
      `${index === 0 ? "" : needsAndOperator(token, index, searchQuery) ? "AND" : "OR"} cat.userlabel LIKE '%${isWrappedInQuotes(token) ? token.slice(1, -1) : token}%'`
    ).join(" ")})) OR (${searchQuery.map((token, index) =>
      `${index === 0 ? "" : needsAndOperator(token, index, searchQuery) ? "AND" : "OR"} ecc.name LIKE '%${isWrappedInQuotes(token) ? token.slice(1, -1) : token}%'`
    ).join(" ")})`;
    // Physical Types
    generatedSearchQuery += ` OR ((${searchQuery.map((token, index) =>
      `${index === 0 ? "" : needsAndOperator(token, index, searchQuery) ? "AND" : "OR"} pt.codevalue LIKE '%${isWrappedInQuotes(token) ? token.slice(1, -1) : token}%'`
    ).join(" ")}) OR (${searchQuery.map((token, index) =>
      `${index === 0 ? "" : needsAndOperator(token, index, searchQuery) ? "AND" : "OR"} pt.userlabel LIKE '%${isWrappedInQuotes(token) ? token.slice(1, -1) : token}%'`
    ).join(" ")})) `;

    setQuery(generatedSearchQuery);
  };

  const save = useCallback(async () => {
    if (!validator.allValid()) {
      showValidationMessage(true);
      return;
    }
    try {
      setIsLoading(true);
      const currentQuery = query || simpleQuery;
      const reportingClientApi = new ReportingClient(apiContext.prefix);

      group
        ? await reportingClientApi.updateGroup(
          apiContext.accessToken,
          iModelId,
          mappingId,
          group.id ?? "",
          { ...details, query: currentQuery },
        )
        : await reportingClientApi.createGroup(apiContext.accessToken, iModelId, mappingId, {
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
    simpleQuery,
    validator,
    apiContext.accessToken,
    apiContext.prefix,
  ]);

  const isBlockingActions = !(details.groupName && (query || simpleQuery) && !isRendering && !isLoading);

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
      <div className='group-add-modify-container'>
        <Fieldset legend='Group Details' className='group-details'>
          <Small className='field-legend'>
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
        <Fieldset legend='Group By' className='query-builder-container'>
          <RadioTileGroup
            className="radio-group-tile"
            required>
            <RadioTile
              name={"groupby"}
              icon={<SvgCursor />}
              onChange={changeGroupByType}
              defaultChecked
              value={"Selection"}
              label={"Selection"}
              disabled={isLoading || isRendering}
            />
            <RadioTile
              icon={<SvgSearch />}
              name={"groupby"}
              onChange={changeGroupByType}
              value={"Query Keywords"}
              label={"Query Keywords"}
              disabled={isLoading || isRendering}
            />
          </RadioTileGroup>
          {groupByType === "Selection" ?
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
            </GroupQueryBuilderContext.Provider> :
            <div className="search-form">
              <Text>Generate a query by keywords. Keywords wrapped in double quotes will be considered a required criteria.</Text>
              <LabeledTextarea
                label="Query Keywords"
                required
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                disabled={isLoading || isRendering}
                placeholder={`E.g. "red" chair`} />
              <div className="search-actions">
                {isRendering &&
                  <LoadingSpinner />
                }
                <Button disabled={isLoading || isRendering} onClick={() => generateSearchQuery(searchInput ? searchInput.replace(/(\r\n|\n|\r)/gm, "").trim().split(" ") : [])}>Apply</Button>
                <Button disabled={isLoading || isRendering} onClick={async () => {
                  setQuery("");
                  setSearchInput("");
                  await resetView();
                }}>Clear</Button>
              </div>
            </div>
          }
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
        isSavingDisabled={
          isBlockingActions
        }
        isCancelDisabled={isBlockingActions}
        isLoading={isLoading}
      />
    </>
  );
};

export default GroupAction;
