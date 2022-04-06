/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./ExportModal.scss";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { IModelApp } from "@itwin/core-frontend";
import {
  Alert,
  Button,
  LabeledInput,
  Modal,
  ProgressLinear,
  ProgressRadial,
  Text,
} from "@itwin/itwinui-react";
import {
  SvgVisibilityHide,
  SvgVisibilityShow,
} from "@itwin/itwinui-icons-react";
import type { JobCreation, Link } from "@itwin/insights-client";
import { JobStatus, OneClickLCAClient } from "@itwin/insights-client";
import logo from "../../public/logo/oneClickLCALogo.png";

interface ExportProps {
  isOpen: boolean;
  close: () => void;
  reportId: string | undefined;
}

interface OclcaTokenCache {
  token: string;
  exp: number;
}

const ExportModal = (props: ExportProps) => {
  const MILI_SECONDS = 1000;
  const PIN_INTERVAL = 1000;
  const oneClickLCAClientApi = useMemo(() => new OneClickLCAClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordIsVisible, showPassword] = useState(false);
  const [signinError, showSigninError] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [cache, cacheToken] = useState<OclcaTokenCache>();

  const [jobStatus, setJobStatus] = useState<JobStatus.StatusEnum>();
  const [jobLink, setJobLink] = useState<Link>();

  const isValidEmail = useCallback(() => {
    return /\S+@\S+\.\S+/.test(email);
  }, [email]);

  const isValidPassword = useCallback(() => {
    return password !== "";
  }, [password]);

  const validateSignin = useCallback(() => {
    return cache?.token && cache?.exp > Date.now();
  }, [cache]);

  const [isSignedIn, setIsSignedIn] = useState(validateSignin());
  const [isSigningIn, startSigningIn] = useState(false);
  const intervalRef = useRef<number>();

  const isValidSignin = useCallback(() => {
    return isValidEmail() && isValidPassword();
  }, [isValidEmail, isValidPassword]);

  const resetSignin = useCallback(() => {
    setEmail("");
    setPassword("");
    showPassword(false);
    showSigninError(false);
  }, [setEmail, setPassword, showPassword, showSigninError]);

  const pinStatus = useCallback(
    (job: JobCreation) => {
      const intervalId = window.setInterval(async () => {
        const token =
          (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
        if (job.id && token) {
          const currentJobStatus =
            await oneClickLCAClientApi.getOneclicklcaJobStatus(token, job?.id);
          if (currentJobStatus.job?.status) {
            if (
              currentJobStatus.job?.status === JobStatus.StatusEnum.Succeeded
            ) {
              setJobLink(currentJobStatus?.job._links?.oneclicklca);
            }
            setJobStatus(currentJobStatus.job?.status);
          } else {
            throw new Error("failed to get job status");
          }
        }
      }, PIN_INTERVAL);
      intervalRef.current = intervalId;
    },
    [setJobLink, setJobStatus, oneClickLCAClientApi]
  );

  const runJob = useCallback(
    async (token: string) => {
      const accessToken =
        (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
      if (props.reportId && token) {
        try {
          const jobCreated = await oneClickLCAClientApi.createOneclicklcaJob(
            accessToken,
            {
              reportId: props.reportId,
              token,
            }
          );
          if (jobCreated?.job?.id) {
            pinStatus(jobCreated?.job);
          } else {
            throw new Error("Failed to create job");
          }
        } catch (e) {
          throw new Error(`Failed to create one click lca job.${e}`);
        }
      } else {
        throw new Error("No reportId or accessToken");
      }
    },
    [props, pinStatus, oneClickLCAClientApi]
  );

  const signin = useCallback(
    async (e) => {
      e.preventDefault();
      startSigningIn(true);
      const result = await oneClickLCAClientApi.getOneclicklcaAccessToken(
        email,
        password
      );
      if (result && result.access_token && result.expires_in) {
        cacheToken({
          token: result.access_token,
          exp: Date.now() + result.expires_in * MILI_SECONDS,
        });
        resetSignin();
        setIsSignedIn(true);
      } else {
        showSigninError(true);
      }
      startSigningIn(false);
    },
    [
      email,
      password,
      resetSignin,
      cacheToken,
      showSigninError,
      oneClickLCAClientApi,
    ]
  );

  const onClose = useCallback(() => {
    resetSignin();
    setJobStatus(undefined);
    setJobLink(undefined);
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
    }
    props.close();
  }, [props, resetSignin]);

  const getStatusComponent = useCallback(
    (status: JobStatus.StatusEnum, link: string | undefined) => {
      switch (status) {
        case JobStatus.StatusEnum.Queued:
          return (
            <div className="oclca-progress-radial-container">
              <ProgressRadial indeterminate size="small" value={50} />
              <Text variant="leading" className="oclca-status-text">
                Export queued
              </Text>
            </div>
          );
        case JobStatus.StatusEnum.Running:
          return (
            <div className="oclca-progress-linear-container">
              <ProgressLinear indeterminate />
              <Text variant="leading" className="oclca-status-text">
                Export running
              </Text>
            </div>
          );
        case JobStatus.StatusEnum.Succeeded:
          return (
            link && (
              <div className="oclca-progress-radial-container">
                <ProgressRadial status="positive" size="small" value={50} />
                <a
                  className="oclca-report-button"
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button styleType="cta">Open in One Click LCA</Button>
                </a>
              </div>
            )
          );
        case JobStatus.StatusEnum.Failed:
          return (
            <div className="oclca-progress-radial-container">
              <ProgressRadial status="negative" size="small" value={100} />
              <Text variant="leading" className="oclca-status-text">
                Export failed
              </Text>
            </div>
          );
        default:
          throw new Error(`Job status is invalid ${status}`);
      }
    },
    []
  );

  useEffect(() => {
    if (props.isOpen && isSignedIn && cache?.token) {
      runJob(cache.token).catch((err) => {
        throw new Error(err);
      });
    }
  }, [props.isOpen, isSignedIn, cache, runJob]);

  useEffect(() => {
    if (
      jobStatus === JobStatus.StatusEnum.Succeeded ||
      jobStatus === JobStatus.StatusEnum.Failed
    ) {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    }
  }, [jobStatus]);

  useEffect(() => {
    if (email !== "") {
      const timeoutId = setTimeout(() => setEmailError(!isValidEmail()), 1000);
      return () => clearTimeout(timeoutId);
    } else {
      setEmailError(false);
      return;
    }
  }, [email, isValidEmail]);

  return (
    <Modal
      data-testid="export-modal"
      isOpen={props.isOpen}
      onClose={onClose}
      title={null}
      closeOnExternalClick={false}
    >
      {!isSignedIn && (
        <div className="oclca-signin">
          <img
            className="oclca-signin-icon"
            src={logo}
            alt="One Click LCA® software"
            data-height-percentage="80"
            data-actual-width="1200"
            data-actual-height="600"
          />
          <form onSubmit={signin} className="oclca-signin-form">
            <div className="oclca-signin-prompt">Sign in to One Click LCA.</div>
            {signinError && (
              <Alert type="negative" className="oclca-signin-error">
                Incorrect email or password.
              </Alert>
            )}
            <div className="oclca-signin-input">
              <LabeledInput
                label="Email"
                value={email}
                onChange={(v) => setEmail(v.target.value)}
                type="email"
                status={emailError ? "negative" : undefined}
                message={emailError ? "Invalid email address." : ""}
                required
              />
            </div>
            <div className="oclca-signin-input">
              <LabeledInput
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={passwordIsVisible ? "text" : "password"}
                svgIcon={
                  passwordIsVisible ? (
                    <SvgVisibilityHide
                      onClick={() => showPassword(!passwordIsVisible)}
                    />
                  ) : (
                    <SvgVisibilityShow />
                  )
                }
                iconDisplayStyle="inline"
                required
              />
            </div>

            <div className="oclca-signin-button-container">
              <Button
                className="oclca-signin-button"
                type="submit"
                styleType="cta"
                disabled={!isValidSignin()}
              >
                {isSigningIn ? (
                  <ProgressRadial
                    className="oclca-signin-wait"
                    indeterminate
                    size="small"
                    value={50}
                  />
                ) : (
                  "Sign In"
                )}
              </Button>
            </div>
          </form>
        </div>
      )}
      {isSignedIn && !jobStatus && (
        <div className="oclca-progress-radial-container">
          <ProgressRadial indeterminate size="large" value={50} />
        </div>
      )}
      {isSignedIn && jobStatus && getStatusComponent(jobStatus, jobLink?.href)}
    </Modal>
  );
};

export default ExportModal;
