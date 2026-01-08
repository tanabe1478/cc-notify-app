import XCTest
@testable import CCNotify

final class ApprovalRequestTests: XCTestCase {

    // MARK: - Status Tests

    func testPendingStatus_hasCorrectIcon() {
        let request = ApprovalRequest(
            toolName: "Bash",
            summary: "ls -la",
            status: .pending,
            timestamp: Date()
        )

        XCTAssertEqual(request.iconName, "clock", "Pending status should have clock icon")
    }

    func testApprovedStatus_hasCorrectIcon() {
        let request = ApprovalRequest(
            toolName: "Bash",
            summary: "ls -la",
            status: .approved,
            timestamp: Date()
        )

        XCTAssertEqual(request.iconName, "checkmark.circle.fill", "Approved status should have checkmark icon")
    }

    func testDeniedStatus_hasCorrectIcon() {
        let request = ApprovalRequest(
            toolName: "Bash",
            summary: "rm -rf /",
            status: .denied,
            timestamp: Date()
        )

        XCTAssertEqual(request.iconName, "xmark.circle.fill", "Denied status should have xmark icon")
    }

    // MARK: - Color Tests

    func testPendingStatus_hasOrangeColor() {
        let request = ApprovalRequest(
            toolName: "Bash",
            summary: "test",
            status: .pending,
            timestamp: Date()
        )

        XCTAssertEqual(request.statusColor, .orange, "Pending status should be orange")
    }

    func testApprovedStatus_hasGreenColor() {
        let request = ApprovalRequest(
            toolName: "Bash",
            summary: "test",
            status: .approved,
            timestamp: Date()
        )

        XCTAssertEqual(request.statusColor, .green, "Approved status should be green")
    }

    func testDeniedStatus_hasRedColor() {
        let request = ApprovalRequest(
            toolName: "Bash",
            summary: "test",
            status: .denied,
            timestamp: Date()
        )

        XCTAssertEqual(request.statusColor, .red, "Denied status should be red")
    }

    // MARK: - Time Ago Tests

    func testTimeAgo_recentTimestamp_showsJustNow() {
        let request = ApprovalRequest(
            toolName: "Bash",
            summary: "test",
            status: .pending,
            timestamp: Date()
        )

        // The exact string depends on locale, but it should not be empty
        XCTAssertFalse(request.timeAgo.isEmpty, "Time ago should not be empty")
    }

    func testTimeAgo_oldTimestamp_showsTimeAgo() {
        let oneHourAgo = Date().addingTimeInterval(-3600)
        let request = ApprovalRequest(
            toolName: "Bash",
            summary: "test",
            status: .pending,
            timestamp: oneHourAgo
        )

        XCTAssertFalse(request.timeAgo.isEmpty, "Time ago should not be empty for old timestamp")
    }

    // MARK: - Identifiable Tests

    func testEachRequest_hasUniqueId() {
        let request1 = ApprovalRequest(
            toolName: "Bash",
            summary: "test1",
            status: .pending,
            timestamp: Date()
        )

        let request2 = ApprovalRequest(
            toolName: "Bash",
            summary: "test2",
            status: .pending,
            timestamp: Date()
        )

        XCTAssertNotEqual(request1.id, request2.id, "Each request should have unique ID")
    }
}
