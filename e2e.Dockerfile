#----------------------------------------------------------------------------------------------
# Copyright (c) Bentley Systems, Incorporated. All rights reserved.
# Licensed under the MIT License. See LICENSE.md in the project root for license terms.
#----------------------------------------------------------------------------------------------

FROM mcr.microsoft.com/playwright:v1.36.2-jammy

ARG PACKAGE_NAME=""

# Downloads needed for git and npm to work
RUN apt-get update \
  && apt-get install -y curl \
  && curl -sL https://deb.nodesource.com/setup_18.x | bash - \
  && apt-get install -y git nodejs locales zsh procps

# Set the working directory in the container
WORKDIR /workspaces/viewer-components-react/

# Copy the local files to the container
COPY . .

RUN git config --local user.email imodeljs-admin@users.noreply.github.com
RUN git config --local user.name imodeljs-admin

# Setup rush
RUN npm install -g @microsoft/rush
RUN rush install
RUN rush build -t test-viewer

# Switch to the directory where E2E tests will run
WORKDIR /workspaces/viewer-components-react/packages/itwin/${PACKAGE_NAME}

# Run E2E tests
RUN npm run test:e2e:local