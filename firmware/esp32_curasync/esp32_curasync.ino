/*
 * CuraSync ESP32 Firmware (v2.4)
 * -------------------------------------------------------------
 * Hardware:
 *   - ESP32 Development Board
 *   - DS3231 RTC Module (I2C: SDA=21, SCL=22)
 *   - 1602 LCD I2C Display (Address: 0x27)
 *   - Digital reed modules (Bays 1/2 -> GPIO 32/33); mini reed (Bay 3 -> GPIO 25)
 *   - 3x Indicator LEDs (Compartments 1, 2, 3 -> GPIO 18, 19, 23)
 *   - Buzzer (GPIO 26) - Supports both Active and Passive Buzzers!
 *
 * v2.4:
 *   - Sensor-specific inputs and closed-magnet alarm behavior
 *   - Local snooze/reminder loop continues while Wi-Fi retries asynchronously
 *   - Live reed levels reported to the device page
 *   - Reduced LCD clears and no boot buzzer chirp
 */

#include <Wire.h>
#include <RTClib.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <time.h>

// =============================================================
// USER CONFIGURATION
// =============================================================
const char* WIFI_SSID     = "Pande-2.4G EXT";
const char* WIFI_PASSWORD = "Ishaan@11";

// Vercel Production Server (Recommended - works anywhere with zero router config):
const char* CLOUD_SERVER_URL = "https://curasync-iot.vercel.app";

// Local Development Server (when running 'next dev' on your laptop):
const char* LOCAL_SERVER_URL = "http://192.168.1.106:3000";

// Set to 'false' for Vercel Cloud (Recommended), or 'true' to prefer Local Dev:
const bool PREFER_LOCAL_DEV = false;

// Your verified Device Key from CuraSync (/device page)
const char* DEVICE_KEY    = "cs_dev_aralnk0g_mvhwiq49";

// Buzzer Configuration:
// - Set 'false' for Passive Buzzer (uses clean 2400Hz tone) [DEFAULT]
// - Set 'true' for Active Buzzer (uses pure DC HIGH for full 85dB volume)
const bool IS_ACTIVE_BUZZER = false;

// Clean, solid single tone frequency (no warble/siren)
const int BUZZER_FREQUENCY = 2400;

// India Standard Time (IST): UTC+5:30 -> 5.5 * 3600 = 19800 seconds
const long  GMT_OFFSET_SEC      = 19800;
const int   DAYLIGHT_OFFSET_SEC = 0;
const char* NTP_SERVER_1        = "pool.ntp.org";
const char* NTP_SERVER_2        = "time.google.com";
// =============================================================

RTC_DS3231 rtc;
LiquidCrystal_I2C lcd(0x27, 16, 2);

// Reusable Global Network Clients (Prevents stack overflow & watchdog resets)
WiFiClient plainClient;
WiFiClientSecure secureClient;

// Hardware pin assignments
const int reedPins[3] = {32, 33, 25};
const int ledPins[3]  = {18, 19, 23};
const int buzzerPin   = 26;

// Local alarm schedules for Compartments 1, 2, 3
int alarmHour[3]    = {8, 13, 20};
int alarmMinute[3]  = {0, 0, 0};
bool alarmActive[3] = {true, true, true};
char alarmMedName[3][17] = {"Citafil", "Medication 2", "Medication 3"};

// Bays 1/2 use digital reed modules; Bay 3 is the bare mini reed switch.
// With the module DO pins wired at 3.3V and the mini switch wired to GND,
// magnet detected means LOW (closed) and magnet removed means HIGH (open).
// Change an entry if a module's DO output is inverted.
const uint8_t reedPinModes[3] = {INPUT, INPUT, INPUT_PULLUP};
const int REED_CLOSED_STATE[3] = {LOW, LOW, LOW};
const unsigned long REED_DEBOUNCE_MS = 40UL;

const unsigned long BUZZER_DURATION   = 7000UL;   // Beep for 7 seconds
const unsigned long REMINDER_INTERVAL = 60000UL;  // Re-buzz every 60s if not taken

bool pending[3]          = {false, false, false};
bool firstBuzzPending[3] = {false, false, false};
bool previousOpen[3]     = {false, false, false};
int reedRawState[3]      = {HIGH, HIGH, HIGH};
int reedStableState[3]   = {HIGH, HIGH, HIGH};
unsigned long reedRawChangedAt[3] = {0, 0, 0};
bool compartmentClosed[3] = {true, true, true};
bool unsentOpenEvent[3] = {false, false, false};
unsigned long lastOpenEventAttempt[3] = {0, 0, 0};
bool ledBlinking[3]      = {false, false, false};

bool buzzerActive = false;
unsigned long buzzerStart = 0;
unsigned long buzzerDurationTarget = BUZZER_DURATION;
unsigned long lastReminder[3] = {0, 0, 0};

// Multi-schedule storage supporting all daily doses across all 3 compartments
struct ScheduleEntry {
  int compartment; // 1, 2, 3
  int hour;
  int minute;
  char name[17];
  bool active;
};

