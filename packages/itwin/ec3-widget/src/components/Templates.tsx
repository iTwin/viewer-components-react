/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useCallback, useEffect, useMemo, useState } from "react";
import DeleteModal from "./DeleteModal";
import { Button, Table, DropdownMenu, MenuItem, IconButton, Surface, toaster } from "@itwin/itwinui-react";
import {
  SvgDelete,
  SvgMore,
  SvgAdd
} from "@itwin/itwinui-icons-react";
import { WidgetHeader, LoadingOverlay, EmptyMessage } from "./utils";
import "./Templates.scss";
import TemplateClient from "./TemplateClient";
import { Configuration } from "./Template"
import TemplateMenu from "./TemplateMenu";
import { SearchBar } from "./SearchBar";
import { HorizontalTile } from "./HorizontalTile";
import React from "react";
import { EC3ConfigurationClient } from "./api/EC3ConfigurationClient";
import { useActiveIModelConnection } from "@itwin/appui-react";


enum TemplateView {
  TEMPLATES = "templates",
  CREATE = "create",
  MENU = "menu",
}

const Templates = () => {
  const iTwinId = useActiveIModelConnection()?.iTwinId;
  const templateClient = useMemo(() => { return new TemplateClient() }, []);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [templates, setTemplates] = useState<Configuration[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Configuration>();
  const [searchValue, setSearchValue] = useState<string>("");
  const configClient = new EC3ConfigurationClient();
  const [templateView, setTemplateView] = useState<TemplateView>(
    TemplateView.TEMPLATES
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    if (iTwinId) {
      const templates = await configClient.getConfigurations(iTwinId);
      setTemplates(templates.configurations);
    }
    else {
      toaster.negative("Invalid iTwinId");
    }

    setIsLoading(false);
  }, [templateClient])

  const refresh = useCallback(async () => {
    setTemplateView(TemplateView.TEMPLATES);
    load();
  }, [load]);

  const filteredTemplates = useMemo(
    () =>
      templates.filter((x) =>
        [x.displayName, x.description]
          .join(" ")
          .toLowerCase()
          .includes(searchValue.toLowerCase())
      ),
    [templates, searchValue]
  );

  useEffect(() => {
    load();
  }, [load]);

  switch (templateView) {

    case TemplateView.CREATE:
      return (
        <TemplateMenu
          goBack={async () => {
            setTemplateView(TemplateView.TEMPLATES);
            await refresh();
          }}
        />
      );
    case TemplateView.MENU:
      return (
        <TemplateMenu
          template={selectedTemplate!}
          //templateId={selectedTemplate!.id!}
          goBack={async () => {
            setTemplateView(TemplateView.TEMPLATES);
            await refresh();
          }}
        />
      );
    default:
      return (
        <>
          <WidgetHeader title="Templates" />
          <Surface className="ec3-templates-list-container">
            <div className="toolbar">
              <Button
                startIcon={<SvgAdd />}
                onClick={() => setTemplateView(TemplateView.CREATE)}
                styleType="high-visibility"
              >
                Create Template
              </Button>
              <div className="search-bar-container" data-testid="search-bar">
                <SearchBar
                  searchValue={searchValue}
                  setSearchValue={setSearchValue}
                  disabled={isLoading}
                />
              </div>
            </div>
            {isLoading ? (
              <LoadingOverlay />
            ) : templates.length === 0 ? (
              <EmptyMessage
                message="No templates available"
              />
            ) : (
              <div className="templates-list">
                {filteredTemplates.map((template) => (
                  <HorizontalTile
                    key={template.id}
                    title={template.displayName}
                    subText={template.description}
                    subtextToolTip={template.description}
                    titleTooltip={template.displayName}
                    onClickTitle={() => {
                      setSelectedTemplate(template);
                      setTemplateView(TemplateView.MENU);
                    }}
                    button={
                      <DropdownMenu
                        menuItems={(close: () => void) => [
                          <MenuItem
                            key={0}
                            onClick={() => {
                              setSelectedTemplate(template);
                              setShowDeleteModal(true);
                              close();
                            }}
                            icon={<SvgDelete />}
                          >
                            Delete
                          </MenuItem>,
                        ]}
                      >
                        <IconButton styleType="borderless">
                          <SvgMore
                            style={{
                              width: "16px",
                              height: "16px",
                            }}
                          />
                        </IconButton>
                      </DropdownMenu>
                    }
                  />
                ))}
              </div>
            )}
          </Surface>
          <DeleteModal
            entityName={selectedTemplate?.displayName ?? ""}
            show={showDeleteModal}
            setShow={setShowDeleteModal}
            onDelete={async () => {
              if (selectedTemplate && selectedTemplate.id) {
                await configClient.deleteConfiguration(selectedTemplate.id);
              }
            }}
            refresh={refresh}
          />
        </>
      );
  };

}

export default Templates;
