# CuraSync — Vercel Deployment & ESP32 HTTPS Guide

This guide covers deploying CuraSync to **Vercel** and configuring the physical **ESP32 Smart Dispenser** to communicate with the live cloud URL over HTTPS.

---

## 1. Deploying to Vercel

CuraSync is built on Next.js 16 (App Router) and is ready for direct deployment on Vercel with zero custom build configuration.

### Steps:
1. Log in to [Vercel](https://vercel.com) using your GitHub account.
2. Click **"Add New..."** → **"Project"**.
3. Select the **`CuraSync`** repository from your GitHub list and click **"Import"**.
4. In the **Configure Project** screen:
   - **Framework Preset**: `Next.js` (detected automatically).
   - **Root Directory**: `./` (leave default).
   - **Build Command**: `next build` (leave default).
5. Expand the **"Environment Variables"** section and add the following keys from your `.env.local`:

| Variable Name | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL (`https://xyz.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Backend service role key for API routes |

6. Click **"Deploy"**.
7. Once deployed, Vercel will provide your production URL (e.g., `https://curasync.vercel.app`).

---

## 2. Supabase Configuration for Production

After deploying on Vercel:
1. Go to your **Supabase Dashboard** → **Authentication** → **URL Configuration**.
2. Set **Site URL** to your Vercel URL:
   ```
   https://curasync.vercel.app
   ```
3. Add your Vercel URL to **Redirect URLs**:
   ```
   https://curasync.vercel.app/**
   ```

---

## 3. Configuring ESP32 Firmware for Live HTTPS

Because Vercel serves all traffic over **HTTPS**, your ESP32 needs to connect to the secure endpoint.

### A. Update Server URL in Firmware
In `firmware/esp32_curasync/esp32_curasync.ino`:
```cpp
// Replace with your live Vercel domain (HTTPS)
const char* SERVER_URL = "https://curasync.vercel.app";
```

### B. HTTPS Client Configuration (`WiFiClientSecure`)
On ESP32, standard `HTTPClient.begin(url)` expects plaintext HTTP by default. To connect securely to Vercel's SSL without embedding certificate authority files, use `WiFiClientSecure` with `setInsecure()`:

```cpp
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

// Example helper function for HTTPS requests on ESP32:
void sendSecureHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure(); // Skips certificate validation for lightweight IoT requests

  HTTPClient http;
  String url = String(SERVER_URL) + "/api/device/heartbeat";
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");

  String jsonBody = "{\"device_key\":\"" + String(DEVICE_KEY) + "\",\"status\":\"OK\"}";
  int httpCode = http.POST(jsonBody);

  if (httpCode == HTTP_CODE_OK) {
    Serial.println("[CuraSync] Secure ping acknowledged by Vercel!");
  } else {
    Serial.printf("[CuraSync] Ping failed, HTTP code: %d\n", httpCode);
  }
  http.end();
}
```

Apply `WiFiClientSecure client; client.setInsecure(); http.begin(client, url);` to:
1. `fetchScheduleFromCuraSync()`
2. `sendKeepalivePing()`
3. `reportCompartmentEvent(compartmentNumber)`

---

## 4. Testing & Verification

1. **Web App**: Open `https://curasync.vercel.app` on desktop or mobile to test login, the **Next Dose Hero**, and the **Physical Dispenser Console**.
2. **Device Connection**:
   - Power up the ESP32.
   - Open Serial Monitor (`115200` baud).
   - Verify that it connects to Wi-Fi and logs:
     ```
     [CuraSync] Connection ping acknowledged.
     [CuraSync] C1 updated: 08:00 (Amlodipine)
     ```
   - Check the **Dashboard** — the ESP32 indicator should turn green (**Online**).
