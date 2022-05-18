/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { handleError } from "../components/utils";

const fetchData = async<T>(
  setData: React.Dispatch<React.SetStateAction<T[]>>,
  fetchFunc: () => Promise<T[] | undefined>,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
) => {
  try {
    setIsLoading(true);
    const data = await fetchFunc();
    setData(data ?? []);
  } catch (error: any) {
    handleError(error.status);
  } finally {
    setIsLoading(false);
  }
};

export const useFetchData = <T>(
  fetchFunc: () => Promise<T[] | undefined>,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
): [T[], React.Dispatch<React.SetStateAction<T[]>>] => {
  const [data, setData] = useState<T[]>([]);

  useEffect(() => {
    void fetchData(
      setData,
      fetchFunc,
      setIsLoading,
    );
  }, [fetchFunc, setIsLoading]);

  return [data, setData];
};

export const useRefreshData = <T>(
  setData: React.Dispatch<React.SetStateAction<T[]>>,
  fetchFunc: () => Promise<T[] | undefined>,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
): () => Promise<void> => {
  return useCallback(async () => {
    setData([]);
    await fetchData(
      setData,
      fetchFunc,
      setIsLoading,
    );
  }, [setData, fetchFunc, setIsLoading]);
};

export const useCombinedFetchRefresh = <T>(fetchFunc: () => Promise<T[] | undefined>) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [data, setData] = useFetchData(fetchFunc, setIsLoading);
  const refreshData = useRefreshData(setData, fetchFunc, setIsLoading);
  return { isLoading, data, refreshData };
};
