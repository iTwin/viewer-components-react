/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useRef, useState } from "react";
import { IconButton, TextBox } from "@stratakit/bricks";
import dismissSvg from "@stratakit/icons/dismiss.svg";
import searchSvg from "@stratakit/icons/search.svg";
import { TreeWidget } from "../../TreeWidget.js";

interface DebouncedSearchBoxProps {
  isOpened: boolean;
  setIsOpened: (value: boolean) => void;
  onSearch: (value?: string) => void;
  delay: number;
  className?: string;
}

/** @internal */
export function DebouncedSearchBox({ isOpened, onSearch, setIsOpened, delay, className }: DebouncedSearchBoxProps) {
  const [inputValue, setInputValue] = useState<string | undefined>(undefined);
  const onChangeRef = useRef(onSearch);
  // save latest `onChange` reference into `useRef` to avoid restarting timeout when `onChange` reference changes.
  onChangeRef.current = onSearch;

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onChangeRef.current(inputValue);
    }, delay);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [inputValue, delay]);

  return !isOpened ? (
    <IconButton
      className={"tw-search-box-button"}
      variant={"ghost"}
      label={TreeWidget.translate("header.searchBox.searchForSomething")}
      icon={searchSvg}
      onClick={() => {
        setIsOpened(true);
        setInputValue("");
      }}
    />
  ) : (
    <>
      <TextBox.Root className={className}>
        <TextBox.Input type={"text"} onChange={(e) => setInputValue(e.currentTarget.value)} placeholder={TreeWidget.translate("header.searchBox.search")} />
      </TextBox.Root>
      <IconButton
        className={"tw-search-box-button"}
        variant={"ghost"}
        label={TreeWidget.translate("header.searchBox.close")}
        icon={dismissSvg}
        onClick={() => {
          setIsOpened(false);
          setInputValue(undefined);
        }}
      />
    </>
  );
}
