/*
    // From: https://github.com/whscullin/apple1js/blob/main/tapes/lunar_lander.js

    import {Rom} from "../roms/lunar-lander.mjs";
    for (let i = 0; i < Rom.data.length; i += 1)
        memory[Rom.start + i] = Rom.data[i];
*/

export class Rom {
    static start = 0x0300;

    static data = [
        0x20, 0x00, 0x04, 0x20, 0x00, 0x04, 0x20, 0x71,
        0x06, 0x20, 0x00, 0x04, 0xA9, 0x00, 0x85, 0x00,
        0x85, 0x01, 0x85, 0x05, 0x85, 0x08, 0x85, 0x09,
        0xA9, 0x05, 0x85, 0x02, 0xA9, 0x50, 0x85, 0x04,
        0xA9, 0x20, 0x85, 0x06, 0xA9, 0x01, 0x85, 0x07,
        0x20, 0x00, 0x04, 0x20, 0x72, 0x07, 0x20, 0x00,
        0x04, 0x20, 0x12, 0x06, 0x24, 0x08, 0x10, 0x10,
        0x24, 0x05, 0x30, 0x12, 0x20, 0x00, 0x04, 0x20,
        0x31, 0x08, 0xA9, 0x00, 0x85, 0x0A, 0xF0, 0x06,
        0x20, 0x00, 0x05, 0x20, 0x2E, 0x05, 0x20, 0x58,
        0x05, 0xA5, 0x04, 0xD0, 0x04, 0xA9, 0x00, 0x85,
        0x09, 0x20, 0xB7, 0x05, 0x20, 0xF7, 0x05, 0xA5,
        0x02, 0xF0, 0x03, 0x4C, 0x2E, 0x03, 0xA5, 0x01,
        0xF0, 0x03, 0x4C, 0x2E, 0x03, 0x20, 0x00, 0x04,
        0x20, 0x35, 0x04, 0x20, 0x00, 0x04, 0x20, 0x12,
        0x06, 0x20, 0x00, 0x04, 0x20, 0x00, 0x04, 0xA5,
        0x04, 0xF0, 0x14, 0xC9, 0x03, 0x90, 0x10, 0xC9,
        0x07, 0x90, 0x06, 0x20, 0x06, 0x09, 0x4C, 0x9A,
        0x03, 0x20, 0xA9, 0x08, 0x4C, 0x9A, 0x03, 0x20,
        0x71, 0x08, 0x20, 0x00, 0x04, 0x20, 0x00, 0x04,
        0x20, 0x43, 0x09, 0x20, 0x15, 0x04, 0xC9, 0x59,
        0xF0, 0x0C, 0x20, 0x00, 0x04, 0x20, 0x00, 0x04,
        0x20, 0x9A, 0x09, 0x4C, 0x1F, 0xFF, 0x4C, 0x09,
        0x03, 0xA9, 0x0D, 0x20, 0xEF, 0xFF, 0xA9, 0x0A,
        0x20, 0xEF, 0xFF, 0x60, 0xA9, 0x20, 0x20, 0xEF,
        0xFF, 0x60, 0xAD, 0xAD, 0x12, 0xD0, 0x10, 0xFB,
        0xAD, 0x10, 0xD0, 0x29, 0x7F, 0x20, 0xEF, 0xFF,
        0x60, 0x49, 0x30, 0xC9, 0x0A, 0x10, 0x06, 0x4C,
        0xE8, 0x03, 0xFA, 0x90, 0x03, 0x29, 0x0F, 0x60,
        0xA9, 0xFF, 0x60, 0x00, 0x10, 0x38, 0x88, 0x03,
        0x00, 0x00, 0x08, 0x01, 0x80, 0x08, 0x20, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x1C, 0xC4, 0x00,
        0x48, 0xA9, 0x0D, 0x20, 0xEF, 0xFF, 0xA9, 0x0A,
        0x20, 0xEF, 0xFF, 0x68, 0x60, 0x48, 0xA9, 0x20,
        0x20, 0xEF, 0xFF, 0x68, 0x60, 0xAD, 0x11, 0xD0,
        0x10, 0xFB, 0xAD, 0x10, 0xD0, 0x29, 0x7F, 0x20,
        0xEF, 0xFF, 0x60, 0x49, 0x30, 0xC9, 0x0A, 0x30,
        0x06, 0x4C, 0x32, 0x04, 0xFA, 0x90, 0x03, 0x29,
        0x0F, 0x60, 0xA9, 0x99, 0x60, 0x20, 0x00, 0x04,
        0x20, 0x53, 0x08, 0x20, 0x00, 0x04, 0x60, 0xA5,
        0x06, 0x85, 0x0A, 0xA9, 0xFF, 0x85, 0x08, 0x60,
        0x05, 0x00, 0xAA, 0xAE, 0x01, 0x00, 0x00, 0x00,
        0xA9, 0x8D, 0xA2, 0x18, 0x20, 0xEF, 0xFF, 0xCA,
        0xD0, 0xFA, 0x60, 0x00, 0x60, 0xFF, 0xFF, 0xFF,
        0x97, 0x90, 0xCD, 0x2B, 0xFF, 0xFF, 0xFF, 0xFF,
        0x8D, 0xD2, 0xE6, 0xD3, 0xFF, 0xFF, 0xFF, 0xFF,
        0xA5, 0x4C, 0x85, 0x4D, 0xA9, 0x00, 0x85, 0x4E,
        0x85, 0x4F, 0xCE, 0x4F, 0x00, 0xD0, 0xFB, 0xCE,
        0x4E, 0x00, 0xD0, 0xF6, 0xCE, 0x4D, 0x00, 0xD0,
        0xF1, 0x60, 0x78, 0xB7, 0xFF, 0xFF, 0xFF, 0xFF,
        0x4B, 0x50, 0xFE, 0xFF, 0xFF, 0xFF, 0xF7, 0xFF,
        0x36, 0xBA, 0xCF, 0xFB, 0xFF, 0xFF, 0x7F, 0xFF,
        0xB8, 0x11, 0x8A, 0xA7, 0xFF, 0xFF, 0xFF, 0xFF,
        0xB0, 0x56, 0x3E, 0xF7, 0xFF, 0xFF, 0xF3, 0xFF,
        0xB5, 0x55, 0x35, 0x72, 0xFF, 0xFF, 0xFF, 0xFF,
        0xA3, 0x36, 0x8D, 0x27, 0xFF, 0xFF, 0xF7, 0xFD,
        0x57, 0x6E, 0xB2, 0xA7, 0xFF, 0xFF, 0xF7, 0xFF,
        0x08, 0x2C, 0x9A, 0x13, 0xFF, 0xFF, 0xFF, 0xFF,
        0xC5, 0xB3, 0x3E, 0xBD, 0xFF, 0xFF, 0xFF, 0xFF,
        0xBD, 0xF1, 0xCF, 0x6B, 0xFF, 0xFF, 0xFF, 0xFF,
        0x00, 0x56, 0x45, 0x4D, 0x45, 0x4E, 0x54, 0x0D,
        0x0A, 0x0A, 0x4D, 0x41, 0x58, 0x49, 0x4D, 0x55,
        0x4D, 0x98, 0x33, 0x37, 0xFF, 0xFF, 0xFF, 0xFF,
        0xF8, 0xF4, 0xFE, 0xAD, 0xFF, 0xFF, 0xBE, 0xFF,
        0x20, 0x15, 0x04, 0x20, 0x23, 0x04, 0x85, 0x0B,
        0x20, 0x15, 0x04, 0xC9, 0x0D, 0xF0, 0x1A, 0x20,
        0x23, 0x04, 0x85, 0x0C, 0xA5, 0x0B, 0x0A, 0x0A,
        0x0A, 0x0A, 0x05, 0x0C, 0xC9, 0x31, 0xB0, 0x03,
        0x85, 0x0A, 0x60, 0x20, 0x67, 0x09, 0x4C, 0x00,
        0x05, 0xA5, 0x0B, 0x4C, 0x1C, 0x05, 0xF8, 0x38,
        0xA5, 0x06, 0xE5, 0x0A, 0x85, 0x0B, 0xA5, 0x07,
        0xE9, 0x00, 0x85, 0x0C, 0xA5, 0x07, 0xC9, 0x01,
        0xF0, 0x0C, 0xA5, 0x06, 0xC5, 0x0A, 0xF0, 0x02,
        0xB0, 0x04, 0x20, 0x3F, 0x04, 0xEA, 0xA5, 0x0B,
        0x85, 0x06, 0xA5, 0x0C, 0x85, 0x07, 0x60, 0x40,
        0xF8, 0x38, 0x24, 0x09, 0x10, 0x18, 0xA5, 0x04,
        0xE9, 0x05, 0x85, 0x0B, 0xC5, 0x04, 0x90, 0x14,
        0x38, 0xA9, 0x00, 0xE5, 0x0B, 0x85, 0x04, 0xA9,
        0x00, 0x85, 0x09, 0x4C, 0x7E, 0x05, 0xF8, 0x18,
        0xA5, 0x04, 0x69, 0x05, 0x85, 0x04, 0x24, 0x09,
        0x10, 0x09, 0x18, 0xA5, 0x04, 0x65, 0x0A, 0x85,
        0x04, 0xD8, 0x60, 0x38, 0xA5, 0x04, 0xE5, 0x0A,
        0x85, 0x0B, 0xA5, 0x0A, 0xC9, 0x00, 0xF0, 0x19,
        0xA5, 0x0B, 0xC5, 0x04, 0xF0, 0x02, 0x90, 0x0D,
        0x38, 0xA9, 0x00, 0xE5, 0x0B, 0x85, 0x04, 0xA9,
        0xFF, 0x85, 0x09, 0xD8, 0x60, 0x85, 0x04, 0xD8,
        0x60, 0xA5, 0x0B, 0x85, 0x04, 0xD8, 0x60, 0xF8,
        0x38, 0x24, 0x09, 0x30, 0x25, 0xA5, 0x01, 0xE5,
        0x04, 0x85, 0x0B, 0xA5, 0x02, 0xF0, 0x0B, 0xE9,
        0x00, 0x85, 0x02, 0x4C, 0xF1, 0x05, 0xA5, 0x0B,
        0xF0, 0x06, 0xA5, 0x01, 0xC5, 0x0B, 0xB0, 0x04,
        0xA9, 0x00, 0xF0, 0x02, 0xA5, 0x0B, 0x85, 0x01,
        0xD8, 0x60, 0x18, 0xA5, 0x01, 0x65, 0x04, 0x85,
        0x01, 0xA5, 0x02, 0x69, 0x00, 0x85, 0x02, 0xD8,
        0x60, 0xA5, 0x0B, 0x85, 0x01, 0xD8, 0x60, 0xF8,
        0x18, 0xA5, 0x00, 0x69, 0x01, 0x85, 0x00, 0xD8,
        0x60, 0xA0, 0x00, 0xB9, 0xAD, 0x09, 0x20, 0xEF,
        0xFF, 0xC0, 0x0A, 0xF0, 0x04, 0xC8, 0x4C, 0x03,
        0x06, 0x60, 0x20, 0x0D, 0x04, 0x20, 0x0D, 0x04,
        0xA5, 0x00, 0x20, 0xDC, 0xFF, 0xA0, 0x04, 0x20,
        0x0D, 0x04, 0x88, 0xD0, 0xFA, 0xA5, 0x02, 0x20,
        0xDC, 0xFF, 0xA5, 0x01, 0x20, 0xDC, 0xFF, 0xA0,
        0x05, 0x20, 0x0D, 0x04, 0x88, 0xD0, 0xFA, 0x24,
        0x09, 0x30, 0x07, 0xA9, 0x2D, 0x20, 0xEF, 0xFF,
        0xD0, 0x05, 0xA9, 0x2B, 0x20, 0xEF, 0xFF, 0xA5,
        0x04, 0x20, 0xDC, 0xFF, 0x24, 0x08, 0x10, 0x01,
        0x60, 0xA0, 0x06, 0x20, 0x0D, 0x04, 0x88, 0xD0,
        0xFA, 0xA5, 0x07, 0x20, 0xDC, 0xFF, 0xA5, 0x06,
        0x20, 0xDC, 0xFF, 0xA0, 0x05, 0x20, 0x0D, 0x04,
        0x88, 0xD0, 0xFA, 0xA9, 0x3F, 0x20, 0xEF, 0xFF,
        0x60, 0xA9, 0x84, 0x8D, 0x04, 0x06, 0xA9, 0x06,
        0x8D, 0x05, 0x06, 0xA9, 0xED, 0x8D, 0x0A, 0x06,
        0x20, 0x01, 0x06, 0x60, 0x4C, 0x55, 0x4E, 0x41,
        0x52, 0x20, 0x4C, 0x41, 0x4E, 0x44, 0x45, 0x52,
        0x0D, 0x0D, 0x0A, 0x4D, 0x49, 0x4E, 0x55, 0x53,
        0x20, 0x56, 0x45, 0x4C, 0x4F, 0x43, 0x49, 0x54,
        0x59, 0x20, 0x28, 0x2D, 0x29, 0x20, 0x4D, 0x45,
        0x41, 0x4E, 0x53, 0x20, 0x44, 0x4F, 0x57, 0x4E,
        0x57, 0x41, 0x52, 0x44, 0x0D, 0x4D, 0x4F, 0x56,
        0x45, 0x4D, 0x45, 0x4E, 0x54, 0x0D, 0x0D, 0x50,
        0x4C, 0x55, 0x53, 0x20, 0x20, 0x56, 0x45, 0x4C,
        0x4F, 0x43, 0x49, 0x54, 0x59, 0x20, 0x28, 0x2B,
        0x29, 0x20, 0x4D, 0x45, 0x41, 0x4E, 0x53, 0x20,
        0x55, 0x50, 0x57, 0x41, 0x52, 0x44, 0x20, 0x4D,
        0x4F, 0x56, 0x45, 0x4D, 0x45, 0x4E, 0x54, 0x0D,
        0x0A, 0x0A, 0x4D, 0x41, 0x58, 0x49, 0x4D, 0x55,
        0x4D, 0x20, 0x42, 0x55, 0x52, 0x4E, 0x20, 0x49,
        0x53, 0x20, 0x33, 0x30, 0x20, 0x55, 0x4E, 0x49,
        0x54, 0x53, 0x2F, 0x53, 0x45, 0x43, 0x2E, 0x20,
        0x20, 0x28, 0x42, 0x55, 0x52, 0x4E, 0x20, 0x4D,
        0x41, 0x59, 0x20, 0x42, 0x45, 0x20, 0x41, 0x4E,
        0x59, 0x20, 0x49, 0x4E, 0x54, 0x45, 0x47, 0x45,
        0x52, 0x20, 0x46, 0x52, 0x4F, 0x4D, 0x20, 0x30,
        0x20, 0x54, 0x4F, 0x20, 0x33, 0x30, 0x29, 0x0D,
        0x0D, 0x41, 0x20, 0x42, 0x55, 0x52, 0x4E, 0x20,
        0x4F, 0x46, 0x20, 0x35, 0x20, 0x55, 0x4E, 0x49,
        0x54, 0x53, 0x2F, 0x53, 0x45, 0x43, 0x20, 0x49,
        0x53, 0x20, 0x52, 0x45, 0x51, 0x55, 0x49, 0x52,
        0x45, 0x44, 0x20, 0x54, 0x4F, 0x0D, 0x43, 0x41,
        0x4E, 0x43, 0x45, 0x4C, 0x20, 0x47, 0x52, 0x41,
        0x56, 0x49, 0x54, 0x59, 0x2E, 0x0D, 0x0D, 0x0A,
        0x47, 0x4F, 0x4F, 0x44, 0x20, 0x4C, 0x55, 0x43,
        0x4B, 0x21, 0xA9, 0x85, 0x8D, 0x04, 0x06, 0xA9,
        0x07, 0x8D, 0x05, 0x06, 0xA9, 0x80, 0x8D, 0x0A,
        0x06, 0x20, 0x01, 0x06, 0x60, 0x43, 0x4F, 0x4E,
        0x54, 0x52, 0x4F, 0x4C, 0x20, 0x54, 0x4F, 0x20,
        0x4C, 0x55, 0x4E, 0x41, 0x52, 0x20, 0x4D, 0x4F,
        0x44, 0x55, 0x4C, 0x45, 0x3A, 0x0D, 0x0A, 0x42,
        0x45, 0x47, 0x49, 0x4E, 0x20, 0x4C, 0x41, 0x4E,
        0x44, 0x49, 0x4E, 0x47, 0x20, 0x50, 0x52, 0x4F,
        0x43, 0x45, 0x44, 0x55, 0x52, 0x45, 0x0D, 0x0D,
        0x0D, 0x0A, 0x20, 0x54, 0x49, 0x4D, 0x45, 0x20,
        0x20, 0x48, 0x45, 0x49, 0x47, 0x48, 0x54, 0x20,
        0x56, 0x45, 0x4C, 0x4F, 0x43, 0x49, 0x54, 0x59,
        0x20, 0x46, 0x55, 0x45, 0x4C, 0x20, 0x55, 0x4E,
        0x49, 0x54, 0x53, 0x20, 0x20, 0x42, 0x55, 0x52,
        0x4E, 0x0D, 0x0A, 0x28, 0x53, 0x45, 0x43, 0x53,
        0x29, 0x20, 0x28, 0x46, 0x45, 0x45, 0x54, 0x29,
        0x20, 0x28, 0x46, 0x54, 0x2F, 0x53, 0x45, 0x43,
        0x29, 0x20, 0x20, 0x52, 0x45, 0x4D, 0x41, 0x49,
        0x4E, 0x49, 0x4E, 0x47, 0x0D, 0x0A, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x20, 0x28, 0x46, 0x45, 0x45,
        0x54, 0x29, 0x00, 0x00, 0x00, 0x00, 0x20, 0x20,
        0x28, 0x46, 0x54, 0x2F, 0x53, 0x45, 0x43, 0x29,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x20,
        0x52, 0x45, 0x4D, 0x41, 0x49, 0x4E, 0x49, 0x4E,
        0x47, 0xA9, 0x48, 0x8D, 0x04, 0x06, 0xA9, 0x08,
        0x8D, 0x05, 0x06, 0xA9, 0x0A, 0x8D, 0x0A, 0x06,
        0x20, 0x01, 0x06, 0xA9, 0xFF, 0x85, 0x05, 0x60,
        0x4F, 0x55, 0x54, 0x20, 0x4F, 0x46, 0x20, 0x46,
        0x55, 0x45, 0x4C, 0xA9, 0x66, 0x8D, 0x04, 0x06,
        0xA9, 0x08, 0x8D, 0x05, 0x06, 0xA9, 0x0A, 0x8D,
        0x0A, 0x06, 0x20, 0x01, 0x06, 0x60, 0x4F, 0x4E,
        0x20, 0x54, 0x48, 0x45, 0x20, 0x4D, 0x4F, 0x4F,
        0x4E, 0xA9, 0x84, 0x8D, 0x04, 0x06, 0xA9, 0x08,
        0x8D, 0x05, 0x06, 0xA9, 0x24, 0x8D, 0x0A, 0x06,
        0x20, 0x01, 0x06, 0x60, 0x50, 0x45, 0x52, 0x46,
        0x45, 0x43, 0x54, 0x20, 0x4C, 0x41, 0x4E, 0x44,
        0x49, 0x4E, 0x47, 0x21, 0x07, 0x07, 0x07, 0x07,
        0x0D, 0x0A, 0x43, 0x4F, 0x4E, 0x47, 0x52, 0x41,
        0x54, 0x55, 0x4C, 0x41, 0x54, 0x49, 0x4F, 0x4E,
        0x53, 0xA9, 0xBC, 0x8D, 0x04, 0x06, 0xA9, 0x08,
        0x8D, 0x05, 0x06, 0xA9, 0x49, 0x8D, 0x0A, 0x06,
        0x20, 0x01, 0x06, 0x60, 0x57, 0x45, 0x4C, 0x4C,
        0x2C, 0x20, 0x59, 0x4F, 0x55, 0x20, 0x47, 0x4F,
        0x54, 0x20, 0x44, 0x4F, 0x57, 0x4E, 0x20, 0x41,
        0x4C, 0x49, 0x56, 0x45, 0x2C, 0x20, 0x42, 0x55,
        0x54, 0x20, 0x44, 0x41, 0x4D, 0x41, 0x47, 0x45,
        0x20, 0x54, 0x4F, 0x20, 0x59, 0x4F, 0x55, 0x52,
        0x20, 0x43, 0x52, 0x41, 0x46, 0x54, 0x20, 0x0A,
        0x48, 0x41, 0x53, 0x20, 0x53, 0x54, 0x52, 0x41,
        0x4E, 0x44, 0x45, 0x44, 0x20, 0x59, 0x4F, 0x55,
        0x20, 0x48, 0x45, 0x52, 0x45, 0x21, 0xA9, 0x19,
        0x8D, 0x04, 0x06, 0xA9, 0x09, 0x8D, 0x05, 0x06,
        0xA9, 0x28, 0x8D, 0x0A, 0x06, 0x20, 0x01, 0x06,
        0x60, 0x59, 0x4F, 0x55, 0x20, 0x4A, 0x55, 0x53,
        0x54, 0x20, 0x43, 0x52, 0x45, 0x41, 0x4D, 0x45,
        0x44, 0x20, 0x41, 0x20, 0x32, 0x39, 0x20, 0x4D,
        0x45, 0x47, 0x41, 0x42, 0x55, 0x43, 0x4B, 0x20,
        0x4C, 0x41, 0x4E, 0x44, 0x45, 0x52, 0x21, 0x07,
        0x07, 0x07, 0x07, 0xA9, 0x56, 0x8D, 0x04, 0x06,
        0xA9, 0x09, 0x8D, 0x05, 0x06, 0xA9, 0x10, 0x8D,
        0x0A, 0x06, 0x20, 0x01, 0x06, 0x60, 0x54, 0x52,
        0x59, 0x20, 0x41, 0x47, 0x41, 0x49, 0x4E, 0x3F,
        0x20, 0x20, 0x28, 0x59, 0x2F, 0x4E, 0x29, 0x20,
        0x00, 0x04, 0xA9, 0x7D, 0x8D, 0x04, 0x06, 0xA9,
        0x09, 0x8D, 0x05, 0x06, 0xA9, 0x1C, 0x8D, 0x0A,
        0x06, 0x20, 0x01, 0x06, 0x60, 0x42, 0x55, 0x52,
        0x4E, 0x20, 0x4F, 0x55, 0x54, 0x20, 0x4F, 0x46,
        0x20, 0x52, 0x41, 0x4E, 0x47, 0x45, 0x2E, 0x20,
        0x20, 0x20, 0x20, 0x20, 0x42, 0x55, 0x52, 0x4E,
        0x20, 0x3F, 0xA9, 0xAD, 0x8D, 0x04, 0x06, 0xA9,
        0x09, 0x8D, 0x05, 0x06, 0xA9, 0x0A, 0x8D, 0x0A,
        0x06, 0x20, 0x01, 0x06, 0x60, 0x43, 0x4F, 0x4E,
        0x54, 0x52, 0x4F, 0x4C, 0x20, 0x4F, 0x55, 0x54,
        0xFF
    ];
}
