/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { forEach as _forEach, isEqual as _isEqual } from "lodash";
import { Exclude } from "class-transformer";

export class SearchQuery {

  @Exclude({ toPlainOnly: true })
  private pageNumber = 0;

  @Exclude({ toPlainOnly: true })
  private pageSize = 30;

  private sortBy: string[] = ["props.NAME"];
  private sortOrder: "asc" | "desc" = "asc";

  private searchFor = "";
  private searchFields: string[] = ["id", "type", "props.NAME", "props.NOTES"];

  @Exclude({ toPlainOnly: true })
  private queryParams: {[key: string]: any} = {};

  @Exclude({ toPlainOnly: true })
  private endOfResults?: boolean;

  @Exclude({ toPlainOnly: true })
  private noResultsFound?: boolean;

  public getPageNumber(): number {
    return this.pageNumber;
  }

  public setPageNumber(pageNumber: number): void {
    this.pageNumber = pageNumber;
  }

  public incrementPageNumber(): void {
    this.pageNumber += 1;
  }

  public getPageSize(): number {
    return this.pageSize;
  }

  public setPageSize(pageSize: number): void {
    this.pageSize = pageSize;
    this.resetPagination();
  }

  public getSortBy(): string[] {
    return this.sortBy;
  }

  public setSortBy(sortBy: string[]): void {
    this.sortBy = sortBy;
    this.resetPagination();
  }

  public getSortOrder(): string {
    return this.sortOrder;
  }

  public setSortOrder(sortOrder: "asc" | "desc"): void {
    this.sortOrder = sortOrder;
    this.resetPagination();
  }

  public toggleSortOrder(): void {
    this.sortOrder = this.sortOrder === "asc" ? "desc" : "asc";
    this.resetPagination();
  }

  public getSearchFor(): string {
    return this.searchFor;
  }

  public setSearchFor(searchFor: string): void {
    this.searchFor = searchFor;
    this.resetPagination();
  }

  public getSearchFields(): string[] {
    return this.searchFields;
  }

  public setSearchFields(searchFields: string[]): void {
    this.searchFields = searchFields;
    this.resetPagination();
  }

  public getQueryParam(id: string): any {
    return this.queryParams[id];
  }

  public setQueryParam(id: string, value: any): void {
    this.queryParams[id] = value;
  }

  public isEndOfResults(): boolean {
    return this.endOfResults || false;
  }

  public isResultsFound(): boolean {
    return !this.noResultsFound;
  }

  public isNoResultsFound(): boolean {
    return this.noResultsFound || false;
  }

  // Returns all query parameters, in object format
  // Omits parameters that are empty
  // Can be directly passed into HttpParams constructor
  public getQueryParams(): {[key: string]: string | ReadonlyArray<string>} {

    // Construct query param map with params that are always there
    const params: {[key: string]: string | string[]} = {
      pageNumber: this.getPageNumber().toString(),
      pageSize: this.getPageSize().toString(),
      sortBy: this.getSortBy(),
      sort: this.getSortOrder(),
    };

    // Add query string params if defined
    if (this.getSearchFor()) {
      params.query = this.getSearchFor();
      params.fields = this.getSearchFields();
    }

    // Add any additional query params if defined
    _forEach(this.queryParams, (value: any, id: string) => {
      if (!!value) {
        params[id] = value;
      }
    });

    return params;
  }

  public checkResults(resultLength: number): void {
    this.endOfResults = resultLength < this.getPageSize();
    this.noResultsFound = !resultLength && this.getPageNumber() === 0;
  }

  public checkFilteredResults(resultLength: number, filteredLength: number): void {
    this.endOfResults = resultLength < this.getPageSize();
    this.noResultsFound = !filteredLength && resultLength < this.getPageSize() && this.getPageNumber() === 0;
  }

  public resetPagination(): void {
    this.setPageNumber(0);
  }

  // Checks if a given query is equal to the current one
  public isEqual(query: SearchQuery): boolean {
    const paramsSelf = this.getQueryParams();
    const paramsOther = query.getQueryParams();
    return _isEqual(paramsSelf, paramsOther);
  }

}
