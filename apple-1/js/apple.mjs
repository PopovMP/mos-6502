import {Assembler} from "../../js/assembler.js";
import {DataSheet} from "../../js/data-sheet.js";
import {Cpu}       from "../../js/cpu.js";
import {Utils}     from "../../js/utils.js";
import {Screen}    from "./screen.mjs";

const KBD     = 0xD010 // PIA.A keyboard input
const KBD_CR  = 0xD011 // PIA.A keyboard control register
const DSP     = 0xD012 // PIA.B display output register
const DSP_CR  = 0xD013 // PIA.B display control register

let scale = 3;
let loops = 0;
let dsp   = 0;
let kbd   = 0
let dspCR = 0;
let kbdCR = 0;

// noinspection SpellCheckingInspection
const charset   = " !\"#$%&'()*+,-./0123456789:;<=>?\r@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_";
const canvasElm = document.getElementById("screen");
const screen    = new Screen(canvasElm, scale);
const memory    = new Uint8Array(0xFFFF + 1);
const assembler = new Assembler();
const dataSheet = new DataSheet();
const cpu       = new Cpu(load, store);
const kbdBuffer = [];

window.addEventListener("keydown", keydown);

export function loadWazMon() {
    getRequest("./wazmon.asm", wazMon_ready);
}

function load(addr) {
    switch (addr) {
        case KBD:
            if (kbdBuffer.length === 0)
                throw new Error("Keyboard buffer underflow");
            return kbdBuffer.shift();
        case KBD_CR:
            const kbdReg = kbdCR;
            kbdCR = kbdCR & 0b0111_1111;
            return kbdReg;
        case DSP:
            return dsp;
        case DSP_CR:
            return dspCR;
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
        case KBD:
            kbd = data;
            return;
        case KBD_CR:
            kbdCR = data & 0b0011_1111;
            return;
        case DSP:
            if ((dspCR & 0b0000_0100) === 0) return; // DDR
            dsp = data;
            print();
            dsp = dsp & 0b0111_1111;
            return;
        case DSP_CR:
            dspCR = data & 0b0011_1111;
            return;
    }

    // Protect the WazMon code
    if (addr >= 0xFF00) {
        console.error(`Attempt to write in WazMon: ${Utils.wordToHex(addr)}: ${Utils.byteToHex(data)}`);
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
    let charCode = dsp & 0b0111_1111;
    if (charCode >= 0x60 && charCode <= 0x7F)
        charCode -= 0x1F;
    const char = String.fromCharCode(charCode);
    if (charset.includes(char))
        screen.print(char);
}

function wazMon_ready(sourceCode) {
    assembler.load(sourceCode, memory);
    cpu.reset();
    setTimeout(run, 0);
}

function run() {
    cpu.step();

    loops += 1;
    if (loops > 100)
        loops = 0;

    if (loops > 0)
        run();
    else
        setTimeout(run, 0);
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
        cpu.reset();
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

    if (event.key === "Backspace") {
        event.preventDefault();
        kbdCR = kbdCR | 0b1000_0000;
        kbdBuffer.push(0xDF);
        return;
    }

    if (event.key === "Escape") {
        event.preventDefault();
        kbdCR = kbdCR | 0b1000_0000;
        kbdBuffer.push(0x9B);
        return;
    }

    const character = event.key === "Enter" ? "\r" : event.key.toUpperCase();
    if (charset.includes(character)) {
        kbdCR = kbdCR | 0b1000_0000;
        kbdBuffer.push(character.charCodeAt(0) | 0b1000_0000);
    }
}

function getRequest(url, callback) {
    const xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = readyStateChange;
    xmlHttp.open("GET", url, true);
    xmlHttp.send();
    function readyStateChange() {
        if (xmlHttp.readyState === 4)
            callback(xmlHttp.status === 200 ? xmlHttp.responseText : "");
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
    const getRegText = (val) =>
        `${Utils.byteToHex(val)}  ${val.toString().padStart(3, " ")}  ${Utils.byteToSInt(val).padStart(4, " ")}`;

    const flagsText = `${+cpu.N} ${+cpu.V} 1 ${+cpu.B} ${+cpu.D} ${+cpu.I} ${+cpu.Z} ${+cpu.C}`;

    return "" +
        "R  Hex  Dec   +/-    R   Hex   N V - B D I Z C\n" +
        "-----------------    -------   ---------------\n" +
        `A   ${getRegText(cpu.A)}    P    ${Utils.byteToHex(cpu.P)}   ${flagsText}\n` +
        `X   ${getRegText(cpu.X)}    S    ${Utils.byteToHex(cpu.S)}\n` +
        `Y   ${getRegText(cpu.Y)}    PC ${Utils.wordToHex(cpu.PC)}`;
}

function getInstructionDump() {
    const pc     = cpu.currentPC;
    const opc    = memory[pc];
    const bytes  = dataSheet.opCodeBytes[opc];
    const code   = Array.from(memory.slice(pc, pc + bytes));
    const tokens = assembler.disassemble(code, pc);
    const token  = tokens[0];

    return `$${token.address}   ${token.code.join(" ").padEnd(8, " ")}   ${token.text}  ; ${token.description}`;
}
