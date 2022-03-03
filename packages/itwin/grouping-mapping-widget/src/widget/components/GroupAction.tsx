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
import React, { useCallback, useEffect, useState } from "react";
import { reportingClientApi } from "../../api/reportingClient";
import { fetchIdsFromQuery, handleError, handleInputChange, WidgetHeader } from "./utils";
import type { Group } from "./Grouping";
import "./GroupAction.scss";
import ActionPanel from "./ActionPanel";
import useValidator, { NAME_REQUIREMENTS } from "../hooks/useValidator";
import type { PropertyRecord } from "@itwin/appui-abstract";
import { GroupQueryBuilderContainer } from "./GroupQueryBuilderContainer";
import { GroupQueryBuilderContext } from "./GroupQueryBuilderContext";
import { QueryBuilder } from "./QueryBuilder";
import {
  clearEmphasizedElements,
  visualizeElementsById,
  zoomToElements,
} from "./viewerUtils";
import { SvgCursor, SvgSearch } from "@itwin/itwinui-icons-react";

interface GroupActionProps {
  iModelId: string;
  mappingId: string;
  group?: Group;
  goBack: () => Promise<void>;
}

const GroupAction = ({
  iModelId,
  mappingId,
  group,
  goBack,
}: GroupActionProps) => {
  const iModelConnection = useActiveIModelConnection() as IModelConnection;
  const [details, setDetails] = useState({
    groupName: group?.groupName ?? "",
    description: group?.description ?? "",
  });
  const [query, setQuery] = useState<string>("");
  const [simpleQuery, setSimpleQuery] = useState<string>("");
  const [validator, showValidationMessage] = useValidator();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentPropertyList, setCurrentPropertyList] = React.useState<
  PropertyRecord[]
  >([]);
  const [queryBuilder, setQueryBuilder] = React.useState<QueryBuilder>(
    new QueryBuilder(undefined),
  );
  const [groupByType, setGroupByType] = React.useState("Selection");
  const [searchInput, setSearchInput] = React.useState("");

  const changeGroupByType = (event: React.ChangeEvent<HTMLInputElement>) => {
    const {
      target: { value },
    } = event;
    setGroupByType(value);
    Presentation.selection.clearSelection(
      "GroupingMappingWidget",
      iModelConnection,
    );
    setQuery("");
  };

  useEffect(() => {
    const removeListener = Presentation.selection.selectionChange.addListener(
      async (
        evt: SelectionChangeEventArgs,
        selectionProvider: ISelectionProvider,
      ) => {
        const selection = selectionProvider.getSelection(evt.imodel, evt.level);
        const query = selection.instanceKeys.size > 0 ? `SELECT ECInstanceId FROM ${selection.instanceKeys.keys().next().value
        }` : "";
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
        clearEmphasizedElements();
        if (!query || query === "") {
          return;
        }

        setIsLoading(true);
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
        setIsLoading(false);
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

  const isWrappedInQuotes = (text: string) => {
    return text.startsWith(`"`) && text.endsWith(`"`);
  };
  // Temporary until ECViews become available for use.
  const generateSearchQuery = (searchQuery: string[]) => {
    const generatedSearchQuery = searchQuery.length > 0 ? `SELECT
      be.ecinstanceid
    FROM
      generic.physicalobject be
      JOIN
        biscore.geometricelement3disincategory ce
        ON be.ecinstanceid = ce.sourceecinstanceid
      JOIN
        bis.ELEMENT de
        ON ce.targetecinstanceid = de.ecinstanceid
    WHERE
      (${searchQuery.map((token, index) =>
    `${index === 0 ? "" : isWrappedInQuotes(token) ? "AND" : "OR"}
      de.codevalue LIKE '%${isWrappedInQuotes(token) ? token.slice(1, -1) : token}%'`
  ).join(" ")}
      )
    UNION
    SELECT
      de.ecinstanceid
    FROM
      biscore.geometricelement3d AS de
      JOIN
        ecdbmeta.ecclassdef AS be
        ON de.ecclassid = be.ecinstanceid
    WHERE
      (${searchQuery.map((token, index) =>
    `${index === 0 ? "" : isWrappedInQuotes(token) ? "AND" : "OR"}
      be.name LIKE '%${isWrappedInQuotes(token) ? token.slice(1, -1) : token}%'`
  ).join(" ")}
      )
    UNION
    SELECT
      be.ecinstanceid
    FROM
      generic.physicalobject be
    WHERE
      (${searchQuery.map((token, index) =>
    `${index === 0 ? "" : isWrappedInQuotes(token) ? "AND" : "OR"}
      be.userlabel LIKE '%${isWrappedInQuotes(token) ? token.slice(1, -1) : token}%'`
  ).join(" ")}
      )` : "";
    setQuery(generatedSearchQuery.trim());

  };

  const save = useCallback(async () => {
    if (!validator.allValid()) {
      showValidationMessage(true);
      return;
    }
    try {
      setIsLoading(true);
      const currentQuery = query || simpleQuery;

      group
        ? await reportingClientApi.updateGroup(
          iModelId,
          mappingId,
          group.id ?? "",
          { ...details, query: currentQuery },
        )
        : await reportingClientApi.createGroup(iModelId, mappingId, {
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
  ]);

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
            required
            name='description'
            label='Description'
            value={details.description}
            onChange={(event) => {
              handleInputChange(event, details, setDetails);
              validator.showMessageFor("description");
            }}
            message={validator.message(
              "description",
              details.description,
              "required",
            )}
            status={
              validator.message("description", details.description, "required")
                ? "negative"
                : undefined
            }
            onBlur={() => {
              validator.showMessageFor("description");
            }}
            onBlurCapture={(event) => {
              handleInputChange(event, details, setDetails);
              validator.showMessageFor("description");
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
            />
            <RadioTile
              icon={<SvgSearch />}
              name={"groupby"}
              onChange={changeGroupByType}
              value={"Search"}
              label={"Search"}
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
              }}
            >
              <GroupQueryBuilderContainer />
            </GroupQueryBuilderContext.Provider> :
            <div className="search-form">
              <Text>Generate a query by searching with words. Words wrapped in double quotes will be considered a required search criteria.</Text>
              <LabeledTextarea
                label="Search"
                required
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                disabled={isLoading}
                placeholder={`ex: wall curtain "panel" facade`} />
              <div className="search-actions">
                <Button disabled={isLoading} onClick={() => generateSearchQuery(searchInput ? searchInput.split(" ") : [])}>Apply</Button>
                <Button disabled={isLoading} onClick={() => {
                  setQuery("");
                  setSearchInput("");
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
        disabled={
          !(details.groupName && details.description && (query || simpleQuery))
        }
        isLoading={isLoading}
      />
    </>
  );
};

export default GroupAction;