const int MAX_SCHEDULES = 16;
ScheduleEntry activeSchedules[MAX_SCHEDULES];
int totalActiveSchedules = 0;

// Minute-level debounce tracking: prevents false re-triggers in the same minute
// while ensuring subsequent doses on the same day trigger properly
int lastAlarmDay[3]    = {-1, -1, -1};
int lastAlarmMonth[3]  = {-1, -1, -1};
int lastAlarmYear[3]   = {-1, -1, -1};
int lastAlarmHour[3]   = {-1, -1, -1};
int lastAlarmMinute[3] = {-1, -1, -1};

int buzzerCompartment = -1;
int nextCompartment   = 0;

unsigned long lastLcdUpdate         = 0;
unsigned long lastKeepalivePing     = 0;
unsigned long lastScheduleSync      = 0;
unsigned long lastNtpSync           = 0;  // Tracks last successful NTP→RTC re-sync

// Rapid polling: Ping server every 5s, re-sync medication schedules every 30s
// Re-sync NTP every 6 hours to keep the DS3231 RTC accurate long-term
const unsigned long KEEPALIVE_INTERVAL     = 15000UL;
const unsigned long SCHEDULE_SYNC_INTERVAL = 30000UL;
const unsigned long NTP_SYNC_INTERVAL      = 6UL * 60UL * 60UL * 1000UL; // 6 hours
const unsigned long WIFI_RETRY_INTERVAL    = 15000UL;
const unsigned long EVENT_RETRY_INTERVAL   = 15000UL;
// Cloud function cold starts and sequential database work can exceed 3 seconds
// even when the ESP32 has a good Wi-Fi signal.
const uint16_t HTTP_RESPONSE_TIMEOUT_MS = 8000;

bool serverConnected = false;
int lastHttpCode = 0;
bool wifiStarted = false;
bool wifiWasConnected = false;
unsigned long lastWifiAttempt = 0;
bool ntpSyncPending = false;
bool ntpConfigured = false;
unsigned long lastNtpCheck = 0;

// Custom LCD message display state (dispatched from frontend)
bool customMessageActive = false;
unsigned long customMessageStart = 0;
unsigned long customMessageDuration = 15000UL;
char customLine1[17] = "";
char customLine2[17] = "";

// -------------------------------------------------------------
// BUZZER DRIVER FUNCTIONS (Clean, High-Power Single Tone)
// -------------------------------------------------------------
void soundBuzzerOn() {
  if (IS_ACTIVE_BUZZER) {
    digitalWrite(buzzerPin, HIGH);
  } else {
    tone(buzzerPin, BUZZER_FREQUENCY);
  }
}

void soundBuzzerOff() {
  if (!IS_ACTIVE_BUZZER) {
    noTone(buzzerPin);
  }
  digitalWrite(buzzerPin, LOW);
}

// Crisp, professional medical dispenser beep pattern (300ms ON, 150ms OFF)
// Single pure tone - no annoying siren or frequency warbles
void updateBuzzerSound() {
  if (!buzzerActive) return;

  // Start each reminder with an ON pulse immediately. Using absolute millis()
  // could put the first pulse in its silent phase and make a new alarm seem dead.
  unsigned long cycle = (millis() - buzzerStart) % 450;
  if (cycle < 300) {
    soundBuzzerOn();
  } else {
    soundBuzzerOff();
  }
}

void startBuzzer(int compartment) {
  buzzerActive = true;
  buzzerStart = millis();
  buzzerDurationTarget = BUZZER_DURATION;
  if (compartment >= 0 && compartment < 3) {
    lastReminder[compartment] = millis();
    buzzerCompartment = compartment;
    firstBuzzPending[compartment] = false;
    nextCompartment = (compartment + 1) % 3;
    Serial.printf("[CuraSync] Buzzer ON for Bay %d\n", compartment + 1);
  }
  updateBuzzerSound();
}

void stopBuzzer() {
  if (buzzerActive) Serial.println("[CuraSync] Buzzer OFF");
  soundBuzzerOff();
  buzzerActive = false;
  buzzerCompartment = -1;
}

// -------------------------------------------------------------
// NTP TIME & RTC SYNCHRONIZATION
// -------------------------------------------------------------
void syncTimeWithNTP() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[CuraSync] Wi-Fi offline. Skipping NTP time fetch.");
    return;
  }

  if (!ntpConfigured) {
    Serial.println("[CuraSync] Starting NTP sync (IST UTC+5:30)...");
    configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER_1, NTP_SERVER_2);
    ntpConfigured = true;
  }

  struct tm timeinfo;
  // Poll without blocking reed monitoring and the local reminder/snooze loop.
  if (getLocalTime(&timeinfo, 20)) {
    Serial.println("[CuraSync] Exact NTP time acquired!");
    rtc.adjust(DateTime(timeinfo.tm_year + 1900,
                        timeinfo.tm_mon + 1,
                        timeinfo.tm_mday,
                        timeinfo.tm_hour,
                        timeinfo.tm_min,
                        timeinfo.tm_sec));

    Serial.printf("[CuraSync] DS3231 RTC Synchronized: %04d-%02d-%02d %02d:%02d:%02d\n",
                  timeinfo.tm_year + 1900, timeinfo.tm_mon + 1, timeinfo.tm_mday,
                  timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);
    lastNtpSync = millis();
    ntpSyncPending = false;
  } else {
    ntpSyncPending = true;
    Serial.println("[CuraSync] NTP not ready; keeping DS3231 time and retrying later.");
  }
}

