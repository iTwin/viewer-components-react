/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// A workaround to @testing-library/react {@testing-library/dom {wait-for-expect}} breaking somewhere,
// because somewhere (most likely in jsdom) window.Date becomes undefined.
// Similar issue mentioned in https://github.com/vuejs/vue-test-utils/issues/936
require('jsdom-global')(``, {
  url: "http://localhost"
});
window.Date = Date;

const {
  JSDOM
} = require('jsdom');
global.DOMParser = new JSDOM(``, {
  url: "http://localhost"
}).window.DOMParser;

const frontend = require("@itwin/core-frontend");
const chai = require("chai");
const sinonChai = require("sinon-chai");
const chaiAsPromised = require("chai-as-promised");
const chaiJestSnapshot = require("chai-jest-snapshot");
const enzyme = require("enzyme/build");
const spies = require("chai-spies");
const sinon = require("sinon");

window.requestAnimationFrame = window.requestAnimationFrame || function (C) { return setTimeout(function () { C(+new Date()) }, 30) };
window.cancelAnimationFrame = window.cancelAnimationFrame || clearTimeout;

// Fix node's module loader to strip ?sprite from SVG imports
const m = require("module");
const origLoader = m._load;
m._load = (request, parent, isMain) => {
  return origLoader(request.replace("?sprite", ""), parent, isMain);
};

// setup enzyme (testing utils for React)
enzyme.configure({
  adapter: new (require("@wojtekmaj/enzyme-adapter-react-17/build"))()
});
chaiJestSnapshot.addSerializer(require("enzyme-to-json/serializer"));



const uifwk = require("@itwin/appui-react");

// setup chai
chai.should();
chai.use(chaiAsPromised);
chai.use(chaiJestSnapshot);
chai.use(spies);
chai.use(sinonChai);
try {
  chai.use(require("chai-string"));
} catch (e) { }

before(async function () {
  chaiJestSnapshot.resetSnapshotRegistry();
  let i18nstub = sinon.stub(frontend.IModelApp, "localization");
  i18nstub.get(() => ({
    translate: (str) => str,
    initialize: ([]) => { },
    registerNamespace: (str) => { return { readFinished: Promise.resolve(true) } },
    unregisterNamespace: (str) => { },
    languageList: () => { return [""]; },
    getLocalizedStringWithNamespace: (namespace, key) => { return "dummy text" },
    getLocalizedString: (key) => { return "dummy text" }
  }));
  sinon.stub(uifwk.SyncUiEventDispatcher, "initializeConnectionEvents").returns(undefined);
  sinon.stub(uifwk.SyncUiEventDispatcher, "clearConnectionEvents").returns(undefined);
  await frontend.NoRenderApp.startup();
});

after(function () {
  delete require.cache[__filename];
});

beforeEach(function () {
  const currentTest = this.currentTest;

  try {
    // we want snapshot tests to use the same random data between runs
    const faker = require("faker");
    let seed = 0;
    for (let i = 0; i < currentTest.fullTitle().length; ++i)
      seed += currentTest.fullTitle().charCodeAt(i);
    faker.seed(seed);
  } catch (e) {
    // may throw if package doesn't use faker - ignore
  }

  // set up snapshot name
  const testFilePath = currentTest.file;
  const sourceFilePath = currentTest.file.replace("lib\\cjs\\test", "src\\test").replace(/\.(jsx?|tsx?)$/, "");
  const snapPath = sourceFilePath + ".snap";
  chaiJestSnapshot.setFilename(snapPath);
  chaiJestSnapshot.setTestName(currentTest.fullTitle());

  chai.spy.restore();
});

afterEach(() => {
  try {
    const rtl = require("@testing-library/react");
    rtl.cleanup();
  } catch (e) { }
});
