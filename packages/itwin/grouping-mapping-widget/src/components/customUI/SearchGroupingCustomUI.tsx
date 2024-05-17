/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import { Alert, Button, LabeledTextarea } from "@itwin/itwinui-react";
import type { GroupingCustomUIProps } from "./GroupingMappingCustomUI";
import { LoadingSpinner } from "../SharedComponents/LoadingSpinner";
import "./SearchGroupingCustomUI.scss";

/**
 * A default group query builder for the Grouping Mapping Widget that uses a generic query template to search for elements.
 * @public
 */
export const SearchGroupingCustomUI = ({
  updateQuery,
  isUpdating,
  resetView,
}: GroupingCustomUIProps) => {
  const [searchInput, setSearchInput] = React.useState("");
  const isWrappedInQuotes = (text: string) => {
    return text.startsWith(`"`) && text.endsWith(`"`);
  };

  const needsAndOperator = (
    token: string,
    index: number,
    searchQuery: string[],
  ) =>
    isWrappedInQuotes(token) ||
    (index === 1 && isWrappedInQuotes(searchQuery[0]));

  const generateSearchQuery = (searchQuery: string[]) => {
    if (searchQuery.length === 0) {
      updateQuery("");
      return;
    }

    let generatedSearchQuery = `SELECT be.ECInstanceId, be.ECClassId FROM bis.geometricelement3d be `;
    generatedSearchQuery += `LEFT JOIN bis.SpatialCategory cat ON be.Category.Id = cat.ECInstanceID LEFT JOIN ecdbmeta.ECClassDef ecc ON be.ECClassId = ecc.ECInstanceId `;
    generatedSearchQuery += `LEFT JOIN bis.PhysicalType pt ON be.TypeDefinition.Id = pt.ECInstanceID`;
    generatedSearchQuery += ` WHERE `;
    generatedSearchQuery += `((${searchQuery
      .map(
        (token, index) =>
          `${index === 0
            ? ""
            : needsAndOperator(token, index, searchQuery)
              ? "AND"
              : "OR"
          } be.codevalue LIKE '%${isWrappedInQuotes(token) ? token.slice(1, -1) : token
          }%'`,
      )
      .join(" ")}) OR (${searchQuery
      .map(
        (token, index) =>
          `${index === 0
            ? ""
            : needsAndOperator(token, index, searchQuery)
              ? "AND"
              : "OR"
          } be.userlabel LIKE '%${isWrappedInQuotes(token) ? token.slice(1, -1) : token
          }%'`,
      )
      .join(" ")})) OR ((${searchQuery
      .map(
        (token, index) =>
          `${index === 0
            ? ""
            : needsAndOperator(token, index, searchQuery)
              ? "AND"
              : "OR"
          } cat.codevalue LIKE '%${isWrappedInQuotes(token) ? token.slice(1, -1) : token
          }%'`,
      )
      .join(" ")}) OR (${searchQuery
      .map(
        (token, index) =>
          `${index === 0
            ? ""
            : needsAndOperator(token, index, searchQuery)
              ? "AND"
              : "OR"
          } cat.userlabel LIKE '%${isWrappedInQuotes(token) ? token.slice(1, -1) : token
          }%'`,
      )
      .join(" ")})) OR (${searchQuery
      .map(
        (token, index) =>
          `${index === 0
            ? ""
            : needsAndOperator(token, index, searchQuery)
              ? "AND"
              : "OR"
          } ecc.name LIKE '%${isWrappedInQuotes(token) ? token.slice(1, -1) : token
          }%'`,
      )
      .join(" ")})`;
    // Physical Types
    generatedSearchQuery += ` OR ((${searchQuery
      .map(
        (token, index) =>
          `${index === 0
            ? ""
            : needsAndOperator(token, index, searchQuery)
              ? "AND"
              : "OR"
          } pt.codevalue LIKE '%${isWrappedInQuotes(token) ? token.slice(1, -1) : token
          }%'`,
      )
      .join(" ")}) OR (${searchQuery
      .map(
        (token, index) =>
          `${index === 0
            ? ""
            : needsAndOperator(token, index, searchQuery)
              ? "AND"
              : "OR"
          } pt.userlabel LIKE '%${isWrappedInQuotes(token) ? token.slice(1, -1) : token
          }%'`,
      )
      .join(" ")})) `;

    updateQuery(generatedSearchQuery);
  };

  return (
    <div className='gmw-search-form'>
      <Alert type='informational'>
        Generate a query by keywords. Keywords wrapped in double quotes will be
        considered a required criteria.
      </Alert>
      <LabeledTextarea
        label='Query Keywords'
        required
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
        disabled={isUpdating}
        placeholder={`E.g. "red" chair`}
      />
      <div className='gmw-search-actions'>
        {isUpdating && <LoadingSpinner />}
        <Button
          disabled={isUpdating}
          onClick={() =>
            generateSearchQuery(
              searchInput
                ? searchInput
                  .replace(/(\r\n|\n|\r)/gm, "")
                  .trim()
                  .split(" ")
                : [],
            )
          }
        >
          Apply
        </Button>
        <Button
          disabled={isUpdating}
          onClick={async () => {
            updateQuery("");
            setSearchInput("");
            if (resetView) {
              await resetView();
            }
          }}
        >
          Clear
        </Button>
      </div>
    </div>
  );
};