// -------------------------------------------------------------
// NETWORK FUNCTIONS WITH OPTIONAL LOCAL-DEV FALLBACK
// -------------------------------------------------------------
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    if (!wifiWasConnected) {
      wifiWasConnected = true;
      Serial.print("[CuraSync] Wi-Fi connected. Local IP: ");
      Serial.println(WiFi.localIP());
      ntpConfigured = false;
      syncTimeWithNTP();
      lastKeepalivePing = millis();
      lastScheduleSync = millis();
    }
    return;
  }

  wifiWasConnected = false;
  if (wifiStarted && millis() - lastWifiAttempt < WIFI_RETRY_INTERVAL) return;

  lastWifiAttempt = millis();
  Serial.printf("[CuraSync] Starting Wi-Fi connection to %s\n", WIFI_SSID);
  if (!wifiStarted) {
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    wifiStarted = true;
  } else {
    WiFi.reconnect();
  }
}

// Low-level HTTP POST using reusable global client
int doSinglePost(const String& fullUrl, const String& jsonBody, String& outResponse) {
  HTTPClient http;

  bool beginOk = false;
  if (fullUrl.startsWith("https://")) {
    secureClient.setInsecure();
    secureClient.setTimeout(HTTP_RESPONSE_TIMEOUT_MS);
    beginOk = http.begin(secureClient, fullUrl);
  } else {
    plainClient.setTimeout(HTTP_RESPONSE_TIMEOUT_MS);
    beginOk = http.begin(plainClient, fullUrl);
  }

  if (!beginOk) {
    Serial.printf("[CuraSync] HTTPClient begin failed for: %s\n", fullUrl.c_str());
    return -10;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_KEY);
  http.setTimeout(HTTP_RESPONSE_TIMEOUT_MS);

  int code = http.POST(jsonBody);
  if (code > 0) {
    outResponse = http.getString();
  }
  http.end();
  return code;
}

// Low-level HTTP GET using reusable global client
int doSingleGet(const String& fullUrl, String& outResponse) {
  HTTPClient http;

  bool beginOk = false;
  if (fullUrl.startsWith("https://")) {
    secureClient.setInsecure();
    secureClient.setTimeout(HTTP_RESPONSE_TIMEOUT_MS);
    beginOk = http.begin(secureClient, fullUrl);
  } else {
    plainClient.setTimeout(HTTP_RESPONSE_TIMEOUT_MS);
    beginOk = http.begin(plainClient, fullUrl);
  }

  if (!beginOk) return -10;

  http.addHeader("x-device-key", DEVICE_KEY);
  http.setTimeout(HTTP_RESPONSE_TIMEOUT_MS);

  int code = http.GET();
  if (code > 0) {
    outResponse = http.getString();
  }
  http.end();
  return code;
}

// Dispatch POST with optional local-development fallback
int dispatchPost(const String& path, const String& jsonBody, String& outResponse) {
  const char* primary = PREFER_LOCAL_DEV ? LOCAL_SERVER_URL : CLOUD_SERVER_URL;
  const char* backup  = PREFER_LOCAL_DEV ? CLOUD_SERVER_URL : LOCAL_SERVER_URL;

  int code = doSinglePost(String(primary) + path, jsonBody, outResponse);

  // In local development mode, fall back to cloud. In production, avoid
  // wasting another timeout on a laptop's private LAN address.
  if (code <= 0 && PREFER_LOCAL_DEV) {
    Serial.printf("[CuraSync] Primary server failed (code %d). Trying fallback...\n", code);
    code = doSinglePost(String(backup) + path, jsonBody, outResponse);
  }
  return code;
}

// Dispatch GET with optional local-development fallback
int dispatchGet(const String& pathAndQuery, String& outResponse) {
  const char* primary = PREFER_LOCAL_DEV ? LOCAL_SERVER_URL : CLOUD_SERVER_URL;
  const char* backup  = PREFER_LOCAL_DEV ? CLOUD_SERVER_URL : LOCAL_SERVER_URL;

  int code = doSingleGet(String(primary) + pathAndQuery, outResponse);

  if (code <= 0 && PREFER_LOCAL_DEV) {
    Serial.printf("[CuraSync] Primary GET failed (code %d). Trying fallback...\n", code);
    code = doSingleGet(String(backup) + pathAndQuery, outResponse);
  }
  return code;
}

