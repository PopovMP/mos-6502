// noinspection DuplicatedCode

import {Utils    } from "./utils.js";
import {DataSheet} from "./data-sheet.js";

export class Cpu {
    // The following instructions need the address
    // designated by the operand instead of its value
    private readonly addressInstructions: string[] = [
        "ASL", "DEC", "INC", "LSR", "JMP", "JSR", "ROL", "ROR", "STA", "STX", "STY",
    ];
    private readonly dataSheet: DataSheet;
    private readonly load : (addr: number, sync?: boolean) => number;
    private readonly store: (addr: number, data: number  ) => void;

    public A : number; // Accumulator
    public X : number; // X index register
    public Y : number; // Y index register
    public S : number; // Stack Pointer
    public PC: number; // Program Counter

    public N: boolean; // Negative flag
    public V: boolean; // Overflow flag
    public D: boolean; // Decimal flag
    public I: boolean; // Interrupt disabled flag
    public Z: boolean; // Zero flag
    public C: boolean; // Carry flag

    // Processor Status
    public get P(): number {
        return (+this.N << 7) |
               (+this.V << 6) |
               (      1 << 5) |
               (      1 << 4) |
               (+this.D << 3) |
               (+this.I << 2) |
               (+this.Z << 1) |
               (+this.C << 0);
    }

    // Process Status
    public set P(ps: number) {
        this.N = !!((ps >> 7) & 0x01);
        this.V = !!((ps >> 6) & 0x01);
        this.D = !!((ps >> 3) & 0x01);
        this.I = !!((ps >> 2) & 0x01);
        this.Z = !!((ps >> 1) & 0x01);
        this.C = !!((ps >> 0) & 0x01);
    }

