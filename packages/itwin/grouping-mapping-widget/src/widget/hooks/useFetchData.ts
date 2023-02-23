/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { handleError } from "../components/utils";

const fetchData = async<T>(
  setData: (data: T[]) => void,
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
  setData: (data: T[]) => void,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
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

export const useCombinedFetchRefresh = <T>(fetchFunc: () => Promise<T[] | undefined>, setData: (data: T[]) => void) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  useFetchData(fetchFunc, setData, setIsLoading);
  const refreshData = useRefreshData(setData, fetchFunc, setIsLoading);
  return { isLoading, refreshData };
};
