import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatStage = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export const formatCurrency = (val: number) => `Ksh ${val.toLocaleString()}`;

export const formatDate = (date: string | Date) => new Date(date).toLocaleDateString();

export const formatTime = (date: string | Date) => new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const getToday = () => new Date().toISOString().split('T')[0];
