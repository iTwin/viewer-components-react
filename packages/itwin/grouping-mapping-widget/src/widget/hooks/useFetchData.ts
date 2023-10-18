/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useCallback, useEffect, useState } from "react";
import { handleError } from "../components/SharedComponents/utils";

const fetchData = async<T>(
  setData: (data: T[]) => void,
  fetchFunc: () => Promise<T[] | undefined>,
  setIsLoading: (isLoading: boolean) => void,
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
  setData: (data: T[]) => void,
  setIsLoading: (isLoading: boolean) => void,
) => {

  useEffect(() => {
    void fetchData(
      setData,
      fetchFunc,
      setIsLoading,
    );
  }, [fetchFunc, setData, setIsLoading]);
};

export const useRefreshData = <T>(
  setData: (data: T[]) => void,
  fetchFunc: () => Promise<T[] | undefined>,
  setIsLoading: (isLoading: boolean) => void,
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

export const useCombinedFetchRefresh = <T>(fetchFunc: () => Promise<T[] | undefined>, setData: (data: T[]) => void) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  useFetchData(fetchFunc, setData, setIsLoading);
  const refreshData = useRefreshData(setData, fetchFunc, setIsLoading);
  return { isLoading, refreshData };
};
