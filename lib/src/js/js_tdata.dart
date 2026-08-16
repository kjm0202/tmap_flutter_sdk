/// TMAP TData OpenAPI 서비스 연동을 위한 JavaScript 스크립트 생성기
class JsTData {
  static String getScript() {
    return '''
    function _ensureTData() {
      if (!tdata) {
        try {
          tdata = new Tmapv3.extension.TData();
        } catch(e) {
          try {
            tdata = new Tmapv3.TData();
          } catch(e2) {
            console.error("TData initialization failed:", e2);
          }
        }
      }
      return tdata;
    }

    function _sendTDataResult(requestId, success, data, error) {
      if (window.tdataCallback) {
        tdataCallback.postMessage(JSON.stringify({
          requestId: requestId,
          success: success,
          data: data || null,
          error: error || null
        }));
      }
    }

    function requestRoutePlan(requestId, startLat, startLng, endLat, endLng, optionsJson) {
      var td = _ensureTData();
      if (!td) {
        _sendTDataResult(requestId, false, null, "TData not available");
        return;
      }

      var start = new Tmapv3.LatLng(startLat, startLng);
      var end = new Tmapv3.LatLng(endLat, endLng);
      var opt = optionsJson ? (typeof optionsJson === 'string' ? JSON.parse(optionsJson) : optionsJson) : {};

      var params = {
        onComplete: function() {
          try {
            var res = this._responseData || this._response || this;
            _sendTDataResult(requestId, true, res, null);
          } catch(e) {
            _sendTDataResult(requestId, true, {}, null);
          }
        },
        onProgress: function() {},
        onError: function(err) {
          _sendTDataResult(requestId, false, null, err ? err.toString() : "Route search failed");
        }
      };

      try {
        td.getRoutePlanJson(start, end, opt, params);
      } catch (e) {
        _sendTDataResult(requestId, false, null, e.toString());
      }
    }

    function requestRoutePlanPedestrian(requestId, startLat, startLng, endLat, endLng, startName, endName, optionsJson) {
      var td = _ensureTData();
      if (!td) {
        _sendTDataResult(requestId, false, null, "TData not available");
        return;
      }

      var start = new Tmapv3.LatLng(startLat, startLng);
      var end = new Tmapv3.LatLng(endLat, endLng);
      var opt = optionsJson ? (typeof optionsJson === 'string' ? JSON.parse(optionsJson) : optionsJson) : {};

      var params = {
        onComplete: function() {
          try {
            var res = this._responseData || this._response || this;
            _sendTDataResult(requestId, true, res, null);
          } catch(e) {
            _sendTDataResult(requestId, true, {}, null);
          }
        },
        onProgress: function() {},
        onError: function(err) {
          _sendTDataResult(requestId, false, null, err ? err.toString() : "Pedestrian route search failed");
        }
      };

      try {
        td.getRoutePlanForPeopleJson(start, end, startName || "출발지", endName || "목적지", opt, params);
      } catch (e) {
        _sendTDataResult(requestId, false, null, e.toString());
      }
    }

    function requestPoiSearch(requestId, searchKeyword, count, page, radius, centerLat, centerLng) {
      var td = _ensureTData();
      if (!td) {
        _sendTDataResult(requestId, false, null, "TData not available");
        return;
      }

      var opt = {
        count: count || 20,
        page: page || 1
      };
      if (radius) opt.radius = radius;
      if (centerLat && centerLng) {
        opt.centerLat = centerLat;
        opt.centerLon = centerLng;
      }

      var params = {
        onComplete: function() {
          try {
            var res = this._responseData || this._response || this;
            _sendTDataResult(requestId, true, res, null);
          } catch(e) {
            _sendTDataResult(requestId, true, {}, null);
          }
        },
        onProgress: function() {},
        onError: function(err) {
          _sendTDataResult(requestId, false, null, err ? err.toString() : "POI search failed");
        }
      };

      try {
        td.getPOIDataFromSearchJson(searchKeyword, opt, params);
      } catch (e) {
        _sendTDataResult(requestId, false, null, e.toString());
      }
    }

    function requestPoiSearchAround(requestId, lat, lng, categories, count, page, radius) {
      var td = _ensureTData();
      if (!td) {
        _sendTDataResult(requestId, false, null, "TData not available");
        return;
      }

      var opt = {
        count: count || 20,
        page: page || 1,
        radius: radius || 1000
      };

      var params = {
        onComplete: function() {
          try {
            var res = this._responseData || this._response || this;
            _sendTDataResult(requestId, true, res, null);
          } catch(e) {
            _sendTDataResult(requestId, true, {}, null);
          }
        },
        onProgress: function() {},
        onError: function(err) {
          _sendTDataResult(requestId, false, null, err ? err.toString() : "POI around search failed");
        }
      };

      try {
        td.getPOIDataFromLonLatJson(lat, lng, categories || "", opt, params);
      } catch (e) {
        _sendTDataResult(requestId, false, null, e.toString());
      }
    }

    function requestGeoFromAddress(requestId, cityDo, guGun, dong, bunji, detailAddress) {
      var td = _ensureTData();
      if (!td) {
        _sendTDataResult(requestId, false, null, "TData not available");
        return;
      }

      var opt = {
        coordType: "WGS84GEO",
        detailAddress: detailAddress || ""
      };

      var params = {
        onComplete: function() {
          try {
            var res = this._responseData || this._response || this;
            _sendTDataResult(requestId, true, res, null);
          } catch(e) {
            _sendTDataResult(requestId, true, {}, null);
          }
        },
        onProgress: function() {},
        onError: function(err) {
          _sendTDataResult(requestId, false, null, err ? err.toString() : "Geocoding failed");
        }
      };

      try {
        td.getGeoFromAddressJson(cityDo || "", guGun || "", dong || "", bunji || "", opt, params);
      } catch (e) {
        _sendTDataResult(requestId, false, null, e.toString());
      }
    }

    function requestAddressFromGeo(requestId, lat, lng) {
      var td = _ensureTData();
      if (!td) {
        _sendTDataResult(requestId, false, null, "TData not available");
        return;
      }

      var opt = {
        coordType: "WGS84GEO"
      };

      var params = {
        onComplete: function() {
          try {
            var res = this._responseData || this._response || this;
            _sendTDataResult(requestId, true, res, null);
          } catch(e) {
            _sendTDataResult(requestId, true, {}, null);
          }
        },
        onProgress: function() {},
        onError: function(err) {
          _sendTDataResult(requestId, false, null, err ? err.toString() : "Reverse geocoding failed");
        }
      };

      try {
        td.getAddressFromGeoJson(lat, lng, opt, params);
      } catch (e) {
        _sendTDataResult(requestId, false, null, e.toString());
      }
    }

    function requestAutoComplete(requestId, searchKeyword) {
      var td = _ensureTData();
      if (!td) {
        _sendTDataResult(requestId, false, null, "TData not available");
        return;
      }

      var opt = {
        timeout: 3000
      };

      var params = {
        onComplete: function() {
          try {
            var res = this._responseData || this._response || this;
            _sendTDataResult(requestId, true, res, null);
          } catch(e) {
            _sendTDataResult(requestId, true, {}, null);
          }
        },
        onProgress: function() {},
        onError: function(err) {
          _sendTDataResult(requestId, false, null, err ? err.toString() : "Auto complete failed");
        }
      };

      try {
        td.getAutoCompleteSearchJson(searchKeyword, opt, params);
      } catch (e) {
        _sendTDataResult(requestId, false, null, e.toString());
      }
    }

    function toggleTraffic(trafficOnOff) {
      var td = _ensureTData();
      if (td && map && td.autoTraffic) {
        try {
          td.autoTraffic(map, { trafficOnOff: trafficOnOff });
        } catch(e) {
          console.error("autoTraffic error:", e);
        }
      }
    }
    ''';
  }
}
