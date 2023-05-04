import React from "react";
import { ReportsConfigWidget } from "../../ReportsConfigWidget";
import { ReportAction } from "./ReportAction";
import { ReportMappings } from "./ReportMappings";
import { Reports } from "./Reports";
import type { Route } from "./ReportsContainer";
import { RouteStep } from "./ReportsContainer";

export const ReportsRouter = ({
  currentRoute,
  navigateTo,
  goBack,
}: {
  currentRoute: Route;
  navigateTo: (toRoute: (prev: Route | undefined) => Route) => void;
  goBack: () => void;
}) => {
  goBack;
  const { report } = currentRoute.reportsRoutingFields;
  switch (currentRoute.step) {
    case RouteStep.ReportsList:
      return (
        <Reports
          onClickAddReport={() =>
            navigateTo(() => ({
              step: RouteStep.ReportAction,
              title: ReportsConfigWidget.localization.getLocalizedString(
                "ReportsConfigWidget:ITwinReports"
              ),
              reportsRoutingFields: {},
            }))
          }
          onClickReportTitle={(r) => {
            navigateTo(() => ({
              step: RouteStep.ReportMappings,
              reportsRoutingFields: { report: r },
              title: r.displayName,
            }));
          }}
          onClickReportModify={(r) => {
            navigateTo(() => ({
              step: RouteStep.ReportAction,
              reportsRoutingFields: { report: r },
              title: r.displayName,
            }));
          }}
        />
      );

    case RouteStep.ReportAction:
      return <ReportAction report={report} onClickCancel={goBack} onSaveSuccess={goBack} />;
    case RouteStep.ReportMappings:
      if (!report) return null;
      return <ReportMappings report={report} onClickClose={goBack} />;
    default:
      return null;
  }
};
