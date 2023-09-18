#----------------------------------------------------------------------------------------------
# Copyright (c) Bentley Systems, Incorporated. All rights reserved.
# Licensed under the MIT License. See LICENSE.md in the project root for license terms.
#----------------------------------------------------------------------------------------------

FROM docker.io/library/debian:11

ARG PACKAGE_NAME=""

# Downloads needed for git, npm and playwright to work
RUN apt-get update \
  && apt-get install -y curl \
  && apt-get install -y libnss3 libatk-bridge2.0-0 libasound2 \
  libcairo2 libcups2 libdbus-1-3 libatk1.0-0 libdrm2 libxrandr2 \
  libglib2.0-0 libxkbcommon0 libnspr4 libatspi2.0-0 libgbm1\
  libpango-1.0-0 libxcomposite1  libxdamage1  libxfixes3\
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
RUN rush build

# Switch to tree-widget directory where E2E tests will run
WORKDIR /workspaces/viewer-components-react/packages/itwin/${PACKAGE_NAME}

# Installations to run playwright
RUN npx playwright install

# Run E2E tests
CMD [ "sh", "-c", \
  "if [ \"$UPDATE_SNAPSHOTS\" = \"1\" ]; then \
  npm run test:e2e:local:update; \
  else \
  npm run test:e2e:local; \
  fi" ]