// 1. Fetch Alarm Schedules from CuraSync
void fetchScheduleFromCuraSync() {
  if (WiFi.status() != WL_CONNECTED) return;

  String payload = "";
  String query = "/api/device/schedule?key=" + String(DEVICE_KEY);
  int httpCode = dispatchGet(query, payload);

  if (httpCode == HTTP_CODE_OK) {
    serverConnected = true;
    lastHttpCode = httpCode;
    Serial.println("[CuraSync] Schedule synced from server:");
    Serial.println(payload);

    DynamicJsonDocument doc(3072);
    DeserializationError error = deserializeJson(doc, payload);

    if (!error && doc["success"] == true) {
      totalActiveSchedules = 0;

      // 1. Primary: Parse flat all_alarms array if provided
      if (doc.containsKey("all_alarms")) {
        JsonArray allA = doc["all_alarms"];
        for (JsonObject a : allA) {
          if (totalActiveSchedules < MAX_SCHEDULES) {
            int comp = a["compartment"];
            if (comp >= 1 && comp <= 3) {
              activeSchedules[totalActiveSchedules].compartment = comp;
              activeSchedules[totalActiveSchedules].hour        = a["hour"];
              activeSchedules[totalActiveSchedules].minute      = a["minute"];
              activeSchedules[totalActiveSchedules].active      = a["active"] | true;
              const char* mName = a["name"] | "Medication";
              strncpy(activeSchedules[totalActiveSchedules].name, mName, 16);
              activeSchedules[totalActiveSchedules].name[16] = '\0';
              totalActiveSchedules++;
            }
          }
        }
      }

      // 2. Fallback: Parse detailed compartments array if all_alarms was not present
      if (totalActiveSchedules == 0 && doc.containsKey("compartments")) {
        JsonArray comps = doc["compartments"];
        for (JsonObject c : comps) {
          int compNum = c["compartment"];
          JsonArray sList = c["schedules"];
          for (JsonObject s : sList) {
            if (totalActiveSchedules < MAX_SCHEDULES) {
              const char* tStr = s["scheduled_time"] | "";
              if (strlen(tStr) >= 5) {
                activeSchedules[totalActiveSchedules].compartment = compNum;
                activeSchedules[totalActiveSchedules].hour = atoi(tStr);
                activeSchedules[totalActiveSchedules].minute = atoi(tStr + 3);
                activeSchedules[totalActiveSchedules].active = true;
                const char* mName = s["medicine_name"] | "Medication";
                strncpy(activeSchedules[totalActiveSchedules].name, mName, 16);
                activeSchedules[totalActiveSchedules].name[16] = '\0';
                totalActiveSchedules++;
              }
            }
          }
        }
      }

      // 3. Fallback: Parse alarms array (next upcoming alarm per compartment)
      if (doc.containsKey("alarms")) {
        JsonArray alarms = doc["alarms"];
        for (JsonObject a : alarms) {
          int compNum = a["compartment"]; // 1, 2, 3
          int idx = compNum - 1;
          if (idx >= 0 && idx < 3) {
            bool active = a["active"] | false;
            alarmActive[idx] = active;
            if (active) {
              alarmHour[idx]   = a["hour"];
              alarmMinute[idx] = a["minute"];
              const char* mName = a["name"] | "Medication";
              strncpy(alarmMedName[idx], mName, 16);
              alarmMedName[idx][16] = '\0';
              if (totalActiveSchedules == 0 && totalActiveSchedules < MAX_SCHEDULES) {
                activeSchedules[totalActiveSchedules].compartment = compNum;
                activeSchedules[totalActiveSchedules].hour = alarmHour[idx];
                activeSchedules[totalActiveSchedules].minute = alarmMinute[idx];
                activeSchedules[totalActiveSchedules].active = true;
                strncpy(activeSchedules[totalActiveSchedules].name, alarmMedName[idx], 16);
                activeSchedules[totalActiveSchedules].name[16] = '\0';
                totalActiveSchedules++;
              }
            } else {
              strncpy(alarmMedName[idx], "Empty Bay", 16);
              alarmMedName[idx][16] = '\0';
            }
          }
        }
      }

      Serial.printf("[CuraSync] Synchronized %d total medication schedules:\n", totalActiveSchedules);
      for (int s = 0; s < totalActiveSchedules; s++) {
        Serial.printf("  Bay %d: %02d:%02d (%s)\n",
                      activeSchedules[s].compartment,
                      activeSchedules[s].hour,
                      activeSchedules[s].minute,
                      activeSchedules[s].name);
      }
    }
  } else {
    // Only paint lastHttpCode with the failure if the server isn't already
    // confirmed online via the heartbeat. This prevents a background schedule-sync
    // failure (e.g. Vercel cold-start) from overwriting a healthy lastHttpCode.
    if (!serverConnected) {
      lastHttpCode = httpCode;
    }
    Serial.printf("[CuraSync] Schedule fetch failed, HTTP Code: %d\n", httpCode);
  }
}

