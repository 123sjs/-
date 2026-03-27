import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAddress(address: string) {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function generateMockAddress(privateKey: string) {
  // A completely fake determinism for UI visualization purposes
  const hash = Array.from(privateKey).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return `0x${hash.toString(16).padEnd(4, '0')}${Math.random().toString(16).slice(2, 10)}${Math.random().toString(16).slice(2, 10)}`.toLowerCase();
}
