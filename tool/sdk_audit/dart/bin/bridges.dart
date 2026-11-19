import 'dart:convert';
import 'dart:io';
import 'package:path/path.dart' as p;

void main(List<String> args) {
  final root = args.isNotEmpty ? args.first : Directory.current.path;
  final bridgeDir = Directory(p.join(root, 'assets/bridge'));

  String readAsset(String name) {
    final f = File(p.join(bridgeDir.path, name));
    return f.existsSync() ? f.readAsStringSync() : '';
  }

  final shared = readAsset('shared.js');
  final web = readAsset('web.js');
  final mobile = readAsset('mobile.js');
  final mobileOverlays = readAsset('mobile_overlays.js');
  final mobileTdata = readAsset('mobile_tdata.js');

  stdout.write(
    jsonEncode({
      'web': [shared, web].where((s) => s.isNotEmpty).join('\n'),
      'mobileHelpers': [
        shared,
        mobile,
        mobileOverlays,
        mobileTdata,
      ].where((s) => s.isNotEmpty).join('\n'),
      'assets': {
        'shared': shared.isNotEmpty,
        'web': web.isNotEmpty,
        'mobile': mobile.isNotEmpty,
        'mobile_overlays': mobileOverlays.isNotEmpty,
        'mobile_tdata': mobileTdata.isNotEmpty,
      },
    }),
  );
}
