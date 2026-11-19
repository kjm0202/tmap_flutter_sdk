import http.server
import json
import subprocess
import argparse
import sys
import math

def run_adb_input(serial, cmd_list):
    # Construct adb shell input command safely
    full_cmd = ['adb', '-s', serial, 'shell'] + [' '.join(cmd_list)]
    print(f"Running: {' '.join(full_cmd)}")
    try:
        subprocess.run(full_cmd, check=True, timeout=5)
    except subprocess.TimeoutExpired:
        raise Exception("ADB command timed out")

class InputHandler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            if self.path != '/input':
                self.send_response(404)
                self.end_headers()
                return

            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self.send_response(400)
                self.end_headers()
                return
                
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            action = data.get('action')
            x = data.get('x')
            y = data.get('y')

            # Validation
            if not all(isinstance(v, (int, float)) and math.isfinite(v) for v in [x, y]):
                self.send_response(400)
                self.end_headers()
                return

            x, y = int(x), int(y)
            if x < 0 or y < 0:
                self.send_response(400)
                self.end_headers()
                return
            serial = self.server.serial

            if action == 'tap':
                run_adb_input(serial, ['input', 'tap', str(x), str(y)])
            elif action == 'doubleTap':
                # Double tap: two taps without sleep in one shell call
                run_adb_input(serial, ['input', 'tap', str(x), str(y), '&&', 'input', 'tap', str(x), str(y)])
            elif action == 'hold':
                # Hold: DOWN, sleep 1.0, UP using touchscreen motionevent
                run_adb_input(serial, ['input', 'touchscreen', 'motionevent', 'DOWN', str(x), str(y), '&&', 'sleep', '1', '&&', 'input', 'touchscreen', 'motionevent', 'UP', str(x), str(y)])
            elif action == 'drag':
                endX = data.get('endX')
                endY = data.get('endY')
                if not all(isinstance(v, (int, float)) and math.isfinite(v) for v in [endX, endY]):
                    self.send_response(400)
                    self.end_headers()
                    return
                endX, endY = int(endX), int(endY)
                if endX < 0 or endY < 0:
                    self.send_response(400)
                    self.end_headers()
                    return
                run_adb_input(serial, ['input', 'swipe', str(x), str(y), str(endX), str(endY), '500'])
            else:
                self.send_response(400)
                self.end_headers()
                return
            
            self.send_response(200)
            self.end_headers()
        except Exception as e:
            print(f"Error: {e}")
            self.send_response(400) # Per requirement, bad requests return 400
            self.end_headers()

def run_server():
    parser = argparse.ArgumentParser(description='Android Input Server')
    parser.add_argument('--device', required=True, help='ADB device serial')
    parser.add_argument('--port', required=True, type=int, help='Port to run server on')
    args = parser.parse_args()

    server = http.server.HTTPServer(('127.0.0.1', args.port), InputHandler)
    server.serial = args.device
    print(f"Server running on 127.0.0.1:{args.port} for device {args.device}")
    server.serve_forever()

if __name__ == '__main__':
    run_server()

