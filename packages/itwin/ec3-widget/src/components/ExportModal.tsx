/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./ExportModal.scss";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { IModelApp } from "@itwin/core-frontend";
import {
  Button,
  Modal,
  ProgressLinear,
  ProgressRadial,
  Text,
  toaster,
} from "@itwin/itwinui-react";
import { useEC3JobsClient } from "./api/context/EC3JobsClientContext";
import type { EC3Job, EC3JobCreate, Link} from "@itwin/insights-client";
import { CarbonUploadState } from "@itwin/insights-client";

interface ExportProps {
  projectName: string;
  isOpen: boolean;
  close: () => void;
  templateId: string | undefined;
  token: string | undefined;
}

const ExportModal = (props: ExportProps) => {
  const PIN_INTERVAL = 1000;
  const ec3JobsClient = useEC3JobsClient();

  const [jobStatus, setJobStatus] = useState<CarbonUploadState>();
  const [jobMessage, setJobMessage] = useState<string | undefined>();
  const [jobLink, setJobLink] = useState<Link>();

  const intervalRef = useRef<number>();

  const pinStatus = useCallback(
    (job: EC3Job) => {
      const intervalId = window.setInterval(async () => {
        const token =
          (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
        if (job.id && token) {
          const currentJobStatus =
            await ec3JobsClient.getEC3JobStatus(token, job.id);
          if (currentJobStatus.status) {
            if (
              currentJobStatus.status === CarbonUploadState.Succeeded
            ) {
              setJobLink(currentJobStatus._links.ec3Project);
            }
            setJobStatus(currentJobStatus.status);
            setJobMessage(currentJobStatus.message);
          } else {
            setJobStatus(CarbonUploadState.Failed);
            toaster.negative("Failed to get job status. 😔");
          }
        }
      }, PIN_INTERVAL);
      intervalRef.current = intervalId;
    },
    [setJobLink, setJobStatus, ec3JobsClient]
  );

  const runJob = useCallback(
    async (token: string) => {
      const accessToken =
        (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
      if (props.templateId && token) {
        try {
          const jobRequest: EC3JobCreate = {
            configurationId: props.templateId,
            projectName: props.projectName,
            ec3BearerToken: token,
          };
          const jobCreated = await ec3JobsClient.createJob(
            accessToken,
            jobRequest
          );
          if (jobCreated.id) {
            pinStatus(jobCreated);
          } else {
            setJobStatus(CarbonUploadState.Failed);
            toaster.negative("Failed to create EC3 job. 😔");
          }
        } catch (e) {
          setJobStatus(CarbonUploadState.Failed);
          toaster.negative("You do not have the required permissions. Please contact the project administrator.");
          /* eslint-disable no-console */
          console.error(e);
        }
      } else {
        setJobStatus(CarbonUploadState.Failed);
        toaster.negative("Invalid reportId.");
      }
    },
    [props, pinStatus, ec3JobsClient]
  );

  const onClose = useCallback(() => {
    setJobStatus(undefined);
    setJobLink(undefined);
    setJobMessage(undefined);
    window.clearInterval(intervalRef.current);
    props.close();
  }, [props]);

  const getStatusComponent = useCallback(
    (status: CarbonUploadState, link: string | undefined) => {
      switch (status) {
        case CarbonUploadState.Queued:
          return (
            <div className="ec3w-progress-radial-container">
              <ProgressRadial indeterminate size="small" value={50} />
              <Text variant="leading" className="ec3w-status-text">
                Export queued
              </Text>
            </div>
          );
        case CarbonUploadState.Running:
          return (
            <div className="ec3w-progress-linear-container">
              <ProgressLinear indeterminate />
              <Text variant="leading" className="ec3w-status-text">
                Export running
              </Text>
            </div>
          );
        case CarbonUploadState.Succeeded:
          return (
            link && (
              <div className="ec3w-progress-radial-container">
                <ProgressRadial status="positive" size="small" value={50} />
                <a
                  className="ec3w-report-button"
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button styleType="cta">Open in EC3</Button>
                </a>
              </div>
            )
          );
        case CarbonUploadState.Failed:
          return (
            <div className="ec3w-progress-radial-container">
              <ProgressRadial status="negative" size="small" value={100} />
              <Text variant="leading" className="ec3w-status-text">
                Export failed <br />
                {jobMessage}
              </Text>
            </div>
          );
        default:
          return (
            <div className="ec3w-progress-radial-container">
              <Text>Invalid Job Status <span role="img" aria-label="sad">😔</span></Text>
            </div>
          );
      }
    },
    [jobMessage]
  );

  useEffect(() => {
    if (props.isOpen && props.token) {
      runJob(props.token).catch((err) => {
        setJobStatus(CarbonUploadState.Failed);
        toaster.negative("Error occurs while running the job. 😔");
        /* eslint-disable no-console */
        console.error(err);
      });
    }
  }, [props.isOpen, props.token, runJob]);

  useEffect(() => {
    if (
      jobStatus === CarbonUploadState.Succeeded ||
      jobStatus === CarbonUploadState.Failed
    ) {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    }
  }, [jobStatus]);

  return (
    <Modal
      data-testid="export-modal"
      isOpen={props.isOpen}
      onClose={onClose}
      title={null}
      closeOnExternalClick={false}
    >
      {!jobStatus && (
        <div className="ec3w-progress-radial-container">
          <ProgressRadial indeterminate size="large" value={50} />
        </div>
      )}
      {jobStatus && getStatusComponent(jobStatus, jobLink?.href)}
    </Modal>
  );
};

export default ExportModal;
