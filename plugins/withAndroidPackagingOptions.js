const { withGradleProperties } = require("expo/config-plugins");

// Android's Java resource merge step fails if two dependency jars contribute
// the same resource path and Gradle has not been told how to resolve it.
//
// In this project the collision happens during :app:mergeDebugJavaResource:
//   - com.squareup.okhttp3:logging-interceptor:5.3.2
//   - org.jspecify:jspecify:1.0.0
//
// Both jars include this Java 9 multi-release OSGi metadata file. It is not
// application code, native code, assets, or runtime configuration that the APK
// needs, so excluding it from the final Android package is the lowest-risk fix.
const DUPLICATE_OSGI_MANIFEST = "META-INF/versions/9/OSGI-INF/MANIFEST.MF";

// android/app/build.gradle already contains Expo's generated hook that reads
// android.packagingOptions.* values from android/gradle.properties and applies
// them to android.packagingOptions. Setting this property here keeps the native
// workaround declarative and compatible with Expo prebuild regeneration.
const PACKAGING_EXCLUDES_PROPERTY = "android.packagingOptions.excludes";

module.exports = function withAndroidPackagingOptions(config) {
  // withGradleProperties lets an Expo config plugin mutate the generated
  // android/gradle.properties file during `expo prebuild` / `expo run:android`.
  return withGradleProperties(config, (config) => {
    // Expo represents gradle.properties as an array of parsed entries rather
    // than a plain object so it can preserve comments and file structure.
    const existingProperty = config.modResults.find(
      (property) =>
        property.type === "property" &&
        property.key === PACKAGING_EXCLUDES_PROPERTY,
    );

    if (existingProperty) {
      // Do not overwrite an existing excludes list. Other plugins or future
      // project changes may add their own packaging excludes, so merge ours in.
      const existingExcludes = existingProperty.value
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

      // Keep the plugin idempotent. Expo config plugins may run repeatedly, and
      // duplicate comma-separated values would make the generated file noisy.
      if (!existingExcludes.includes(DUPLICATE_OSGI_MANIFEST)) {
        existingExcludes.push(DUPLICATE_OSGI_MANIFEST);
        existingProperty.value = existingExcludes.join(",");
      }
    } else {
      // No excludes property exists yet, so create the exact property consumed
      // by the generated android/app/build.gradle packagingOptions bridge.
      config.modResults.push({
        type: "property",
        key: PACKAGING_EXCLUDES_PROPERTY,
        value: DUPLICATE_OSGI_MANIFEST,
      });
    }

    return config;
  });
};
