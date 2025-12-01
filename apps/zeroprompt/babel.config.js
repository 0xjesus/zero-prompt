module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      "./babel-plugin-import-meta-web.js",
      [
        "module-resolver",
        {
          alias: {
            "react-native-markdown-display/src/lib/util/getUniqueID": "./mock-getUniqueId.js",
          },
        },
      ],
    ],
    overrides: [
      {
        // Transform import.meta in @reown packages
        test: /node_modules[\\/]@reown/,
        plugins: ["./babel-plugin-import-meta-web.js"],
      },
      {
        // Transform import.meta in @walletconnect packages
        test: /node_modules[\\/]@walletconnect/,
        plugins: ["./babel-plugin-import-meta-web.js"],
      },
    ],
  };
};
