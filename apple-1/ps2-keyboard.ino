#include <Arduino.h>

const uint8_t CLOCK = 2;
const uint8_t DATA  = 4;

const int INVALID_BIT = -1;
const int START_BIT   =  0;
const int PARITY_BIT  =  9;
const int STOP_BIT    = 10;

const int KEY_UP    = 0xF0;
const int SHIFT     = 0x12;
const int CAPS_LOCK = 0x58;
const int ESCAPE    = 0x76;
const int BACKSPACE = 0x66;

const char scanCode_to_ascii[128] = {
    0,  0 ,  0 ,  0 ,  0 ,  0 ,  0 ,  0,  //0x00 - 0x07
    0,  0 ,  0 ,  0 ,  0 ,'\t', '`',  0,  //0x08 - 0x0F
    0,  0 ,  0 ,  0 ,  0 , 'q', '1',  0,  //0x10 - 0x17
    0,  0 , 'z', 's', 'a', 'w', '2',  0,  //0x18 - 0x1F
    0, 'c', 'x', 'd', 'e', '4', '3',  0,  //0x20 - 0x27
    0, ' ', 'v', 'f', 't', 'r', '5',  0,  //0x28 - 0x2F
    0, 'n', 'b', 'h', 'g', 'y', '6',  0,  //0x30 - 0x37
    0,  0 , 'm', 'j', 'u', '7', '8',  0,  //0x38 - 0x3F
    0, ',', 'k', 'i', 'o', '0', '9',  0,  //0x40 - 0x47
    0, '.', '/', 'l', ';', 'p', '-',  0,  //0x48 - 0x4F
    0,  0 ,'\'',  0 , '[', '=',  0 ,  0,  //0x50 - 0x57
    0,  0 ,'\n', ']',  0 ,'\\',  0 ,  0,  //0x58 - 0x5F
    0,  0 ,  0 ,  0 ,  0 ,  0 ,  0 ,  0,  //0x60 - 0x67
    0,  0 ,  0 ,  0 ,  0 ,  0 ,  0 ,  0,  //0x68 - 0x6F
    0,  0 ,  0 ,  0 ,  0 ,  0 ,  0 ,  0,  //0x70 - 0x77
    0,  0 ,  0 ,  0 ,  0 ,  0 ,  0 ,  0,  //0x78 - 0x7F
};

const char scanCode_to_shift_ascii[128] = {
    0,  0 ,  0 ,  0 ,  0 ,  0 ,  0 ,  0,  //0x00 - 0x07
    0,  0 ,  0 ,  0 ,  0 ,'\t', '~',  0,  //0x08 - 0x0F
    0,  0 ,  0 ,  0 ,  0 , 'Q', '!',  0,  //0x10 - 0x17
    0,  0 , 'Z', 'S', 'A', 'W', '@',  0,  //0x18 - 0x1F
    0, 'C', 'X', 'D', 'E', '$', '#',  0,  //0x20 - 0x27
    0, ' ', 'V', 'F', 'T', 'R', '%',  0,  //0x28 - 0x2F
    0, 'N', 'B', 'H', 'G', 'Y', '^',  0,  //0x30 - 0x37
    0,  0 , 'M', 'J', 'U', '&', '*',  0,  //0x38 - 0x3F
    0, '<', 'K', 'I', 'O', ')', '(',  0,  //0x40 - 0x47
    0, '>', '?', 'L', ':', 'P', '_',  0,  //0x48 - 0x4F
    0,  0 , '"',  0 , '{', '+',  0 ,  0,  //0x50 - 0x57
    0,  0 ,'\n', '}',  0 , '|',  0 ,  0,  //0x58 - 0x5F
    0,  0 ,  0 ,  0 ,  0 ,  0 ,  0 ,  0,  //0x60 - 0x67
    0,  0 ,  0 ,  0 ,  0 ,  0 ,  0 ,  0,  //0x68 - 0x6F
    0,  0 ,  0 ,  0 ,  0 ,  0 ,  0 ,  0,  //0x70 - 0x77
    0,  0 ,  0 ,  0 ,  0 ,  0 ,  0 ,  0,  //0x78 - 0x7F
};

bool isKeyUp;
bool isShift;
bool isCapsLock;

int input[8];
int clockState;
int dataState;
int bitIndex;

void resetInput() {
  for (int i = 0; i < 8; i += 1)
    input[i] = 0;

  clockState = HIGH;
  dataState  = HIGH;
  bitIndex   = INVALID_BIT;
}

int parseInputByte() {
  return input[7] *   1 +
         input[6] *   2 +
         input[5] *   4 +
         input[4] *   8 +
         input[3] *  16 +
         input[2] *  32 +
         input[1] *  64 +
         input[0] * 128;
}

void manageInput() {
  const int scanCode = parseInputByte();

  if (scanCode == KEY_UP) {
    isKeyUp = true;
    return;
  }

  if (scanCode == SHIFT) {
    isShift = !isKeyUp;
    isKeyUp = false;
    return;
  }

  if (scanCode == CAPS_LOCK) {
    if (isKeyUp)
      isCapsLock = !isCapsLock;
    isKeyUp = false;
    return;
  }

  if (!isKeyUp) return;
  isKeyUp = false;

  if (scanCode == ESCAPE) {
    Serial.write(0x1B);  // ESC
    return;
  }

  if (scanCode == BACKSPACE) {
    Serial.write(0x08);
    return;
  }

  if (scanCode < 128) {
    char ascii = isShift
                  ? scanCode_to_shift_ascii[scanCode]
                  : scanCode_to_ascii[scanCode];

    if (!ascii) return;

    // Caps Lock makes the letters uppercase
    if (isCapsLock && ascii >= 0x61 && ascii <= 0x7a)
      ascii -= 32;

    Serial.write(ascii);
  }
}

void setup() {
  pinMode(CLOCK, INPUT);
  pinMode(DATA,  INPUT);

  Serial.begin(9600);
  while (!Serial){;} // Wait for serial port to connect. Needed for native USB port only

  resetInput();

  isShift    = false;
  isKeyUp    = false;
  isCapsLock = false;
}

void probeInput() {
  const int clock = digitalRead(CLOCK);

  if (clock == clockState) return; // No changes
  clockState = clock;
  if (clockState == HIGH) {
    if (bitIndex == STOP_BIT) {
      // Stop bit clock is off. Ready to parse the input.
      manageInput();
      resetInput();
    }
    return; // We have data on clock == LOW only
  }

  bitIndex += 1;
  const int data = digitalRead(DATA);

  // Start bit check
  if (bitIndex == START_BIT ) {
    if (data == HIGH) {
      Serial.println("Start bit error");
      resetInput();
      isKeyUp = false;
    }
    return; // Skip the start bit
  }

  // Parity check
  if (bitIndex == PARITY_BIT) {
    int sum = data;
    for (int i = 0; i < 8; i += 1)
      sum += input[i];
    if (sum % 2 == 0) {
      Serial.println("Parity error");
      resetInput();
      isKeyUp = false;
    }
    return; // Skip the parity bit
  }

  // All bits received
  if (bitIndex == STOP_BIT) return;

  // Collect the bit. LSB first
  input[8 - bitIndex] = data;
}

void loop() {
  probeInput();
}
