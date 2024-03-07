import * as fs from "node:fs";

import {Assembler} from "../../js/assembler.js";
import {Utils}     from "../../js/utils.js";

import {fileURLToPath} from "node:url";
import {dirname}       from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const sourceCode  = fs.readFileSync(__dirname + "/wazmon.asm", {encoding: "utf8"});
const binFilePath = __dirname + "/../bin/rom-8k.bin";

const assembler = new Assembler();
const codePages = assembler.assemble(sourceCode);

const buffSize = 8 * 256;
const buffer   = Buffer.alloc(buffSize, 0xFF);
const romStart = 0xFF00;

for (const pageTag of Object.keys(codePages)) {
    const pageAddress = parseInt(pageTag, 16);
    for (let offset = 0; offset < codePages[pageTag].length; offset += 1) {
        const value = codePages[pageTag][offset];
        if (typeof value === "number") {
            const address = pageAddress + offset;
            const valHex  = Utils.byteToHex(value);
            const val     = parseInt(valHex, 16);
            buffer.writeUInt8(val, address - romStart);
        }
    }
}

fs.writeFileSync(binFilePath, buffer);

const codeDto    = assembler.tokenize(sourceCode);
const instTokens = assembler.parseInstructions(codeDto);
assembler.resolveUnsetLabels(codeDto, instTokens);

// Export labels
for (const label of Object.keys(codeDto.labels))
    console.log(`$${codeDto.labels[label].toString(16).toUpperCase()} ${label}`);
