import 'package:example/main.dart' as example;
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('Shows the AppKey prompt at startup', (tester) async {
    example.main();
    await tester.pumpAndSettle();
    expect(find.textContaining('TMAP AppKey를 입력해주세요'), findsOneWidget);
  });
}
