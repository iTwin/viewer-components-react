"use strict";
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See COPYRIGHT.md in the repository root for full copyright notice.
*--------------------------------------------------------------------------------------------*/// See the @microsoft/rush package's LICENSE file for license information.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
// THIS FILE WAS GENERATED BY A TOOL. ANY MANUAL MODIFICATIONS WILL GET OVERWRITTEN WHENEVER RUSH IS UPGRADED.
//
// This script is intended for usage in an automated build environment where the Rush command may not have
// been preinstalled, or may have an unpredictable version.  This script will automatically install the version of Rush
// specified in the rush.json configuration file (if not already installed), and then pass a command-line to it.
// An example usage would be:
//
//    node common/scripts/install-run-rush.js install
//
// For more information, see: https://rushjs.io/pages/maintainer/setup_new_repo/
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const install_run_1 = require("./install-run");
const PACKAGE_NAME = '@microsoft/rush';
const RUSH_PREVIEW_VERSION = 'RUSH_PREVIEW_VERSION';
function _getRushVersion() {
    const rushPreviewVersion = process.env[RUSH_PREVIEW_VERSION];
    if (rushPreviewVersion !== undefined) {
        console.log(`Using Rush version from environment variable ${RUSH_PREVIEW_VERSION}=${rushPreviewVersion}`);
        return rushPreviewVersion;
    }
    const rushJsonFolder = install_run_1.findRushJsonFolder();
    const rushJsonPath = path.join(rushJsonFolder, install_run_1.RUSH_JSON_FILENAME);
    try {
        const rushJsonContents = fs.readFileSync(rushJsonPath, 'utf-8');
        // Use a regular expression to parse out the rushVersion value because rush.json supports comments,
        // but JSON.parse does not and we don't want to pull in more dependencies than we need to in this script.
        const rushJsonMatches = rushJsonContents.match(/\"rushVersion\"\s*\:\s*\"([0-9a-zA-Z.+\-]+)\"/);
        return rushJsonMatches[1];
    }
    catch (e) {
        throw new Error(`Unable to determine the required version of Rush from rush.json (${rushJsonFolder}). ` +
            "The 'rushVersion' field is either not assigned in rush.json or was specified " +
            'using an unexpected syntax.');
    }
}
function _run() {
    const [nodePath /* Ex: /bin/node */, scriptPath /* /repo/common/scripts/install-run-rush.js */, ...packageBinArgs /* [build, --to, myproject] */] = process.argv;
    // Detect if this script was directly invoked, or if the install-run-rushx script was invokved to select the
    // appropriate binary inside the rush package to run
    const scriptName = path.basename(scriptPath);
    const bin = scriptName.toLowerCase() === 'install-run-rushx.js' ? 'rushx' : 'rush';
    if (!nodePath || !scriptPath) {
        throw new Error('Unexpected exception: could not detect node path or script path');
    }
    if (process.argv.length < 3) {
        console.log(`Usage: ${scriptName} <command> [args...]`);
        if (scriptName === 'install-run-rush.js') {
            console.log(`Example: ${scriptName} build --to myproject`);
        }
        else {
            console.log(`Example: ${scriptName} custom-command`);
        }
        process.exit(1);
    }
    install_run_1.runWithErrorAndStatusCode(() => {
        const version = _getRushVersion();
        console.log(`The rush.json configuration requests Rush version ${version}`);
        return install_run_1.installAndRun(PACKAGE_NAME, version, bin, packageBinArgs);
    });
}
_run();
//# sourceMappingURL=install-run-rush.js.map