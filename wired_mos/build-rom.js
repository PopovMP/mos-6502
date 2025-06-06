import { readFileSync, writeFileSync } from "node:fs";
import { Buffer } from "node:buffer";

import { Assembler } from "../js/assembler.js";
import { Utils     } from "../js/utils.js";

import { fileURLToPath } from "node:url";
import { dirname       } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const ROM_SIZE = 8 * 1024;

const sourceDir   = __dirname;
const sourcePath  = sourceDir + "/rom.asm";
const sourceCode  = readFileSync(sourcePath, "utf8");
const binFilePath = sourceDir + "/rom.bin";

const assembler = new Assembler();
const codePages = assembler.assemble(sourceCode);

const buffer   = Buffer.alloc(ROM_SIZE, 0xFF);
const romStart = 0xFFFF + 1 - ROM_SIZE;

for (const pageTag of Object.keys(codePages)) {
	const pageAddress = parseInt(pageTag, 16);
	for (let offset = 0; offset < codePages[pageTag].length; offset++) {
		const value = codePages[pageTag][offset];
		if (typeof value === "number") {
			const address = pageAddress + offset;
			const valHex  = Utils.byteToHex(value);
			const val     = parseInt(valHex, 16);
			buffer.writeUInt8(val, address - romStart);
		}
	}
}

writeFileSync(binFilePath, buffer);

const codeDto    = assembler.tokenize(sourceCode);
const instTokens = assembler.parseInstructions(codeDto);
assembler.resolveUnsetLabels(codeDto, instTokens);

const tokens = assembler.disassemble(buffer, romStart);
const text = tokens.map((tkn) =>
	`$${tkn.address}   ${tkn.code.join(" ").padEnd(8, " ")}   ` +
	`${tkn.text.padEnd(13, " ")}  ; ${tkn.description}`)
	.join("\n");

console.log(text);
console.log();

// Export labels
Object.keys(codeDto.labels).forEach((key) => {
	console.log(`${key.toUpperCase().padEnd(8, " ")} ${codeDto.labels[key].toString(16).toUpperCase()}`);
});
