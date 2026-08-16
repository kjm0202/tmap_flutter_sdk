/// TMAP Label 생성 및 제어를 위한 JavaScript 스크립트 생성기
class JsLabel {
  static String getScript() {
    return '''
    function addLabel(labelId, lat, lng, content, fontSize, fontColor, minLevel, maxLevel) {
      if (!map) return;

      if (labels[labelId]) {
        labels[labelId].setMap(null);
        delete labels[labelId];
      }

      var pos = new Tmapv3.LatLng(lat, lng);
      var options = {
        position: pos,
        content: content,
        fontSize: fontSize || "14px",
        fontColor: fontColor || "#000000",
        map: map
      };

      if (minLevel !== undefined && minLevel !== null) {
        options.minLevel = minLevel;
      }
      if (maxLevel !== undefined && maxLevel !== null) {
        options.maxLevel = maxLevel;
      }

      var label = new Tmapv3.Label(options);
      labels[labelId] = label;
    }

    function clearLabel(labelId) {
      if (labels[labelId]) {
        labels[labelId].setMap(null);
        delete labels[labelId];
      }
    }

    function clearAllLabels() {
      for (var id in labels) {
        if (labels.hasOwnProperty(id)) {
          labels[id].setMap(null);
        }
      }
      labels = {};
    }
    ''';
  }
}
