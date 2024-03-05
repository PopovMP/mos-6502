export class DataSheet {
    constructor() {
        this.instructions = [];
        this.opCodeBytes = {};
        this.opCodeMode = {};
        this.opCodeName = {};
        this.addressingModes = [
            'IMM',
            'ZP',
            'ZPX',
            'ZPY',
            'ABS',
            'ABSX',
            'ABSY',
            'IND',
            'XZPI',
            'ZPIY',
            'IMPL',
            'REL',
        ];
        this.addressingModeBytes = {
            IMM: 2,
            ZP: 2,
            ZPX: 2,
            ZPY: 2,
            ABS: 3,
            ABSX: 3,
            ABSY: 3,
            IND: 3,
            XZPI: 2,
            ZPIY: 2,
            IMPL: 1,
            REL: 2,
        };
        this.Opcodes = {
            ADC: [0x69, 0x65, 0x75, NaN, 0x6D, 0x7D, 0x79, NaN, 0x61, 0x71, NaN, NaN],
            AND: [0x29, 0x25, 0x35, NaN, 0x2D, 0x3D, 0x39, NaN, 0x21, 0x31, NaN, NaN],
            ASL: [NaN, 0x06, 0x16, NaN, 0x0E, 0x1E, NaN, NaN, NaN, NaN, 0x0A, NaN],
            BCC: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x90],
            BCS: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0xB0],
            BEQ: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0xF0],
            BIT: [NaN, 0x24, NaN, NaN, 0x2C, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
            BMI: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x30],
            BNE: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0xD0],
            BPL: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x10],
            BRK: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x00, NaN],
            BVC: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x50],
            BVS: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x70],
            CLC: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x18, NaN],
            CLD: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0xD8, NaN],
            CLI: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x58, NaN],
            CLV: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0xB8, NaN],
            CMP: [0xC9, 0xC5, 0xD5, NaN, 0xCD, 0xDD, 0xD9, NaN, 0xC1, 0xD1, NaN, NaN],
            CPX: [0xE0, 0xE4, NaN, NaN, 0xEC, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
            CPY: [0xC0, 0xC4, NaN, NaN, 0xCC, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
            DEC: [NaN, 0xC6, 0xD6, NaN, 0xCE, 0xDE, NaN, NaN, NaN, NaN, NaN, NaN],
            DEX: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0xCA, NaN],
            DEY: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x88, NaN],
            EOR: [0x49, 0x45, 0x55, NaN, 0x4D, 0x5D, 0x59, NaN, 0x41, 0x51, NaN, NaN],
            INC: [NaN, 0xE6, 0xF6, NaN, 0xEE, 0xFE, NaN, NaN, NaN, NaN, NaN, NaN],
            INX: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0xE8, NaN],
            INY: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0xC8, NaN],
            JMP: [NaN, NaN, NaN, NaN, 0x4C, NaN, NaN, 0x6C, NaN, NaN, NaN, NaN],
            JSR: [NaN, NaN, NaN, NaN, 0x20, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
            LDA: [0xA9, 0xA5, 0xB5, NaN, 0xAD, 0xBD, 0xB9, NaN, 0xA1, 0xB1, NaN, NaN],
            LDX: [0xA2, 0xA6, NaN, 0xB6, 0xAE, NaN, 0xBE, NaN, NaN, NaN, NaN, NaN],
            LDY: [0xA0, 0xA4, 0xB4, NaN, 0xAC, 0xBC, NaN, NaN, NaN, NaN, NaN, NaN],
            LSR: [NaN, 0x46, 0x56, NaN, 0x4E, 0x5E, NaN, NaN, NaN, NaN, 0x4A, NaN],
            NOP: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0xEA, NaN],
            ORA: [0x09, 0x05, 0x15, NaN, 0x0D, 0x1D, 0x19, NaN, 0x01, 0x11, NaN, NaN],
            PHA: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x48, NaN],
            PHP: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x08, NaN],
            PLA: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x68, NaN],
            PLP: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x28, NaN],
            ROL: [NaN, 0x26, 0x36, NaN, 0x2E, 0x3E, NaN, NaN, NaN, NaN, 0x2A, NaN],
            ROR: [NaN, 0x66, 0x76, NaN, 0x6E, 0x7E, NaN, NaN, NaN, NaN, 0x6A, NaN],
            RTI: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x40, NaN],
            RTS: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x60, NaN],
            SBC: [0xE9, 0xE5, 0xF5, NaN, 0xED, 0xFD, 0xF9, NaN, 0xE1, 0xF1, NaN, NaN],
            SEC: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x38, NaN],
            SED: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0xF8, NaN],
            SEI: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x78, NaN],
            STA: [NaN, 0x85, 0x95, NaN, 0x8D, 0x9D, 0x99, NaN, 0x81, 0x91, NaN, NaN],
            STX: [NaN, 0x86, NaN, 0x96, 0x8E, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
            STY: [NaN, 0x84, 0x94, NaN, 0x8C, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
            TAX: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0xAA, NaN],
            TAY: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0xA8, NaN],
            TSX: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0xBA, NaN],
            TXA: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x8A, NaN],
            TXS: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x9A, NaN],
            TYA: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x98, NaN],
        };
        this.instrDescription = {
            ADC: "Add with Carry",
            AND: "Logical AND",
            ASL: "Arithmetic Shift Left",
            BCC: "Branch if Carry Clear",
            BCS: "Branch if Carry Set",
            BEQ: "Branch if Equal",
            BIT: "Bit Test",
            BMI: "Branch if Minus",
            BNE: "Branch if Not Equal",
            BPL: "Branch if Plus",
            BRK: "Force Interrupt",
            BVC: "Branch if Overflow Clear",
            BVS: "Branch if Overflow Set",
            CLC: "Clear Carry Flag",
            CLD: "Clear Decimal Mode",
            CLI: "Clear Interrupt Disable",
            CLV: "Clear Overflow Flag",
            CMP: "Compare",
            CPX: "Compare X Register",
            CPY: "Compare Y Register",
            DEC: "Decrement Memory",
            DEX: "Decrement X Register",
            DEY: "Decrement Y Register",
            EOR: "Exclusive OR",
            INC: "Increment Memory",
            INX: "Increment X Register",
            INY: "Increment Y Register",
            JMP: "Jump",
            JSR: "Jump to Subroutine",
            LDA: "Load Accumulator",
            LDX: "Load X Register",
            LDY: "Load Y Register",
            LSR: "Logical Shift Right",
            NOP: "No Operation",
            ORA: "Logical OR",
            PHA: "Push Accumulator",
            PHP: "Push Processor Status",
            PLA: "Pull Accumulator",
            PLP: "Pull Processor Status",
            ROL: "Rotate Left",
            ROR: "Rotate Right",
            RTI: "Return from Interrupt",
            RTS: "Return from Subroutine",
            SBC: "Subtract with Carry",
            SEC: "Set Carry Flag",
            SED: "Set Decimal Flag",
            SEI: "Set Interrupt Disable",
            STA: "Store Accumulator",
            STX: "Store X Register",
            STY: "Store Y Register",
            TAX: "Transfer Accumulator to X",
            TAY: "Transfer Accumulator to Y",
            TSX: "Transfer Stack Pointer to X",
            TXA: "Transfer X to Accumulator",
            TXS: "Transfer X to Stack Pointer",
            TYA: "Transfer Y to Accumulator",
        };
        for (const instructionName of Object.keys(this.Opcodes)) {
            this.instructions.push(instructionName);
            this.Opcodes[instructionName].forEach((opcode, index) =>
                            this.populateData(instructionName, opcode, index));
        }
    }
    populateData(instructionName, opcode, index) {
        if (isNaN(opcode))
            return;
        const addressingMode = this.addressingModes[index];
        this.opCodeName[opcode] = instructionName;
        this.opCodeMode[opcode] = addressingMode;
        this.opCodeBytes[opcode] = this.addressingModeBytes[addressingMode];
    }
    getOpc(instName, mode) {
        const modeIndex = this.addressingModes.indexOf(mode);
        return this.Opcodes[instName][modeIndex];
    }
}
//# sourceMappingURL=data-sheet.js.map