    constructor(load : (addr: number, sync?: boolean) => number,
                store: (addr: number, data: number  ) => void) {
        this.load      = load;
        this.store     = store;
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

    public reset(): void {
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

    public step(): void {
        const opcode: number = this.load(this.PC, true);

        const instructionName: string = this.dataSheet.opCodeName[opcode];

        if (instructionName === undefined)
            throw new Error(`Invalid instruction '${Utils.byteToHex(opcode)}' at: $${Utils.wordToHex(this.PC)}`);

        const addressingMode: string = this.dataSheet.opCodeMode[opcode];
        const operandAddr   : number = this.operandAddress[addressingMode](this.PC + 1, this.X, this.Y);
        const operandValue  : number = this.addressInstructions.includes(instructionName)
                                    ? operandAddr                 // Instruction needs an effective address
                                    : addressingMode === "IMPL"   // Implied addressing mode doesn't require address
                                        ? this.A                  // However, it may need the A register value
                                        : this.load(operandAddr); // Operand value

        this.PC += this.dataSheet.opCodeBytes[opcode];

        this.instruction[instructionName](operandValue);
    }

    // noinspection JSUnusedGlobalSymbols
    public irq(): void {
        if (this.I) return;

        this.push((this.PC >> 8) & 0xFF);
        this.push(this.PC & 0xFF);
        this.push((this.P | (1 << 3)) & ~(1 << 5)); // Set I, reset B
        this.PC = this.loadWord(0xFFFE);
    }

    // noinspection JSUnusedGlobalSymbols
    public nmi(): void {
        this.push((this.PC >> 8) & 0xFF);
        this.push(this.PC & 0xFF);
        this.push((this.P | (1 << 3)) & ~(1 << 5)); // Set I, reset B
        this.PC = this.loadWord(0xFFFA);
    }

    private readonly operandAddress: Record<string, (addr: number, x: number, y: number) => number> = {
        IMPL: (): number => -1, // Implied and Accumulator modes don't need an address
        IMM : (addr: number                      ): number => addr,
        ZP  : (addr: number                      ): number => this.load(addr),
        ZPX : (addr: number, x: number           ): number => (this.load(addr) + x) & 0xFF,
        ZPY : (addr: number, _: number, y: number): number => (this.load(addr) + y) & 0xFF,
        ABS : (addr: number                      ): number => this.loadWord(addr),
        ABSX: (addr: number, x: number           ): number => this.loadWord(addr) + x,
        ABSY: (addr: number, _: number, y: number): number => this.loadWord(addr) + y,
        IND : (addr: number                      ): number => this.loadWord(this.loadWord(addr)),
        XZPI: (addr: number, x: number           ): number => this.loadWord((this.load(addr) + x) & 0xFF),
        ZPIY: (addr: number, _: number, y: number): number => this.loadWord(this.load(addr)) + y,
        REL : (addr: number                      ): number => addr,
    };

    private readonly instruction: Record<string, (opr: number) => void> = {
        // Add Memory to Accumulator with Carry
        ADC: (val: number): void => {
            let res: number = this.A + val + +this.C;
            if (this.D) {
                if ((this.A & 0x0F) + (val & 0x0F) + +this.C > 0x09) res += 0x06;
                if (res > 0x99) res += 0x60;
            }

            this.C = res > 0xFF;
            this.V = !((this.A ^ val) & 0x80) && !!((this.A ^ res) & 0x80);
            this.A = res & 0xFF;
            this.setNZ(this.A);
        },

        // "AND" Memory with Accumulator
        AND: (val: number): void => {
            this.A &= val;
            this.setNZ(this.A);
        },

        // Shift Left One Bit (Memory or Accumulator)
        ASL: (addr: number): void => {
            const val : number = addr === -1 ? this.A : this.load(addr);
            const temp: number = val << 1;
            const res : number = temp & 0xFF;

            if (addr === -1)
                this.A = res;
            else
                this.store(addr, res);

            this.C = (temp >> 8) === 1;
            this.setNZ(res);
        },

        // Branch on Carry Clear
        BCC: (addr: number): void => {
            if (!this.C) this.branch(addr);
        },

        // Branch on Carry Set
        BCS: (addr: number): void => {
            if (this.C) this.branch(addr);
        },

        // Branch on Result Zero
        BEQ: (addr: number): void => {
            if (this.Z) this.branch(addr);
        },

        // Test Bits in Memory with Accumulator
        BIT: (val: number): void => {
            const res: number = this.A & val;

            this.N = !!(val & 0x80);
            this.V = !!(val & 0x40);
            this.Z = !res;
        },

        // Branch on Result Minus
        BMI: (addr: number): void => {
            if (this.N)
                this.branch(addr);
        },

        // Branch on Result not Zero
        BNE: (addr: number): void => {
            if (!this.Z)
                this.branch(addr);
        },

        // Branch on Result Plus
        BPL: (addr: number): void => {
            if (!this.N)
                this.branch(addr);
        },

        // Force Break
        BRK: (): void => {
            this.PC += 1;
            this.push((this.PC >> 8) & 0xFF);
            this.push(this.PC & 0xFF);
            this.push(this.P | (1 << 5)); // Set B
            this.I  = true;
            this.PC = this.loadWord(0xFFFE);
        },

        // Branch on Overflow Clear
        BVC: (addr: number): void => {
            if (!this.V)
                this.branch(addr);
        },

        // Branch on Overflow Set
        BVS: (addr: number): void => {
            if (this.V)
                this.branch(addr);
        },

        // Clear Carry Flag
        CLC: (): void => {
            this.C = false;
        },

        // Clear Decimal Mode
        CLD: (): void => {
            this.D = false;
        },

        // Clear interrupt Disable Bit
        CLI: (): void => {
            this.I = false;
        },

        // Clear Overflow Flag
        CLV: (): void => {
            this.V = false;
        },

        // Compare Memory and Accumulator
        CMP: (val: number): void => {
            const delta: number = this.A - val;
            this.C = this.A >= val;
            this.setNZ(delta);
        },

        // Compare Index X to Memory
        CPX: (val: number): void => {
            const delta: number = this.X - val;
            this.C = this.X >= val;
            this.setNZ(delta);
        },

        // Compare Index Y to Memory
        CPY: (val: number): void => {
            const delta: number = this.Y - val;
            this.C = this.Y >= val;
            this.setNZ(delta);
        },

        // Decrement memory by One
        DEC: (addr: number): void => {
            const res: number = (this.load(addr) - 1) & 0xFF;
            this.store(addr, res);
            this.setNZ(res);
        },

        // Decrement Index X by One
        DEX: (): void => {
            this.X = (this.X - 1) & 0xFF;
            this.setNZ(this.X);
        },

        // Decrement Index Y by One
        DEY: (): void => {
            this.Y = (this.Y - 1) & 0xFF;
            this.setNZ(this.Y);
        },

        // "Exclusive-Or" Memory with Accumulator
        EOR: (val: number): void => {
            this.A ^= val;
            this.setNZ(this.A);
        },

        // Increment Memory by One
        INC: (addr: number): void => {
            const res: number = (this.load(addr) + 1) & 0xFF;
            this.store(addr, res);
            this.setNZ(res);
        },

        // Increment Index X by One
        INX: (): void => {
            this.X = (this.X + 1) & 0xFF;
            this.setNZ(this.X);
        },

        // Increment Index y By One
        INY: (): void => {
            this.Y = (this.Y + 1) & 0xFF;
            this.setNZ(this.Y);
        },

        // Jump to New Location
        JMP: (addr: number): void => {
            this.PC = addr;
        },

        // Save the Return Address, Jump to New Location
        JSR: (addr: number): void => {
            this.PC -= 1;
            this.push((this.PC >> 8) & 0xFF);
            this.push(this.PC & 0xFF);
            this.PC = addr;
        },

        // Load Accumulator with Memory
        LDA: (val: number): void => {
            this.A = val;
            this.setNZ(this.A);
        },

        // Load X Register
        LDX: (val: number): void => {
            this.X = val;
            this.setNZ(this.X);
        },

        // Load Y Register
        LDY: (val: number): void => {
            this.Y = val;
            this.setNZ(this.Y);
        },

        // Logical Shift Right
        LSR: (addr: number): void => {
            const val: number = addr === -1 ? this.A : this.load(addr);
            const res: number = val >> 1;

            if (addr === -1)
                this.A = res;
            else
                this.store(addr, res);

            this.N = false;
            this.Z = !res;
            this.C = !!(val & 1);
        },

        // No Operation
        NOP: (): void => {
        },

        // "OR" Memory with Accumulator
        ORA: (val: number): void => {
            this.A |= val;
            this.setNZ(this.A);
        },

        // Push Accumulator On Stack
        PHA: (): void => {
            this.push(this.A);
        },

        // Push Processor Status On Stack
        PHP: (): void => {
            this.push(this.P);
        },

        // Pull Accumulator From Stack
        PLA: (): void => {
            this.A = this.pull();
            this.setNZ(this.A);
        },

        // Pull Processor Status From Stack
        PLP: (): void => {
            this.P = this.pull();
        },

        // Rotate Left
        ROL: (addr: number): void => {
            const val: number = addr === -1 ? this.A : this.load(addr);
            const res: number = ((val << 1) + +this.C) & 0xFF;

            if (addr === -1)
                this.A = res;
            else
                this.store(addr, res);

            this.N = !!((val >> 6) & 1);
            this.Z = !res;
            this.C = !!((val >> 7) & 1);
        },

        // Rotate Right
        ROR: (addr: number): void => {
            const val: number = addr === -1 ? this.A : this.load(addr);
            const res: number = ((val >> 1) + (+this.C << 7)) & 0xFF;

            if (addr === -1)
                this.A = res;
            else
                this.store(addr, res);

            this.N = this.C;
            this.Z = !res;
            this.C = !!(val & 1);
        },

        // Return from Interrupt
        RTI: (): void => {
            this.P  = this.pull();
            this.PC = this.pull() + (this.pull() << 8);
        },

        // Return from Subroutine
        RTS: (): void => {
            this.PC = this.pull() + (this.pull() << 8) + 1;
        },

        // Subtract Memory from Accumulator with Borrow
        SBC: (val: number): void => {
            let res: number;

            if (this.D) {
                let tmp: number = (this.A & 0x0F) - (val & 0x0F) - +!this.C;
                if (tmp < 0) tmp -= 0x06;
                res = (this.A & 0xF0) - (val & 0xF0) + tmp;
                this.C = res >= 0;
                if (res < 0) res -= 0x60;
            } else {
                res = 0xFF + this.A - val + +this.C;
                this.C = res >= 0x100;
            }

            this.V = !!((this.A ^ val) & (this.A ^ res) & 0x80);
            this.A = res & 0xFF;
            this.setNZ(this.A);
        },

        // Set Carry Flag
        SEC: (): void => {
            this.C = true;
        },

        // Set Decimal Mode
        SED: (): void => {
            this.D = true;
        },

        // Set Interrupt Disable Status
        SEI: (): void => {
            this.I = true;
        },

        // Store Accumulator in Memory
        STA: (addr: number): void => {
            this.store(addr, this.A);
        },

        // Store Index X in Memory
        STX: (addr: number): void => {
            this.store(addr, this.X);
        },

        // Store Index Y in Memory
        STY: (addr: number): void => {
            this.store(addr, this.Y);
        },

        // Transfer Accumulator to Index X
        TAX: (): void => {
            this.X = this.A;
            this.setNZ(this.X);
        },

        // Transfer Accumulator to Index Y
        TAY: (): void => {
            this.Y = this.A;
            this.setNZ(this.Y);
        },

        // Transfer Stack Pointer to Index X
        TSX: (): void => {
            this.X = this.S;
            this.setNZ(this.X);
        },

        // Transfer Index X to Accumulator
        TXA: (): void => {
            this.A = this.X;
            this.setNZ(this.A);
        },

        // Transfer Index X to Stack Pointer
        TXS: (): void => {
            this.S = this.X;
        },

        // Transfer Index Y to Accumulator
        TYA: (): void => {
            this.A = this.Y;
            this.setNZ(this.A);
        },
    };

    private loadWord(addr: number): number {
        return this.load(addr) + (this.load(addr + 1) << 8);
    }

    private push(val: number): void {
        this.store(0x0100 + this.S,  val);

        this.S -= 1;
        if (this.S < 0) this.S = 0xFF;
    }

    private pull(): number {
        this.S += 1;
        if (this.S > 0xFF) this.S = 0;

        return this.load(0x0100 + this.S);
    }

    private branch(offset: number): void {
        this.PC += offset < 128 ? offset : offset - 256;
    }

    private setNZ(val: number): void {
        this.N = !!(val & 0x80);
        this.Z = !val;
    }
}
