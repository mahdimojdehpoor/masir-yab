import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Callout } from "react-native-maps";

// روی هر مارکر گزارش نمایش داده می‌شه: تعداد تأیید/تکذیب + دکمه‌ها
export default function ReportBadge({ label, report, onConfirm, onDeny }) {
  return (
    <Callout tooltip={false}>
      <View style={styles.box}>
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
    </Callout>
  );
}

const styles = StyleSheet.create({
  box: { padding: 8, minWidth: 180 },
  title: { fontWeight: "bold", fontSize: 13, textAlign: "right" },
  sub: { fontSize: 11, color: "#555", textAlign: "right", marginTop: 2 },
  question: { fontSize: 11, color: "#888", textAlign: "right", marginTop: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  btn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  confirmBtn: { backgroundColor: "#e6f7e6" },
  denyBtn: { backgroundColor: "#fdeaea" },
  btnText: { fontSize: 12 },
});
