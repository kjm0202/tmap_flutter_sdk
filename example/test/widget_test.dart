import 'package:example/main.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const TMapExampleApp());
    expect(find.text('TMAP Flutter Demo'), findsNothing); // Title in MaterialApp
  });
}