// 2. Send Keepalive Ping to CuraSync & Check for LCD Remote Messages
void sendKeepalivePing() {
  if (WiFi.status() != WL_CONNECTED) return;

  String response = "";
  String jsonBody;
  jsonBody.reserve(220);
  jsonBody = "{\"device_key\":\"";
  jsonBody += DEVICE_KEY;
  jsonBody += "\",\"status\":\"OK\",\"reed_states\":[";
  for (int i = 0; i < 3; i++) {
    if (i > 0) jsonBody += ",";
    jsonBody += "{\"bay\":";
    jsonBody += String(i + 1);
    jsonBody += ",\"gpio\":";
    jsonBody += String(reedPins[i]);
    jsonBody += ",\"level\":\"";
    jsonBody += reedStableState[i] == HIGH ? "HIGH" : "LOW";
    jsonBody += "\",\"closed\":";
    jsonBody += compartmentClosed[i] ? "true" : "false";
    jsonBody += "}";
  }
  jsonBody += "]}";

  int httpCode = dispatchPost("/api/device/heartbeat", jsonBody, response);
  lastHttpCode = httpCode;

  if (httpCode == HTTP_CODE_OK) {
    serverConnected = true;

    // Check if web dashboard sent a custom LCD message or buzzer command
    StaticJsonDocument<768> doc;
    DeserializationError err = deserializeJson(doc, response);
    if (!err && doc.containsKey("custom_msg") && !doc["custom_msg"].isNull()) {
      const char* l1 = doc["custom_msg"]["line1"] | "";
      const char* l2 = doc["custom_msg"]["line2"] | "";
      bool ringBuzzer = doc["custom_msg"]["ring_buzzer"] | false;
      int durSec = doc["custom_msg"]["duration_sec"] | 15;
      int targetCompartment = doc["custom_msg"]["compartment_number"] | 0;

      Serial.println("\n==========================================");
      Serial.println("  >>> INCOMING MESSAGE FROM WEB APP <<<   ");
      Serial.printf("  Line 1: \"%s\"\n", l1);
      Serial.printf("  Line 2: \"%s\"\n", l2);
      Serial.printf("  Buzzer: %s | Duration: %d seconds\n", ringBuzzer ? "ACTIVE" : "OFF", durSec);
      Serial.println("==========================================\n");

      customMessageActive = true;
      customMessageStart = millis();
      customMessageDuration = (unsigned long)durSec * 1000UL;

      strncpy(customLine1, l1, 16);
      customLine1[16] = '\0';
      strncpy(customLine2, l2, 16);
      customLine2[16] = '\0';

      // Immediately display on LCD screen
      char pad1[17];
      char pad2[17];
      snprintf(pad1, sizeof(pad1), "%-16s", customLine1);
      snprintf(pad2, sizeof(pad2), "%-16s", customLine2);

      lcd.setCursor(0, 0);
      lcd.print(pad1);
      lcd.setCursor(0, 1);
      lcd.print(pad2);

      // Parse compartment targeting to blink matching LED during alert
      String combined = String(l1) + " " + String(l2);
      combined.toUpperCase();

      bool b1 = false;
      bool b2 = false;
      bool b3 = false;
      if (targetCompartment >= 1 && targetCompartment <= 3) {
        b1 = targetCompartment == 1;
        b2 = targetCompartment == 2;
        b3 = targetCompartment == 3;
      } else {
        // Compatibility path for older callers that only send LCD text.
        b1 = (combined.indexOf("BAY 1") >= 0) || (combined.indexOf("C1") >= 0) || (combined.indexOf("COMPARTMENT 1") >= 0);
        b2 = (combined.indexOf("BAY 2") >= 0) || (combined.indexOf("C2") >= 0) || (combined.indexOf("COMPARTMENT 2") >= 0);
        b3 = (combined.indexOf("BAY 3") >= 0) || (combined.indexOf("C3") >= 0) || (combined.indexOf("COMPARTMENT 3") >= 0);
      }

      if (b1 || b2 || b3) {
        ledBlinking[0] = b1;
        ledBlinking[1] = b2;
        ledBlinking[2] = b3;
        buzzerCompartment = b1 ? 0 : (b2 ? 1 : 2);
      } else {
        // General alert -> blink all LEDs
        ledBlinking[0] = true;
        ledBlinking[1] = true;
        ledBlinking[2] = true;
        buzzerCompartment = -1;
      }

      // Trigger buzzer if requested
      if (ringBuzzer) {
        Serial.printf("[CuraSync] Remote alert target: Bay %d, buzzer=%s\n",
                      b1 ? 1 : (b2 ? 2 : (b3 ? 3 : 0)), ringBuzzer ? "ON" : "OFF");
        buzzerActive = true;
        buzzerStart = millis();
        buzzerDurationTarget = customMessageDuration;
        updateBuzzerSound();
      } else {
        stopBuzzer();
      }
    }
  } else {
    serverConnected = false;
    Serial.printf("[CuraSync] Ping failed, HTTP Code: %d\n", httpCode);
  }
}

