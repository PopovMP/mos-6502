import { Assembler } from "../../js/assembler.js";
import { DataSheet } from "../../js/data-sheet.js";
import { Cpu }       from "../../js/cpu.js";
import { Utils }     from "../../js/utils.js";
import { Screen }    from "../../apple-1/js/screen.mjs";
import {Rom}         from "./rom.js";

// ACIA register addresses
const ACIA_DATA   = 0xD000 // Data register
const ACIA_STATUS = 0xD001 // Status register
const ACIA_CMD    = 0xD002 // Command register
const ACIA_CTRL   = 0xD003 // Control register

// 6521 registers
let dsp   = 0;
let kbd   = 0x80; // Bit 7 is 1
let dspCR = 0;

let scale = 3;
let loops = 0;

let debugMode = true;
let lastPC    = 0;

// noinspection SpellCheckingInspection
const charset   = " !\"#$%&'()*+,-./0123456789:;<=>?\r@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_";
const canvasElm = /** @type {HTMLCanvasElement} */ (document.getElementById("screen"));
const screen    = new Screen(canvasElm, scale);
const memory    = new Uint8Array(0xFFFF + 1);
const assembler = new Assembler();
const dataSheet = new DataSheet();
const cpu       = new Cpu(load, store);
const kbdBuffer = [];

// Rom
for (let i = 0; i < Rom.data.length; i++) {
    memory[Rom.start + i] = Rom.data[i];
}

window.addEventListener("keydown", keydown);

export function start() {
    cpu.reset();
    setTimeout(run, 0);
}

/**
 *
 * @param {number} addr
 * @param {boolean} [sync] - Synchronize with Op Code
 * @returns {number}
 */
function load(addr, sync=false) {
    switch (addr) {
        case ACIA_STATUS:
            return kbdBuffer.length > 0 ? 0x08 : 0x00; // Bit 3 is 1 if data is available
        case ACIA_DATA:
            return kbdBuffer.length > 0 ? kbdBuffer.shift() : 0x00;
    }

    if (sync) {
        lastPC = addr;
    }

    if (debugMode && sync && lastPC >= 0x0800 && lastPC < 0xE000) {
        console.log(getInstructionDump());
    }

    return memory[addr];
}

/**
 * Store data to an address in memory or send it to IO.
 *
 * @param {number} addr
 * @param {number} data
 */
function store(addr, data) {
    switch (addr) {
        case ACIA_STATUS:
            return; // Soft-reset, no action needed
        case ACIA_CTRL:
            return; // No action needed
        case ACIA_CMD:
            return; // No action needed
        case ACIA_DATA:
            dspCR = data;
            print();
            return;
    }

    // Protect the ROM
    if (addr >= 0xE000) {
        console.error(`Attempt to write in ROM: ${Utils.wordToHex(addr)}: ${Utils.byteToHex(data)}`);
        dump();
        return;
    }

    memory[addr] = data;
}

/**
 * Print a WazMon CharCode.
 * @return {void}
 */
function print() {
    let charCode = dspCR;
    if (charCode >= 0x60) charCode -= 0x20; // Make uppercase
    const char = String.fromCharCode(charCode);
    if (charset.includes(char)) {
        screen.print(char);
    }
}

function run() {
    cpu.step();

    loops += 1;
    if (loops > 100) {
        loops = 0;
    }

    if (loops > 0) {
        run();
    } else {
        setTimeout(run, 0);
    }
}

