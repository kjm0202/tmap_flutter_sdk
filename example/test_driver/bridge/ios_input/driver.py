#!/usr/bin/env python3
"""
Reproducible native touch input driver for iOS Simulator (XCUITest).

Serves a loopback HTTP interface on 127.0.0.1:PORT, generates a standalone
XCUITest runner project in a temporary directory via canonical create_project.rb,
and drives native gestures (tap, double tap, hold, drag) using XCTest coordinate APIs.

No auto reboot or kill of other user's simulators; never dumps app trees or env;
fails closed and surfaces actual driver failures.
"""

import argparse
import glob
import http.server
import json
import os
import queue
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time
import uuid
from urllib.parse import parse_qs, urlparse


# -----------------------------------------------------------------------------
# Loopback HTTP Driver Server
# -----------------------------------------------------------------------------
class GestureDriverServer:
    def __init__(self, host: str, port: int, bundle_id: str, device_udid: str, device_name: str):
        self.host = host
        self.port = port
        self.bundle_id = bundle_id
        self.device_udid = device_udid
        self.device_name = device_name
        self.command_queue = queue.Queue()
        self.pending_events = {}
        self.pending_results = {}
        self.armed_events = {}
        self.fire_events = {}
        self.runner_ready_event = threading.Event()
        self.server = None
        self.server_thread = None

    def start(self):
        parent = self

        class RequestHandler(http.server.BaseHTTPRequestHandler):
            def log_message(self, fmt, *args):
                # Keep logs minimal and surface actual errors
                pass

            def do_POST(self):
                length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(length) if length > 0 else b"{}"
                try:
                    data = json.loads(body.decode("utf-8"))
                except Exception:
                    data = {}

                if self.path == "/ready":
                    parent.runner_ready_event.set()
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(b'{"status":"ready"}')

                elif self.path == "/done":
                    req_id = data.get("id")
                    if req_id and req_id in parent.pending_events:
                        parent.pending_results[req_id] = data
                        parent.pending_events[req_id].set()
                        if req_id in parent.armed_events:
                            parent.armed_events[req_id].set()
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(b'{"status":"ok"}')

                elif self.path == "/armed":
                    req_id = data.get("id")
                    if req_id in parent.armed_events:
                        parent.armed_events[req_id].set()
                    self.send_response(200)
                    self.end_headers()

                elif self.path == "/fire":
                    req_id = data.get("id")
                    fire = parent.fire_events.get(req_id)
                    done = parent.pending_events.get(req_id)
                    if fire is None or done is None:
                        self.send_response(404)
                        self.end_headers()
                        return
                    fire.set()
                    completed = done.wait(timeout=30.0)
                    res = parent.pending_results.pop(req_id, None)
                    parent.pending_events.pop(req_id, None)
                    parent.armed_events.pop(req_id, None)
                    parent.fire_events.pop(req_id, None)
                    self.send_response(200 if completed and res and res.get("status") == "success" else 500)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps(res or {"error": "Timed out waiting for fast drag"}).encode("utf-8"))

                elif self.path in ("/input", "/prepare"):
                    action = data.get("action")
                    if not action or "x" not in data or "y" not in data:
                        self.send_response(400)
                        self.send_header("Content-Type", "application/json")
                        self.end_headers()
                        self.wfile.write(b'{"status":"error","error":"action, x, and y are required"}')
                        return

                    req_id = f"cmd-{int(time.time()*1000)}-{uuid.uuid4().hex[:6]}"
                    data["id"] = req_id
                    ev = threading.Event()
                    parent.pending_events[req_id] = ev
                    if self.path == "/prepare":
                        parent.armed_events[req_id] = threading.Event()
                        parent.fire_events[req_id] = threading.Event()
                    parent.command_queue.put(data)

                    if self.path == "/prepare":
                        armed = parent.armed_events[req_id].wait(timeout=30.0)
                        result = parent.pending_results.get(req_id)
                        if not armed or result:
                            parent.pending_events.pop(req_id, None)
                            parent.pending_results.pop(req_id, None)
                            parent.armed_events.pop(req_id, None)
                            parent.fire_events.pop(req_id, None)
                            self.send_response(500)
                            self.end_headers()
                            self.wfile.write(json.dumps(result or {"error": "Timed out preparing fast drag"}).encode("utf-8"))
                            return
                        self.send_response(200)
                        self.send_header("Content-Type", "application/json")
                        self.end_headers()
                        self.wfile.write(json.dumps({"id": req_id}).encode("utf-8"))
                        return

                    # Wait for XCUITest completion (fail closed if runner stalls)
                    completed = ev.wait(timeout=30.0)
                    res = parent.pending_results.pop(req_id, None)
                    parent.pending_events.pop(req_id, None)

                    if not completed:
                        self.send_response(504)
                        self.send_header("Content-Type", "application/json")
                        self.end_headers()
                        self.wfile.write(
                            json.dumps({
                                "status": "error",
                                "id": req_id,
                                "error": f"Timed out waiting for XCUITest runner to execute '{action}'"
                            }).encode("utf-8")
                        )
                        return

                    if res and res.get("status") == "success":
                        self.send_response(200)
                        self.send_header("Content-Type", "application/json")
                        self.end_headers()
                        self.wfile.write(json.dumps(res).encode("utf-8"))
                    else:
                        err_msg = (res or {}).get("error", "Unknown XCUITest execution error")
                        self.send_response(500)
                        self.send_header("Content-Type", "application/json")
                        self.end_headers()
                        self.wfile.write(
                            json.dumps({
                                "status": "error",
                                "id": req_id,
                                "error": err_msg
                            }).encode("utf-8")
                        )

                else:
                    self.send_response(404)
                    self.end_headers()

            def do_GET(self):
                parsed = urlparse(self.path)
                if parsed.path == "/fire":
                    req_id = parse_qs(parsed.query).get("id", [None])[0]
                    fire = parent.fire_events.get(req_id)
                    if fire is None or not fire.wait(timeout=30.0):
                        self.send_response(408)
                    else:
                        self.send_response(200)
                    self.end_headers()
                elif self.path == "/next":
                    parent.runner_ready_event.set()
                    try:
                        cmd = parent.command_queue.get(timeout=0.5)
                    except queue.Empty:
                        cmd = {"action": "wait"}
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps(cmd).encode("utf-8"))

                elif self.path in ("/health", "/status"):
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(
                        json.dumps({
                            "status": "ok",
                            "ready": parent.runner_ready_event.is_set(),
                            "device": parent.device_udid,
                            "device_name": parent.device_name,
                            "bundle_id": parent.bundle_id,
                        }).encode("utf-8")
                    )

                else:
                    self.send_response(404)
                    self.end_headers()

        self.server = http.server.ThreadingHTTPServer((self.host, self.port), RequestHandler)
        self.server_thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.server_thread.start()

    def shutdown(self):
        if self.server:
            try:
                self.server.shutdown()
                self.server.server_close()
            except Exception:
                pass


