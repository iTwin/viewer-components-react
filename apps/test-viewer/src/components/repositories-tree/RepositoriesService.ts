/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

interface RepositoryData {
  id?: string;
  displayName: string;
  type?: string;
  name?: string;
}

interface ITwinRepository {
  class: string;
  subClass?: string;
  uri: string;
}

/**
 * @internal
 */
export async function getItwinRepositories(itwinId: string, accessToken: string, environment?: "PROD" | "QA" | "DEV"): Promise<ITwinRepository[]> {
  const url = getRepositoriesUrl(itwinId, environment);
  const result = (await fetchData(url, accessToken)) as ITwinRepository[];
  return result;
}

/**
 * @internal
 */
export async function getRepositoryData(accessToken: string, url?: string): Promise<RepositoryData[]> {
  if (!url) {
    return [];
  }

  const result = (await fetchData(url, accessToken)) as RepositoryData[];
  return result;
}

async function fetchData(url: string, accessToken: string): Promise<unknown> {
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

    return data;
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
