import React from "react";
import { StatusBar } from "expo-status-bar";
import MapScreen from "./src/screens/MapScreen";
import ErrorBoundary from "./src/components/ErrorBoundary";

export default function App() {
  return (
    <ErrorBoundary>
      <StatusBar style="auto" />
      <MapScreen />
    </ErrorBoundary>
  );
}
