"use client";

import { Howl } from "howler";

const SOUND_ENABLED_KEY = "titan.sound_enabled";
const DEFAULT_ENABLED = true;

const PLACEHOLDER_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

let clickSound: Howl | null = null;
let completeSound: Howl | null = null;
let bootSound: Howl | null = null;
let bootPlayed = false;

function canUseSound(): boolean {
  return typeof window !== "undefined";
}

function getSoundEnabled(): boolean {
  if (!canUseSound()) return false;
  const raw = window.localStorage.getItem(SOUND_ENABLED_KEY);
  if (raw === null) {
    window.localStorage.setItem(SOUND_ENABLED_KEY, String(DEFAULT_ENABLED));
    return DEFAULT_ENABLED;
  }
  return raw === "true";
}

function ensureSounds() {
  if (!canUseSound()) return;
  if (!clickSound) {
    clickSound = new Howl({ src: [PLACEHOLDER_WAV], volume: 0.2 });
  }
  if (!completeSound) {
    completeSound = new Howl({ src: [PLACEHOLDER_WAV], volume: 0.25, rate: 1.1 });
  }
  if (!bootSound) {
    bootSound = new Howl({ src: [PLACEHOLDER_WAV], volume: 0.18, rate: 0.95 });
  }
}

function safePlay(sound: Howl | null) {
  if (!canUseSound() || !getSoundEnabled()) return;
  if (!sound) return;
  try {
    sound.play();
  } catch {}
}

export function setSoundEnabled(value: boolean) {
  if (!canUseSound()) return;
  window.localStorage.setItem(SOUND_ENABLED_KEY, String(value));
}

export function toggleSoundEnabled(): boolean {
  const next = !getSoundEnabled();
  setSoundEnabled(next);
  return next;
}

export function playClick() {
  ensureSounds();
  safePlay(clickSound);
}

export function playComplete() {
  ensureSounds();
  safePlay(completeSound);
}

export function playBoot() {
  if (bootPlayed) return;
  bootPlayed = true;
  ensureSounds();
  safePlay(bootSound);
}
