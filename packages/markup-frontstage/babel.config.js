module.exports = {
  presets: ["@babel/preset-env", "@babel/react"],
  plugins: [
    "@babel/plugin-transform-runtime",
    "@babel/proposal-class-properties",
    "babel-plugin-import-remove-resource-query",
  ],
};
