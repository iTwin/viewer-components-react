#----------------------------------------------------------------------------------------------
# Copyright (c) Bentley Systems, Incorporated. All rights reserved.
# Licensed under the MIT License. See LICENSE.md in the project root for license terms.
#----------------------------------------------------------------------------------------------
FROM mcr.microsoft.com/playwright:v1.48.2-jammy

ARG PACKAGE_NAME=""
ARG TEST_VIEWER_DIST=""

# Install pnpm
RUN corepack enable
RUN corepack prepare pnpm@9.12.3 --activate

# Copy the local files to the container
WORKDIR /workspaces/viewer-components-react/
COPY /scripts ./scripts
COPY ${TEST_VIEWER_DIST} ./apps/test-viewer/dist
COPY /packages/itwin/${PACKAGE_NAME} ./packages/itwin/${PACKAGE_NAME}

# Switch to the directory where E2E tests will run
WORKDIR ./packages/itwin/${PACKAGE_NAME}

# Install dependencies
RUN pnpm install -D --filter .
RUN npx playwright install chromium

# Set the entry point to run the tests
ENV TEST_VIEWER_DIST=/workspaces/viewer-components-react/apps/test-viewer/dist
CMD ["npm", "run", "test:e2e:local"]
