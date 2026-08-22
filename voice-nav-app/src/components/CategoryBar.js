import React from "react";
import { View, ScrollView, TouchableOpacity, Text, StyleSheet } from "react-native";
import { CATEGORIES } from "../services/poiService";

// نوار دسته‌بندی امکانات: هتل، بیمارستان، پلیس، پمپ‌بنزین، رستوران، داروخانه
export default function CategoryBar({ activeCategory, onSelect }) {
  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {Object.entries(CATEGORIES).map(([key, cat]) => (
          <TouchableOpacity
            key={key}
            onPress={() => onSelect(activeCategory === key ? null : key)}
            style={[styles.chip, activeCategory === key && styles.chipActive]}
          >
            <Text style={styles.chipText}>{cat.icon} {cat.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: "#fff", paddingVertical: 6 },
  chip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginHorizontal: 4,
  },
  chipActive: { backgroundColor: "#1e90ff", borderColor: "#1e90ff" },
  chipText: { fontSize: 12 },
});
