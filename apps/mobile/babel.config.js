module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // react-native-reanimated/plugin is auto-included by babel-preset-expo v54
  };
};
