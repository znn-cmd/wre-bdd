import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Safe plain strings for RSC → client props (null bytes / huge cells from Sheets). */
export function safeStringForRsc(value: unknown, maxLen = 8000): string {
  let s = value == null ? "" : String(value);
  s = s.replace(/\0/g, "");
  if (s.length > maxLen) return s.slice(0, maxLen);
  return s;
}
