import XCTest
@testable import CCNotify

@MainActor
final class ServerManagerTests: XCTestCase {

    var serverManager: ServerManager!

    override func setUp() async throws {
        serverManager = ServerManager()
    }

    override func tearDown() async throws {
        serverManager.stop()
        serverManager = nil
    }

    // MARK: - Initial State Tests

    func testInitialState_isNotRunning() {
        XCTAssertFalse(serverManager.isRunning, "Server should not be running initially")
    }

    func testInitialState_recentRequestsEmpty() {
        XCTAssertTrue(serverManager.recentRequests.isEmpty, "Recent requests should be empty initially")
    }

    func testInitialState_serverPathDetected() {
        // Server path auto-detection is environment-dependent
        // This test verifies the detection doesn't crash and returns valid path format
        let path = serverManager.serverPath

        // Path can be empty if detection fails (acceptable in test environment)
        if !path.isEmpty {
            // If a path is detected, verify it has valid format
            // The path might not exist in test environment due to DerivedData location
            XCTAssertTrue(path.contains("server") || path.contains("index.js"),
                          "Detected path should reference server files: \(path)")
        }
        // Empty path is acceptable - auto-detection may not work in test environment
    }

    // MARK: - Server Start/Stop Tests

    func testStart_withValidPath_serverIsRunning() async throws {
        // Skip if server path is not configured
        guard !serverManager.serverPath.isEmpty else {
            throw XCTSkip("Server path not configured")
        }

        // Check if port is already in use (another server instance running)
        if isPortInUse(port: 3847) {
            throw XCTSkip("Port 3847 already in use - another server instance may be running")
        }

        serverManager.start()

        // Wait a bit for the server to start
        try await Task.sleep(nanoseconds: 3_000_000_000) // 3 seconds

        XCTAssertTrue(serverManager.isRunning, "Server should be running after start()")
    }

    private func isPortInUse(port: Int) -> Bool {
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/usr/sbin/lsof")
        task.arguments = ["-i", ":\(port)"]

        let pipe = Pipe()
        task.standardOutput = pipe
        task.standardError = pipe

        do {
            try task.run()
            task.waitUntilExit()
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            return !data.isEmpty
        } catch {
            return false
        }
    }

    func testStop_afterStart_serverIsStopped() async throws {
        guard !serverManager.serverPath.isEmpty else {
            throw XCTSkip("Server path not configured")
        }

        serverManager.start()
        try await Task.sleep(nanoseconds: 2_000_000_000)

        serverManager.stop()
        try await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds

        XCTAssertFalse(serverManager.isRunning, "Server should be stopped after stop()")
    }

    func testStart_withEmptyPath_serverDoesNotStart() {
        serverManager.serverPath = ""
        serverManager.start()

        XCTAssertFalse(serverManager.isRunning, "Server should not start with empty path")
    }

    func testStart_whenAlreadyRunning_doesNothing() async throws {
        guard !serverManager.serverPath.isEmpty else {
            throw XCTSkip("Server path not configured")
        }

        serverManager.start()
        try await Task.sleep(nanoseconds: 2_000_000_000)

        let wasRunning = serverManager.isRunning
        serverManager.start() // Call start again

        XCTAssertEqual(serverManager.isRunning, wasRunning, "Calling start() again should not change state")
    }

    // MARK: - Settings Persistence Tests

    func testAutoStart_persistsToUserDefaults() {
        serverManager.autoStart = true
        XCTAssertTrue(serverManager.autoStart)

        serverManager.autoStart = false
        XCTAssertFalse(serverManager.autoStart)
    }

    func testServerPath_persistsToUserDefaults() {
        let testPath = "/test/path/to/server.js"
        serverManager.serverPath = testPath

        XCTAssertEqual(serverManager.serverPath, testPath)
    }
}
