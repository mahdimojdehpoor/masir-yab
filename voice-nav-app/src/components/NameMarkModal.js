import React, { useState, useEffect } from "react";
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";

// وقتی کاربر یک نقطه رو نشانه‌گذاری می‌کنه، اول اسمش رو می‌پرسیم
export default function NameMarkModal({ visible, onCancel, onSave }) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (visible) setName("");
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <Text style={styles.title}>اسم این نشانه چیست؟</Text>
          <TextInput
            style={styles.input}
            placeholder="مثلاً: خانه، محل کار..."
            value={name}
            onChangeText={setName}
            autoFocus
          />
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={onCancel}>
              <Text style={styles.btnText}>انصراف</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.saveBtn]}
              onPress={() => onSave(name.trim() || "بدون‌نام")}
            >
              <Text style={[styles.btnText, { color: "#fff" }]}>ذخیره</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  box: { backgroundColor: "#fff", borderRadius: 12, padding: 16, width: "80%" },
  title: { fontSize: 15, fontWeight: "bold", textAlign: "right", marginBottom: 10 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, textAlign: "right", marginBottom: 14 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  btn: { flex: 1, padding: 10, borderRadius: 8, alignItems: "center", marginHorizontal: 4 },
  cancelBtn: { backgroundColor: "#eee" },
  saveBtn: { backgroundColor: "#1e90ff" },
  btnText: { fontSize: 14 },
});
