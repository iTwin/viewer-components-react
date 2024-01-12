#----------------------------------------------------------------------------------------------
# Copyright (c) Bentley Systems, Incorporated. All rights reserved.
# Licensed under the MIT License. See LICENSE.md in the project root for license terms.
#----------------------------------------------------------------------------------------------
FROM viewer-components-react/test-viewer
ARG PACKAGE_NAME=""

# Switch to the directory where E2E tests will run
WORKDIR /workspaces/viewer-components-react/packages/itwin/${PACKAGE_NAME}
RUN npx playwright install chromium

# Copy tests' source into container before running the tests
COPY /packages/itwin/${PACKAGE_NAME}/src/e2e-tests src/e2e-tests

# Set the entry point to run the tests
CMD ["npm", "run", "test:e2e:local"]
