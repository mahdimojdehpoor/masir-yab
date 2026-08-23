import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";

// به‌جای کرش خاموش، پیغام خطا رو نشون می‌ده تا بشه اسکرین‌شات گرفت و مشکل رو فهمید
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
          <Text style={styles.title}>یک خطا رخ داد</Text>
          <Text style={styles.message}>{String(this.state.error?.message || this.state.error)}</Text>
          <Text style={styles.stack}>{String(this.state.errorInfo?.componentStack || "")}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => this.setState({ hasError: false, error: null, errorInfo: null })}
          >
            <Text style={styles.buttonText}>تلاش دوباره</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", paddingTop: 40 },
  title: { fontSize: 18, fontWeight: "bold", color: "#e53935", marginBottom: 12, textAlign: "right" },
  message: { fontSize: 14, color: "#333", marginBottom: 16, textAlign: "right" },
  stack: { fontSize: 11, color: "#888", textAlign: "left" },
  button: { marginTop: 20, backgroundColor: "#1e90ff", padding: 12, borderRadius: 8, alignItems: "center" },
  buttonText: { color: "#fff", fontSize: 14 },
});
