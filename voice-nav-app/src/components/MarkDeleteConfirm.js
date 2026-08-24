import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

// وقتی کاربر روی یک نشانه‌ی موجود می‌زنه، می‌پرسیم حذف بشه یا نه
export default function MarkDeleteConfirm({ mark, onDelete, onClose }) {
  if (!mark) return null;
  return (
    <View style={styles.panel}>
      <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>
      <Text style={styles.title}>📌 {mark.name || "نشانه"}</Text>
      <Text style={styles.question}>می‌خواهید این نشانه حذف شود؟</Text>
      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, styles.deleteBtn]} onPress={onDelete}>
          <Text style={styles.btnText}>🗑 حذف کن</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.keepBtn]} onPress={onClose}>
          <Text style={styles.btnText}>نگه‌دار</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  closeBtn: { position: "absolute", top: 8, left: 8, padding: 4 },
  closeText: { fontSize: 16, color: "#888" },
  title: { fontWeight: "bold", fontSize: 14, textAlign: "right" },
  question: { fontSize: 12, color: "#555", textAlign: "right", marginTop: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 8, marginHorizontal: 4, alignItems: "center" },
  deleteBtn: { backgroundColor: "#fdeaea" },
  keepBtn: { backgroundColor: "#eee" },
  btnText: { fontSize: 13 },
});
