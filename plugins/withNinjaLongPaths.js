const { withAppBuildGradle } = require("expo/config-plugins");

// Required due to: https://github.com/expo/expo/issues/36274 see https://github.com/expo/expo/issues/36274#issuecomment-3521622624

module.exports = function withNinjaLongPaths(config) {
  return withAppBuildGradle(config, (config) => {
    const ninjaConfig = `
        if (System.getProperty("os.name").toLowerCase(java.util.Locale.ROOT).contains("windows")) {
            def ninjaPath = System.getenv("NINJA_PATH") ?: "D:/ninja/ninja.exe"

            externalNativeBuild {
                cmake {
                    arguments "-DCMAKE_MAKE_PROGRAM=\${ninjaPath}", "-DCMAKE_OBJECT_PATH_MAX=1024"
                }
            }
        }`;

    if (!config.modResults.contents.includes("DCMAKE_MAKE_PROGRAM")) {
      config.modResults.contents = config.modResults.contents.replace(
        /(defaultConfig\s*\{[\s\S]*?)(    \})/,
        `$1${ninjaConfig}\n$2`,
      );
    }
    return config;
  });
};
