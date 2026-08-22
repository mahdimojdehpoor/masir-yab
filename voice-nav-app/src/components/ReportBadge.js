import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

// پنل پایین صفحه برای نمایش گزارش انتخاب‌شده + دکمه‌های تأیید/تکذیب
export default function ReportBadge({ label, report, onConfirm, onDeny, onClose }) {
  if (!report) return null;

  return (
    <View style={styles.panel}>
      <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{label} — این‌جا گزارش داریم</Text>
      <Text style={styles.sub}>
        تأیید: {report.confirmCount || 0} | تکذیب: {report.denyCount || 0}
      </Text>
      <Text style={styles.question}>اگر صحت ندارد اعلام کنید</Text>
      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, styles.confirmBtn]} onPress={onConfirm}>
          <Text style={styles.btnText}>✅ درسته</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.denyBtn]} onPress={onDeny}>
          <Text style={styles.btnText}>❌ نیست</Text>
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
  sub: { fontSize: 12, color: "#555", textAlign: "right", marginTop: 4 },
  question: { fontSize: 12, color: "#888", textAlign: "right", marginTop: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 8, marginHorizontal: 4, alignItems: "center" },
  confirmBtn: { backgroundColor: "#e6f7e6" },
  denyBtn: { backgroundColor: "#fdeaea" },
  btnText: { fontSize: 13 },
});