# -----------------------------------------------------------------------------
# Device Discovery
# -----------------------------------------------------------------------------
def resolve_simulator(target: str):
    """
    Finds simulator matching target name, UDID, or 'booted'.
    Never reboots or kills any simulator.
    """
    cmd = ["xcrun", "simctl", "list", "-j", "devices"]
    try:
        raw = subprocess.check_output(cmd, text=True)
        data = json.loads(raw)
    except Exception as e:
        sys.stderr.write(f"Error querying iOS simulators: {e}\n")
        sys.exit(1)

    devices = data.get("devices", {})
    all_devs = []
    for runtime, dev_list in devices.items():
        if "iOS" not in runtime:
            continue
        for d in dev_list:
            all_devs.append((d.get("udid"), d.get("name"), d.get("state"), runtime))

    if target.lower() == "booted":
        booted = [d for d in all_devs if d[2] == "Booted"]
        if not booted:
            sys.stderr.write(
                "Error: No booted iOS Simulator found. Please boot a simulator or specify --device <name/udid>.\n"
            )
            sys.exit(1)
        # Prefer iPhone over iPad if available
        iphones = [d for d in booted if "iPhone" in d[1]]
        chosen = iphones[0] if iphones else booted[0]
        return chosen[0], chosen[1]

    # Match by exact UDID
    for udid, name, state, _ in all_devs:
        if udid.lower() == target.lower():
            return udid, name

    # Match by exact Name
    named = [d for d in all_devs if d[1].lower() == target.lower()]
    if named:
        booted_named = [d for d in named if d[2] == "Booted"]
        chosen = booted_named[0] if booted_named else named[0]
        return chosen[0], chosen[1]

    sys.stderr.write(f"Error: Simulator '{target}' not found in simctl list.\n")
    sys.exit(1)


