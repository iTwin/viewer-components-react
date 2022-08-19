/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useCallback, useEffect, useMemo, useState } from "react";
import DeleteModal from "./DeleteModal";
import { Button, Table, DropdownMenu, MenuItem, IconButton, Surface } from "@itwin/itwinui-react";
import {
  SvgDelete,
  SvgMore,
  SvgAdd
} from "@itwin/itwinui-icons-react";
import { WidgetHeader, LoadingOverlay, EmptyMessage } from "./utils";
import "./Templates.scss";
import TemplateClient from "./TemplateClient";
import { Template } from "./Template"
import TemplateMenu from "./TemplateMenu";
import { SearchBar } from "./SearchBar";
import { HorizontalTile } from "./HorizontalTile";
import React from "react";


enum TemplateView {
  TEMPLATES = "templates",
  CREATE = "create",
  MENU = "menu",
}

const Templates = () => {

  const templateClient = useMemo(() => { return new TemplateClient() }, []);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template>();
  const [searchValue, setSearchValue] = useState<string>("");
  const [templateView, setTemplateView] = useState<TemplateView>(
    TemplateView.TEMPLATES
  );

  const load = useCallback(() => {
    setIsLoading(true);
    const templates = templateClient.getTemplates();
    setTemplates(templates);
    setIsLoading(false);
  }, [templateClient])


  const refresh = useCallback(async () => {
    setTemplateView(TemplateView.TEMPLATES);
    load();
  }, [load]);


  const filteredTemplates = useMemo(
    () =>
      templates.filter((x) =>
        [x.templateName, x.templateDescription]
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
                    title={template.templateName}
                    subText={template.templateDescription}
                    subtextToolTip={template.templateDescription}
                    titleTooltip={template.templateName}
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
            entityName={selectedTemplate?.templateName ?? ""}
            show={showDeleteModal}
            setShow={setShowDeleteModal}
            onDelete={() => {
              if (selectedTemplate && selectedTemplate.id) {
                templateClient.deleteTemplate(
                  selectedTemplate.id
                );
              }
            }}
            refresh={refresh}
          />
        </>
      );
  };

}

export default Templates;
