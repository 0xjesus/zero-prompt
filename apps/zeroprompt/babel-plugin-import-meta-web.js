// Custom babel plugin to transform import.meta for web browsers
// Transforms import.meta.url to window.location.href
module.exports = function () {
  return {
    visitor: {
      MetaProperty(path) {
        const { node } = path;
        if (node.meta.name === "import" && node.property.name === "meta") {
          // Check if it's import.meta.url
          const parent = path.parentPath;
          if (
            parent.isMemberExpression() &&
            parent.node.property.name === "url"
          ) {
            // Transform import.meta.url to window.location.href
            parent.replaceWithSourceString(
              '(typeof document !== "undefined" && document.currentScript ? document.currentScript.src : (typeof window !== "undefined" ? window.location.href : ""))'
            );
          } else {
            // Transform import.meta to an object with url
            path.replaceWithSourceString(
              '({ url: typeof document !== "undefined" && document.currentScript ? document.currentScript.src : (typeof window !== "undefined" ? window.location.href : "") })'
            );
          }
        }
      },
    },
  };
};
