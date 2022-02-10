/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { SvgChevronLeft } from "@itwin/itwinui-icons-react";
import { Text, toaster } from "@itwin/itwinui-react";
import "./utils.scss";
import React from "react";
import type {
  ISelectionProvider,
  SelectionChangeEventArgs,
} from "@itwin/presentation-frontend";
import type { IModelConnection } from "@itwin/core-frontend";
import { QueryRowFormat } from "@itwin/core-common";

export const onSelectionChanged = (
  evt: SelectionChangeEventArgs,
  selectionProvider: ISelectionProvider,
) => {
  /* eslint-disable no-console */
  const selection = selectionProvider.getSelection(evt.imodel, evt.level);
  if (selection.isEmpty) {
    console.log("========== Selection cleared ==========");
  } else {
    console.log("========== Selection change ===========");
    if (selection.instanceKeys.size !== 0) {
      // log all selected ECInstance ids grouped by ECClass name
      console.log("ECInstances:");
      selection.instanceKeys.forEach((ids, ecclass) => {
        console.log(`${ecclass}: [${[...ids].join(",")}]`);
      });
    }
    if (selection.nodeKeys.size !== 0) {
      // log all selected node keys
      console.log("Nodes:");
      selection.nodeKeys.forEach((key) => console.log(JSON.stringify(key)));
    }
    console.log("=======================================");
  }
  /* eslint-enable no-console */
};

export interface WidgetHeaderProps {
  title: string;
  disabled?: boolean;
  returnFn?: () => Promise<void>;
}

export const WidgetHeader = ({
  title,
  disabled = false,
  returnFn,
}: WidgetHeaderProps) => {
  return (
    <div className='widget-header-container'>
      {returnFn && (
        <div
          className={disabled ? "chevron-disabled" : "chevron"}
          onClick={disabled ? undefined : returnFn}
        >
          <SvgChevronLeft />
        </div>
      )}
      <Text className='title' variant='title'>
        {title}
      </Text>
    </div>
  );
};

export const handleInputChange = <T,>(
  e: React.ChangeEvent<HTMLInputElement>,
  values: T,
  setValues: React.Dispatch<React.SetStateAction<T>>,
) => {
  const { name, value } = e.target;

  setValues({
    ...values,
    [name]: value,
  });
};

export const fetchIdsFromQuery = async (
  query: string,
  iModelConnection: IModelConnection,
) => {
  if (query === "") {
    return [];
  }
  try {
    const ids: string[] = [];
    const rowIterator = iModelConnection.query(query, undefined, {
      rowFormat: QueryRowFormat.UseJsPropertyNames,
    });
    while (true) {
      const { done, value } = await rowIterator.next();
      if (done) {
        break;
      }
      if (Object.keys(value).includes("id")) {
        // eslint-disable-next-line dot-notation
        ids.push(value.id);
      } else if (Object.keys(value).includes("element.id")) {
        ids.push(value["element.id"]);
      }
      // eslint-disable-next-line dot-notation
      ids.push(value.id);
    }

    return ids;
  } catch (error) {
    toaster.negative("Failed to resolve query.");
    throw (error);
  }
};

export const handleError = (errorStatus: number) => {
  let errorMessage = `Error ${errorStatus}: `;
  switch (errorStatus) {
    case 401:
      errorMessage += `You are unauthorized to do this operation.`;
      break;
    case 403:
      errorMessage += `You don't have permission to access the requested resource.`;
      break;
    case 404:
      errorMessage += `The requested resource was not found.`;
      break;
    case 409:
      errorMessage += `This property name is already being used.`;
      break;
    case 422:
      errorMessage += `Unable to process the request.`;
      break;
    case 429:
      errorMessage += `Too many requests.`;
      break;
    case 500:
      errorMessage += `Internal server error.`;
      break;
    case 502:
      errorMessage += `Bad gateway.`;
      break;
    case 503:
      errorMessage += `Service unavailable.`;
      break;
    default:
      errorMessage += `Something went wrong!`;
  }
  toaster.negative(errorMessage);

};
