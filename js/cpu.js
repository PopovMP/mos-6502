import { Utils } from "./utils.js";
import { DataSheet } from "./data-sheet.js";
export class Cpu {
    constructor(load, store) {
        this.addressInstructions = [
            "ASL", "DEC", "INC", "LSR", "JMP", "JSR", "ROL", "ROR", "STA", "STX", "STY",
        ];
        this.B = true;
        this.operandAddress = {
            IMPL: () => NaN,
            IMM: (addr) => addr,
            ZP: (addr) => this.load(addr),
            ZPX: (addr, x) => this.load(addr) + x,
            ZPY: (addr, _, y) => this.load(addr) + y,
            ABS: (addr) => this.loadWord(addr),
            ABSX: (addr, x) => this.loadWord(addr) + x,
            ABSY: (addr, _, y) => this.loadWord(addr) + y,
            IND: (addr) => this.loadWord(addr),
            XZPI: (addr, x) => this.loadWord((this.load(addr) + x) & 0xFF),
            ZPIY: (addr, _, y) => this.loadWord(this.load(addr)) + y,
            REL: (addr) => addr,
        };
        this.instruction = {
            ADC: (val) => {
                this.V = !((this.A ^ val) & 0x80);
                const res = this.A + val + +this.C;
                this.A = res & 0xFF;
                if (res >= 0x100) {
                    this.C = true;
                    if (this.V && res >= 0x180)
                        this.V = false;
                }
                else {
                    this.C = false;
                    if (this.V && res < 0x80)
                        this.V = false;
                }
                this.setNZ(this.A);
            },
            AND: (val) => {
                this.A &= val;
                this.setNZ(this.A);
            },
            ASL: (addr) => {
                const input = isNaN(addr) ? this.A : this.load(addr);
                const temp = input << 1;
                this.C = (temp >> 8) === 1;
                const val = temp & 0xFF;
                if (isNaN(addr))
                    this.A = val;
                else
                    this.store(addr, val);
                this.setNZ(val);
            },
            BCC: (addr) => {
                if (!this.C)
                    this.branch(addr);
            },
            BCS: (addr) => {
                if (this.C)
                    this.branch(addr);
            },
            BEQ: (addr) => {
                if (this.Z)
                    this.branch(addr);
            },
            BIT: (val) => {
                const res = this.A & val;
                this.N = !!(val & 0x80);
                this.V = !!(val & 0x40);
                this.Z = !res;
            },
            BMI: (addr) => {
                if (this.N)
                    this.branch(addr);
            },
            BNE: (addr) => {
                if (!this.Z)
                    this.branch(addr);
            },
            BPL: (addr) => {
                if (!this.N)
                    this.branch(addr);
            },
            BRK: () => {
                this.PC += 1;
                this.push((this.PC >> 8) & 0xFF);
                this.push(this.PC & 0xFF);
                this.PC = this.loadWord(0xFFFE);
            },
            BVC: (addr) => {
                if (!this.V)
                    this.branch(addr);
            },
            BVS: (addr) => {
                if (this.V)
                    this.branch(addr);
            },
            CLC: () => {
                this.C = false;
            },
            CLD: () => {
                this.D = false;
            },
            CLI: () => {
                this.I = false;
            },
            CLV: () => {
                this.V = false;
            },
            CMP: (val) => {
                const delta = this.A - val;
                this.C = this.A >= val;
                this.setNZ(delta);
            },
            CPX: (val) => {
                const delta = this.X - val;
                this.C = this.X >= val;
                this.setNZ(delta);
            },
            CPY: (val) => {
                const delta = this.Y - val;
                this.C = this.Y >= val;
                this.setNZ(delta);
            },
            DEC: (addr) => {
                const val = (this.load(addr) - 1) & 0xFF;
                this.store(addr, val);
                this.setNZ(val);
            },
            DEX: () => {
                this.X = (this.X - 1) & 0xFF;
                this.setNZ(this.X);
            },
            DEY: () => {
                this.Y = (this.Y - 1) & 0xFF;
                this.setNZ(this.Y);
            },
            EOR: (val) => {
                this.A ^= val;
                this.setNZ(this.A);
            },
            INC: (addr) => {
                const val = (this.load(addr) + 1) & 0xFF;
                this.store(addr, val);
                this.setNZ(val);
            },
            INX: () => {
                this.X = (this.X + 1) & 0xFF;
                this.setNZ(this.X);
            },
            INY: () => {
                this.Y = (this.Y + 1) & 0xFF;
                this.setNZ(this.Y);
            },
            JMP: (addr) => {
                this.PC = addr;
            },
            JSR: (addr) => {
                this.PC -= 1;
                this.push((this.PC >> 8) & 0xFF);
                this.push(this.PC & 0xFF);
                this.PC = addr;
            },
            LDA: (val) => {
                this.A = val;
                this.setNZ(this.A);
            },
            LDX: (val) => {
                this.X = val;
                this.setNZ(this.X);
            },
            LDY: (val) => {
                this.Y = val;
                this.setNZ(this.Y);
            },
            LSR: (addr) => {
                const input = isNaN(addr) ? this.A : this.load(addr);
                const out = input >> 1;
                if (isNaN(addr))
                    this.A = out;
                else
                    this.store(addr, out);
                this.N = false;
                this.Z = !out;
                this.C = !!(input & 1);
            },
            NOP: () => {
            },
            ORA: (val) => {
                this.A |= val;
                this.setNZ(this.A);
            },
            PHA: () => {
                this.push(this.A);
            },
            PHP: () => {
                this.push(this.P);
            },
            PLA: () => {
                this.A = this.pull();
                this.setNZ(this.A);
            },
            PLP: () => {
                this.P = this.pull();
            },
            ROL: (addr) => {
                const input = isNaN(addr) ? this.A : this.load(addr);
                const out = (input << 1) + +this.C;
                if (isNaN(addr))
                    this.A = out;
                else
                    this.store(addr, out);
                this.N = !!((input >> 6) & 1);
                this.Z = !out;
                this.C = !!((input >> 7) & 1);
            },
            ROR: (addr) => {
                const input = isNaN(addr) ? this.A : this.load(addr);
                const out = ((input >> 1) + (+this.C << 7)) & 0xFF;
                if (isNaN(addr))
                    this.A = out;
                else
                    this.store(addr, out);
                this.N = this.C;
                this.Z = !out;
                this.C = !!(input & 1);
            },
            RTI: () => {
                this.P = this.pull();
                this.PC = this.pull() + (this.pull() << 8);
                this.I = false;
            },
            RTS: () => {
                this.PC = this.pull() + (this.pull() << 8) + 1;
            },
            SBC: (val) => {
                this.V = !!((this.A ^ val) & 0x80);
                const res = 0xff + this.A - val + (this.C ? 1 : 0);
                if (res < 0x100) {
                    this.C = false;
                    if (this.V && res < 0x80)
                        this.V = false;
                }
                else {
                    this.C = true;
                    if (this.V && res >= 0x180)
                        this.V = false;
                }
                this.A = res & 0xff;
            },
            SEC: () => {
                this.C = true;
            },
            SED: () => {
                this.D = true;
            },
            SEI: () => {
                this.I = true;
            },
            STA: (addr) => {
                this.store(addr, this.A);
            },
            STX: (addr) => {
                this.store(addr, this.X);
            },
            STY: (addr) => {
                this.store(addr, this.Y);
            },
            TAX: () => {
                this.X = this.A;
                this.setNZ(this.X);
            },
            TAY: () => {
                this.Y = this.A;
                this.setNZ(this.Y);
            },
            TSX: () => {
                this.X = this.S;
                this.setNZ(this.X);
            },
            TXA: () => {
                this.A = this.X;
                this.setNZ(this.A);
            },
            TXS: () => {
                this.S = this.X;
            },
            TYA: () => {
                this.A = this.Y;
                this.setNZ(this.A);
            },
        };
        this.load = load;
        this.store = store;
        this.dataSheet = new DataSheet();
        this.A = Utils.randomByte();
        this.X = Utils.randomByte();
        this.Y = Utils.randomByte();
        this.S = Utils.randomByte();
        this.N = false;
        this.V = false;
        this.D = false;
        this.I = true;
        this.Z = false;
        this.C = false;
        this.PC = this.loadWord(0xFFFC);
    }
    get P() {
        return (+this.N << 7) |
            (+this.V << 6) |
            (1 << 5) |
            (1 << 4) |
            (+this.D << 3) |
            (+this.I << 2) |
            (+this.Z << 1) |
            (+this.C << 0);
    }
    set P(val) {
        this.N = !!((val >> 7) & 0x01);
        this.V = !!((val >> 6) & 0x01);
        this.D = !!((val >> 3) & 0x01);
        this.I = !!((val >> 2) & 0x01);
        this.Z = !!((val >> 1) & 0x01);
        this.C = !!((val >> 0) & 0x01);
    }
    reset() {
        this.A = Utils.randomByte();
        this.X = Utils.randomByte();
        this.Y = Utils.randomByte();
        this.S = Utils.randomByte();
        this.N = false;
        this.V = false;
        this.D = false;
        this.I = true;
        this.Z = false;
        this.C = false;
        this.PC = this.loadWord(0xFFFC);
    }
    step() {
        const opcode = this.load(this.PC);
        const instructionName = this.dataSheet.opCodeName[opcode];
        if (instructionName === undefined)
            throw new Error(`Invalid instruction '${Utils.byteToHex(opcode)}' at: $${Utils.wordToHex(this.PC)}`);
        const addressingMode = this.dataSheet.opCodeMode[opcode];
        const operandAddr = this.operandAddress[addressingMode](this.PC + 1, this.X, this.Y);
        const operandValue = this.addressInstructions.includes(instructionName)
            ? operandAddr
            : addressingMode === "IMPL"
                ? this.A
                : this.load(operandAddr);
        this.PC += this.dataSheet.opCodeBytes[opcode];
        this.instruction[instructionName](operandValue);
    }
    irq() {
        if (this.I)
            return;
        this.push((this.PC >> 8) & 0xFF);
        this.push(this.PC & 0xFF);
        this.push((this.P | 0x02) & ~(1 << 0x04));
        this.PC = this.loadWord(0xFFFE);
    }
    nmi() {
        this.push((this.PC >> 8) & 0xFF);
        this.push(this.PC & 0xFF);
        this.push((this.P | 0x02) & ~(1 << 0x04));
        this.PC = this.loadWord(0xFFFA);
    }
    loadWord(addr) {
        return this.load(addr) + (this.load(addr + 1) << 8);
    }
    push(val) {
        this.store(0x0100 + this.S, val);
        this.S -= 1;
        if (this.S < 0)
            this.S = 0xFF;
    }
    pull() {
        this.S += 1;
        if (this.S > 0xFF)
            this.S = 0;
        return this.load(0x0100 + this.S);
    }
    branch(offset) {
        this.PC += offset < 128 ? offset : offset - 256;
    }
    setNZ(val) {
        this.N = !!(val >> 7);
        this.Z = !val;
    }
}
//# sourceMappingURL=cpu.js.map