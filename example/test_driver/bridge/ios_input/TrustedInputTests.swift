import XCTest
import Foundation

/// Reproducible native touch input test runner for iOS Simulator.
/// Drives gestures via XCTest coordinate APIs without injecting JS synthetic events.
final class TrustedInputTests: XCTestCase {
    private let session: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.requestCachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        configuration.timeoutIntervalForRequest = 15.0
        return URLSession(configuration: configuration)
    }()

    private func exchange(_ request: URLRequest) throws -> Data {
        let finished = expectation(description: "driver-exchange")
        var result: Result<Data, Error>?
        session.dataTask(with: request) { data, response, error in
            if let error = error {
                result = .failure(error)
            } else if let httpResponse = response as? HTTPURLResponse,
                      httpResponse.statusCode < 200 || httpResponse.statusCode >= 300 {
                result = .failure(NSError(domain: "TrustedInput", code: httpResponse.statusCode,
                                          userInfo: [NSLocalizedDescriptionKey: "HTTP \(httpResponse.statusCode)"]))
            } else {
                result = .success(data ?? Data())
            }
            finished.fulfill()
        }.resume()
        wait(for: [finished], timeout: 20)
        guard let result = result else {
            throw NSError(domain: "TrustedInput", code: 4, userInfo: [NSLocalizedDescriptionKey: "Exchange timed out"])
        }
        return try result.get()
    }

    func testDriveRequestedGestures() throws {
        continueAfterFailure = false

        let env = ProcessInfo.processInfo.environment
        let portStr = env["TMAP_GESTURE_PORT"] ?? "8099"
        let serverUrlStr = env["TMAP_GESTURE_SERVER"] ?? "http://127.0.0.1:\(portStr)"
        guard let base = URL(string: serverUrlStr) else {
            XCTFail("Invalid gesture server URL: \(serverUrlStr)")
            return
        }

        let bundleId = env["TMAP_TARGET_BUNDLE_ID"] ?? "com.example.example"
        let app = XCUIApplication(bundleIdentifier: bundleId)

        // Handshake: notify loopback server that runner is connected
        var readyRequest = URLRequest(url: base.appendingPathComponent("ready"))
        readyRequest.httpMethod = "POST"
        readyRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        readyRequest.httpBody = try? JSONSerialization.data(withJSONObject: ["status": "ready"])
        _ = try? exchange(readyRequest)

        let deadline = Date().addingTimeInterval(86400) // Keep accepting commands continuously
        while Date() < deadline {
            let data: Data
            do {
                data = try exchange(URLRequest(url: base.appendingPathComponent("next")))
            } catch {
                Thread.sleep(forTimeInterval: 0.2)
                continue
            }

            guard let command = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let action = command["action"] as? String else {
                Thread.sleep(forTimeInterval: 0.1)
                continue
            }

            if action == "stop" {
                return
            }
            if action == "wait" {
                Thread.sleep(forTimeInterval: 0.1)
                continue
            }

            let commandId = command["id"] as? String ?? UUID().uuidString

            do {
                // Foreground target application if needed
                if app.state != .runningForeground {
                    app.activate()
                    _ = app.wait(for: .runningForeground, timeout: 5.0)
                }

                // Locate WKWebView or fallback to app window accounting for status bar
                let webView = app.webViews.firstMatch
                let baseCoordinate: XCUICoordinate
                let baseFrame: CGRect

                if webView.exists && webView.frame.width > 0 && webView.frame.height > 0 {
                    baseFrame = webView.frame
                    baseCoordinate = webView.coordinate(withNormalizedOffset: .zero)
                } else {
                    let window = app.windows.firstMatch
                    baseFrame = window.exists ? window.frame : app.frame
                    let appOrigin = app.coordinate(withNormalizedOffset: .zero)

                    var statusBarHeight: CGFloat = 0
                    let appStatusBar = app.statusBars.firstMatch
                    if appStatusBar.exists && appStatusBar.frame.height > 0 {
                        statusBarHeight = appStatusBar.frame.height
                    } else {
                        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
                        let sbStatusBar = springboard.statusBars.firstMatch
                        if sbStatusBar.exists && sbStatusBar.frame.height > 0 {
                            statusBarHeight = sbStatusBar.frame.height
                        }
                    }
                    baseCoordinate = appOrigin.withOffset(CGVector(dx: 0, dy: statusBarHeight))
                }

                // Resolve start coordinate
                guard let x = (command["x"] as? NSNumber)?.doubleValue,
                      let y = (command["y"] as? NSNumber)?.doubleValue else {
                    throw NSError(domain: "TrustedInput", code: 400,
                                  userInfo: [NSLocalizedDescriptionKey: "Missing x or y coordinate"])
                }

                let startCoord: XCUICoordinate
                if x < 0 || y < 0 {
                    startCoord = (webView.exists && webView.frame.width > 0)
                        ? webView.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
                        : app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
                } else {
                    if x > baseFrame.width || y > baseFrame.height {
                        throw NSError(
                            domain: "TrustedInput",
                            code: 422,
                            userInfo: [NSLocalizedDescriptionKey: "Input point (\(x), \(y)) outside target frame \(baseFrame.size)"]
                        )
                    }
                    startCoord = baseCoordinate.withOffset(CGVector(dx: x, dy: y))
                }

                let normAction = action.lowercased()
                    .replacingOccurrences(of: "_", with: "")
                    .replacingOccurrences(of: "-", with: "")

                switch normAction {
                case "tap":
                    startCoord.tap()

                case "doubletap":
                    startCoord.doubleTap()

                case "hold", "longpress":
                    let duration = (command["duration"] as? NSNumber)?.doubleValue ?? 0.75
                    startCoord.press(forDuration: duration)

                case "drag", "pan", "pressdrag":
                    guard let toX = (command["endX"] as? NSNumber)?.doubleValue ?? (command["toX"] as? NSNumber)?.doubleValue,
                          let toY = (command["endY"] as? NSNumber)?.doubleValue ?? (command["toY"] as? NSNumber)?.doubleValue else {
                        throw NSError(
                            domain: "TrustedInput",
                            code: 400,
                            userInfo: [NSLocalizedDescriptionKey: "Missing endX/endY for drag action"]
                        )
                    }
                    if toX > baseFrame.width || toY > baseFrame.height || toX < 0 || toY < 0 {
                        throw NSError(
                            domain: "TrustedInput",
                            code: 422,
                            userInfo: [NSLocalizedDescriptionKey: "Drag end point (\(toX), \(toY)) outside target frame \(baseFrame.size)"]
                        )
                    }
                    let endCoord = baseCoordinate.withOffset(CGVector(dx: toX, dy: toY))
                    let pressDuration = (command["pressDuration"] as? NSNumber)?.doubleValue ?? 0.12
                    let holdDuration = (command["holdDuration"] as? NSNumber)?.doubleValue ?? 0.05
                    startCoord.press(forDuration: pressDuration, thenDragTo: endCoord,
                                     withVelocity: .slow, thenHoldForDuration: holdDuration)

                default:
                    throw NSError(domain: "TrustedInput", code: 400,
                                  userInfo: [NSLocalizedDescriptionKey: "Unsupported gesture action: \(action)"])
                }

                var doneRequest = URLRequest(url: base.appendingPathComponent("done"))
                doneRequest.httpMethod = "POST"
                doneRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
                doneRequest.httpBody = try JSONSerialization.data(withJSONObject: [
                    "id": commandId,
                    "status": "success",
                    "action": action
                ])
                _ = try exchange(doneRequest)

            } catch {
                var errRequest = URLRequest(url: base.appendingPathComponent("done"))
                errRequest.httpMethod = "POST"
                errRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
                errRequest.httpBody = try? JSONSerialization.data(withJSONObject: [
                    "id": commandId,
                    "status": "error",
                    "error": error.localizedDescription
                ])
                _ = try? exchange(errRequest)
            }
        }
    }
}
