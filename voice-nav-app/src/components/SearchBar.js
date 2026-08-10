import React, { useState } from "react";
import { View, TextInput, Button, StyleSheet } from "react-native";

// سرچ ساده با Nominatim (OpenStreetMap) — رایگان و بدون کلید
export default function SearchBar({ label, onSelect }) {
  const [query, setQuery] = useState("");

  const search = async () => {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query
    )}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "VoiceNavApp" },
    });
    const data = await res.json();
    if (data.length > 0) {
      onSelect({
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
      });
    }
  };

  return (
    <View style={styles.row}>
      <TextInput
        style={styles.input}
        placeholder={label}
        value={query}
        onChangeText={setQuery}
      />
      <Button title="جستجو" onPress={search} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", padding: 6 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 8,
    marginRight: 6,
  },
});
