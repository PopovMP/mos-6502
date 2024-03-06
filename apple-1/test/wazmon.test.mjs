import * as fs from "node:fs";

import {strictEqual}  from "node:assert";
import {describe, it} from "node:test";

import {Assembler} from "../../js/assembler.js";
import {Cpu}       from "../../js/cpu.js";

import {fileURLToPath} from "node:url";
import {dirname} from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sourcePath =  (__dirname).endsWith('test') ? __dirname + '/../wazmon.asm' :  __dirname + '/test/wazmon.asm'
const sourceCode = fs.readFileSync( sourcePath, 'utf8')

const memory    = new Uint8Array(0xFFFF + 1);
const assembler = new Assembler();
assembler.load(sourceCode, memory);

const KBD     = 0xD010 // PIA.A keyboard input
const KBD_CR  = 0xD011 // PIA.A keyboard control register
const DSP     = 0xD012 // PIA.B display output register
const DSP_CR  = 0xD013 // PIA.B display control register

function load(addr) {
    switch (addr) {
        case KBD   : return 0x00;
        case KBD_CR: return 0x00;
        case DSP   : return 0x00;
        case DSP_CR: return 0x00;
    }

    return memory[addr];
}

/**
 * @param {number} addr
 * @param {number} data
 */
function store(addr, data) {
    switch (addr) {
        case KBD   : logHex("KBD   ", data, false); break;
        case KBD_CR: logHex("KBD_CR", data, false); break;
        case DSP   : logHex("DSP   ", data, true ); break;
        case DSP_CR: logHex("DSP_CR", data, false); break;
    }

    memory[addr] = data;
}

/**
 * @param {string } label
 * @param {number } data
 * @param {boolean} showChar
 */
function logHex(label, data, showChar) {
    let char = showChar ? String.fromCharCode(data & 0x7F) : ""
    console.log(`${label} ${data.toString(16).toUpperCase()} ${data.toString(2).padStart(8, "0")} ${char}`);
}

const cpu = new Cpu(load, store);
cpu.reset();

/*
while (memory[cpu.PC] !== 0x00)
    cpu.step();
*/
