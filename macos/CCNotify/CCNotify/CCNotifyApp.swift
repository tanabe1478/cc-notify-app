import SwiftUI

// Check if running in UI test mode (evaluated once at launch)
private let isUITestMode = CommandLine.arguments.contains("--show-settings")

@main
struct CCNotifyApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var serverManager = ServerManager()

    var body: some Scene {
        MenuBarExtra {
            MenuBarView(serverManager: serverManager)
        } label: {
            Image(systemName: serverManager.isRunning ? "bell.fill" : "bell.slash")
                .symbolRenderingMode(.palette)
                .foregroundStyle(serverManager.isRunning ? .green : .secondary)
        }
        .menuBarExtraStyle(.window)

        Settings {
            SettingsView(serverManager: serverManager)
        }
    }
}

class AppDelegate: NSObject, NSApplicationDelegate {
    var testWindow: NSWindow?
    var serverManager: ServerManager?

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Only show test window in UI test mode
        if isUITestMode {
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 300_000_000) // 0.3 seconds
                self.showTestSettingsWindow()
            }
        }
    }

    @MainActor private func showTestSettingsWindow() {
        // Get or create server manager
        let manager = ServerManager()

        // Create the settings view
        let settingsView = SettingsView(serverManager: manager)
            .frame(width: 450, height: 300)

        // Create hosting controller and window
        let hostingController = NSHostingController(rootView: settingsView)

        let window = NSWindow(contentViewController: hostingController)
        window.title = "Test Settings"
        window.styleMask = [.titled, .closable, .resizable]
        window.setContentSize(NSSize(width: 450, height: 300))
        window.center()

        // Store reference and show
        self.testWindow = window
        self.serverManager = manager

        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
}
