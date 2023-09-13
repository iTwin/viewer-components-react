FROM docker.io/library/debian:11

RUN \
  apt-get update \
  && apt-get install -y curl \
  && curl -sL https://deb.nodesource.com/setup_18.x | bash - \
  && apt-get install -y git nodejs locales zsh procps

# Set the working directory in the container
WORKDIR /workspaces/viewer-components-react/

# Copy the local files to the container
COPY . .

RUN git config --local user.email imodeljs-admin@users.noreply.github.com
RUN git config --local user.name imodeljs-admin

# Install rush globally
RUN npm install -g @microsoft/rush

# Install dependencies using rush
RUN rush install

# Build the project using rush
RUN rush build

# Switch to the package directory where you want to run E2E tests
WORKDIR /workspaces/viewer-components-react/packages/itwin/property-grid

# Install playwright
RUN npx playwright install

RUN npx playwright install-deps

# Run E2E tests
CMD ["npm", "run", "test:e2e"]