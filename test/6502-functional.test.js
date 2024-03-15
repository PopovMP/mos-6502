import {readFileSync} from "fs";
import {strictEqual}  from "node:assert";
import {describe, it} from "node:test";
import {fileURLToPath} from "node:url";
import {dirname} from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import {Cpu} from "../js/cpu.js";

const callStack = [];
const memory    = new Uint8Array(0xFFFF + 1);

function read(addr, sync) {
    if (sync) {
        callStack.push(addr);
        if (callStack.length > 10)
            callStack.shift();
    }

    return memory[addr];
}

function write(addr, data) {
    memory[addr] = data;
}



/**
 * Sets Intel Hex to Memory
 * @param {Uint8Array} mem
 * @param {string} hexContent
 */
function setIntelHex(mem, hexContent) {
    const hexLines = hexContent.split(/\r?\n/);
    for (const line of hexLines) {
        const bytes = parseInt(line.substring(1, 3), 16);
        if (bytes === 0) continue;
        const address = parseInt(line.substring(3, 7), 16);
        for (let i = 0; i < bytes; i += 1)
            mem[address + i] = parseInt(line.substring(9 + i * 2, 11 + i * 2), 16);
    }
}


describe("6502 functional test", () => {
    it("Passes All", () => {
        const cpu = new Cpu(read, write);

        const sourcePath =  (__dirname).endsWith('test')
            ? __dirname + '/6502_functional_test.hex'
            : __dirname + '/test/6502_functional_test.hex';

        const testHex = readFileSync(sourcePath, {encoding: "utf8"});
        setIntelHex(memory, testHex);
        cpu.PC = 0x0400;
        while (true) {
            cpu.step();
            const lastAddr =  callStack[callStack.length - 1];
            if (callStack.length >= 2 && lastAddr === callStack[callStack.length - 2]) {
                strictEqual(lastAddr, 0x34D8);
                break;
            }
        }
    })
});
