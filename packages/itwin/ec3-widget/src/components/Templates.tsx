/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, DropdownMenu, IconButton, MenuItem, toaster } from "@itwin/itwinui-react";
import { SvgAdd, SvgDelete, SvgMore, SvgRefresh } from "@itwin/itwinui-icons-react";
import { EmptyMessage, LoadingOverlay } from "./utils";
import "./Templates.scss";
import type { Configuration } from "./EC3/Template";
import { SearchBar } from "./SearchBar";
import { HorizontalTile } from "./HorizontalTile";
import React from "react";
import { useApiContext } from "./context/APIContext";
import { ExportModal } from "./ExportModal";
import { DeleteModal } from "./DeleteModal";
import { EC3Widget } from "../EC3Widget";
import type { TemplateProps } from "./TemplateProps";

/**
 * Templates component to display list of templates
 * @beta
 */
export const Templates = ({ onClickCreate, onClickTemplateTitle, onExportResult }: TemplateProps) => {
  const {
    config: { getAccessToken, iTwinId, getEC3AccessToken },
  } = useApiContext();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [templates, setTemplates] = useState<Configuration[] | undefined>();
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Configuration | undefined>();
  const [searchValue, setSearchValue] = useState<string>("");
  const configClient = useApiContext().ec3ConfigurationsClient;
  const [token, setToken] = useState<string>();
  const [modalIsOpen, openModal] = useState(false);
  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      if (iTwinId) {
        const accessToken = await getAccessToken();
        const templatesResponse = await configClient.getConfigurations(accessToken, iTwinId);
        const configurations: Configuration[] = templatesResponse.map((x) => {
          return {
            displayName: x.displayName,
            description: x.description ?? "",
            id: x.id,
            labels: [],
            reportId: x._links.report.href.split("/reports/")[1],
          };
        });
        setTemplates(configurations);
      } else {
        toaster.negative("Invalid iTwinId.");
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to load templates.", error);
    } finally {
      setIsLoading(false);
    }
  }, [iTwinId, configClient, getAccessToken]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  const filteredTemplates = useMemo(
    () => templates?.filter((x) => [x.displayName, x.description].join(" ").toLowerCase().includes(searchValue.toLowerCase())) ?? [],
    [templates, searchValue],
  );

  const clickedOnClassname = (e: Element, ...classNames: string[]) => {
    for (const className of classNames) if (e.className.toString().split(" ").includes(className)) return true;
    return false;
  };

  const selectTemplateCallback = useCallback(
    (template: Configuration, e: React.MouseEvent) => {
      const element = e.target as EventTarget & Element;

      if (selectedTemplate && selectedTemplate?.id === template.id && clickedOnClassname(element, "ec3w-horizontal-tile-container", "ec3w-body"))
        setSelectedTemplate(undefined);
      else setSelectedTemplate(template);
    },
    [selectedTemplate],
  );

  const onExport = useCallback(async () => {
    const newToken = await getEC3AccessToken();
    setToken(newToken);
    openModal(true);
  }, [getEC3AccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <div className="ec3w-templates-list-container">
        {isLoading ? (
          <LoadingOverlay />
        ) : !templates ? (
          <EmptyMessage message={EC3Widget.translate("failedToLoadTemplates")} />
        ) : templates.length === 0 ? (
          <>
            <EmptyMessage message={EC3Widget.translate("noTemplateMsg")} />
            <Button startIcon={<SvgAdd />} onClick={onClickCreate} styleType="high-visibility" title={EC3Widget.translate("addNewTemplate")}>
              {EC3Widget.translate("addNewTemplate")}
            </Button>
          </>
        ) : (
          <div className="ec3w-templates-list">
            <div className="ec3w-toolbar" data-testid="ec3-templates">
              <div className="ec3w-toolbar-left">
                <Button startIcon={<SvgAdd />} onClick={onClickCreate} styleType="high-visibility" title={EC3Widget.translate("newTemplate")}>
                  {EC3Widget.translate("new")}
                </Button>
                <Button data-testid="ec3-export-button" styleType="default" onClick={onExport} disabled={!selectedTemplate}>
                  {EC3Widget.translate("export")}
                </Button>
              </div>
              <div className="ec3w-search-bar-container">
                <IconButton title="Reload List" onClick={refresh} disabled={isLoading} styleType="borderless">
                  <SvgRefresh />
                </IconButton>
                <div className="ec3w-search-button" data-testid="ec3-search-bar">
                  <SearchBar searchValue={searchValue} setSearchValue={setSearchValue} disabled={isLoading} />
                </div>
              </div>
            </div>
            {filteredTemplates.map((template) => (
              <HorizontalTile
                key={template.id}
                title={template.displayName}
                subText={template.description}
                subtextToolTip={template.description}
                titleTooltip={template.displayName}
                onClickTitle={onClickTemplateTitle ? () => onClickTemplateTitle(template) : undefined}
                onClick={(e) => selectTemplateCallback(template, e)}
                selected={!!template.id && selectedTemplate?.id === template.id}
                button={
                  <DropdownMenu
                    menuItems={(close: () => void) => [
                      <MenuItem
                        data-testid="ec3-templates-delete-button"
                        key={0}
                        onClick={() => {
                          setSelectedTemplate(template);
                          setShowDeleteModal(true);
                          close();
                        }}
                        icon={<SvgDelete />}
                      >
                        {EC3Widget.translate("delete")}
                      </MenuItem>,
                    ]}
                  >
                    <IconButton styleType="borderless" title={EC3Widget.translate("templateOptions")}>
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
      </div>

      <ExportModal
        projectName={selectedTemplate?.displayName ?? ""}
        isOpen={modalIsOpen}
        close={() => openModal(false)}
        templateId={selectedTemplate?.id}
        token={token}
        onExportResult={onExportResult}
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
};
