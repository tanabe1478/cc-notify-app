import Foundation
import Combine

struct ApprovalRequest: Identifiable {
    let id = UUID()
    let toolName: String
    let summary: String
    let status: Status
    let timestamp: Date

    enum Status {
        case pending
        case approved
        case denied
    }

    var iconName: String {
        switch status {
        case .pending: return "clock"
        case .approved: return "checkmark.circle.fill"
        case .denied: return "xmark.circle.fill"
        }
    }

    var statusColor: Color {
        switch status {
        case .pending: return .orange
        case .approved: return .green
        case .denied: return .red
        }
    }

    var timeAgo: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: timestamp, relativeTo: Date())
    }
}

import SwiftUI

@MainActor
class ServerManager: ObservableObject {
    @Published var isRunning = false
    @Published var recentRequests: [ApprovalRequest] = []

    @AppStorage("serverPath") var serverPath: String = ""
    @AppStorage("autoStart") var autoStart: Bool = false

    private var process: Process?
    private var outputPipe: Pipe?

    init() {
        // Auto-detect server path if not set
        if serverPath.isEmpty {
            serverPath = detectServerPath()
        }

        // Auto-start if enabled
        if autoStart {
            start()
        }
    }

    private func detectServerPath() -> String {
        let fileManager = FileManager.default

        // Common locations to search
        let possibleRoots = [
            // From Xcode DerivedData - traverse up to find project
            Bundle.main.bundleURL
                .deletingLastPathComponent() // Debug/
                .deletingLastPathComponent() // Products/
                .deletingLastPathComponent() // Build/
                .deletingLastPathComponent() // CCNotify-xxx/
                .deletingLastPathComponent() // DerivedData/
                .deletingLastPathComponent() // Xcode/
                .deletingLastPathComponent() // Developer/
                .deletingLastPathComponent() // Library/
                .appendingPathComponent("Documents/repositories/cc-notify-app"),
            // Direct project path
            URL(fileURLWithPath: NSHomeDirectory())
                .appendingPathComponent("Documents/repositories/cc-notify-app"),
            // App bundle location (when installed in Applications)
            Bundle.main.bundleURL
                .deletingLastPathComponent()
                .deletingLastPathComponent()
                .deletingLastPathComponent(),
        ]

        for root in possibleRoots {
            let serverPath = root.appendingPathComponent("dist/server/index.js")
            if fileManager.fileExists(atPath: serverPath.path) {
                return serverPath.path
            }
        }

        return ""
    }

    func start() {
        guard !isRunning else { return }
        guard !serverPath.isEmpty else {
            print("Server path not configured")
            return
        }

        let process = Process()
        let pipe = Pipe()

        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = ["node", serverPath]
        process.standardOutput = pipe
        process.standardError = pipe

        // Set environment variables from .env file
        var environment = ProcessInfo.processInfo.environment
        loadEnvFile(into: &environment)
        process.environment = environment

        // Set working directory to project root
        let projectRoot = URL(fileURLWithPath: serverPath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        process.currentDirectoryURL = projectRoot

        pipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            if let output = String(data: data, encoding: .utf8), !output.isEmpty {
                Task { @MainActor in
                    self?.parseOutput(output)
                }
            }
        }

        process.terminationHandler = { [weak self] _ in
            Task { @MainActor in
                self?.isRunning = false
                self?.process = nil
            }
        }

        do {
            try process.run()
            self.process = process
            self.outputPipe = pipe
            isRunning = true
        } catch {
            print("Failed to start server: \(error)")
        }
    }

    func stop() {
        guard let process = process, process.isRunning else { return }
        process.terminate()
        self.process = nil
        isRunning = false
    }

    private func loadEnvFile(into environment: inout [String: String]) {
        let projectRoot = URL(fileURLWithPath: serverPath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let envPath = projectRoot.appendingPathComponent(".env")

        guard let content = try? String(contentsOf: envPath, encoding: .utf8) else { return }

        for line in content.components(separatedBy: .newlines) {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            guard !trimmed.isEmpty, !trimmed.hasPrefix("#") else { continue }

            let parts = trimmed.split(separator: "=", maxSplits: 1)
            guard parts.count == 2 else { continue }

            let key = String(parts[0]).trimmingCharacters(in: .whitespaces)
            var value = String(parts[1]).trimmingCharacters(in: .whitespaces)

            // Remove quotes if present
            if (value.hasPrefix("\"") && value.hasSuffix("\"")) ||
               (value.hasPrefix("'") && value.hasSuffix("'")) {
                value = String(value.dropFirst().dropLast())
            }

            environment[key] = value
        }
    }

    private func parseOutput(_ output: String) {
        // Parse server output to track requests
        // Example: [Discord] Sent approval request: abc123
        // Example: [Discord] Button clicked: approve for request abc123

        for line in output.components(separatedBy: .newlines) {
            if line.contains("Sent approval request:") {
                // Extract tool name from previous log lines if available
                let request = ApprovalRequest(
                    toolName: "Permission Request",
                    summary: "Waiting for approval...",
                    status: .pending,
                    timestamp: Date()
                )
                recentRequests.insert(request, at: 0)

                // Keep only last 10 requests
                if recentRequests.count > 10 {
                    recentRequests = Array(recentRequests.prefix(10))
                }
            } else if line.contains("Button clicked: approve") {
                updateLatestRequest(status: .approved)
            } else if line.contains("Button clicked: deny") || line.contains("Deny modal submitted") {
                updateLatestRequest(status: .denied)
            }
        }
    }

    private func updateLatestRequest(status: ApprovalRequest.Status) {
        guard let index = recentRequests.firstIndex(where: { $0.status == .pending }) else { return }
        let old = recentRequests[index]
        recentRequests[index] = ApprovalRequest(
            toolName: old.toolName,
            summary: status == .approved ? "Approved" : "Denied",
            status: status,
            timestamp: old.timestamp
        )
    }
}
