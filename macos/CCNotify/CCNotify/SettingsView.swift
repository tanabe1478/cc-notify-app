import SwiftUI

struct SettingsView: View {
    @ObservedObject var serverManager: ServerManager
    @State private var isSelectingFile = false

    var body: some View {
        Form {
            Section {
                HStack {
                    TextField("Server Path", text: $serverManager.serverPath)
                        .textFieldStyle(.roundedBorder)

                    Button("Browse...") {
                        selectServerPath()
                    }
                }

                Text("Path to dist/server/index.js")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } header: {
                Text("Server Configuration")
            }

            Section {
                Toggle("Start server on launch", isOn: $serverManager.autoStart)

                LaunchAtLoginToggle()
            } header: {
                Text("Startup")
            }

            Section {
                HStack {
                    Text("Status")
                    Spacer()
                    if serverManager.isRunning {
                        Label("Running", systemImage: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                    } else {
                        Label("Stopped", systemImage: "xmark.circle.fill")
                            .foregroundStyle(.red)
                    }
                }

                if serverManager.isRunning {
                    Button("Stop Server") {
                        serverManager.stop()
                    }
                    .foregroundStyle(.red)
                } else {
                    Button("Start Server") {
                        serverManager.start()
                    }
                }
            } header: {
                Text("Server Status")
            }
        }
        .formStyle(.grouped)
        .frame(width: 450, height: 300)
        .navigationTitle("Settings")
    }

    private func selectServerPath() {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.canChooseFiles = true
        panel.allowedContentTypes = [.javaScript]
        panel.message = "Select the server's index.js file (dist/server/index.js)"

        if panel.runModal() == .OK {
            serverManager.serverPath = panel.url?.path ?? ""
        }
    }
}

struct LaunchAtLoginToggle: View {
    @State private var launchAtLogin = false

    var body: some View {
        Toggle("Launch at login", isOn: $launchAtLogin)
            .onChange(of: launchAtLogin) { _, newValue in
                setLaunchAtLogin(newValue)
            }
            .onAppear {
                launchAtLogin = isLaunchAtLoginEnabled()
            }
    }

    private func isLaunchAtLoginEnabled() -> Bool {
        // Check if app is in login items
        // This is a simplified check - in production, use SMAppService
        return false
    }

    private func setLaunchAtLogin(_ enabled: Bool) {
        // In production, use SMAppService.mainApp.register() / unregister()
        // For now, we'll just print a message
        print("Launch at login: \(enabled)")
    }
}

#Preview {
    SettingsView(serverManager: ServerManager())
}
