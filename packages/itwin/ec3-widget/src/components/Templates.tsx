/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, DropdownMenu, IconButton, MenuItem, Surface, toaster } from "@itwin/itwinui-react";
import {
  SvgAdd,
  SvgDelete,
  SvgMore,
} from "@itwin/itwinui-icons-react";
import { EmptyMessage, LoadingOverlay, WidgetHeader } from "./utils";
import "./Templates.scss";
import type { Configuration } from "./Template";
import { SearchBar } from "./SearchBar";
import { HorizontalTile } from "./HorizontalTile";
import React from "react";
import { useActiveIModelConnection } from "@itwin/appui-react";
import type { EC3Props } from "./EC3";
import type { EC3Token } from "./EC3/EC3Token";
import { useApiContext } from "./api/APIContext";
import { TemplateMenu } from "./TemplateMenu";
import { ExportModal } from "./ExportModal";
import { DeleteModal } from "./DeleteModal";

enum TemplateView {
  TEMPLATES = "templates",
  CREATE = "create",
  MENU = "menu",
}

export const Templates = ({ config }: EC3Props) => {
  const getAccessToken = useApiContext().getAccessTokenFn;
  const iTwinId = useActiveIModelConnection()?.iTwinId;
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [templates, setTemplates] = useState<Configuration[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Configuration | undefined>();
  const [searchValue, setSearchValue] = useState<string>("");
  const configClient = useApiContext().ec3ConfigurationsClient;
  const [token, setToken] = useState<EC3Token>();
  const [modalIsOpen, openModal] = useState(false);
  const [templateView, setTemplateView] = useState<TemplateView>(
    TemplateView.TEMPLATES
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    if (iTwinId) {
      const accessToken = await getAccessToken();
      const templatesResponse = await configClient.getConfigurations(accessToken, iTwinId);
      const configurations: Configuration[] = templatesResponse.map((x) => {
        return {
          displayName: x.displayName,
          description: x.description ?? "",
          id: x.id,
          labels: x.labels,
          reportId: x._links.report.href.split("/reports/")[1],
        };
      });
      setTemplates(configurations);
    } else {
      toaster.negative("Invalid iTwinId");
    }

    setIsLoading(false);
  }, [iTwinId, configClient, getAccessToken]);

  const refresh = useCallback(async () => {
    setTemplateView(TemplateView.TEMPLATES);
    await load();
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

  const clickedOnClassname = (e: Element, ...classNames: string[]) => {
    for (const className of classNames)
      if (e.className.toString().split(" ").includes(className))
        return true;
    return false;
  };

  const selectTemplateCallback = useCallback((template: Configuration, e: React.MouseEvent) => {
    const element = e.target as (EventTarget & Element);

    if (selectedTemplate && selectedTemplate?.id === template.id &&
      clickedOnClassname(element, "ec3w-horizontal-tile-container", "ec3w-body"))
      setSelectedTemplate(undefined);
    else
      setSelectedTemplate(template);
  }, [selectedTemplate]);

  const onExport = useCallback(async () => {
    if (!(token?.token && token?.exp > Date.now())) {
      const url = `${config.ec3Uri}oauth2/authorize?client_id=${config.clientId}&redirect_uri=${config.redirectUri}&response_type=code&scope=${config.scope}`;
      const authWindow = window.open(url, "_blank", "toolbar=0,location=0,menubar=0,width=800,height=700");

      const receiveMessage = (event: MessageEvent<EC3Token>) => {
        if (event.data.source !== "ec3-auth")
          return;
        authWindow?.close();
        setToken(event.data);
        openModal(true);
      };

      window.addEventListener("message", receiveMessage, false);
    } else {
      openModal(true);
    }
  }, [config, token]);

  useEffect(() => {
    void load();
  }, [load]);

  switch (templateView) {

    case TemplateView.CREATE:
      return (
        <TemplateMenu
          created={false}
          goBack={async () => {
            setTemplateView(TemplateView.TEMPLATES);
            await refresh();
          }}
        />
      );
    case TemplateView.MENU:
      return (
        <TemplateMenu
          created={true}
          template={selectedTemplate}
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
          <Surface className="ec3w-templates-list-container">
            <div className="ec3w-toolbar" data-testId="ec3-templates">
              <Button
                startIcon={<SvgAdd />}
                onClick={() => {
                  setTemplateView(TemplateView.CREATE);
                  setSelectedTemplate(undefined);
                }}
                styleType="high-visibility"
              >
                Create Template
              </Button>
              <Button
                styleType="default"
                onClick={onExport}
                disabled={!selectedTemplate}
              >
                Export
              </Button>
              <div className="ec3w-search-bar-container" data-testid="search-bar">
                <div className="ec3w-search-button">
                  <SearchBar
                    searchValue={searchValue}
                    setSearchValue={setSearchValue}
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>
            {isLoading ? (
              <LoadingOverlay />
            ) : templates.length === 0 ? (
              <EmptyMessage
                message="No templates available"
              />
            ) : (
              <div className="ec3w-templates-list">
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
                    onClick={(e) => selectTemplateCallback(template, e)}
                    selected={!!template.id && selectedTemplate?.id === template.id}
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

          <ExportModal
            projectName={selectedTemplate?.displayName ?? ""}
            isOpen={modalIsOpen}
            close={() => openModal(false)}
            templateId={selectedTemplate?.id}
            token={token?.token}
          />

          <DeleteModal
            entityName={selectedTemplate?.displayName ?? ""}
            show={showDeleteModal}
            setShow={setShowDeleteModal}
            onDelete={async () => {
              if (selectedTemplate && selectedTemplate.id) {
                const accessToken = await getAccessToken();
                await configClient.deleteConfiguration(accessToken, selectedTemplate.id);
              }
              setSelectedTemplate(undefined);
            }}
            refresh={refresh}
          />
        </>
      );
  }
};
