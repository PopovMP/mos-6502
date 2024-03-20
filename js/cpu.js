import { Utils } from "./utils.js";
import { DataSheet } from "./data-sheet.js";
export class Cpu {
    constructor(load, store) {
        this.addressInstructions = [
            "ASL", "DEC", "INC", "LSR", "JMP", "JSR", "ROL", "ROR", "STA", "STX", "STY",
        ];
        this.operandAddress = {
            IMPL: () => -1,
            IMM: (addr) => addr,
            ZP: (addr) => this.load(addr),
            ZPX: (addr, x) => (this.load(addr) + x) & 0xFF,
            ZPY: (addr, _, y) => (this.load(addr) + y) & 0xFF,
            ABS: (addr) => this.loadWord(addr),
            ABSX: (addr, x) => this.loadWord(addr) + x,
            ABSY: (addr, _, y) => this.loadWord(addr) + y,
            IND: (addr) => this.loadWord(this.loadWord(addr)),
            XZPI: (addr, x) => this.loadWord((this.load(addr) + x) & 0xFF),
            ZPIY: (addr, _, y) => this.loadWord(this.load(addr)) + y,
            REL: (addr) => addr,
        };
        this.instruction = {
            ADC: (val) => {
                let res = this.A + val + +this.C;
                if (this.D) {
                    if ((this.A & 0x0F) + (val & 0x0F) + +this.C > 0x09)
                        res += 0x06;
                    if (res > 0x99)
                        res += 0x60;
                }
                this.C = res > 0xFF;
                this.V = !((this.A ^ val) & 0x80) && !!((this.A ^ res) & 0x80);
                this.A = res & 0xFF;
                this.setNZ(this.A);
            },
            AND: (val) => {
                this.A &= val;
                this.setNZ(this.A);
            },
            ASL: (addr) => {
                const val = addr === -1 ? this.A : this.load(addr);
                const temp = val << 1;
                const res = temp & 0xFF;
                if (addr === -1)
                    this.A = res;
                else
                    this.store(addr, res);
                this.C = (temp >> 8) === 1;
                this.setNZ(res);
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
                this.push(this.P | (1 << 5));
                this.I = true;
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
                const res = (this.load(addr) - 1) & 0xFF;
                this.store(addr, res);
                this.setNZ(res);
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
                const res = (this.load(addr) + 1) & 0xFF;
                this.store(addr, res);
                this.setNZ(res);
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
                const val = addr === -1 ? this.A : this.load(addr);
                const res = val >> 1;
                if (addr === -1)
                    this.A = res;
                else
                    this.store(addr, res);
                this.N = false;
                this.Z = !res;
                this.C = !!(val & 1);
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
                const val = addr === -1 ? this.A : this.load(addr);
                const res = ((val << 1) + +this.C) & 0xFF;
                if (addr === -1)
                    this.A = res;
                else
                    this.store(addr, res);
                this.N = !!((val >> 6) & 1);
                this.Z = !res;
                this.C = !!((val >> 7) & 1);
            },
            ROR: (addr) => {
                const val = addr === -1 ? this.A : this.load(addr);
                const res = ((val >> 1) + (+this.C << 7)) & 0xFF;
                if (addr === -1)
                    this.A = res;
                else
                    this.store(addr, res);
                this.N = this.C;
                this.Z = !res;
                this.C = !!(val & 1);
            },
            RTI: () => {
                this.P = this.pull();
                this.PC = this.pull() + (this.pull() << 8);
            },
            RTS: () => {
                this.PC = this.pull() + (this.pull() << 8) + 1;
            },
            SBC: (val) => {
                let res;
                if (this.D) {
                    let tmp = (this.A & 0x0F) - (val & 0x0F) - +!this.C;
                    if (tmp < 0)
                        tmp -= 0x06;
                    res = (this.A & 0xF0) - (val & 0xF0) + tmp;
                    this.C = res >= 0;
                    if (res < 0)
                        res -= 0x60;
                }
                else {
                    res = 0xFF + this.A - val + +this.C;
                    this.C = res >= 0x100;
                }
                this.V = !!((this.A ^ val) & (this.A ^ res) & 0x80);
                this.A = res & 0xFF;
                this.setNZ(this.A);
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
    set P(ps) {
        this.N = !!((ps >> 7) & 0x01);
        this.V = !!((ps >> 6) & 0x01);
        this.D = !!((ps >> 3) & 0x01);
        this.I = !!((ps >> 2) & 0x01);
        this.Z = !!((ps >> 1) & 0x01);
        this.C = !!((ps >> 0) & 0x01);
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
        const opcode = this.load(this.PC, true);
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
        this.push((this.P | (1 << 3)) & ~(1 << 5));
        this.PC = this.loadWord(0xFFFE);
    }
    nmi() {
        this.push((this.PC >> 8) & 0xFF);
        this.push(this.PC & 0xFF);
        this.push((this.P | (1 << 3)) & ~(1 << 5));
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
        this.N = !!(val & 0x80);
        this.Z = !val;
    }
}
//# sourceMappingURL=cpu.js.map