# -----------------------------------------------------------------------------
# Project Generator
# -----------------------------------------------------------------------------
def find_xcodeproj_ruby():
    """
    Finds a ruby environment capable of requiring 'xcodeproj'.
    Supports system/user gem installations, Homebrew CocoaPods prefix, and gem fallbacks.
    """
    # 1. Direct check in current environment
    res = subprocess.run(["ruby", "-e", "require 'xcodeproj'"], capture_output=True)
    if res.returncode == 0:
        return ["ruby"], os.environ.copy()

    candidate_gem_homes = []

    # 2. Read GEM_HOME from pod Homebrew prefix or pod script
    try:
        brew_res = subprocess.run(
            ["brew", "--prefix", "cocoapods"],
            capture_output=True,
            text=True,
            check=False,
        )
        if brew_res.returncode == 0 and brew_res.stdout.strip():
            candidate_gem_homes.append(os.path.join(brew_res.stdout.strip(), "libexec"))
    except Exception:
        pass

    pod_path = shutil.which("pod")
    if pod_path:
        try:
            with open(pod_path, "r", errors="ignore") as f:
                content = f.read(2048)
                m = re.search(r'GEM_HOME=["\']([^"\']+)["\']', content)
                if m:
                    candidate_gem_homes.append(m.group(1))
        except Exception:
            pass
        try:
            real_pod = os.path.realpath(pod_path)
            parent = os.path.dirname(real_pod)
            if os.path.basename(parent) == "bin":
                candidate_gem_homes.append(os.path.dirname(parent))
        except Exception:
            pass

    # Well-known Homebrew CocoaPods paths
    candidate_gem_homes.extend([
        "/opt/homebrew/opt/cocoapods/libexec",
        "/usr/local/opt/cocoapods/libexec",
        *glob.glob("/opt/homebrew/Cellar/cocoapods/*/libexec"),
        *glob.glob("/usr/local/Cellar/cocoapods/*/libexec"),
    ])

    # 3. Gem fallback
    try:
        gem_res = subprocess.run(
            ["gem", "env", "gemdir"],
            capture_output=True,
            text=True,
            check=False,
        )
        if gem_res.returncode == 0 and gem_res.stdout.strip():
            candidate_gem_homes.append(gem_res.stdout.strip())
    except Exception:
        pass

    try:
        gem_home_res = subprocess.run(
            ["gem", "env", "home"],
            capture_output=True,
            text=True,
            check=False,
        )
        if gem_home_res.returncode == 0 and gem_home_res.stdout.strip():
            candidate_gem_homes.append(gem_home_res.stdout.strip())
    except Exception:
        pass

    seen = set()
    for gem_home in candidate_gem_homes:
        if not gem_home or gem_home in seen or not os.path.isdir(gem_home):
            continue
        seen.add(gem_home)
        env = os.environ.copy()
        env["GEM_HOME"] = gem_home
        res = subprocess.run(["ruby", "-e", "require 'xcodeproj'"], env=env, capture_output=True)
        if res.returncode == 0:
            return ["ruby"], env

    return None, None


