import React from "react";
import { Text, Linking, TouchableOpacity, StyleSheet } from "react-native";

// این کامپوننت رو در همه‌ی پروژه‌هات به همین شکل کپی کن
export default function Signature() {
  return (
    <TouchableOpacity
      onPress={() => Linking.openURL("https://github.com/YOUR_USERNAME")}
      style={styles.container}
    >
      <Text style={styles.text}>Made by YOUR_NAME</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", paddingVertical: 4 },
  text: { fontSize: 11, color: "#888" },
});
