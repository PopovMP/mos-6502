import {strictEqual}  from "node:assert";
import {describe, it} from "node:test";

import {Assembler} from "../js/assembler.js";

const assembler      = new Assembler();
const memory         = new Uint8Array(0xFFFF + 1);

describe("Assembler - Directives", () => {
    describe(".ORG", () => {
        it("Sets the origin address", () => {
            const sourceCode = `
                .ORG $0800
                LDA #$01
                STA $0200
            `;
            memory.fill(0x00);
            assembler.load(sourceCode, memory);
            strictEqual(memory[0x0800], 0xA9); // LDA #$01
            strictEqual(memory[0x0801], 0x01); // #$01
            strictEqual(memory[0x0802], 0x8D); // STA $0200
            strictEqual(memory[0x0803], 0x00); // Low byte of $0200
            strictEqual(memory[0x0804], 0x02); // High byte of $0200
        });
        it("Sets the origin address with a label", () => {
            const sourceCode = `
                .org $0800
                start LDA #$01
                STA $0200
            `;
            memory.fill(0x00);
            assembler.load(sourceCode, memory);
            strictEqual(memory[0x0800], 0xA9); // LDA #$01
            strictEqual(memory[0x0801], 0x01); // #$01
            strictEqual(memory[0x0802], 0x8D); // STA $0200
            strictEqual(memory[0x0803], 0x00); // Low byte of $0200
            strictEqual(memory[0x0804], 0x02); // High byte of $0200

        });
        it("Sets the origin address with a variable", () => {
            const sourceCode = `
                .ORG $0800
                VARA = $0200
                LDA #$01
                STA VARA
            `;
            memory.fill(0x00);
            assembler.load(sourceCode, memory);
            strictEqual(memory[0x0800], 0xA9); // LDA #$01
            strictEqual(memory[0x0801], 0x01); // #$01
            strictEqual(memory[0x0802], 0x8D); // STA $0200
            strictEqual(memory[0x0803], 0x00); // Low byte of $0200
            strictEqual(memory[0x0804], 0x02); // High byte of $0200
        });
    });

    describe(".BYTE", () => {
        it("Sets a byte in memory", () => {
            const sourceCode = `
				* = $0800
				.BYTE $AB
			`;
            memory.fill(0x00);
            assembler.load(sourceCode, memory);
            strictEqual(memory[0x0800], 0xAB);
        });

        it("Sets multiple bytes", () => {
            const sourceCode = `
				* = $0800
				.BYTE $AB, $AC, $AD
			`;
            memory.fill(0x00);
            assembler.load(sourceCode, memory);
            strictEqual(memory[0x0800], 0xAB);
            strictEqual(memory[0x0801], 0xAC);
            strictEqual(memory[0x0802], 0xAD);
        });

        it("Sets multiple records", () => {
            const sourceCode = `
				* = $0800
                lda #$AB
                * = $E200
                message ; "Hello, MOS 65C02!\r\n\0"
                        .BYTE $48, $65, $6C, $6C, $6F, $2C, $20, $4D, $4F, $53
                        .BYTE $20, $36, $35, $43, $30, $32, $21, $0D, $0A, $00
			`;
            memory.fill(0x00);
            assembler.load(sourceCode, memory);
            strictEqual(memory[0x0801], 0xAB);
            strictEqual(memory[0xE200], 0x48);
            strictEqual(memory[0xE209], 0x53);
            strictEqual(memory[0xE20A], 0x20);
            strictEqual(memory[0xE212], 0x0A);
        });

        it("Sets a byte with a label", () => {
            const sourceCode = `
				* = $0800
				LDA label
				label .BYTE $AB
			`;
            memory.fill(0x00);
            assembler.load(sourceCode, memory);
            strictEqual(memory[0x0803], 0xAB);
        });

        it("BYTE with variable", () => {
            const sourceCode = `
				* = $0800
				VARA = $F4
				.BYTE VARA
			`;
            memory.fill(0x00);
            assembler.load(sourceCode, memory);
            strictEqual(memory[0x0800], 0xF4);
        });
    });

    describe(".WORD", () => {
        it("Sets a WORD in memory", () => {
            const sourceCode = `
				* = $0800
				.WORD $AB11
			`;
            memory.fill(0x00);
            assembler.load(sourceCode, memory);
            strictEqual(memory[0x0800], 0x11);
            strictEqual(memory[0x0801], 0xAB);
        });

        it("Sets multiple bytes", () => {
            const sourceCode = `
				* = $0800
				.WORD $AB11, $CD22
			`;
            memory.fill(0x00);
            assembler.load(sourceCode, memory);
            strictEqual(memory[0x0800], 0x11);
            strictEqual(memory[0x0801], 0xAB);
            strictEqual(memory[0x0802], 0x22);
            strictEqual(memory[0x0803], 0xCD);
        });

        it("WORD sets a label", () => {
            const sourceCode = `
				* = $0800
				label NOP
				      NOP
				      NOP
				.WORD label
			`;
            memory.fill(0x00);
            assembler.load(sourceCode, memory);
            strictEqual(memory[0x0803], 0x00);
            strictEqual(memory[0x0804], 0x08);
        });

        it("WORD with variable", () => {
            const sourceCode = `
				* = $0800
				VARA = $ABCD
				.WORD VARA
			`;
            memory.fill(0x00);
            assembler.load(sourceCode, memory);
            strictEqual(memory[0x0800], 0xCD);
            strictEqual(memory[0x0801], 0xAB);
        });

    });
});