def setup_test_project(temp_dir: str, port: int = 8099, bundle_id: str = "com.example.example", generator: str = "ruby"):
    """
    Generates the standalone Xcode project in temp_dir using canonical
    create_project.rb and sibling TrustedInputTests.swift.
    """
    if generator != "ruby":
        raise ValueError(f"Unsupported generator: {generator}. Only 'ruby' is currently supported.")

    script_dir = os.path.dirname(os.path.abspath(__file__))
    create_rb = os.path.join(script_dir, "create_project.rb")
    swift_source = os.path.join(script_dir, "TrustedInputTests.swift")

    if not os.path.isfile(create_rb):
        raise FileNotFoundError(f"Canonical project generator not found: {create_rb}")
    if not os.path.isfile(swift_source):
        raise FileNotFoundError(f"Canonical Swift test source not found: {swift_source}")

    ruby_cmd, ruby_env = find_xcodeproj_ruby()
    if not ruby_cmd:
        raise RuntimeError(
            "Could not find a Ruby environment with 'xcodeproj' gem.\n"
            "Ensure CocoaPods is installed (e.g. 'brew install cocoapods') "
            "or the xcodeproj gem is installed ('gem install xcodeproj')."
        )

    res = subprocess.run(
        [*ruby_cmd, create_rb, temp_dir, swift_source],
        env=ruby_env,
        capture_output=True,
        text=True,
    )
    if res.returncode != 0:
        err = res.stderr.strip() or res.stdout.strip()
        raise RuntimeError(f"Failed to generate Xcode project via {create_rb}: {err}")

    proj_dir = os.path.join(temp_dir, "TrustedInput.xcodeproj")
    if not os.path.exists(proj_dir):
        raise RuntimeError(f"Expected generated project at {proj_dir}, but it was not created.")

    return proj_dir


# -----------------------------------------------------------------------------
# Main Driver Entrypoint
# -----------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Reproducible native touch input driver for iOS Simulator (XCUITest).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Reproducible Invocation:
  1. Start the native input driver on host:
     python3 example/test_driver/bridge/ios_input/driver.py --device booted --port 8099

  2. Run your Flutter test scenario passing the gesture port:
     flutter run -d <device> --dart-define=TMAP_GESTURE_PORT=8099 example/test_driver/bridge/main.dart

  3. In scenario Dart code:
     import 'native_input_stub.dart' if (dart.library.io) 'native_input.dart';

     if (useNativeInput) {
       await driveNativeInput('tap', x, y);
       await driveNativeInput('doubleTap', x, y);
       await driveNativeInput('hold', x, y);
       await driveNativeInput('drag', startX, startY, endX: endX, endY: endY);
     }
