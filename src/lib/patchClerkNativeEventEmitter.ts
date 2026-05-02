import { TurboModuleRegistry } from "react-native";

type EventEmitterCompatibleNativeModule = {
  addListener?: (eventName: string) => void;
  removeListeners?: (count: number) => void;
};

type MutableTurboModuleRegistry = {
  get: (name: string) => unknown;
};

const registry = TurboModuleRegistry as unknown as MutableTurboModuleRegistry;
const originalGet = registry.get.bind(registry);

function addEventEmitterHooks(module: unknown) {
  if (!module || typeof module !== "object") {
    return module;
  }

  const nativeModule = module as EventEmitterCompatibleNativeModule;

  // Why: @clerk/expo 3.2.7 subscribes to `onAuthStateChange` with
  // `new NativeEventEmitter(ClerkExpoModule)`, so React Native expects the
  // native module to expose these two listener bookkeeping hooks.
  //
  // Clerk's current TurboModule spec does not declare them. The event still
  // flows through React Native's shared device event emitter, but RN warns
  // because it cannot notify the native module when listener counts change.
  // These no-ops provide the expected contract until Clerk adds the hooks
  // upstream in its native module.
  //
  // Delete this shim when an @clerk/expo upgrade adds `addListener` and
  // `removeListeners` to its native `ClerkExpo` module. To verify removal:
  // remove this import from `index.ts`, cold-start the Android app, and check
  // fresh logcat output for the two `new NativeEventEmitter()` warnings.
  nativeModule.addListener ??= () => {};
  nativeModule.removeListeners ??= () => {};

  return nativeModule;
}

registry.get = (name: string) => {
  const module = originalGet(name);

  if (name === "ClerkExpo") {
    return addEventEmitterHooks(module);
  }

  return module;
};
