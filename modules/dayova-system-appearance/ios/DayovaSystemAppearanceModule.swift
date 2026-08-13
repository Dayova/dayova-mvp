import ExpoModulesCore
import React
import UIKit

public class DayovaSystemAppearanceModule: Module {
  // Decision: docs/contexts/mobile-app/adr/0001-use-local-ios-system-appearance-bridge.md
  private static let snapshotShieldColor = UIColor(
    red: 0.0,
    green: 186.0 / 255.0,
    blue: 1.0,
    alpha: 1.0)

  private var observerView: AppearanceObserverView?
  private var isObserving = false
  private var willResignActiveObserver: NSObjectProtocol?
  private var snapshotShieldView: UIView?
  private var snapshotShieldGeneration = 0

  public func definition() -> ModuleDefinition {
    Name("DayovaSystemAppearance")

    Events("onChange", "onResume")

    OnCreate { [weak self] in
      DispatchQueue.main.async {
        RCTUseKeyWindowForSystemStyle(true)
        Self.notifyReactNativeAppearance()
        self?.startSnapshotShieldObservation()
      }
    }

    Function("getColorScheme") { () -> String in
      return Self.readColorSchemeOnMainQueue()
    }

    Function("releaseSnapshotShield") { [weak self] (generation: Int) in
      DispatchQueue.main.async {
        self?.releaseSnapshotShield(generation: generation)
      }
    }

    OnStartObserving("onChange") { [weak self] in
      DispatchQueue.main.async {
        guard let self else { return }
        self.isObserving = true
        self.installObserver()
      }
    }

    OnStopObserving("onChange") { [weak self] in
      DispatchQueue.main.async {
        guard let self else { return }
        self.isObserving = false
        self.removeObserver()
      }
    }

    OnAppBecomesActive { [weak self] in
      DispatchQueue.main.async {
        guard let self else { return }
        Self.notifyReactNativeAppearance()
        self.refreshAppearanceObservation()
        let generation = self.snapshotShieldGeneration
        self.sendEvent("onResume", ["generation": generation])
      }
    }

    OnDestroy { [weak self] in
      guard let self else { return }

      DispatchQueue.main.async {
        self.isObserving = false
        self.observerView?.removeFromSuperview()
        self.snapshotShieldView?.removeFromSuperview()

        if let willResignActiveObserver = self.willResignActiveObserver {
          NotificationCenter.default.removeObserver(willResignActiveObserver)
        }

        self.observerView = nil
        self.snapshotShieldView = nil
        self.willResignActiveObserver = nil
      }
    }
  }

  private static func activeWindow() -> UIWindow? {
    let windows = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap(\.windows)

    return windows.first(where: \.isKeyWindow) ?? windows.first
  }

  private static func currentColorScheme() -> String {
    let style = activeWindow()?.traitCollection.userInterfaceStyle
      ?? UITraitCollection.current.userInterfaceStyle
    return style == .dark ? "dark" : "light"
  }

  fileprivate static func notifyReactNativeAppearance() {
    NotificationCenter.default.post(
      name: Notification.Name("RCTUserInterfaceStyleDidChangeNotification"),
      object: nil)
  }

  private static func readColorSchemeOnMainQueue() -> String {
    if Thread.isMainThread {
      return currentColorScheme()
    }

    return DispatchQueue.main.sync {
      currentColorScheme()
    }
  }

  private func installObserver() {
    removeObserver()

    guard let window = Self.activeWindow() else { return }
    let view = AppearanceObserverView()
    view.isUserInteractionEnabled = false
    view.onColorSchemeChange = { [weak self] colorScheme in
      self?.sendEvent("onChange", ["colorScheme": colorScheme])
    }
    window.addSubview(view)
    observerView = view
    emitCurrentColorScheme()
  }

  private func removeObserver() {
    observerView?.removeFromSuperview()
    observerView = nil
  }

  private func startSnapshotShieldObservation() {
    if let willResignActiveObserver {
      NotificationCenter.default.removeObserver(willResignActiveObserver)
    }

    willResignActiveObserver = NotificationCenter.default.addObserver(
      forName: UIApplication.willResignActiveNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      self?.showSnapshotShield()
    }
  }

  private func showSnapshotShield() {
    guard let window = Self.activeWindow() else { return }
    snapshotShieldGeneration += 1

    if let snapshotShieldView {
      snapshotShieldView.frame = window.bounds
      window.bringSubviewToFront(snapshotShieldView)
      return
    }

    let shield = UIView(frame: window.bounds)
    shield.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    shield.backgroundColor = Self.snapshotShieldColor
    shield.isUserInteractionEnabled = false
    shield.isAccessibilityElement = false
    shield.accessibilityElementsHidden = true
    shield.accessibilityViewIsModal = true

    window.addSubview(shield)
    snapshotShieldView = shield
  }

  private func releaseSnapshotShield(generation: Int) {
    guard snapshotShieldView != nil,
      generation == snapshotShieldGeneration
    else {
      return
    }

    snapshotShieldView?.removeFromSuperview()
    snapshotShieldView = nil
  }

  private func refreshAppearanceObservation() {
    guard isObserving else { return }

    guard let activeWindow = Self.activeWindow() else {
      removeObserver()
      return
    }

    if observerView?.window !== activeWindow {
      installObserver()
      return
    }

    emitCurrentColorScheme()
  }

  private func emitCurrentColorScheme() {
    let emit: () -> Void = { [weak self] in
      guard let self else { return }
      Self.notifyReactNativeAppearance()
      self.sendEvent("onChange", [
        "colorScheme": Self.currentColorScheme()
      ])
    }

    if Thread.isMainThread {
      emit()
    } else {
      DispatchQueue.main.async {
        emit()
      }
    }
  }
}

private final class AppearanceObserverView: UIView {
  var onColorSchemeChange: ((String) -> Void)?

  override init(frame: CGRect) {
    super.init(frame: frame)

    if #available(iOS 17.0, *) {
      registerForTraitChanges([UITraitUserInterfaceStyle.self]) {
        (view: AppearanceObserverView, previousTraitCollection: UITraitCollection) in
        view.emitColorSchemeIfChanged(from: previousTraitCollection)
      }
    }
  }

  override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
    super.traitCollectionDidChange(previousTraitCollection)

    if #available(iOS 17.0, *) {
      return
    }

    emitColorSchemeIfChanged(from: previousTraitCollection)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  private func emitColorSchemeIfChanged(from previousTraitCollection: UITraitCollection?) {
    guard let previousTraitCollection,
      traitCollection.hasDifferentColorAppearance(comparedTo: previousTraitCollection)
    else {
      return
    }

    onColorSchemeChange?(
      traitCollection.userInterfaceStyle == .dark ? "dark" : "light")
  }
}
