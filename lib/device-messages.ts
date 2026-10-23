export interface DeviceMessage {
  line1: string;
  line2: string;
  ringBuzzer: boolean;
  durationSec: number;
  timestamp: string;
  compartmentNumber?: 1 | 2 | 3;
}

// In-memory store keyed by device_key, preserved across requests
declare global {
  // eslint-disable-next-line no-var
  var __curasyncDeviceMessages: Map<string, DeviceMessage> | undefined;
}

if (!globalThis.__curasyncDeviceMessages) {
  globalThis.__curasyncDeviceMessages = new Map<string, DeviceMessage>();
}

export const deviceMessages = globalThis.__curasyncDeviceMessages;
