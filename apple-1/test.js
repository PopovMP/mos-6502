"use strict";

const fs = require("fs");

const {Assembler, Utils} = require("../js/index.js");

const sourceDir  = (__dirname).endsWith("apple-1") ? __dirname : __dirname + "/apple-1";
const sourceCode = `
;-------------------------------------------------------------------------
;  Memory declaration
;-------------------------------------------------------------------------

        XAML    = $24              ; Last "opened" location Low
        XAMH    = $25              ; Last "opened" location High
        STL     = $26              ; Store address Low
        STH     = $27              ; Store address High
        L       = $28              ; Hex value parsing Low
        H       = $29              ; Hex value parsing High
        YSAV    = $2A              ; Used to see if hex value is given
        MODE    = $2B              ; $00=XAM, $7F=STOR, $AE=BLOCK XAM

        IN      = $0200            ; Input buffer

        KBD     = $D010             ; PIA.A keyboard input
        KBDCR   = $D011             ; PIA.A keyboard control register
        DSP     = $D012             ; PIA.B display output register
        DSPCR   = $D013             ; PIA.B display control register

; KBD b7..b0 are inputs, b6..b0 is ASCII input, b7 is constant high
;     Programmed to respond to low to high KBD strobe
; DSP b6..b0 are outputs, b7 is input
;     CB2 goes low when data is written, returns high when CB1 goes high
; Interrupts are enabled, though not used. KBD can be connected to IRQ,
; whereas DSP can be connected to NMI.

;-------------------------------------------------------------------------
;  Constants
;-------------------------------------------------------------------------

        BS       = $DF             ; Backspace key, arrow left key
        CR       = $8D             ; Carriage Return
        ESC      = $9B             ; ESC key
        PROMPT   = "\\"             ; Prompt character

; Start
*=$E000

;-------------------------------------------------------------------------
;  Let's get started
;
;  Remark the RESET routine is only to be entered by asserting the RESET
;  line of the system. This ensures that the data direction registers
;  are selected.
;-------------------------------------------------------------------------

RESET           CLD                     ; Clear decimal arithmetic mode
                CLI
                LDY     #%11111111      ; Mask for DSP data direction reg
                STY     DSP             ; (DDR mode is assumed after reset)
                STY     KBD
                LDA     #%00101100      ; KBD and DSP control register mask
                STA     KBDCR
                STA     DSPCR

; Program falls through to the GETLINE routine to save some program bytes
; Please note that Y still holds $7F, which will cause an automatic Escape


START
                LDA #%00110011
                STA KBD
                LDA #%11100010
                STA DSP
LOOP
                JMP LOOP
            

; Entry vectors
*=$FFFA
        .WORD   RESET   ; NMI
        .WORD   RESET   ; Reset
        .WORD   RESET   ; IRQ
`;

const binFilePath = sourceDir + "/bin/rom-8k.bin";

const assembler = new Assembler();
const codePages = assembler.assemble(sourceCode);

const buffSize = 8 * 1024;
const buffer   = Buffer.alloc(buffSize, 0xFF);
const romStart = 0xE000;   // 1100 0000 0000 0000

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

fs.writeFileSync(binFilePath, buffer, "binary");

const codeDto    = assembler.tokenize(sourceCode);
const instTokens = assembler.parseInstructions(codeDto);
assembler.resolveUnsetLabels(codeDto, instTokens);

// Export labels
Object.keys(codeDto.labels).forEach((key) => {
    console.log(`${key.toUpperCase().padEnd(8, " ")} ${codeDto.labels[key].toString(16).toUpperCase()}`);
});
