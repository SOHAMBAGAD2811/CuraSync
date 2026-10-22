/*
 * CuraSync ESP32 Firmware
 * -------------------------------------------------------------
 * Hardware:
 *   - ESP32 Development Board
 *   - DS3231 RTC Module (I2C: SDA=21, SCL=22)
 *   - 1602 LCD I2C Display (Address: 0x27)
 *   - 3x Reed Switches (Compartments 1, 2, 3 -> GPIO 32, 33, 25)
 *   - 3x Indicator LEDs (Compartments 1, 2, 3 -> GPIO 18, 19, 23)
 *   - Passive Buzzer (GPIO 26)
 *
 * Features:
 *   - Independent RTC timekeeping & local buzzer reminders (offline-first)
 *   - Dynamic schedule synchronization with CuraSync cloud
 *   - Automatic dose acknowledgement when compartment reed switch opens
 *   - Periodic connection keepalive ping
 */

#include <Wire.h>
#include <RTClib.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// =============================================================
// USER CONFIGURATION (Fill with your credentials)
// =============================================================
const char* WIFI_SSID     = "Pande-2.4G";
const char* WIFI_PASSWORD = "Ishaan@11";

// Use your computer's local LAN IP (e.g., http://192.168.1.15:3000) or production URL
const char* SERVER_URL    = "http://192.168.1.106:3000";

// Copy your Device Key from the CuraSync web app (/device page)
const char* DEVICE_KEY    = "cs_dev_aralnk0g_mvhwiq49";
// =============================================================

RTC_DS3231 rtc;
LiquidCrystal_I2C lcd(0x27, 16, 2);

// Pin assignments
const int reedPins[3] = {32, 33, 25};
const int ledPins[3]  = {18, 19, 23};
const int buzzerPin   = 26;

// Local alarm schedules for Compartments 1, 2, 3 (fallback / initialized values)
int alarmHour[3]   = {17, 17, 17};
int alarmMinute[3] = {37, 39, 41};
bool alarmActive[3] = {true, true, true};

const int OPEN_STATE = LOW;

const unsigned long BUZZER_DURATION   = 7000UL;   // 7 seconds
const unsigned long REMINDER_INTERVAL = 60000UL;  // Re-buzz every 60 seconds if not taken

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

const unsigned long KEEPALIVE_INTERVAL    = 60000UL;  // Ping server every 60s
const unsigned long SCHEDULE_SYNC_INTERVAL = 300000UL; // Sync schedule every 5 mins

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
// NETWORK FUNCTIONS
// -------------------------------------------------------------
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");

  unsigned long startAttempt = millis();
  // Attempt for max 8 seconds on boot so we don't block RTC alarms
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 8000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWi-Fi Connected! IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\nWi-Fi connection timed out. Running in Offline Mode.");
  }
}

// 1. Fetch Alarm Schedules from CuraSync
void fetchScheduleFromCuraSync() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(SERVER_URL) + "/api/device/schedule?key=" + String(DEVICE_KEY);
  http.begin(url);
  http.setTimeout(4000);

  int httpCode = http.GET();
  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
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
            Serial.printf("[CuraSync] C%d updated: %02d:%02d (%s)\n",
                          compNum, alarmHour[idx], alarmMinute[idx], (const char*)a["name"]);
          }
        }
      }
    }
  } else {
    Serial.printf("[CuraSync] Schedule fetch failed, HTTP: %d\n", httpCode);
  }
  http.end();
}

// 2. Send Keepalive Ping to CuraSync
void sendKeepalivePing() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(SERVER_URL) + "/api/device/heartbeat";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(3000);

  String jsonBody = "{\"device_key\":\"" + String(DEVICE_KEY) + "\",\"status\":\"OK\"}";
  int httpCode = http.POST(jsonBody);

  if (httpCode == HTTP_CODE_OK) {
    Serial.println("[CuraSync] Connection ping acknowledged.");
  } else {
    Serial.printf("[CuraSync] Ping failed, HTTP: %d\n", httpCode);
  }
  http.end();
}

// 3. Send Compartment Opened Event to CuraSync
void reportCompartmentEvent(int compartmentNumber) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(SERVER_URL) + "/api/device/event";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(4000);

  String jsonBody = "{\"device_key\":\"" + String(DEVICE_KEY) +
                    "\",\"event_type\":\"compartment_open\",\"compartment_number\":" +
                    String(compartmentNumber) + "}";

  int httpCode = http.POST(jsonBody);
  if (httpCode == HTTP_CODE_OK) {
    String response = http.getString();
    Serial.printf("[CuraSync] Event logged for C%d: %s\n", compartmentNumber, response.c_str());
  } else {
    Serial.printf("[CuraSync] Event post failed, HTTP: %d\n", httpCode);
  }
  http.end();
}

// -------------------------------------------------------------
// SETUP
// -------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);

  for (int i = 0; i < 3; i++) {
    pinMode(reedPins[i], INPUT);
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], LOW);

    previousOpen[i] = (digitalRead(reedPins[i]) == OPEN_STATE);
  }

  ledcAttach(buzzerPin, BUZZER_FREQUENCY, 8);
  ledcWrite(buzzerPin, 0);

  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("CuraSync System");
  lcd.setCursor(0, 1);
  lcd.print("Init Hardware...");

  if (!rtc.begin()) {
    lcd.clear();
    lcd.print("RTC Not Found!");
    while (true) {
      delay(100);
    }
  }

  if (rtc.lostPower()) {
    rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
  }

  // Connect to Wi-Fi and fetch cloud schedules
  lcd.setCursor(0, 1);
  lcd.print("Connecting WiFi ");
  connectWiFi();

  if (WiFi.status() == WL_CONNECTED) {
    lcd.setCursor(0, 1);
    lcd.print("Syncing Schedule");
    fetchScheduleFromCuraSync();
    sendKeepalivePing();
  }

  delay(1000);
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
      Serial.printf("Compartment %d opened!\n", i + 1);

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
        Serial.printf("Alarm triggered for Compartment %d\n", i + 1);
      }
    }

    digitalWrite(ledPins[i], pending[i] ? HIGH : LOW);
  }

  // 2. Manage Buzzer Duration
  if (buzzerActive &&
      currentMillis - buzzerStart >= BUZZER_DURATION) {
    stopBuzzer();
  }

  // 3. Manage Recurring Buzz Reminders
  if (!buzzerActive) {
    for (int offset = 0; offset < 3; offset++) {
      int i = (nextCompartment + offset) % 3;

      if (!pending[i]) {
        continue;
      }

      if (firstBuzzPending[i] ||
          currentMillis - lastReminder[i] >= REMINDER_INTERVAL) {
        startBuzzer(i);
        break;
      }
    }
  }

  // 4. Update LCD Display every 250ms
  if (currentMillis - lastLcdUpdate >= 250) {
    lastLcdUpdate = currentMillis;

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
    lcd.print("                ");
    lcd.setCursor(0, 1);

    if (firstPending == -1) {
      if (WiFi.status() == WL_CONNECTED) {
        lcd.print("Ready [Online]  ");
      } else {
        lcd.print("Ready [Offline] ");
      }
    } else {
      lcd.print("Dose pending: ");
      lcd.print(firstPending + 1);
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