function keydown (event) {
    // Clear the screen Ctrl+L
    if (event.ctrlKey && event.key === "l") {
        event.preventDefault();
        screen.clear();
        return;
    }

    // Reset CPU Ctrl+R
    if (event.ctrlKey && event.key === "r") {
        event.preventDefault();
        dspCR = 0x00; // Reset 6521
        dsp   = 0x00;
        kbd   = 0x80; // Bit 7 is 1
        cpu.reset();
        return;
    }

    // Debug mode Ctrl+D
    if (event.ctrlKey && event.key === "D") {
        event.preventDefault();
        debugMode = !debugMode;
        console.log("Debug " + (debugMode ? "enabled" : "disabled"));
        return;
    }

    // Zoom in Ctrl+"+"
    if (event.ctrlKey && (event.key === "+" || event.key === "=")) {
        event.preventDefault();
        scale += 1;
        screen.setScale(scale);
        return;
    }

    // Zoom out Ctrl+"-"
    if (event.ctrlKey && event.key === "-") {
        event.preventDefault();
        if (scale === 1) return;
        scale -= 1;
        screen.setScale(scale);
        return;
    }

    // Zoom reset Ctrl+"0"
    if (event.ctrlKey && event.key === "0") {
        event.preventDefault();
        if (scale === 3) return;
        scale = 3;
        screen.setScale(scale);
        return;
    }

    if (event.key === "Backspace" ||
        event.key === "ArrowLeft") {
        event.preventDefault();
        kbdBuffer.push(0xDF);
        return;
    }

    if (event.key === "Escape") {
        event.preventDefault();
        kbdBuffer.push(0x9B);
        return;
    }

    // Ctrl+D - Terminate AUTO mode in Basic
    if (event.ctrlKey && event.key === "d") {
        event.preventDefault();
        kbdBuffer.push(0x04);
        return;
    }
    const character = event.key === "Enter" ? "\r" : event.key.toUpperCase();
    if (charset.includes(character)) {
        kbdBuffer.push(character.charCodeAt(0));
    }
}

function dump() {
    const output = `${getCpuDump()}

${getInstructionDump()}

$24 XAML    = ${Utils.byteToHex(memory[0x24])}   ; Last "opened" location Low
$25 XAMH    = ${Utils.byteToHex(memory[0x25])}   ; Last "opened" location High
$26 STL     = ${Utils.byteToHex(memory[0x26])}   ; Store address Low
$27 STH     = ${Utils.byteToHex(memory[0x27])}   ; Store address High
$28 L       = ${Utils.byteToHex(memory[0x28])}   ; Hex value parsing Low
$29 H       = ${Utils.byteToHex(memory[0x29])}   ; Hex value parsing High
$2A YSAV    = ${Utils.byteToHex(memory[0x2A])}   ; Used to see if hex value is given
$2B MODE    = ${Utils.byteToHex(memory[0x2B])}   ; $00=XAM, $7F=STOR, $AE=BLOCK XAM
`;

    console.log(output);
}

function getCpuDump() {
    const flagsText = `${+cpu.N} ${+cpu.V} 1 1 ${+cpu.D} ${+cpu.I} ${+cpu.Z} ${+cpu.C}`;

    return "" +
        "R  Hex  Dec   +/-    R   Hex   N V - B D I Z C\n" +
        "-----------------    -------   ---------------\n" +
        `A   ${dumpRegister(cpu.A)}    P    ${Utils.byteToHex(cpu.P)}   ${flagsText}\n` +
        `X   ${dumpRegister(cpu.X)}    S    ${Utils.byteToHex(cpu.S)}\n` +
        `Y   ${dumpRegister(cpu.Y)}    PC ${Utils.wordToHex(cpu.PC)}`;
}

function dumpRegister(val) {
    return "" +
        Utils.byteToHex(val)            + "  " + // Hex
        val.toString().padStart(3, " ") + "  " + // Unsigned dec
        Utils.byteToSInt(val).padStart(4, " ");  // Signed dec
}

function getInstructionDump() {
    const pc     = lastPC;
    const opc    = memory[pc];
    const bytes  = dataSheet.opCodeBytes[opc];
    const code   = Array.from(memory.slice(pc, pc + bytes));
    const tokens = assembler.disassemble(code, pc);
    const token  = tokens[0];

    return `$${token.address}   ${token.code.join(" ").padEnd(8, " ")}   ${token.text}  ; ${token.description}`;
}
