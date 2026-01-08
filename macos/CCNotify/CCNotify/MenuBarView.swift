import SwiftUI

struct MenuBarView: View {
    @ObservedObject var serverManager: ServerManager

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                Image(systemName: "bell.badge")
                    .font(.title2)
                Text("CC Notify")
                    .font(.headline)
                Spacer()
                StatusBadge(isRunning: serverManager.isRunning)
            }
            .padding(.bottom, 4)

            Divider()

            // Server Control
            VStack(alignment: .leading, spacing: 8) {
                Text("Server")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                HStack {
                    if serverManager.isRunning {
                        Button(action: { serverManager.stop() }) {
                            Label("Stop Server", systemImage: "stop.fill")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.red)
                    } else {
                        Button(action: { serverManager.start() }) {
                            Label("Start Server", systemImage: "play.fill")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.green)
                    }
                }
            }

            // Recent Activity
            if !serverManager.recentRequests.isEmpty {
                Divider()

                VStack(alignment: .leading, spacing: 8) {
                    Text("Recent Requests")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    ForEach(serverManager.recentRequests.prefix(5)) { request in
                        RequestRow(request: request)
                    }
                }
            }

            Divider()

            // Footer
            HStack {
                SettingsLink {
                    Text("Settings...")
                }
                .buttonStyle(.plain)
                .foregroundStyle(.blue)

                Spacer()

                Button("Quit") {
                    serverManager.stop()
                    NSApplication.shared.terminate(nil)
                }
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)
            }
            .font(.caption)
        }
        .padding()
        .frame(width: 280)
    }
}

struct StatusBadge: View {
    let isRunning: Bool

    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(isRunning ? .green : .red)
                .frame(width: 8, height: 8)
            Text(isRunning ? "Running" : "Stopped")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(.quaternary)
        .clipShape(Capsule())
    }
}

struct RequestRow: View {
    let request: ApprovalRequest

    var body: some View {
        HStack {
            Image(systemName: request.iconName)
                .foregroundStyle(request.statusColor)
                .frame(width: 20)

            VStack(alignment: .leading, spacing: 2) {
                Text(request.toolName)
                    .font(.caption)
                    .fontWeight(.medium)
                Text(request.summary)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            Text(request.timeAgo)
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 2)
    }
}

#Preview {
    MenuBarView(serverManager: ServerManager())
}
