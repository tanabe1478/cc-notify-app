import SwiftUI

@main
struct CCNotifyApp: App {
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
