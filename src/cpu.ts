// noinspection DuplicatedCode

import {Utils} from "./utils.js";
import {DataSheet} from "./data-sheet.js";

export class Cpu {
    // The following instructions need the address
    // designated by the operand instead of its value
    private readonly addressInstructions: string[] = [
        "ASL", "DEC", "INC", "LSR", "JMP", "JSR", "ROL", "ROR", "STA", "STX", "STY",
    ];
    private readonly dataSheet: DataSheet;

    public currentPC: number;

    public A : number; // Accumulator
    public X : number; // X index register
    public Y : number; // Y index register
    public S : number; // Stack Pointer
    public PC: number; // Program Counter

    public N: boolean; // Negative flag
    public V: boolean; // Overflow flag
    public readonly B: boolean = true; // Break flag (always true)
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

    public set P(val: number) {
        this.N = !!((val >> 7) & 0x01);
        this.V = !!((val >> 6) & 0x01);
        this.D = !!((val >> 3) & 0x01);
        this.I = !!((val >> 2) & 0x01);
        this.Z = !!((val >> 1) & 0x01);
        this.C = !!((val >> 0) & 0x01);
    }

    private readonly load : (addr: number) => number;
    private readonly store: (addr: number, data: number) => void;

    constructor(load : (addr: number) => number,
                store: (addr: number, data: number) => void) {
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
        this.currentPC = this.PC;
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
        this.currentPC = this.PC;
    }

    public step(): void {
        const opcode: number = this.load(this.PC);
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

        this.currentPC = this.PC;
        this.PC += this.dataSheet.opCodeBytes[opcode];

        this.instruction[instructionName](operandValue);
    }

    // noinspection JSUnusedGlobalSymbols
    public irq(): void {
        if (this.I) return;

        this.push((this.PC >> 8) & 0xFF);
        this.push(this.PC & 0xFF);
        this.push((this.P | 0x02) & ~(1 << 0x04)); // Set I, reset B
        this.PC = this.loadWord(0xFFFE);
    }

    // noinspection JSUnusedGlobalSymbols
    public nmi(): void {
        this.push((this.PC >> 8) & 0xFF);
        this.push(this.PC & 0xFF);
        this.push((this.P | 0x02) & ~(1 << 0x04)); // Set I, reset B
        this.PC = this.loadWord(0xFFFA);
    }

    private readonly operandAddress: Record<string, (addr: number, x: number, y: number) => number> = {
        IMPL: (): number => NaN, // Implied and Accumulator modes don't need an address
        IMM : (addr: number                      ): number => addr,
        ZP  : (addr: number                      ): number => this.load(addr),
        ZPX : (addr: number, x: number           ): number => this.load(addr) + x,
        ZPY : (addr: number, _: number, y: number): number => this.load(addr) + y,
        ABS : (addr: number                      ): number => this.loadWord(addr),
        ABSX: (addr: number, x: number           ): number => this.loadWord(addr) + x,
        ABSY: (addr: number, _: number, y: number): number => this.loadWord(addr) + y,
        IND : (addr: number                      ): number => this.loadWord(addr),
        XZPI: (addr: number, x: number           ): number => this.loadWord((this.load(addr) + x) & 0xFF),
        ZPIY: (addr: number, _: number, y: number): number => this.loadWord(this.load(addr)) + y,
        REL : (addr: number                      ): number => addr,
    };

    private loadWord(addr: number): number {
        return this.load(addr) + (this.load(addr + 1) << 8);
    }

