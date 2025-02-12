/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useRef, useState } from "react";
import { IconButton, TextBox } from "@itwin/itwinui-react/bricks";
import { TreeWidget } from "../../TreeWidget.js";

const searchIcon = new URL("@itwin/itwinui-icons/search.svg", import.meta.url).href;
const dismissIcon = new URL("@itwin/itwinui-icons/dismiss.svg", import.meta.url).href;

interface DebouncedSearchBoxProps {
  isOpened: boolean;
  setIsOpened: (value: boolean) => void;
  onSearch: (value: string) => void;
  delay: number;
  className?: string;
}

export function DebouncedSearchBox({ isOpened, onSearch, setIsOpened, delay, className }: DebouncedSearchBoxProps) {
  const [inputValue, setInputValue] = useState<string>("");
  const onChangeRef = useRef(onSearch);
  // save latest `onChange` reference into `useRef` to avoid restarting timeout when `onChange` reference changes.
  onChangeRef.current = onSearch;

  useEffect(() => {
    if (!inputValue) {
      onChangeRef.current("");
      return;
    }

    const timeoutId = setTimeout(() => {
      onChangeRef.current(inputValue);
    }, delay);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [inputValue, delay]);

  return !isOpened ? (
    <IconButton variant={"ghost"} label={"search"} icon={searchIcon} onClick={() => setIsOpened(true)} />
  ) : (
    <>
      <TextBox.Root className={className}>
        <TextBox.Input type={"search"} onChange={(e) => setInputValue(e.currentTarget.value)} placeholder={TreeWidget.translate("header.searchBox.search")} />
      </TextBox.Root>
      <IconButton variant={"ghost"} label={"close search"} icon={dismissIcon} onClick={() => setIsOpened(false)} />
    </>
  );
}
