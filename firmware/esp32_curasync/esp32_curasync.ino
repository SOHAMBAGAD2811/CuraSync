/*
 * CuraSync ESP32 Firmware (v2.0)
 * -------------------------------------------------------------
 * Hardware:
 *   - ESP32 Development Board
 *   - DS3231 RTC Module (I2C: SDA=21, SCL=22)
 *   - 1602 LCD I2C Display (Address: 0x27)
 *   - 3x Reed Switches (Compartments 1, 2, 3 -> GPIO 32, 33, 25)
 *   - 3x Indicator LEDs (Compartments 1, 2, 3 -> GPIO 18, 19, 23)
 *   - Passive Buzzer (GPIO 26)
 *
 * Key Improvements:
 *   - Automatic NTP Internet Time Sync (IST UTC+5:30) with DS3231 RTC calibration
 *   - Universal HTTP / HTTPS support (Works with local IP and live Vercel domains)
 *   - Verbose Serial diagnostics for connection troubleshooting
 *   - Non-blocking cloud synchronization & offline-resilient alarms
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

// Webserver URL:
// - For local dev, use your computer LAN IP: "http://192.168.1.106:3000"
// - For production, use your live Vercel domain: "https://curasync-iot.vercel.app"
const char* SERVER_URL    = "http://192.168.1.106:3000";

// Copy your Device Key from your CuraSync dashboard (/device page)
const char* DEVICE_KEY    = "cs_dev_aralnk0g_mvhwiq49";

// Timezone offset for India Standard Time (IST): UTC+5:30 = 5.5 * 3600 = 19800 seconds
const long  GMT_OFFSET_SEC      = 19800;
const int   DAYLIGHT_OFFSET_SEC = 0;
const char* NTP_SERVER_1        = "pool.ntp.org";
const char* NTP_SERVER_2        = "time.google.com";
// =============================================================

RTC_DS3231 rtc;
LiquidCrystal_I2C lcd(0x27, 16, 2);

// Hardware pin assignments
const int reedPins[3] = {32, 33, 25};
const int ledPins[3]  = {18, 19, 23};
const int buzzerPin   = 26;

// Local alarm schedules for Compartments 1, 2, 3 (hours 0-23, minutes 0-59)
int alarmHour[3]    = {8, 13, 20};
int alarmMinute[3]  = {0, 0, 0};
bool alarmActive[3] = {true, true, true};

const int OPEN_STATE = LOW;

const unsigned long BUZZER_DURATION   = 7000UL;   // Beep for 7 seconds
const unsigned long REMINDER_INTERVAL = 60000UL;  // Re-buzz every 60s if dose not taken

const int BUZZER_FREQUENCY = 2000;
const int BUZZER_VOLUME    = 128;

bool pending[3]          = {false, false, false};
bool firstBuzzPending[3] = {false, false, false};
bool previousOpen[3]     = {false, false, false};

bool buzzerActive = false;
unsigned long buzzerStart = 0;
unsigned long lastReminder[3] = {0, 0, 0};

int lastAlarmDay[3]   = {-1, -1, -1};
int lastAlarmMonth[3] = {-1, -1, -1};
int lastAlarmYear[3]  = {-1, -1, -1};

int buzzerCompartment = -1;
int nextCompartment   = 0;

unsigned long lastLcdUpdate         = 0;
unsigned long lastKeepalivePing     = 0;
unsigned long lastScheduleSync      = 0;

const unsigned long KEEPALIVE_INTERVAL     = 60000UL;   // Ping server every 60s
const unsigned long SCHEDULE_SYNC_INTERVAL = 300000UL;  // Sync schedule every 5 mins

// -------------------------------------------------------------
// BUZZER FUNCTIONS
// -------------------------------------------------------------
void startBuzzer(int compartment) {
  ledcWrite(buzzerPin, BUZZER_VOLUME);

  buzzerActive = true;
  buzzerStart = millis();
  lastReminder[compartment] = millis();
  buzzerCompartment = compartment;
  firstBuzzPending[compartment] = false;

  nextCompartment = (compartment + 1) % 3;
}

void stopBuzzer() {
  ledcWrite(buzzerPin, 0);
  buzzerActive = false;
  buzzerCompartment = -1;
}

// -------------------------------------------------------------
// NTP TIME & RTC SYNCHRONIZATION
// -------------------------------------------------------------
void syncTimeWithNTP() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[CuraSync] Wi-Fi not connected. Skipping NTP sync.");
    return;
  }

  Serial.println("[CuraSync] Configuring NTP time sync (IST UTC+5:30)...");
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER_1, NTP_SERVER_2);

  struct tm timeinfo;
  int retry = 0;
  while (!getLocalTime(&timeinfo) && retry < 6) {
    delay(500);
    Serial.print(".");
    retry++;
  }

  if (getLocalTime(&timeinfo)) {
    Serial.println("\n[CuraSync] NTP Time acquired successfully!");
    // Calibrate DS3231 RTC chip with the network atomic time
    rtc.adjust(DateTime(timeinfo.tm_year + 1900,
                        timeinfo.tm_mon + 1,
                        timeinfo.tm_mday,
                        timeinfo.tm_hour,
                        timeinfo.tm_min,
                        timeinfo.tm_sec));

    Serial.printf("[CuraSync] DS3231 RTC Calibrated: %04d-%02d-%02d %02d:%02d:%02d\n",
                  timeinfo.tm_year + 1900, timeinfo.tm_mon + 1, timeinfo.tm_mday,
                  timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);
  } else {
    Serial.println("\n[CuraSync] Warning: Failed to fetch time from NTP server. Running on existing RTC time.");
  }
}

// -------------------------------------------------------------
// NETWORK FUNCTIONS
// -------------------------------------------------------------
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("[CuraSync] Connecting to Wi-Fi SSID: ");
  Serial.println(WIFI_SSID);

  unsigned long startAttempt = millis();
  // Allow up to 12 seconds for Wi-Fi association
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 12000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[CuraSync] Wi-Fi Connected!");
    Serial.print("[CuraSync] IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[CuraSync] Wi-Fi connection timed out. Operating in Offline Mode.");
  }
}

// 1. Fetch Alarm Schedules from CuraSync
void fetchScheduleFromCuraSync() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  WiFiClient client;
  WiFiClientSecure secureClient;

  String url = String(SERVER_URL) + "/api/device/schedule?key=" + String(DEVICE_KEY);
  Serial.print("[CuraSync] Fetching schedules from: ");
  Serial.println(url);

  if (url.startsWith("https://")) {
    secureClient.setInsecure();
    http.begin(secureClient, url);
  } else {
    http.begin(client, url);
  }

  http.addHeader("x-device-key", DEVICE_KEY);
  http.setTimeout(5000);

  int httpCode = http.GET();
  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    Serial.println("[CuraSync] Schedule payload received:");
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
            Serial.printf("[CuraSync] Compartment %d Alarm Updated: %02d:%02d (%s)\n",
                          compNum, alarmHour[idx], alarmMinute[idx], (const char*)a["name"]);
          } else {
            Serial.printf("[CuraSync] Compartment %d: No active alarms today.\n", compNum);
          }
        }
      }
    } else {
      Serial.println("[CuraSync] Error parsing JSON schedule payload.");
    }
  } else {
    Serial.printf("[CuraSync] Schedule fetch failed, HTTP Code: %d\n", httpCode);
    if (httpCode > 0) {
      Serial.println(http.getString());
    }
  }
  http.end();
}

// 2. Send Keepalive Ping to CuraSync
void sendKeepalivePing() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  WiFiClient client;
  WiFiClientSecure secureClient;

  String url = String(SERVER_URL) + "/api/device/heartbeat";
  Serial.print("[CuraSync] Sending heartbeat ping to: ");
  Serial.println(url);

  if (url.startsWith("https://")) {
    secureClient.setInsecure();
    http.begin(secureClient, url);
  } else {
    http.begin(client, url);
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_KEY);
  http.setTimeout(4000);

  String jsonBody = "{\"device_key\":\"" + String(DEVICE_KEY) + "\",\"status\":\"OK\"}";
  int httpCode = http.POST(jsonBody);

  if (httpCode == HTTP_CODE_OK) {
    Serial.println("[CuraSync] Connection ping acknowledged by server.");
  } else {
    Serial.printf("[CuraSync] Ping failed, HTTP Code: %d\n", httpCode);
    if (httpCode > 0) {
      Serial.println(http.getString());
    }
  }
  http.end();
}

// 3. Send Compartment Opened Event to CuraSync
void reportCompartmentEvent(int compartmentNumber) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  WiFiClient client;
  WiFiClientSecure secureClient;

  String url = String(SERVER_URL) + "/api/device/event";

  if (url.startsWith("https://")) {
    secureClient.setInsecure();
    http.begin(secureClient, url);
  } else {
    http.begin(client, url);
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_KEY);
  http.setTimeout(4000);

  String jsonBody = "{\"device_key\":\"" + String(DEVICE_KEY) +
                    "\",\"event_type\":\"compartment_open\",\"compartment_number\":" +
                    String(compartmentNumber) + "}";

  int httpCode = http.POST(jsonBody);
  if (httpCode == HTTP_CODE_OK) {
    String response = http.getString();
    Serial.printf("[CuraSync] Event logged for C%d: %s\n", compartmentNumber, response.c_str());
  } else {
    Serial.printf("[CuraSync] Event post failed, HTTP Code: %d\n", httpCode);
    if (httpCode > 0) {
      Serial.println(http.getString());
    }
  }
  http.end();
}

// -------------------------------------------------------------
// SETUP
// -------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n--- CuraSync ESP32 Dispenser Unit Booting ---");

  Wire.begin(21, 22);

  // Initialize GPIO pins
  for (int i = 0; i < 3; i++) {
    pinMode(reedPins[i], INPUT_PULLUP);
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], LOW);

    previousOpen[i] = (digitalRead(reedPins[i]) == OPEN_STATE);
  }

  // Setup passive buzzer PWM channel
  ledcAttach(buzzerPin, BUZZER_FREQUENCY, 8);
  ledcWrite(buzzerPin, 0);

  // Initialize LCD display
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("CuraSync Dispenser");
  lcd.setCursor(0, 1);
  lcd.print("Hardware Init...");

  // Initialize DS3231 RTC
  if (!rtc.begin()) {
    Serial.println("[CuraSync] ERROR: DS3231 RTC Module not detected! Check SDA/SCL wiring.");
    lcd.clear();
    lcd.print("RTC Not Found!");
    while (true) {
      delay(200);
    }
  }

  // Connect to Wi-Fi
  lcd.setCursor(0, 1);
  lcd.print("Connecting WiFi ");
  connectWiFi();

  // If connected, calibrate clock via NTP and sync schedule from server
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

  delay(1200);
  lcd.clear();
}

// -------------------------------------------------------------
// MAIN LOOP
// -------------------------------------------------------------
void loop() {
  DateTime now = rtc.now();
  unsigned long currentMillis = millis();

  // 1. Check Compartment Reed Switches & Alarms
  for (int i = 0; i < 3; i++) {
    int reedState = digitalRead(reedPins[i]);
    bool isOpen = (reedState == OPEN_STATE);

    bool justOpened = isOpen && !previousOpen[i];

    if (justOpened) {
      Serial.printf("[CuraSync] Compartment %d OPENED!\n", i + 1);

      // Report event to CuraSync cloud backend
      reportCompartmentEvent(i + 1);

      if (pending[i]) {
        pending[i] = false;
        firstBuzzPending[i] = false;

        if (buzzerActive && buzzerCompartment == i) {
          stopBuzzer();
        }
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
        Serial.printf("[CuraSync] ALARM TRIGGERED for Compartment %d (%02d:%02d)\n",
                      i + 1, alarmHour[i], alarmMinute[i]);
      }
    }

    // Compartment LED glows when dose is pending
    digitalWrite(ledPins[i], pending[i] ? HIGH : LOW);
  }

  // 2. Manage Buzzer Duration
  if (buzzerActive && currentMillis - buzzerStart >= BUZZER_DURATION) {
    stopBuzzer();
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

  // 4. Update LCD Display every 300ms
  if (currentMillis - lastLcdUpdate >= 300) {
    lastLcdUpdate = currentMillis;

    // Line 1: Time: HH:MM:SS
    char timeLine[17];
    snprintf(timeLine, sizeof(timeLine),
             "Time: %02d:%02d:%02d",
             now.hour(), now.minute(), now.second());

    lcd.setCursor(0, 0);
    lcd.print(timeLine);
    lcd.print("  ");

    // Line 2: Status or Pending Dose Alert
    int firstPending = -1;
    for (int i = 0; i < 3; i++) {
      if (pending[i]) {
        firstPending = i;
        break;
      }
    }

    lcd.setCursor(0, 1);
    if (firstPending == -1) {
      if (WiFi.status() == WL_CONNECTED) {
        lcd.print("Ready [Online]  ");
      } else {
        lcd.print("Ready [Offline] ");
      }
    } else {
      lcd.print("DOSE DUE: C");
      lcd.print(firstPending + 1);
      lcd.print("    ");
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