    private readonly instruction: Record<string, (opr: number) => void> = {
        ADC: (val: number): void => {
            // Add Memory to Accumulator with Carry
            this.V = !((this.A ^ val) & 0x80);

            const res: number = this.A + val + +this.C;
            this.A = res & 0xFF;

            if (res >= 0x100) {
                this.C = true;
                if (this.V && res >= 0x180)
                    this.V = false;
            } else {
                this.C = false;
                if (this.V && res < 0x80)
                    this.V = false;
            }

            this.setNZ(this.A);
        },

        AND: (val: number): void => {
            // "AND" Memory with Accumulator
            this.A &= val;
            this.setNZ(this.A);
        },

        ASL: (addr: number): void => {
            // Shift Left One Bit (Memory or Accumulator)
            const input: number = isNaN(addr) ? this.A : this.load(addr);
            const temp : number = input << 1;
            this.C = (temp >> 8) === 1;
            const val: number = temp & 0xFF;

            if (isNaN(addr))
                this.A = val;
            else
                this.store(addr, val);

            this.setNZ(val);
        },

        BCC: (addr: number): void => {
            // Branch on Carry Clear
            if (!this.C)
                this.branch(addr);
        },

        BCS: (addr: number): void => {
            // Branch on Carry Set
            if (this.C)
                this.branch(addr);
        },

        BEQ: (addr: number): void => {
            // Branch on Result Zero
            if (this.Z)
                this.branch(addr);
        },

        BIT: (val: number): void => {
            // Test Bits in Memory with Accumulator
            const res: number = this.A & val;

            this.N = !!(val >> 7);
            this.V = !!(val >> 6);
            this.Z = !res;
        },

        BMI: (addr: number): void => {
            // Branch on Result Minus
            if (this.N)
                this.branch(addr);
        },

        BNE: (addr: number): void => {
            // Branch on Result not Zero
            if (!this.Z)
                this.branch(addr);
        },

        BPL: (addr: number): void => {
            // Branch on Result Plus
            if (!this.N)
                this.branch(addr);
        },

        BRK: (): void => {
            // Force Break
            this.PC += 1;
            this.push((this.PC >> 8) & 0xFF);
            this.push(this.PC & 0xFF);
            this.PC = this.loadWord(0xFFFE);
        },

        BVC: (addr: number): void => {
            // Branch on Overflow Clear
            if (!this.V)
                this.branch(addr);
        },

        BVS: (addr: number): void => {
            // Branch on Overflow Set
            if (this.V)
                this.branch(addr);
        },

        CLC: (): void => {
            // Clear Carry Flag
            this.C = false;
        },

        CLD: (): void => {
            // Clear Decimal Mode
            this.D = false;
        },

        CLI: (): void => {
            // Clear interrupt Disable Bit
            this.I = false;
        },

        CLV: (): void => {
            // Clear Overflow Flag
            this.V = false;
        },

        CMP: (val: number): void => {
            // Compare Memory and Accumulator
            const delta: number = this.A - val;
            this.C = this.A >= val;
            this.setNZ(delta);
        },

        CPX: (val: number): void => {
            // Compare Index X to Memory
            const delta: number = this.X - val;
            this.C = this.X >= val;
            this.setNZ(delta);
        },

        CPY: (val: number): void => {
            // Compare Index Y to Memory
            const delta: number = this.Y - val;
            this.C = this.Y >= val;
            this.setNZ(delta);
        },

        DEC: (addr: number): void => {
            // Decrement memory by One
            const val: number = (this.load(addr) - 1) & 0xFF;
            this.store(addr, val);
            this.setNZ(val);
        },

        DEX: (): void => {
            // Decrement Index X by One
            this.X = (this.X - 1) & 0xFF;
            this.setNZ(this.X);
        },

        DEY: (): void => {
            // Decrement Index Y by One
            this.Y = (this.Y - 1) & 0xFF;
            this.setNZ(this.Y);
        },

        EOR: (val: number): void => {
            // "Exclusive-Or" Memory with Accumulator
            this.A ^= val;
            this.setNZ(this.A);
        },

        INC: (addr: number): void => {
            // Increment Memory by One
            const val: number = (this.load(addr) + 1) & 0xFF;
            this.store(addr, val);
            this.setNZ(val);
        },

        INX: (): void => {
            // Increment Index X by One
            this.X = (this.X + 1) & 0xFF;
            this.setNZ(this.X);
        },

        INY: (): void => {
            // Increment Index y By One
            this.Y = (this.Y + 1) & 0xFF;
            this.setNZ(this.Y);
        },

        JMP: (addr: number): void => {
            // Jump to New Location
            this.PC = addr;
        },

        JSR: (addr: number): void => {
            // Save the Return Address, Jump to New Location
            this.PC -= 1;
            this.push((this.PC >> 8) & 0xFF);
            this.push(this.PC & 0xFF);
            this.PC = addr;
        },

        LDA: (val: number): void => {
            // Load Accumulator with Memory
            this.A = val;
            this.setNZ(this.A);
        },

        LDX: (val: number): void => {
            // Load X Register
            this.X = val;
            this.setNZ(this.X);
        },

        LDY: (val: number): void => {
            // Load Y Register
            this.Y = val;
            this.setNZ(this.Y);
        },

        LSR: (addr: number): void => {
            // Logical Shift Right
            const input: number = isNaN(addr) ? this.A : this.load(addr);
            const out  : number = input >> 1;

            if (isNaN(addr))
                this.A = out;
            else
                this.store(addr, out);

            this.N = false;
            this.Z = !out;
            this.C = !!(input & 1);
        },

        NOP: (): void => {
            // No Operation
        },

        ORA: (val: number): void => {
            // "OR" Memory with Accumulator
            this.A |= val;
            this.setNZ(this.A);
        },

        PHA: (): void => {
            // Push Accumulator On Stack
            this.push(this.A);
        },

        PHP: (): void => {
            // Push Processor Status On Stack
            this.push(this.P);
        },

        PLA: (): void => {
            // Pull Accumulator From Stack
            this.A = this.pull();
            this.setNZ(this.A);
        },

        PLP: (): void => {
            // Pull Processor Status From Stack
            this.P = this.pull();
        },

        ROL: (addr: number): void => {
            // Rotate Left
            const input: number = isNaN(addr) ? this.A : this.load(addr);
            const out  : number = (input << 1) + +this.C;

            if (isNaN(addr))
                this.A = out;
            else
                this.store(addr, out);

            this.N = !!((input >> 6) & 1);
            this.Z = !out;
            this.C = !!((input >> 7) & 1);
        },

        ROR: (addr: number): void => {
            // Rotate Right
            const input: number = isNaN(addr) ? this.A : this.load(addr);
            const out  : number = ((input >> 1) + (+this.C << 7)) & 0xFF;

            if (isNaN(addr))
                this.A = out;
            else
                this.store(addr, out);

            this.N = this.C;
            this.Z = !out;
            this.C = !!(input & 1);
        },

        RTI: (): void => {
            // Return from Interrupt
            this.P  = this.pull();
            this.PC = this.pull() + (this.pull() << 8);
            this.I  = false;
        },

        RTS: (): void => {
            // Return from Subroutine
            this.PC = this.pull() + (this.pull() << 8) + 1;
        },

        SBC: (val: number): void => {
            // Subtract Memory from Accumulator with Borrow
            this.V = !!((this.A ^ val) & 0x80);
            const res: number = 0xff + this.A - val + (this.C ? 1 : 0);

            if (res < 0x100) {
                this.C = false;
                if (this.V && res < 0x80)
                    this.V = false;
            } else {
                this.C = true;
                if (this.V && res >= 0x180)
                    this.V = false;
            }

            this.A = res & 0xff;
        },

        SEC: (): void => {
            // Set Carry Flag
            this.C = true;
        },

        SED: (): void => {
            // Set Decimal Mode
            this.D = true;
        },

        SEI: (): void => {
            // Set Interrupt Disable Status
            this.I = true;
        },

        STA: (addr: number): void => {
            // Store Accumulator in Memory
            this.store(addr, this.A);
        },

        STX: (addr: number): void => {
            // Store Index X in Memory
            this.store(addr, this.X);
        },

        STY: (addr: number): void => {
            // Store Index Y in Memory
            this.store(addr, this.Y);
        },

        TAX: (): void => {
            // Transfer Accumulator to Index X
            this.X = this.A;
            this.setNZ(this.X);
        },

        TAY: (): void => {
            // Transfer Accumulator to Index Y
            this.Y = this.A;
            this.setNZ(this.Y);
        },

        TSX: (): void => {
            // Transfer Stack Pointer to Index X
            this.X = this.S;
            this.setNZ(this.X);
        },

        TXA: (): void => {
            // Transfer Index X to Accumulator
            this.A = this.X;
            this.setNZ(this.A);
        },

        TXS: (): void => {
            // Transfer Index X to Stack Pointer
            this.S = this.X;
        },

        TYA: (): void => {
            // Transfer Index Y to Accumulator
            this.A = this.Y;
            this.setNZ(this.A);
        },
    };

    private push(val: number): void {
        this.store(0x0100 + this.S,  val);

        this.S -= 1;

        if (this.S < 0)
            this.S = 0xFF;
    }

    private pull(): number {
        this.S += 1;

        if (this.S > 0xFF)
            this.S = 0;

        return this.load(0x0100 + this.S);
    }

    private branch(offset: number): void {
        this.PC += offset < 128 ? offset : offset - 256;
    }

    private setNZ(val: number): void {
        this.N = !!(val >> 7);
        this.Z = !val;
    }
}