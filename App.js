import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Switch,
  ActivityIndicator,
} from "react-native";
import MapView, {
  Marker,
  Circle,
  Polyline,
  Polygon,
  Callout,
} from "react-native-maps";
import * as Location from "expo-location";

export default function App() {
  // --- STATE FOR LOCATION & ROUTE ---
  const [userLocation, setUserLocation] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);

  // --- STATE FOR COMPONENT TOGGLES ---
  const [showGeofence, setShowGeofence] = useState(true);
  const [showRoute, setShowRoute] = useState(true);
  const [showZone, setShowZone] = useState(true);

  // 1. WATCH LIVE HARDWARE LOCATION
  useEffect(() => {
    let locationSubscription;

    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Permission to access location was denied");
        return;
      }

      // watchPositionAsync continuously tracks the device as it moves
      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 5, // Or update every 5 meters
        },
        (location) => {
          setUserLocation(location.coords);
        },
      );
    })();

    // Cleanup subscription when component unmounts
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  // 2. FETCH REAL STREET ROUTE DATA
  useEffect(() => {
    // Only fetch the route once we have the user's starting location
    if (userLocation && routeCoords.length === 0) {
      // Let's create a dummy destination a few kilometers away from your start point
      const destLat = userLocation.latitude + 0.015;
      const destLon = userLocation.longitude + 0.015;

      // Fetch a real driving route using the open-source OSRM API
      const fetchRoute = async () => {
        try {
          const response = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${userLocation.longitude},${userLocation.latitude};${destLon},${destLat}?geometries=geojson`,
          );
          const data = await response.json();

          if (data.routes && data.routes.length > 0) {
            // OSRM returns coordinates as [longitude, latitude], so we map them to what react-native-maps expects
            const coordinates = data.routes[0].geometry.coordinates.map(
              (coord) => ({
                latitude: coord[1],
                longitude: coord[0],
              }),
            );
            setRouteCoords(coordinates);
          }
        } catch (error) {
          console.error("Failed to fetch route:", error);
        }
      };

      fetchRoute();
    }
  }, [userLocation]); // Re-runs if userLocation changes, but routeCoords.length check prevents spamming the API

  if (errorMsg) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{errorMsg}</Text>
      </View>
    );
  }

  if (!userLocation) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Locking onto GPS satellites...</Text>
      </View>
    );
  }

  const lat = userLocation.latitude;
  const lon = userLocation.longitude;

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: lat,
          longitude: lon,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
        showsUserLocation={true} // Built-in prop to show the pulsing blue dot
      >
        {/* CUSTOM LIVE MARKER */}
        <Marker coordinate={{ latitude: lat, longitude: lon }}>
          <Callout tooltip>
            <View style={styles.calloutBox}>
              <Text style={styles.boldText}>Live Location</Text>
              <Text style={styles.coordsText}>Lat: {lat.toFixed(4)}</Text>
              <Text style={styles.coordsText}>Lon: {lon.toFixed(4)}</Text>
            </View>
          </Callout>
        </Marker>

        {/* REAL GEOFENCE: Fixed at your starting coordinate */}
        {showGeofence && routeCoords.length > 0 && (
          <Circle
            center={{
              latitude: routeCoords[0].latitude,
              longitude: routeCoords[0].longitude,
            }}
            radius={400}
            fillColor="rgba(255, 0, 0, 0.15)"
            strokeColor="red"
            strokeWidth={2}
          />
        )}

        {/* REAL ROUTE: Fetched from OSRM API */}
        {showRoute && routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor="#2563EB" // A nicer, modern blue
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {/* STATIC ZONE: Kept as an example of a boundary area */}
        {showZone && (
          <Polygon
            coordinates={[
              { latitude: lat - 0.002, longitude: lon - 0.002 },
              { latitude: lat - 0.002, longitude: lon - 0.006 },
              { latitude: lat - 0.006, longitude: lon - 0.006 },
              { latitude: lat - 0.006, longitude: lon - 0.002 },
            ]}
            fillColor="rgba(255, 165, 0, 0.3)"
            strokeColor="orange"
            strokeWidth={2}
          />
        )}
      </MapView>

      {/* --- DASHBOARD PANEL --- */}
      <View style={styles.dashboard}>
        <Text style={styles.dashboardTitle}>Live Exploration Panel</Text>

        <View style={styles.toggleRow}>
          <Text style={styles.toggleText}>Start Geofence</Text>
          <Switch value={showGeofence} onValueChange={setShowGeofence} />
        </View>

        <View style={styles.toggleRow}>
          <Text style={styles.toggleText}>Live Route to Target</Text>
          <Switch value={showRoute} onValueChange={setShowRoute} />
        </View>

        <View style={styles.toggleRow}>
          <Text style={styles.toggleText}>Restricted Zone</Text>
          <Switch value={showZone} onValueChange={setShowZone} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  loadingText: { marginTop: 10, fontSize: 16, color: "#333" },
  errorText: { fontSize: 16, color: "red", fontWeight: "bold" },
  calloutBox: {
    backgroundColor: "white",
    padding: 10,
    borderRadius: 8,
    borderColor: "#ccc",
    borderWidth: 1,
  },
  boldText: { fontWeight: "bold", marginBottom: 2 },
  coordsText: { fontSize: 12, color: "#666" },
  dashboard: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: "white",
    padding: 18,
    borderRadius: 15,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  dashboardTitle: {
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 12,
    textAlign: "center",
    color: "#222",
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 6,
  },
  toggleText: { fontSize: 15, color: "#444" },
});