// 3. Send Compartment Opened Event to CuraSync
bool reportCompartmentEvent(int compartmentNumber) {
  if (WiFi.status() != WL_CONNECTED) return false;

  String response = "";
  String jsonBody = "{\"device_key\":\"" + String(DEVICE_KEY) +
                    "\",\"event_type\":\"compartment_open\",\"compartment_number\":" +
                    String(compartmentNumber) + "}";

  int httpCode = dispatchPost("/api/device/event", jsonBody, response);
  if (httpCode == HTTP_CODE_OK) {
    serverConnected = true;
    lastHttpCode = httpCode;
    Serial.printf("[CuraSync] Event logged for Compartment %d\n", compartmentNumber);
    return true;
  } else {
    lastHttpCode = httpCode;
    Serial.printf("[CuraSync] Event post failed, HTTP Code: %d\n", httpCode);
    return false;
  }
}

// -------------------------------------------------------------
// SETUP
// -------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(600);
  Serial.println("\n==========================================");
  Serial.println("    CuraSync Smart Dispenser Starting     ");
  Serial.println("==========================================");

  Wire.begin(21, 22);

  // Initialize GPIO pins
  for (int i = 0; i < 3; i++) {
    pinMode(reedPins[i], reedPinModes[i]);
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], LOW);

    reedRawState[i] = digitalRead(reedPins[i]);
    reedStableState[i] = reedRawState[i];
    compartmentClosed[i] = (reedStableState[i] == REED_CLOSED_STATE[i]);
    previousOpen[i] = !compartmentClosed[i];
    Serial.printf("[CuraSync] Bay %d reed GPIO %d initial=%s, closed-level=%s, mode=%s\n",
                  i + 1, reedPins[i], reedStableState[i] == HIGH ? "HIGH" : "LOW",
                  REED_CLOSED_STATE[i] == HIGH ? "HIGH" : "LOW",
                  reedPinModes[i] == INPUT_PULLUP ? "INPUT_PULLUP" : "INPUT");
  }

  // Setup Buzzer pin
  pinMode(buzzerPin, OUTPUT);
  digitalWrite(buzzerPin, LOW);

  // Initialize LCD display
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("CuraSync Ready");
  lcd.setCursor(0, 1);
  lcd.print("Starting HW...");

  // Initialize DS3231 RTC
  if (!rtc.begin()) {
    Serial.println("[CuraSync] WARNING: DS3231 RTC Module not detected. Check I2C wiring (SDA=21, SCL=22).");
    lcd.setCursor(0, 0);
    lcd.print("RTC Not Found!   ");
  }

  // Start Wi-Fi asynchronously so reed sensing and local alarms remain active
  // while the access point connects or retries.
  lcd.setCursor(0, 1);
  lcd.print("Starting WiFi... ");
  connectWiFi();
  lastKeepalivePing = millis();
  lastScheduleSync = millis();
  lastNtpCheck = millis();
}

