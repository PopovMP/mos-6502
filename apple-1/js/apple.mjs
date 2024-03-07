import {Assembler} from "../../js/assembler.js";
import {Cpu}       from "../../js/cpu.js";
import {Screen}    from "./screen.mjs";
import {Utils} from "../../js/utils.js";

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
    if (addr >= 0xFF00) return;

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
    const assembler = new Assembler();
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
