import ExpoModulesCore
import React
import UIKit

public class DayovaSystemAppearanceModule: Module {
  private var observerView: AppearanceObserverView?
  private var keyWindowObserver: NSObjectProtocol?
  private var isObserving = false

  public func definition() -> ModuleDefinition {
    Name("DayovaSystemAppearance")

    Events("onChange")

    OnCreate {
      DispatchQueue.main.async {
        RCTUseKeyWindowForSystemStyle(true)
        Self.notifyReactNativeAppearance()
      }
    }

    Function("getColorScheme") { () -> String in
      return Self.readColorSchemeOnMainQueue()
    }

    OnStartObserving("onChange") { [weak self] in
      DispatchQueue.main.async {
        guard let self else { return }
        self.isObserving = true
        self.startObservingKeyWindowChanges()
        self.refreshObservation()
      }
    }

    OnStopObserving("onChange") { [weak self] in
      DispatchQueue.main.async {
        guard let self else { return }
        self.stopObservation()
      }
    }

    OnAppBecomesActive { [weak self] in
      DispatchQueue.main.async {
        guard let self, self.isObserving else { return }
        self.refreshObservation()
      }
    }

    OnDestroy { [weak self] in
      guard let self else { return }
      DispatchQueue.main.async {
        self.stopObservation()
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

  private func installObserverIfNeeded() {
    guard let window = Self.activeWindow() else { return }
    if let observerView, observerView.superview === window {
      return
    }

    removeObserver()
    let view = AppearanceObserverView()
    view.isUserInteractionEnabled = false
    view.onColorSchemeChange = { [weak self] colorScheme in
      self?.sendEvent("onChange", ["colorScheme": colorScheme])
    }
    window.addSubview(view)
    observerView = view
  }

  private func refreshObservation() {
    installObserverIfNeeded()
    emitCurrentColorScheme()
  }

  private func startObservingKeyWindowChanges() {
    stopObservingKeyWindowChanges()
    keyWindowObserver = NotificationCenter.default.addObserver(
      forName: UIWindow.didBecomeKeyNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      guard let self, self.isObserving else { return }
      self.refreshObservation()
    }
  }

  private func stopObservingKeyWindowChanges() {
    guard let keyWindowObserver else { return }
    NotificationCenter.default.removeObserver(keyWindowObserver)
    self.keyWindowObserver = nil
  }

  private func stopObservation() {
    isObserving = false
    stopObservingKeyWindowChanges()
    removeObserver()
  }

  private func removeObserver() {
    observerView?.removeFromSuperview()
    observerView = nil
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
