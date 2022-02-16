/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import "./ExportModal.scss";
import React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
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
import {
  JobCreationCarbonCalculationAPI,
  LinkCarbonCalculationAPI,
  OneClickLCAClient,
} from "@itwin/insights-client";

interface ExportProps {
  isOpen: boolean;
  close: () => void;
  reportId: string | undefined;
}

interface OclcaTokenCache {
  token: string;
  exp: number;
}

enum OCLCAJobStatus {
  Queued = "Queued",
  Running = "Running",
  Succeeded = "Succeeded",
  Failed = "Failed",
}

const ExportModal = (props: ExportProps) => {
  const MILI_SECONDS = 1000;
  const EMAIL_LABEL = "Email";
  const PASSWORD_LABEL = "Password";
  const SIGNIN_BUTTON_LABEL = "Sign In";
  const SIGNIN_PROMPT = "Sign in to One Click LCA.";
  const SIGNIN_ERROR = "Incorrect email or password.";
  const PIN_INTERVAL = 1000;
  const oneClickLCAClientApi = new OneClickLCAClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordIsVisible, showPassword] = useState(false);
  const [signinError, showSigninError] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [cache, cacheToken] = useState<OclcaTokenCache>();

  const [jobStatus, setJobStatus] = useState<OCLCAJobStatus>();
  const [jobLink, setJobLink] = useState<LinkCarbonCalculationAPI>();

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
  const intervalRef = useRef<NodeJS.Timer>();

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
    (job: JobCreationCarbonCalculationAPI) => {
      const intervalId = setInterval(async () => {
        const token =
          (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
        if (job.id && token) {
          let currentJobStatus =
            await oneClickLCAClientApi.getOneclicklcaJobStatus(token, job?.id);
          if (currentJobStatus.job?.status) {
            if (currentJobStatus.job?.status === OCLCAJobStatus.Succeeded) {
              setJobLink(currentJobStatus?.job._links?.oneclicklca);
            }
            setJobStatus(currentJobStatus.job?.status as OCLCAJobStatus);
          } else {
            throw new Error("failed to get job status");
          }
        }
      }, PIN_INTERVAL);
      intervalRef.current = intervalId;
    },
    [setJobLink, setJobStatus]
  );

  const runJob = useCallback(
    async (token: string) => {
      const accessToken =
        (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
      if (props.reportId && token) {
        let jobCreated = await oneClickLCAClientApi.createOneclicklcaJob(
          accessToken,
          {
            reportId: props.reportId,
            token: token,
          }
        );
        if (jobCreated?.job?.id) {
          pinStatus(jobCreated?.job);
        } else {
          throw new Error("Failed to create job");
        }
      } else {
        throw new Error("No reportId or accessToken");
      }
    },
    [props, pinStatus]
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
    [email, password, resetSignin, cacheToken, showSigninError]
  );

  const onClose = useCallback(() => {
    resetSignin();
    setJobStatus(undefined);
    setJobLink(undefined);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    props.close();
  }, [props, resetSignin]);

  const getStatusComponent = useCallback(
    (jobStatus: string, jobLink: string | undefined) => {
      switch (jobStatus) {
        case OCLCAJobStatus.Queued:
          return (
            <>
              <div className="progress-radial-container">
                <ProgressRadial indeterminate size="small" value={50} />
                <Text variant="leading" className="status-text">
                  Export queued
                </Text>
              </div>
            </>
          );
        case OCLCAJobStatus.Running:
          return (
            <>
              <div className="progress-linear-container">
                <ProgressLinear indeterminate />
                <Text variant="leading" className="status-text">
                  Export running
                </Text>
              </div>
            </>
          );
        case OCLCAJobStatus.Succeeded:
          return (
            <>
              {jobLink && (
                <div className="progress-radial-container">
                  <ProgressRadial status="positive" size="small" value={50} />
                  <a
                    className="report-button"
                    href={jobLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button styleType="cta">Open in One Click LCA</Button>
                  </a>
                </div>
              )}
            </>
          );
        case OCLCAJobStatus.Failed:
          return (
            <>
              <div className="progress-radial-container">
                <ProgressRadial status="negative" size="small" value={100} />
                <Text variant="leading" className="status-text">
                  Export failed
                </Text>
              </div>
            </>
          );
        default:
          throw new Error("Job status is invalid " + jobStatus);
      }
    },
    []
  );

  useEffect(() => {
    if (props.isOpen && isSignedIn && cache?.token) {
      runJob(cache.token);
    }
  }, [props.isOpen, isSignedIn, cache, runJob]);

  useEffect(() => {
    if (
      jobStatus === OCLCAJobStatus.Succeeded ||
      jobStatus === OCLCAJobStatus.Failed
    ) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
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
  }, [email]);

  return (
    <>
      <Modal
        isOpen={props.isOpen}
        onClose={onClose}
        title={null}
        closeOnExternalClick={false}
      >
        {!isSignedIn && (
          <div className="signin">
            <img
              className="signin-icon"
              src="../logo/oneClickLCALogo.png"
              alt="One Click LCA® software"
              data-height-percentage="80"
              data-actual-width="1200"
              data-actual-height="600"
            />
            <form onSubmit={signin} className="signin-form">
              <div className="signin-prompt">{SIGNIN_PROMPT}</div>
              {signinError && (
                <Alert type="negative" className="signin-error">
                  {SIGNIN_ERROR}
                </Alert>
              )}
              <div className="signin-input">
                <LabeledInput
                  label={EMAIL_LABEL}
                  value={email}
                  onChange={(v) => setEmail(v.target.value)}
                  type="email"
                  status={emailError ? "negative" : undefined}
                  message={emailError ? "Invalid email address." : ""}
                  required
                />
              </div>
              <div className="signin-input">
                <LabeledInput
                  label={PASSWORD_LABEL}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={passwordIsVisible ? "text" : "password"}
                  svgIcon={
                    <div onClick={() => showPassword(!passwordIsVisible)}>
                      {passwordIsVisible ? (
                        <SvgVisibilityHide />
                      ) : (
                        <SvgVisibilityShow />
                      )}
                    </div>
                  }
                  iconDisplayStyle="inline"
                  required
                />
              </div>

              <div className="signin-button-container">
                <Button
                  type="submit"
                  className="signin-button"
                  styleType="cta"
                  disabled={!isValidSignin()}
                >
                  {isSigningIn ? (
                    <ProgressRadial
                      className="signin-wait"
                      indeterminate
                      size="small"
                      value={50}
                    />
                  ) : (
                    SIGNIN_BUTTON_LABEL
                  )}
                </Button>
              </div>
            </form>
          </div>
        )}
        {isSignedIn && !jobStatus && (
          <>
            <div className="progress-radial-container">
              <ProgressRadial indeterminate size="large" value={50} />
            </div>
          </>
        )}
        {isSignedIn &&
          jobStatus &&
          getStatusComponent(jobStatus, jobLink?.href)}
      </Modal>
    </>
  );
};

export default ExportModal;
