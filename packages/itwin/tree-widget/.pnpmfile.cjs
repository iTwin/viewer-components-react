//@ts-check


const itwinUiV3dependencies = [
  "@itwin/presentation-components",
  "@itwin/components-react",
  "@itwin/core-react",
  "@itwin/imodel-components-react",
  "@itwin/appui-react"
]

module.exports = {
  hooks: {
    readPackage(pkg, _context) {
      if (itwinUiV3dependencies.some((dep) => pkg.name === dep)) {
        pkg.dependencies["@itwin/itwinui-react"] = pkg.peerDependencies["@itwin/itwinui-react"];
        delete pkg.peerDependencies["@itwin/itwinui-react"];
      }
      return pkg;
    },
  },
};
