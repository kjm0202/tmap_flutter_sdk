import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

import 'tdata_coordinate_poi.dart';
import 'tdata_coordinate_projection.dart';
import 'tdata_coordinate_route.dart';
import 'tdata_coordinate_samples.dart';

Future<void> testTdataCoordinateScenario(TMapController controller) async {
  verifyReleasedCoordinateSamples();
  await verifyPoiCoordinates(controller);
  await verifyRouteCoordinates(controller);
  await verifyProjectedRoutes(controller);
}
