/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { AccessToken } from "@itwin/core-bentley";
import type {
  ApiOverrides,
  IModelFull,
  ProjectFull,
} from "@itwin/imodel-browser-react";
import {
  ProjectGrid,
} from "@itwin/imodel-browser-react";
import {
  SvgCalendar,
  SvgClose,
  SvgList,
  SvgSearch,
  SvgStarHollow,
} from "@itwin/itwinui-icons-react";
import {
  Button,
  HorizontalTabs,
  IconButton,
  LabeledInput,
  Tab,
} from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useState } from "react";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import "./SelectProject.scss";

const tabsWithIcons = [
  <Tab
    key='favorite'
    label='Favorite projects'
    startIcon={<SvgStarHollow />}
  />,
  <Tab key='recents' label='Recent projects' startIcon={<SvgCalendar />} />,
  <Tab key='all' label='My projects' startIcon={<SvgList />} />,
];
interface SelectProjectProps {
  onSelect: (project: ProjectFull) => void;
  onCancel: () => void;
}
const SelectProject = ({ onSelect, onCancel }: SelectProjectProps) => {
  const { getAccessToken, prefix } = useGroupingMappingApiConfig();
  const [projectType, setProjectType] = useState<number>(0);
  const [searchInput, setSearchInput] = useState<string>("");
  const [activeSearchInput, setActiveSearchInput] = useState<string>("");
  const [accessToken, setAccessToken] = useState<AccessToken>();
  const [apiOverrides, setApiOverrides] = useState<ApiOverrides<IModelFull[]>>({ serverEnvironmentPrefix: prefix });
  const [searched, setSearched] = useState<boolean>(false);

  useEffect(() => setApiOverrides({ serverEnvironmentPrefix: prefix }), [prefix]);

  useEffect(() => {
    const fetchAccessToken = async () => {
      const accessToken = await getAccessToken();
      setAccessToken(accessToken);
    };
    void fetchAccessToken();
  }, [getAccessToken]);

  const startSearch = useCallback(() => {
    setActiveSearchInput(searchInput);
    setSearched(true);
  }, [searchInput]);

  const clearSearch = useCallback(() => {
    setSearchInput("");
    setActiveSearchInput("");
    setSearched(false);
  }, []);

  const runLabel = useCallback(() => {
    if(searched === false) {
      return (
        <IconButton onClick={() => startSearch() } styleType='borderless'>
          <SvgSearch />
        </IconButton>
      );
    }
    if(searchInput.length === 0) {
      setSearched(false);
    }
    return (
      <IconButton onClick={() => clearSearch() } styleType='borderless'>
        <SvgClose />
      </IconButton>
    );

  }, [searched, clearSearch, startSearch, searchInput]);

  return (
    <div className='select-project-grid-container'>
      <HorizontalTabs
        labels={tabsWithIcons}
        onTabSelected={setProjectType}
        activeIndex={projectType}
        type={"borderless"}
        contentClassName='grid-holding-tab'
      >
        <LabeledInput
          displayStyle='inline'
          iconDisplayStyle='inline'
          className='search-input'
          label='Search'
          value={searchInput}
          placeholder="Search...."
          onChange={(event) => {
            const {
              target: { value },
            } = event;
            setSearchInput(value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              startSearch();
            }
          }}
          svgIcon={runLabel()}
        />
      </HorizontalTabs>
      <div className='project-grid'>
        <ProjectGrid
          onThumbnailClick={onSelect}
          accessToken={accessToken}
          apiOverrides={apiOverrides}
          filterOptions={activeSearchInput}
          requestType={
            projectType === 0
              ? "favorites"
              : projectType === 1
                ? "recents"
                : ""
          }
        />
      </div>
      <div className='select-project-action-panel'>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
};

export default SelectProject;
