// noinspection DuplicatedCode

class Cpu {
    // The following instructions need the address
    // designated by the operand instead of its value
    private readonly addressInstructions: string[] = [
        "ASL", "DEC", "INC", "LSR", "JMP", "JSR", "ROL", "ROR", "STA", "STX", "STY",
    ];
    private readonly dataSheet: DataSheet;
    private readonly memory   : Uint8Array;

    public A : number; // Accumulator
    public X : number; // X index register
    public Y : number; // Y index register
    public S : number; // Stack Pointer
    public PC: number; // Program Counter

    public N: boolean; // Negative flag
    public V: boolean; // Overflow flag
    public get B(): boolean {return true} // Break flag (always true)
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

    constructor(memory: Uint8Array) {
        this.dataSheet = new DataSheet();
        this.memory    = memory;

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
        const opc : number = this.memory[this.PC];
        const name: string = this.dataSheet.opCodeName[opc];

        if (name === undefined)
            throw new Error(`Invalid instruction '${Utils.byteToHex(opc)}' at: $${Utils.wordToHex(this.PC)}`);

        const mode: string = this.dataSheet.opCodeMode[opc];
        const opr : number = this.addressInstructions.includes(name)
                             ? this.operandAddress[mode]()                 // Instruction needs an effective address
                             : mode === "IMPL"                             // Implied addressing mode doesn't require address
                               ? this.A                                    // However, it may need the A register value
                               : this.memory[this.operandAddress[mode]()]; // Instruction needs the operand value

        this.PC += this.dataSheet.opCodeBytes[opc];

        this.instruction[name](opr);
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

    private readonly operandAddress: Record<string, () => number> = {
        IMPL: () => NaN, // Implied and Accumulator modes don't need an address
        IMM : () => this.PC + 1,
        ZP  : () => this.memory[this.PC + 1],
        ZPX : () => this.memory[this.PC + 1] + this.X,
        ZPY : () => this.memory[this.PC + 1] + this.Y,
        ABS : () => this.loadWord(this.PC + 1),
        ABSX: () => this.loadWord(this.PC + 1) + this.X,
        ABSY: () => this.loadWord(this.PC + 1) + this.Y,
        IND : () => this.loadWord(this.PC + 1),
        XZPI: () => this.loadWord(this.memory[this.PC + 1] + this.X),
        ZPIY: () => this.loadWord(this.memory[this.PC + 1]) + this.Y,
        REL : () => this.PC + 1,
    };

    private readonly instruction: Record<string, (opr: number) => void> = {
        ADC: (opr: number): void => {
            // Add Memory to Accumulator with Carry
            this.V = !((this.A ^ opr) & 0x80);

            const val: number = this.A + opr + +this.C;
            this.A = val & 0xFF;

            if (val >= 0x100) {
                this.C = true;
                if (this.V && val >= 0x180)
                    this.V = false;
            } else {
                this.C = false;
                if (this.V && val < 0x80)
                    this.V = false;
            }

            this.setNZ(this.A);
        },

        AND: (opr: number): void => {
            // "AND" Memory with Accumulator
            this.A &= opr;
            this.setNZ(this.A);
        },

        ASL: (addr: number): void => {
            // Shift Left One Bit (Memory or Accumulator)
            const input: number = isNaN(addr) ? this.A : this.memory[addr];
            const temp : number = input << 1;
            this.C = (temp >> 8) === 1;
            const val: number = temp & 0xFF;

            if (isNaN(addr))
                this.A = val;
            else
                this.memory[addr] = val;

            this.setNZ(val);
        },

        BCC: (opr: number): void => {
            // Branch on Carry Clear
            if (!this.C)
                this.branch(opr);
        },

        BCS: (opr: number): void => {
            // Branch on Carry Set
            if (this.C)
                this.branch(opr);
        },

        BEQ: (opr: number): void => {
            // Branch on Result Zero
            if (this.Z)
                this.branch(opr);
        },

        BIT: (opr: number): void => {
            // Test Bits in Memory with Accumulator
            const val: number = this.A & opr;

            this.N = !!(opr >> 7);
            this.V = !!(opr >> 6);
            this.Z = !val;
        },

        BMI: (opr: number): void => {
            // Branch on Result Minus
            if (this.N)
                this.branch(opr);
        },

        BNE: (opr: number): void => {
            // Branch on Result not Zero
            if (!this.Z)
                this.branch(opr);
        },

        BPL: (opr: number): void => {
            // Branch on Result Plus
            if (!this.N)
                this.branch(opr);
        },

        BRK: (): void => {
            // Force Break
            this.PC += 1;
            this.push((this.PC >> 8) & 0xFF);
            this.push(this.PC & 0xFF);
            this.PC = this.loadWord(0xFFFE);
        },

        BVC: (opr: number): void => {
            // Branch on Overflow Clear
            if (!this.V)
                this.branch(opr);
        },

        BVS: (opr: number): void => {
            // Branch on Overflow Set
            if (this.V)
                this.branch(opr);
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

        CMP: (opr: number): void => {
            // Compare Memory and Accumulator
            const delta: number = this.A - opr;
            this.C = this.A >= opr;
            this.setNZ(delta);
        },

        CPX: (opr: number): void => {
            // Compare Index X to Memory
            const delta: number = this.X - opr;
            this.C = this.X >= opr;
            this.setNZ(delta);
        },

        CPY: (opr: number): void => {
            // Compare Index X to Memory
            const delta: number = this.Y - opr;
            this.C = this.Y >= opr;
            this.setNZ(delta);
        },

        DEC: (addr: number): void => {
            // Decrement memory by One
            const val: number = this.memory[addr] = (this.memory[addr] - 1) & 0xFF;
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

        EOR: (opr: number): void => {
            // "Exclusive-Or" Memory with Accumulator
            this.A ^= opr;
            this.setNZ(this.A);
        },

        INC: (addr: number): void => {
            // Increment Memory by One
            const val: number = this.memory[addr] = (this.memory[addr] + 1) & 0xFF;
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

        LDA: (opr: number): void => {
            // Load Accumulator with Memory
            this.A = opr;
            this.setNZ(this.A);
        },

        LDX: (opr: number): void => {
            // Load X Register
            this.X = opr;
            this.setNZ(this.X);
        },

        LDY: (opr: number): void => {
            // Load Y Register
            this.Y = opr;
            this.setNZ(this.Y);
        },

        LSR: (addr: number): void => {
            // Logical Shift Right
            const input: number = isNaN(addr) ? this.A : this.memory[addr];
            const out  : number = input >> 1;

            if (isNaN(addr))
                this.A = out;
            else
                this.memory[addr] = out;

            this.N = false;
            this.Z = !out;
            this.C = !!(input & 1);
        },

        NOP: (): void => {
            // No Operation
        },

        ORA: (opr: number): void => {
            // "OR" Memory with Accumulator
            this.A |= opr;
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
            const input: number = isNaN(addr) ? this.A : this.memory[addr];
            const out  : number = (input << 1) + +this.C;

            if (isNaN(addr))
                this.A = out;
            else
                this.memory[addr] = out;

            this.N = !!((input >> 6) & 1);
            this.Z = !out;
            this.C = !!((input >> 7) & 1);
        },

        ROR: (addr: number): void => {
            // Rotate Right
            const input: number = isNaN(addr) ? this.A : this.memory[addr];
            const out  : number = ((input >> 1) + (+this.C << 7)) & 0xFF;

            if (isNaN(addr))
                this.A = out;
            else
                this.memory[addr] = out;

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

        SBC: (opr: number): void => {
            // Subtract Memory from Accumulator with Borrow
            this.V = !!((this.A ^ opr) & 0x80);
            const value: number = 0xff + this.A - opr + (this.C ? 1 : 0);

            if (value < 0x100) {
                this.C = false;
                if (this.V && value < 0x80)
                    this.V = false;
            } else {
                this.C = true;
                if (this.V && value >= 0x180)
                    this.V = false;
            }

            this.A = value & 0xff;
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
            this.memory[addr] = this.A;
        },

        STX: (addr: number): void => {
            // Store Index X in Memory
            this.memory[addr] = this.X;
        },

        STY: (addr: number): void => {
            // Store Index Y in Memory
            this.memory[addr] = this.Y;
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

    private loadWord(addr: number): number {
        return this.memory[addr] + (this.memory[addr + 1] << 8);
    }

    private push(val: number): void {
        this.memory[0x0100 + this.S] = val;

        this.S -= 1;

        if (this.S < 0)
            this.S = 0xFF;
    }

    private pull(): number {
        this.S += 1;

        if (this.S > 0xFF)
            this.S = 0;

        return this.memory[0x0100 + this.S];
    }

    private branch(offset: number): void {
        this.PC += offset < 128 ? offset : offset - 256;
    }

    private setNZ(val: number): void {
        this.N = !!(val >> 7);
        this.Z = !val;
    }
}

module.exports.Cpu = Cpu;
