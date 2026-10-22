/*
 * CuraSync ESP32 Firmware (v2.3)
 * -------------------------------------------------------------
 * Hardware:
 *   - ESP32 Development Board
 *   - DS3231 RTC Module (I2C: SDA=21, SCL=22)
 *   - 1602 LCD I2C Display (Address: 0x27)
 *   - 3x Reed Switches (Compartments 1, 2, 3 -> GPIO 32, 33, 25)
 *   - 3x Indicator LEDs (Compartments 1, 2, 3 -> GPIO 18, 19, 23)
 *   - Buzzer (GPIO 26) - Supports both Active and Passive Buzzers!
 *
 * New in v2.3:
 *   - Dual-Server Auto-Fallback: Seamless connection to Vercel HTTPS & local HTTP
 *   - Fixed ESP32 HTTPClient WiFiClient requirement (no more dropped connections)
 *   - Live LCD Status Diagnostics: Displays exact HTTP code on screen if failing
 *   - Rapid 5-second polling with real-time text & buzzer trigger from web dashboard
 *   - Universal Buzzer driver with boot test chirp
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
const char* WIFI_SSID     = "Pande-2.4G";
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

const int OPEN_STATE = LOW;

const unsigned long BUZZER_DURATION   = 7000UL;   // Beep for 7 seconds
const unsigned long REMINDER_INTERVAL = 60000UL;  // Re-buzz every 60s if not taken

bool pending[3]          = {false, false, false};
bool firstBuzzPending[3] = {false, false, false};
bool previousOpen[3]     = {false, false, false};

bool buzzerActive = false;
unsigned long buzzerStart = 0;
unsigned long buzzerDurationTarget = BUZZER_DURATION;
unsigned long lastReminder[3] = {0, 0, 0};

int lastAlarmDay[3]   = {-1, -1, -1};
int lastAlarmMonth[3] = {-1, -1, -1};
int lastAlarmYear[3]  = {-1, -1, -1};

int buzzerCompartment = -1;
int nextCompartment   = 0;

unsigned long lastLcdUpdate         = 0;
unsigned long lastKeepalivePing     = 0;
unsigned long lastScheduleSync      = 0;

// Rapid polling: Ping server every 5s, re-sync medication schedules every 30s
const unsigned long KEEPALIVE_INTERVAL     = 5000UL;
const unsigned long SCHEDULE_SYNC_INTERVAL = 30000UL;

bool serverConnected = false;
int lastHttpCode = 0;

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

  unsigned long cycle = millis() % 450;
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
  updateBuzzerSound();
  if (compartment >= 0 && compartment < 3) {
    lastReminder[compartment] = millis();
    buzzerCompartment = compartment;
    firstBuzzPending[compartment] = false;
    nextCompartment = (compartment + 1) % 3;
  }
}

void stopBuzzer() {
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

  Serial.println("[CuraSync] Fetching atomic time from NTP (IST UTC+5:30)...");
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER_1, NTP_SERVER_2);

  struct tm timeinfo;
  // 1200ms short timeout prevents watchdog resets on routers blocking NTP UDP port
  if (getLocalTime(&timeinfo, 1200)) {
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
  } else {
    Serial.println("[CuraSync] NTP skipped. Running smoothly on DS3231 hardware RTC.");
  }
}

// -------------------------------------------------------------
// NETWORK FUNCTIONS WITH AUTO-FALLBACK
// -------------------------------------------------------------
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);

  Serial.print("[CuraSync] Connecting to Wi-Fi SSID: ");
  Serial.println(WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 15000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[CuraSync] Wi-Fi Connected!");
    Serial.print("[CuraSync] Local IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[CuraSync] Wi-Fi connection failed. Operating in Offline Mode.");
  }
}

// Low-level HTTP POST using reusable global client
int doSinglePost(const String& fullUrl, const String& jsonBody, String& outResponse) {
  HTTPClient http;

  bool beginOk = false;
  if (fullUrl.startsWith("https://")) {
    secureClient.setInsecure();
    secureClient.setTimeout(3000);
    beginOk = http.begin(secureClient, fullUrl);
  } else {
    plainClient.setTimeout(3000);
    beginOk = http.begin(plainClient, fullUrl);
  }

  if (!beginOk) {
    Serial.printf("[CuraSync] HTTPClient begin failed for: %s\n", fullUrl.c_str());
    return -10;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_KEY);
  http.setTimeout(3000);

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
    secureClient.setTimeout(3000);
    beginOk = http.begin(secureClient, fullUrl);
  } else {
    plainClient.setTimeout(3000);
    beginOk = http.begin(plainClient, fullUrl);
  }

  if (!beginOk) return -10;

  http.addHeader("x-device-key", DEVICE_KEY);
  http.setTimeout(3000);

  int code = http.GET();
  if (code > 0) {
    outResponse = http.getString();
  }
  http.end();
  return code;
}

// Dispatch POST with automatic local <-> cloud fallback
int dispatchPost(const String& path, const String& jsonBody, String& outResponse) {
  const char* primary = PREFER_LOCAL_DEV ? LOCAL_SERVER_URL : CLOUD_SERVER_URL;
  const char* backup  = PREFER_LOCAL_DEV ? CLOUD_SERVER_URL : LOCAL_SERVER_URL;

  int code = doSinglePost(String(primary) + path, jsonBody, outResponse);

  // If primary unreachable (e.g. laptop asleep or AP isolation), use backup
  if (code <= 0) {
    Serial.printf("[CuraSync] Primary server failed (code %d). Trying fallback...\n", code);
    code = doSinglePost(String(backup) + path, jsonBody, outResponse);
  }
  return code;
}

// Dispatch GET with automatic local <-> cloud fallback
int dispatchGet(const String& pathAndQuery, String& outResponse) {
  const char* primary = PREFER_LOCAL_DEV ? LOCAL_SERVER_URL : CLOUD_SERVER_URL;
  const char* backup  = PREFER_LOCAL_DEV ? CLOUD_SERVER_URL : LOCAL_SERVER_URL;

  int code = doSingleGet(String(primary) + pathAndQuery, outResponse);

  if (code <= 0) {
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

    StaticJsonDocument<1536> doc;
    DeserializationError error = deserializeJson(doc, payload);

    if (!error && doc["success"] == true) {
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
            Serial.printf("[CuraSync] C%d Alarm Set: %02d:%02d (%s)\n",
                          compNum, alarmHour[idx], alarmMinute[idx], alarmMedName[idx]);
          } else {
            strncpy(alarmMedName[idx], "Empty Bay", 16);
            alarmMedName[idx][16] = '\0';
            Serial.printf("[CuraSync] C%d: No active doses scheduled.\n", compNum);
          }
        }
      }
    }
  } else {
    lastHttpCode = httpCode;
    Serial.printf("[CuraSync] Schedule fetch failed, HTTP Code: %d\n", httpCode);
  }
}

// 2. Send Keepalive Ping to CuraSync & Check for LCD Remote Messages
void sendKeepalivePing() {
  if (WiFi.status() != WL_CONNECTED) return;

  String response = "";
  String jsonBody = "{\"device_key\":\"" + String(DEVICE_KEY) + "\",\"status\":\"OK\"}";

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

      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print(pad1);
      lcd.setCursor(0, 1);
      lcd.print(pad2);

      // Trigger buzzer if requested
      if (ringBuzzer) {
        buzzerActive = true;
        buzzerStart = millis();
        buzzerDurationTarget = customMessageDuration;
        updateBuzzerSound();
      }
    }
  } else {
    serverConnected = false;
    Serial.printf("[CuraSync] Ping failed, HTTP Code: %d\n", httpCode);
  }
}

// 3. Send Compartment Opened Event to CuraSync
void reportCompartmentEvent(int compartmentNumber) {
  if (WiFi.status() != WL_CONNECTED) return;

  String response = "";
  String jsonBody = "{\"device_key\":\"" + String(DEVICE_KEY) +
                    "\",\"event_type\":\"compartment_open\",\"compartment_number\":" +
                    String(compartmentNumber) + "}";

  int httpCode = dispatchPost("/api/device/event", jsonBody, response);
  if (httpCode == HTTP_CODE_OK) {
    serverConnected = true;
    lastHttpCode = httpCode;
    Serial.printf("[CuraSync] Event logged for Compartment %d\n", compartmentNumber);
  } else {
    lastHttpCode = httpCode;
    Serial.printf("[CuraSync] Event post failed, HTTP Code: %d\n", httpCode);
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
    pinMode(reedPins[i], INPUT_PULLUP);
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], LOW);

    previousOpen[i] = (digitalRead(reedPins[i]) == OPEN_STATE);
  }

  // Setup Buzzer pin
  pinMode(buzzerPin, OUTPUT);
  digitalWrite(buzzerPin, LOW);

  // Quick startup single beep self-test (clean, solid tone)
  Serial.println("[CuraSync] Buzzer startup self-test...");
  soundBuzzerOn();
  delay(180);
  soundBuzzerOff();

  // Initialize LCD display
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("CuraSync Dispenser");
  lcd.setCursor(0, 1);
  lcd.print("Starting HW...");

  // Initialize DS3231 RTC
  if (!rtc.begin()) {
    Serial.println("[CuraSync] WARNING: DS3231 RTC Module not detected. Check I2C wiring (SDA=21, SCL=22).");
    lcd.clear();
    lcd.print("RTC Not Found!");
  }

  // Connect to Wi-Fi
  lcd.setCursor(0, 1);
  lcd.print("Connecting WiFi ");
  connectWiFi();

  // If connected, sync exact time and fetch schedule
  if (WiFi.status() == WL_CONNECTED) {
    lcd.setCursor(0, 1);
    lcd.print("Syncing Time... ");
    syncTimeWithNTP();

    lcd.setCursor(0, 1);
    lcd.print("Syncing Schedule");
    fetchScheduleFromCuraSync();
    sendKeepalivePing();
  } else {
    lcd.setCursor(0, 1);
    lcd.print("Offline Mode    ");
  }

  delay(1000);
  lcd.clear();
}

// -------------------------------------------------------------
// MAIN LOOP
// -------------------------------------------------------------
void loop() {
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
    bool isOpen = (reedState == OPEN_STATE);

    bool justOpened = isOpen && !previousOpen[i];

    if (justOpened) {
      Serial.printf("[CuraSync] Lid opened: Compartment %d\n", i + 1);

      // Report event to CuraSync server
      reportCompartmentEvent(i + 1);

      if (pending[i]) {
        pending[i] = false;
        firstBuzzPending[i] = false;

        if (buzzerActive && buzzerCompartment == i) {
          stopBuzzer();
        }

        // Showcase dose confirmation on LCD for 4 seconds
        customMessageActive = true;
        customMessageStart = millis();
        customMessageDuration = 4000UL;
        snprintf(customLine1, sizeof(customLine1), "%-16s", "DOSE TAKEN! OK ");
        snprintf(customLine2, sizeof(customLine2), "C%d:%-13s", i + 1, alarmMedName[i]);
      }
    }

    previousOpen[i] = isOpen;

    // Trigger scheduled alarms
    if (alarmActive[i]) {
      bool alreadyTriggered =
        lastAlarmDay[i] == now.day() &&
        lastAlarmMonth[i] == now.month() &&
        lastAlarmYear[i] == now.year();

      if (!alreadyTriggered &&
          now.hour() == alarmHour[i] &&
          now.minute() == alarmMinute[i]) {

        lastAlarmDay[i] = now.day();
        lastAlarmMonth[i] = now.month();
        lastAlarmYear[i] = now.year();

        pending[i] = true;
        firstBuzzPending[i] = true;
        Serial.printf("[CuraSync] >>> ALARM ACTIVE for Compartment %d (%02d:%02d) <<<\n",
                      i + 1, alarmHour[i], alarmMinute[i]);
      }
    }

    // Compartment LED glows when dose is pending
    digitalWrite(ledPins[i], pending[i] ? HIGH : LOW);
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
        lcd.clear();
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
          if (lastHttpCode != 0) {
            snprintf(statusBuf, sizeof(statusBuf), "Err HTTP:%-7d", lastHttpCode);
          } else {
            snprintf(statusBuf, sizeof(statusBuf), "WiFi Conn (Wait)");
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

  // 5. Periodic Background Cloud Sync (Non-Blocking)
  if (currentMillis - lastKeepalivePing >= KEEPALIVE_INTERVAL) {
    lastKeepalivePing = currentMillis;
    if (WiFi.status() != WL_CONNECTED) {
      connectWiFi();
    }
    sendKeepalivePing();
  }

  if (currentMillis - lastScheduleSync >= SCHEDULE_SYNC_INTERVAL) {
    lastScheduleSync = currentMillis;
    fetchScheduleFromCuraSync();
  }

  delay(20);
}
