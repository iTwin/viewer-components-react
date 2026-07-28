/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useState } from "react";
import { IconButton, TextField, Tooltip } from "@mui/material";
import dismissSvg from "@stratakit/icons/dismiss.svg";
import searchSvg from "@stratakit/icons/search.svg";
import { Icon } from "@stratakit/mui";
import { useTranslation } from "../trees/common/components/LocalizationContext.js";
import { useLatest } from "../trees/common/internal/hooks/UseLatest.js";

interface DebouncedSearchBoxProps {
  isOpened: boolean;
  setIsOpened: (value: boolean) => void;
  onSearch: (value?: string) => void;
  delay: number;
  className?: string;
}

// TODO: remove when fixed https://github.com/iTwin/stratakit/issues/1644
const tooltipSlotProps = {
  popper: {
    popperOptions: {
      strategy: "fixed" as const,
      modifiers: [
        {
          name: "preventOverflow" as const,
          options: {
            rootBoundary: "viewport" as const,
            altAxis: true,
            padding: 8,
          },
        },
      ],
    },
  },
};

/** @internal */
export function DebouncedSearchBox({ isOpened, onSearch, setIsOpened, delay, className }: DebouncedSearchBoxProps) {
  const translate = useTranslation();
  const [inputValue, setInputValue] = useState<string | undefined>(undefined);
  // save latest `onChange` reference into `useRef` to avoid restarting timeout when `onChange` reference changes.
  const onChangeRef = useLatest(onSearch);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onChangeRef.current(inputValue);
    }, delay);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [inputValue, delay, onChangeRef]);

  return !isOpened ? (
    <Tooltip title={translate("header.searchBox.searchForSomething")} slotProps={tooltipSlotProps}>
      <IconButton
        className={"tw-search-box-button"}
        size="small"
        aria-label={translate("header.searchBox.searchForSomething")}
        onClick={() => {
          setIsOpened(true);
          setInputValue("");
        }}
      >
        <Icon href={searchSvg} />
      </IconButton>
    </Tooltip>
  ) : (
    <>
      <TextField
        className={className}
        size="small"
        type={"text"}
        onChange={(e) => setInputValue(e.currentTarget.value)}
        placeholder={translate("header.searchBox.search")}
      />
      <Tooltip title={translate("header.searchBox.close")} slotProps={tooltipSlotProps}>
        <IconButton
          className={"tw-search-box-button"}
          size="small"
          aria-label={translate("header.searchBox.close")}
          onClick={() => {
            setIsOpened(false);
            setInputValue(undefined);
          }}
        >
          <Icon href={dismissSvg} />
        </IconButton>
      </Tooltip>
    </>
  );
}
