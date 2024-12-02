/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

/**
 * @internal
 */
export interface ITwinRepositories {
  repositories: ITwinRepository[];
}

interface Repository {
  id?: string;
  displayName?: string;
  type?: string;
  name?: string;
}

interface ITwinRepository {
  id?: string;
  class: string;
  subClass?: string;
  uri?: string;
}

/**
 * @internal
 */
export async function getItwinRepositories(itwinId: string, accessToken: string, environment?: "PROD" | "QA" | "DEV"): Promise<ITwinRepository[]> {
  const url = getRepositoriesUrl(itwinId, environment);
  const result = await fetchData<ITwinRepository[]>(url, accessToken);
  return result;
}

/**
 * @internal
 */
export async function getRepositoryData(accessToken: string, url?: string): Promise<Repository[]> {
  if (!url) return [];

  const result = await fetchData<Repository[]>(url, accessToken);
  return result;
}

async function fetchData<T>(url: string, accessToken: string): Promise<T> {
  const headers = {
    Authorization: accessToken,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  try {
    const response = await fetch(url, {
      headers,
    });
    const result = await response.json();

    // get the data avoiding links
    delete result._links;
    const values = Object.values(result);
    const data = values[0];

    return data as T;
  } catch (error) {
    throw error;
  }
}

function getRepositoriesUrl(itwinId: string, environment?: "PROD" | "QA" | "DEV") {
  const prefix = {
    QA: "qa-",
    DEV: "dev-",
    PROD: "",
  };

  return `https://${prefix[environment ?? "PROD"]}api.bentley.com/itwins/${itwinId}/repositories`;
}