// -------------------------------------------------------------
// MAIN LOOP
// -------------------------------------------------------------
void loop() {
  // Keep reconnect attempts asynchronous; local sensing and alarms continue
  // while Wi-Fi retries in the background.
  connectWiFi();

  DateTime now = rtc.now();

  // Safe fallback: If hardware RTC year is invalid (< 2024), use internal ESP32 clock
  if (now.year() < 2024) {
    time_t rawtime;
    time(&rawtime);
    struct tm *ti = localtime(&rawtime);
    if (ti->tm_year + 1900 >= 2024) {
      now = DateTime(ti->tm_year + 1900, ti->tm_mon + 1, ti->tm_mday,
                     ti->tm_hour, ti->tm_min, ti->tm_sec);
      rtc.adjust(now);
    }
  }

  unsigned long currentMillis = millis();

  // 1. Check Compartment Reed Switches & Alarms
  for (int i = 0; i < 3; i++) {
    int reedState = digitalRead(reedPins[i]);
    if (reedState != reedRawState[i]) {
      reedRawState[i] = reedState;
      reedRawChangedAt[i] = currentMillis;
      Serial.printf("[CuraSync] Bay %d reed GPIO %d raw transition -> %s\n",
                    i + 1, reedPins[i], reedState == HIGH ? "HIGH" : "LOW");
    }
    if (reedState != reedStableState[i] &&
        currentMillis - reedRawChangedAt[i] >= REED_DEBOUNCE_MS) {
      reedStableState[i] = reedState;
      Serial.printf("[CuraSync] Bay %d reed GPIO %d stable -> %s\n",
                    i + 1, reedPins[i], reedState == HIGH ? "HIGH" : "LOW");
    }

    bool isClosed = (reedStableState[i] == REED_CLOSED_STATE[i]);
    bool isOpen = !isClosed;
    compartmentClosed[i] = isClosed;

    bool justOpened = isOpen && !previousOpen[i];

    if (justOpened) {
      Serial.printf("[CuraSync] Lid opened: Bay %d (GPIO %d=%s)\n",
                    i + 1, reedPins[i], reedStableState[i] == HIGH ? "HIGH" : "LOW");

      // Silence this bay's reminder before the network request, which can
      // take time on a slow connection.
      if (buzzerActive && (buzzerCompartment == i || buzzerCompartment == -1)) {
        stopBuzzer();
      }
      pending[i] = false;
      firstBuzzPending[i] = false;
      ledBlinking[i] = false;

      customMessageActive = true;
      customMessageStart = millis();
      customMessageDuration = 4000UL;
      snprintf(customLine1, sizeof(customLine1), "%-16s", "DOSE TAKEN! OK ");
      snprintf(customLine2, sizeof(customLine2), "C%d:%-13s", i + 1, alarmMedName[i]);
      digitalWrite(ledPins[i], LOW);
      lcd.setCursor(0, 0);
      lcd.print(customLine1);
      lcd.setCursor(0, 1);
      lcd.print(customLine2);

      // Send the event after local buzzer/LED/LCD state has already changed.
      unsentOpenEvent[i] = true;
      lastOpenEventAttempt[i] = millis();
      if (reportCompartmentEvent(i + 1)) unsentOpenEvent[i] = false;
    }

    // The debounced justOpened edge above silences the matching buzzer and
    // clears its alert LED. Keep a stale/already-open input from cancelling a
    // newly dispatched manual alert on every loop iteration.
    if (isOpen) {
      pending[i] = false;
      firstBuzzPending[i] = false;
    }

    previousOpen[i] = isOpen;
  }

  // 1B. Check Scheduled Alarms (Multiple Doses per Bay supported)
  if (totalActiveSchedules > 0) {
    for (int s = 0; s < totalActiveSchedules; s++) {
      if (!activeSchedules[s].active) continue;

      int compIdx = activeSchedules[s].compartment - 1;
      if (compIdx < 0 || compIdx >= 3) continue;

      bool alreadyTriggered =
        lastAlarmDay[compIdx] == now.day() &&
        lastAlarmMonth[compIdx] == now.month() &&
        lastAlarmYear[compIdx] == now.year() &&
        lastAlarmHour[compIdx] == now.hour() &&
        lastAlarmMinute[compIdx] == now.minute();

      if (compartmentClosed[compIdx] && !alreadyTriggered &&
          now.hour() == activeSchedules[s].hour &&
          now.minute() == activeSchedules[s].minute) {

        lastAlarmDay[compIdx] = now.day();
        lastAlarmMonth[compIdx] = now.month();
        lastAlarmYear[compIdx] = now.year();
        lastAlarmHour[compIdx] = now.hour();
        lastAlarmMinute[compIdx] = now.minute();

        strncpy(alarmMedName[compIdx], activeSchedules[s].name, 16);
        alarmMedName[compIdx][16] = '\0';

        pending[compIdx] = true;
        firstBuzzPending[compIdx] = true;

        Serial.printf("[CuraSync] >>> ALARM ACTIVE for Bay %d at %02d:%02d: %s <<<\n",
                      compIdx + 1, activeSchedules[s].hour, activeSchedules[s].minute,
                      activeSchedules[s].name);
      }
    }
  } else {
    // Fallback: check 3 primary alarms
    for (int i = 0; i < 3; i++) {
      if (alarmActive[i]) {
        bool alreadyTriggered =
          lastAlarmDay[i] == now.day() &&
          lastAlarmMonth[i] == now.month() &&
          lastAlarmYear[i] == now.year() &&
          lastAlarmHour[i] == now.hour() &&
          lastAlarmMinute[i] == now.minute();

        if (compartmentClosed[i] && !alreadyTriggered &&
            now.hour() == alarmHour[i] &&
            now.minute() == alarmMinute[i]) {

          lastAlarmDay[i] = now.day();
          lastAlarmMonth[i] = now.month();
          lastAlarmYear[i] = now.year();
          lastAlarmHour[i] = now.hour();
          lastAlarmMinute[i] = now.minute();

          pending[i] = true;
          firstBuzzPending[i] = true;
          Serial.printf("[CuraSync] >>> ALARM ACTIVE for Bay %d (%02d:%02d) <<<\n",
                        i + 1, alarmHour[i], alarmMinute[i]);
        }
      }
    }
  }

  // Blinking LED Alert Driver:
  // Compartment LEDs blink rapidly (200ms ON / 200ms OFF) during active alarms and alerts!
  bool blinkCycle = (currentMillis % 400) < 200;
  for (int k = 0; k < 3; k++) {
    bool isAlerting = pending[k] || (customMessageActive && ledBlinking[k]);
    bool ledState = isAlerting && blinkCycle;
    digitalWrite(ledPins[k], ledState ? HIGH : LOW);
  }

  // 2. Manage Buzzer Duration & High-Volume Siren Modulation
  if (buzzerActive) {
    if (currentMillis - buzzerStart >= buzzerDurationTarget) {
      stopBuzzer();
    } else {
      updateBuzzerSound();
    }
  }

  // 3. Manage Recurring Buzz Reminders
  if (!buzzerActive) {
    for (int offset = 0; offset < 3; offset++) {
      int i = (nextCompartment + offset) % 3;

      if (!pending[i]) {
        continue;
      }

      if (firstBuzzPending[i] || currentMillis - lastReminder[i] >= REMINDER_INTERVAL) {
        startBuzzer(i);
        break;
      }
    }
  }

  // 4. Update LCD Display
  if (currentMillis - lastLcdUpdate >= 300) {
    lastLcdUpdate = currentMillis;

    // A) If a custom message was dispatched from frontend, showcase it!
    if (customMessageActive) {
      if (currentMillis - customMessageStart >= customMessageDuration) {
        customMessageActive = false;
        ledBlinking[0] = false;
        ledBlinking[1] = false;
        ledBlinking[2] = false;
        digitalWrite(ledPins[0], LOW);
        digitalWrite(ledPins[1], LOW);
        digitalWrite(ledPins[2], LOW);
      } else {
        char pad1[17];
        char pad2[17];
        snprintf(pad1, sizeof(pad1), "%-16s", customLine1);
        snprintf(pad2, sizeof(pad2), "%-16s", customLine2);
        lcd.setCursor(0, 0);
        lcd.print(pad1);
        lcd.setCursor(0, 1);
        lcd.print(pad2);
      }
    } 
    // B) Standard Real-Time Clock & Compartment Status
    else {
      char timeLine[17];
      snprintf(timeLine, sizeof(timeLine),
               "Time: %02d:%02d:%02d",
               now.hour(), now.minute(), now.second());

      lcd.setCursor(0, 0);
      lcd.print(timeLine);
      lcd.print("  ");

      int firstPending = -1;
      for (int i = 0; i < 3; i++) {
        if (pending[i]) {
          firstPending = i;
          break;
        }
      }

      lcd.setCursor(0, 1);
      if (firstPending == -1) {
        if (serverConnected) {
          lcd.print("Online [Synced] ");
        } else if (WiFi.status() == WL_CONNECTED) {
          char statusBuf[17];
          if (lastHttpCode < 0) {
            // ESP32 HTTPClient internal error codes (negative = transport-level failure)
            switch (lastHttpCode) {
              case -1:  snprintf(statusBuf, sizeof(statusBuf), "Conn Refused    "); break;
              case -2:  snprintf(statusBuf, sizeof(statusBuf), "Send Failed     "); break;
              case -3:  snprintf(statusBuf, sizeof(statusBuf), "Not Connected   "); break;
              case -4:  snprintf(statusBuf, sizeof(statusBuf), "Connection Lost "); break;
              case -11: snprintf(statusBuf, sizeof(statusBuf), "Request Timeout "); break;
              default:  snprintf(statusBuf, sizeof(statusBuf), "Net Err (%d)    ", lastHttpCode); break;
            }
          } else {
            // Real HTTP status code (4xx / 5xx)
            snprintf(statusBuf, sizeof(statusBuf), "HTTP Err %d     ", lastHttpCode);
          }
          lcd.print(statusBuf);
        } else {
          lcd.print("Ready [Offline] ");
        }
      } else {
        // DOSE IS DUE: Showcase medicine name and bay from /medicines
        char doseLine[17];
        snprintf(doseLine, sizeof(doseLine), "C%d:%-13s", firstPending + 1, alarmMedName[firstPending]);
        lcd.print(doseLine);
      }
    }
  }

  // Retry physical opening events after connectivity returns.
  for (int i = 0; i < 3; i++) {
    if (unsentOpenEvent[i] &&
        currentMillis - lastOpenEventAttempt[i] >= EVENT_RETRY_INTERVAL) {
      lastOpenEventAttempt[i] = currentMillis;
      if (reportCompartmentEvent(i + 1)) unsentOpenEvent[i] = false;
      break;
    }
  }

  // 5. Periodic cloud sync (HTTP requests may briefly block on the server)
  if (currentMillis - lastKeepalivePing >= KEEPALIVE_INTERVAL) {
    lastKeepalivePing = currentMillis;
    sendKeepalivePing();
  }

  if (currentMillis - lastScheduleSync >= SCHEDULE_SYNC_INTERVAL) {
    lastScheduleSync = currentMillis;
    fetchScheduleFromCuraSync();
  }

  // 6. Periodic NTP -> DS3231 Re-sync (every 6 hours) to prevent RTC drift
  if (WiFi.status() == WL_CONNECTED && ntpSyncPending &&
      currentMillis - lastNtpCheck >= 30000UL) {
    lastNtpCheck = currentMillis;
    syncTimeWithNTP();
  } else if (WiFi.status() == WL_CONNECTED && !ntpSyncPending &&
             currentMillis - lastNtpSync >= NTP_SYNC_INTERVAL) {
    Serial.println("[CuraSync] Periodic NTP re-sync: checking DS3231 RTC drift...");
    ntpConfigured = false;
    lastNtpCheck = currentMillis;
    syncTimeWithNTP();
  }

  delay(20);
}
