import { useState, useEffect } from "react";

const FONT_SIZE_KEY = "eq_font_size";
const DEFAULT_SIZE = 16;
const MIN_SIZE = 12;
const MAX_SIZE = 24;

export function useFontSize() {
  const [fontSize, setFontSize] = useState(() => {
    const stored = localStorage.getItem(FONT_SIZE_KEY);
    return stored ? parseInt(stored, 10) : DEFAULT_SIZE;
  });

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
    localStorage.setItem(FONT_SIZE_KEY, String(fontSize));
  }, [fontSize]);

  return { fontSize, setFontSize, MIN_SIZE, MAX_SIZE, DEFAULT_SIZE };
}
