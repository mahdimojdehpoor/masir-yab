import * as Speech from "expo-speech";

export function speak(text) {
  Speech.speak(text, { language: "fa-IR" });
}
