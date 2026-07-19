import ExpoModulesCore
import UIKit

public class DayovaSystemAppearanceModule: Module {
  private var observerView: AppearanceObserverView?

  public func definition() -> ModuleDefinition {
    Name("DayovaSystemAppearance")

    Events("onChange")

    Function("getColorScheme") { () -> String in
      return Self.readColorSchemeOnMainQueue()
    }

    OnStartObserving("onChange") { [weak self] in
      DispatchQueue.main.async {
        self?.installObserver()
      }
    }

    OnStopObserving("onChange") { [weak self] in
      DispatchQueue.main.async {
        self?.removeObserver()
      }
    }

    OnAppBecomesActive { [weak self] in
      self?.emitCurrentColorScheme()
    }

    OnDestroy { [weak self] in
      guard let observerView = self?.observerView else { return }
      self?.observerView = nil
      DispatchQueue.main.async {
        observerView.removeFromSuperview()
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

  private func emitCurrentColorScheme() {
    let emit: () -> Void = { [weak self] in
      guard let self else { return }
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

    registerForTraitChanges([UITraitUserInterfaceStyle.self]) {
      (view: AppearanceObserverView, previousTraitCollection: UITraitCollection) in
      guard view.traitCollection.hasDifferentColorAppearance(comparedTo: previousTraitCollection) else {
        return
      }

      view.onColorSchemeChange?(
        view.traitCollection.userInterfaceStyle == .dark ? "dark" : "light")
    }
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }
}
