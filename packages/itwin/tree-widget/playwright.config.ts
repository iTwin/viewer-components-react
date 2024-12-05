/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import dotenv from "dotenv";
import * as fs from "fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * The tests require a logged-in user to access the test iModel. The following environment variables are required:
 *
 * # Client ID of E2E test runner. Must support the "itwin-platform" scope
 * - IMJS_AUTH_CLIENT_CLIENT_ID
 * # Credentials of a user that has read access to the iModel referenced in `playwright.config.ts` webserver setup script
 * - IMJS_USER_EMAIL
 * - IMJS_USER_PASSWORD
 *
 * We read the environment variables from a `.env.e2e` file.
 */
dotenv.config({ path: ".env.e2e" });

const testViewerLocation = process.env.TEST_VIEWER_DIST ?? "../../../apps/test-viewer/dist";
if (!fs.existsSync(testViewerLocation)) {
  throw new Error(`Test viewer "dist" output not found at '${testViewerLocation}'. Did you forget to build it?.`);
}

const e2eTestsQueryArgs = {
  iTwinId: "b391ba44-add7-47a0-8375-f2889a3540e8",
  iModelId: "ba504f88-a479-4156-9d81-658ee169588e",
  widgets: ["tree-widget"].join(";"),
};

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./src/e2e-tests",
  /* Maximum time one test can run for. */
  timeout: 2 * 60 * 1000,
  /** Settings for `expect` calls */
  expect: {
    /** Increase the timeout from 5 s. to 30 s. */
    timeout: 30 * 1000,
  },
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e-out/report" }]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: `http://localhost:3000/?${Object.entries(e2eTestsQueryArgs)
      .map(([key, value]) => `${key}=${value}`)
      .join("&")}`,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
  },
  /** Folder for test artifacts such as screenshots, videos, traces, etc. */
  outputDir: "e2e-out/test-results",
  /* Configure projects for major browsers */
  projects: [
    { name: "auth", testMatch: /.*\/auth\.ts/ },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: ["--font-render-hinting=none", "--disable-skia-runtime-opts", "--disable-font-subpixel-positioning", "--disable-lcd-text"],
          ignoreDefaultArgs: ["--hide-scrollbars"],
        },
        storageState: "e2e-out/.auth.json",
      },
      dependencies: ["auth"],
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: `http-server --port 3000 --proxy http://localhost:3000/? ${testViewerLocation}`,
    url: "http://localhost:3000/",
    reuseExistingServer: !process.env.CI,
    timeout: 5 * 60 * 1000,
    stderr: "pipe",
  },
});
