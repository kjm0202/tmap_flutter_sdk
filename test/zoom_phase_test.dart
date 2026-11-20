import 'package:flutter_test/flutter_test.dart';
import 'package:tmap_flutter_sdk/src/constants/zoom_type.dart';
import 'package:tmap_flutter_sdk/src/utils/zoom_phase.dart';

void main() {
  test('recognized zoom phases map to the matching ZoomType', () {
    expect(zoomTypeFromPhase('start'), ZoomType.start);
    expect(zoomTypeFromPhase('end'), ZoomType.end);
  });

  test('unknown, intermediate and absent phases are ignored', () {
    for (final phase in <String?>[null, '', 'move', 'START', 'finished']) {
      expect(zoomTypeFromPhase(phase), isNull, reason: 'phase: $phase');
    }
  });
}
