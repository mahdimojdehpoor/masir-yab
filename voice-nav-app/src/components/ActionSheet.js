import React from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet } from "react-native";

// منوی انتخاب کاربرد یک نقطه: مبدأ / مقصد / نشانه‌گذاری / گزارش تصادف / گزارش پلیس
export default function ActionSheet({ visible, onClose, onSelect }) {
  const options = [
    { key: "origin", label: "📍 انتخاب به‌عنوان مبدأ" },
    { key: "destination", label: "🎯 انتخاب به‌عنوان مقصد" },
    { key: "mark", label: "📌 نشانه‌گذاری این نقطه" },
    { key: "crash", label: "🚗 گزارش تصادف" },
    { key: "police", label: "👮 گزارش ایست پلیس" },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={styles.item}
              onPress={() => {
                onSelect(opt.key);
                onClose();
              }}
            >
              <Text style={styles.itemText}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>انصراف</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 12 },
  item: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#eee" },
  itemText: { fontSize: 16, textAlign: "right" },
  cancel: { paddingVertical: 14, alignItems: "center" },
  cancelText: { fontSize: 16, color: "red" },
});
