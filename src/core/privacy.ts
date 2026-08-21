import type { DesktopWindow, UserActivity } from "./types.js";

export interface PrivacyFrameInput {
  userActivity: UserActivity;
  foregroundApp: string | null;
  windows: DesktopWindow[];
}

export interface PrivacyFrameOutput {
  userActivity: UserActivity;
  foregroundApp: string | null;
  windows: DesktopWindow[];
}

/**
 * Privacy levels:
 *   0 Blind    — geometry only. No app identity, no activity inference, window titles scrubbed.
 *   1 Ambient  — default. App names + broad activity categories.
 *   2 Context  — reserved for local classification (behaves like Ambient today).
 *   3 Vision   — reserved for explicit opt-in perception (behaves like Ambient today).
 */
export function applyPrivacy(level: 0 | 1 | 2 | 3, input: PrivacyFrameInput): PrivacyFrameOutput {
  if (level === 0) {
    return {
      userActivity: "active",
      foregroundApp: null,
      windows: input.windows.map(w => ({ ...w, title: "", app: "" }))
    };
  }
  return { userActivity: input.userActivity, foregroundApp: input.foregroundApp, windows: input.windows };
}
