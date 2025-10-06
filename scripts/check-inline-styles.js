#!/usr/bin/env node

/**
 * Script to check for inline styles
 * This validates that the map-layers package contains no inline style attributes
 */

const fs = require("fs");
const path = require("path");
const { glob } = require("glob");

const mapLayersPath = "packages/itwin/map-layers/**/*.{ts,tsx}";

async function checkForInlineStyles() {
  try {
    const files = await glob(mapLayersPath, { cwd: process.cwd() });
    let violations = [];

    files.forEach((file) => {
      const content = fs.readFileSync(file, "utf8");
      const lines = content.split("\n");

      lines.forEach((line, index) => {
        // Check for style={{ or style = { patterns
        if (/style\s*=\s*\{/.test(line)) {
          violations.push({
            file,
            line: index + 1,
            content: line.trim(),
          });
        }

        // Check for setAttribute("style", ...) patterns
        if (/\.setAttribute\s*\(\s*["']style["']\s*,/.test(line)) {
          violations.push({
            file,
            line: index + 1,
            content: line.trim(),
          });
        }

        // Check for .style.property = value patterns
        if (/\.style\.[a-zA-Z][a-zA-Z0-9]*\s*=/.test(line)) {
          violations.push({
            file,
            line: index + 1,
            content: line.trim(),
          });
        }
      });
    });

    if (violations.length > 0) {
      console.error("\nInline styles detected in map-layers package:");
      violations.forEach((v) => {
        console.error(`In file: ${v.file}`);
        console.error(`On line ${v.line}: ${v.content}`);
        console.error("");
      });
      console.error(`Total violations: ${violations.length}`);
      console.error("Please convert inline styles to CSS classes.");
    } else {
      console.log("\nNo inline styles found in map-layers package");
      console.log(`Checked ${files.length} files`);
    }
  } catch (error) {
    console.error("Error checking for inline styles:", error);
    process.exit(1);
  }
}

// Run the check
checkForInlineStyles();
