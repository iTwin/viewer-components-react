/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelConnection } from "@itwin/core-frontend";
import {
  ISelectionProvider,
  Presentation,
  SelectionChangeEventArgs,
} from "@itwin/presentation-frontend";
import { useActiveIModelConnection } from "@itwin/appui-react";
import { Fieldset, LabeledInput, Small } from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useState } from "react";
import { reportingClientApi } from "../../api/reportingClient";
import { fetchIdsFromQuery, handleInputChange, WidgetHeader } from "./utils";
import { Group } from "./Grouping";
import "./GroupAction.scss";
import ActionPanel from "./ActionPanel";
import useValidator, { NAME_REQUIREMENTS } from "../hooks/useValidator";
import { PropertyRecord } from "@itwin/appui-abstract";
import { GroupQueryBuilderContainer } from "./GroupQueryBuilderContainer";
import { GroupQueryBuilderContext } from "./GroupQueryBuilderContext";
import { QueryBuilder } from "./QueryBuilder";
import {
  clearEmphasizedElements,
  visualizeElementsById,
  zoomToElements,
} from "./viewerUtils";

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

  useEffect(() => {
    const removeListener = Presentation.selection.selectionChange.addListener(
      async (
        evt: SelectionChangeEventArgs,
        selectionProvider: ISelectionProvider,
      ) => {
        const selection = selectionProvider.getSelection(evt.imodel, evt.level);
        const query = `SELECT ECInstanceId FROM ${selection.instanceKeys.keys().next().value
        }`;
        // Selects all instances of the class
        // const ids = await fetchIdsFromQuery(query, iModelConnection);
        // const keySet = await manufactureKeys(ids, iModelConnection);
        // Presentation.selection.replaceSelection(
        //   "GroupingMappingWidget",
        //   iModelConnection,
        //   keySet
        // );
        // setSelectionInstanceKeys(selection.instanceKeys);
        setSimpleQuery(query);
      },
    );
    return () => {
      removeListener();
    };
  }, [iModelConnection]);

  useEffect(() => {
    const reemphasize = async () => {
      clearEmphasizedElements();
      if (!query || query === "") {
        return;
      }
      const ids = await fetchIdsFromQuery(query ?? "", iModelConnection);
      const resolvedHiliteIds = await visualizeElementsById(
        ids,
        "red",
        iModelConnection,
      );
      await zoomToElements(resolvedHiliteIds);
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
    } catch {
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

        <Fieldset legend='Group By' className='find-similar'>
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
          </GroupQueryBuilderContext.Provider>
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