"""
    )
    parser.add_argument(
        "--device",
        default="booted",
        help="Target simulator name or UDID (default: 'booted')",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8099,
        help="Loopback HTTP server port (default: 8099)",
    )
    parser.add_argument(
        "--bundle-id",
        default="com.example.example",
        help="Bundle ID of app under test (default: com.example.example)",
    )
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Loopback host address (default: 127.0.0.1)",
    )
    parser.add_argument(
        "--keep-project",
        action="store_true",
        help="Retain temporary generated Xcode project directory on exit",
    )
    parser.add_argument(
        "--generator",
        choices=["ruby", "template"],
        default="ruby",
        help="Project generation mechanism ('ruby' [default] or 'template')",
    )
    parser.add_argument(
        "--startup-timeout",
        type=float,
        default=300.0,
        help="Readiness deadline in seconds waiting for XCUITest runner (default: 300.0)",
    )

    args = parser.parse_args()

    udid, name = resolve_simulator(args.device)
    print(f"[driver] Resolved iOS Simulator: {name} ({udid})")

    temp_dir = tempfile.mkdtemp(prefix="tmap_ios_input_")
    derived_data = os.path.join(temp_dir, "DerivedData")

    server = GestureDriverServer(
        host=args.host,
        port=args.port,
        bundle_id=args.bundle_id,
        device_udid=udid,
        device_name=name,
    )
    server.start()
    print(f"[driver] Loopback HTTP server listening on http://{args.host}:{args.port}")

    proj_dir = setup_test_project(
        temp_dir=temp_dir,
        port=args.port,
        bundle_id=args.bundle_id,
        generator=args.generator,
    )
    print(f"[driver] Test project ready in temporary directory")

    xcodebuild_cmd = [
        "xcodebuild",
        "test",
        "-project", proj_dir,
        "-scheme", "TrustedInput",
        "-destination", f"id={udid}",
        "-derivedDataPath", derived_data,
        "-parallel-testing-enabled", "NO",
        "-test-timeouts-enabled", "NO",
    ]

    env = os.environ.copy()
    env["TMAP_GESTURE_PORT"] = str(args.port)
    env["TMAP_GESTURE_SERVER"] = f"http://{args.host}:{args.port}"
    env["TEST_RUNNER_TMAP_GESTURE_PORT"] = str(args.port)
    env["TEST_RUNNER_TMAP_GESTURE_SERVER"] = f"http://{args.host}:{args.port}"
    env["TMAP_TARGET_BUNDLE_ID"] = args.bundle_id
    env["TEST_RUNNER_TMAP_TARGET_BUNDLE_ID"] = args.bundle_id

    print(f"[driver] Launching XCUITest runner on {name}...")
    proc = subprocess.Popen(
        xcodebuild_cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        env=env,
        text=True,
    )

    # Background reader thread to prevent pipe buffering deadlocks
    def stream_output():
        for line in iter(proc.stdout.readline, ""):
            line_str = line.strip()
            if any(k in line_str for k in ["Test Case", "TEST FAILED", "Build failed", "error:"]):
                print(f"[xcodebuild] {line_str}")
        proc.stdout.close()

    reader_thread = threading.Thread(target=stream_output, daemon=True)
    reader_thread.start()

    shutdown_event = threading.Event()

    def handle_signal(sig, frame):
        shutdown_event.set()

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    # Wait for initial connection from XCUITest runner
    print(f"[driver] Waiting for XCUITest runner to connect (timeout: {args.startup_timeout:g}s)...")
    start_time = time.time()
    while not server.runner_ready_event.is_set():
        if proc.poll() is not None:
            sys.stderr.write(
                f"[driver] Error: XCUITest runner exited early with code {proc.returncode} before becoming ready.\n"
            )
            server.shutdown()
            if not args.keep_project:
                shutil.rmtree(temp_dir, ignore_errors=True)
            sys.exit(1)
        if shutdown_event.is_set():
            sys.stderr.write("[driver] Interrupted while waiting for XCUITest runner.\n")
            proc.terminate()
            server.shutdown()
            if not args.keep_project:
                shutil.rmtree(temp_dir, ignore_errors=True)
            sys.exit(1)
        if time.time() - start_time >= args.startup_timeout:
            break
        server.runner_ready_event.wait(timeout=0.5)

    if not server.runner_ready_event.is_set():
        if proc.poll() is not None:
            sys.stderr.write(
                f"[driver] Error: XCUITest runner exited early with code {proc.returncode} before becoming ready.\n"
            )
        else:
            sys.stderr.write(
                f"[driver] Error: XCUITest runner failed to connect within {args.startup_timeout:g}s.\n"
                "Fail closed: check simulator state or target bundle identifier.\n"
            )
            proc.terminate()
        server.shutdown()
        if not args.keep_project:
            shutil.rmtree(temp_dir, ignore_errors=True)
        sys.exit(1)

    print("================================================================================")
    print("iOS Native Touch Input Driver Active & Ready")
    print(f"Loopback Server: http://{args.host}:{args.port}/input")
    print(f"Device:          {name} ({udid})")
    print(f"Target App:      {args.bundle_id}")
    print("================================================================================")
    print("[driver] Accepting commands continuously. Supporting running before flutter run.")
    print("[driver] Press Ctrl+C to terminate.")

    while not shutdown_event.is_set():
        if proc.poll() is not None:
            sys.stderr.write(f"\n[driver] XCUITest runner exited unexpectedly (code {proc.returncode})\n")
            break
        time.sleep(0.5)

    print("\n[driver] Shutting down...")
    server.command_queue.put({"action": "stop"})
    try:
        proc.wait(timeout=5.0)
    except subprocess.TimeoutExpired:
        proc.terminate()

    server.shutdown()

    if not args.keep_project:
        shutil.rmtree(temp_dir, ignore_errors=True)
    else:
        print(f"[driver] Retained temporary project: {temp_dir}")

    print("[driver] Clean shutdown complete.")


if __name__ == "__main__":
    main()
