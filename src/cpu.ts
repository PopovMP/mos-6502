// noinspection DuplicatedCode

class Cpu {
	// The following instructions need the address
	// designated by the operand instead of its value
	private readonly addressInstructions = [
		'ASL', 'DEC', 'INC', 'LSR', 'JMP', 'JSR', 'ROL', 'ROR', 'STA', 'STX', 'STY'
	]
	private readonly dataSheet: DataSheet
	private readonly memory: Uint8Array

	public A: number  // Accumulator
	public X: number  // X index register
	public Y: number  // Y index register
	public S: number  // Stack Pointer
	public PC: number // Program Counter

	public N: boolean // Negative flag
	public V: boolean // Overflow flag
	public B: boolean // Break Command
	public D: boolean // Decimal flag
	public I: boolean // Interrupt Disabled flag
	public Z: boolean // Zero flag
	public C: boolean // Carry flag

	// Processor Status
	public get P(): number {
		return  (+this.N << 7) |
				(+this.V << 6) |
				(      1 << 5) |
				(+this.B << 4) |
				(+this.D << 3) |
				(+this.I << 2) |
				(+this.Z << 1) |
				(+this.C << 0)
	}

	public set P(val: number) {
		this.N = !!((val >> 7) & 0x01)
		this.V = !!((val >> 6) & 0x01)
		this.B = !!((val >> 4) & 0x01)
		this.D = !!((val >> 3) & 0x01)
		this.I = !!((val >> 2) & 0x01)
		this.Z = !!((val >> 1) & 0x01)
		this.C = !!((val >> 0) & 0x01)
	}

	constructor(memory: Uint8Array) {
		this.dataSheet = new DataSheet()
		this.memory = memory

		this.A = Utils.randomByte()
		this.X = Utils.randomByte()
		this.Y = Utils.randomByte()
		this.S = Utils.randomByte()

		this.PC = 0x0000

		this.N = false
		this.V = false
		this.B = false
		this.D = false
		this.I = false
		this.Z = false
		this.C = false
	}

	public reset(): void {
		this.B  = false
		this.PC = this.loadWord(0xFFFC)
	}

	public step(): void {
		const opc: number  = this.memory[this.PC]
		const name: string = this.dataSheet.opCodeName[opc]

		if (name === undefined) {
			throw new Error(`Invalid instruction '${Utils.byteToHex(opc)}' at: $${Utils.wordToHex(this.PC)}`)
		}

		const mode: string = this.dataSheet.opCodeMode[opc]
		const opr: number  = this.addressInstructions.includes(name)
				? this.operandAddress[mode]()                   // Instruction needs an effective address
				: mode === 'IMPL'                               // Implied addressing mode doesn't require address
					? this.A                                    // However, it may need the A register value
					: this.memory[this.operandAddress[mode]()]  // Instruction needs the operand value

		this.PC += this.dataSheet.opCodeBytes[opc]

		this.instruction[name](opr)
	}

	public run(): void {
		this.B = false

		while (!this.B) {
			this.step()
		}
	}

	private readonly operandAddress: Record<string, () => number> = {
		IMPL: () => NaN, // Implied and Accumulator modes don't need address
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
	}

	private readonly instruction: Record<string, (opr: number) => void> = {
		ADC: (opr: number) => {
			// Add Memory to Accumulator with Carry
			this.V = !((this.A ^ opr) & 0x80)

			const val: number = this.A + opr + +this.C
			this.A = val & 0xFF

			if (val >= 0x100) {
				this.C = true
				if (this.V && val >= 0x180) {
					this.V = false
				}
			}
			else {
				this.C = false
				if (this.V && val < 0x80) {
					this.V = false
				}
			}

			this.setNZ(this.A)
		},

		AND: (opr: number) => {
			// "AND" Memory with Accumulator
			this.A &= opr
			this.setNZ(this.A)
		},

		ASL: (addr: number) => {
			// Arithmetic Shift Left
			const input: number = isNaN(addr) ? this.A : this.memory[addr]
			const temp: number  = input << 1
			this.C = (temp >> 8) === 1
			const val = temp & 0xFF

			if (isNaN(addr)) {
				this.A = val
			}
			else {
				this.memory[addr] = val
			}

			this.setNZ(val)
		},

		BCC: (opr: number) => {
			// Branch if Carry Clear
			if (!this.C) {
				this.branch(opr)
			}
		},

		BCS: (opr: number) => {
			// Branch if Carry Set
			if (this.C) {
				this.branch(opr)
			}
		},

		BEQ: (opr: number) => {
			// Branch if Equal
			if (this.Z) {
				this.branch(opr)
			}
		},

		BIT: (opr: number) => {
			// Test Bits in Memory with Accumulator
			const val: number = this.A & opr

			this.N = !!(opr >> 7)
			this.V = !!(opr >> 6)
			this.Z = !val
		},

		BMI: (opr: number) => {
			// Branch if Minus
			if (this.N) {
				this.branch(opr)
			}
		},

		BNE: (opr: number) => {
			// Branch if Not Equal
			if (!this.Z) {
				this.branch(opr)
			}
		},

		BPL: (opr: number) => {
			// BCS - Branch if Plus
			if (!this.N) {
				this.branch(opr)
			}
		},

		BRK: () => {
			// Break
			const addr: number = this.PC + 1
			this.push(addr & 0xFF)
			this.push((addr >> 8) & 0xFF)
			this.B = true
			this.push(this.P)
			this.PC = this.loadWord(0xFFFE)
		},

		BVC: (opr: number) => {
			// Branch if Overflow Clear
			if (!this.V) {
				this.branch(opr)
			}
		},

		BVS: (opr: number) => {
			// Branch if Overflow Set
			if (this.V) {
				this.branch(opr)
			}
		},

		CMP: (opr: number) => {
			// Compare Memory and Accumulator
			const delta: number = this.A - opr
			this.C = this.A >= opr
			this.setNZ(delta)
		},

		CPX: (opr: number) => {
			// Compare Index Register X To Memory
			const delta: number = this.X - opr
			this.C = this.X >= opr
			this.setNZ(delta)
		},

		CPY: (opr: number) => {
			// Compare Index Register X To Memory
			const delta: number = this.Y - opr
			this.C = this.Y >= opr
			this.setNZ(delta)
		},

		CLC: () => {
			// CLC - Clear Carry Flag
			this.C = false
		},

		CLD: () => {
			// CLD - Clear Decimal Mode
			this.D = false
		},

		CLI: () => {
			// CLI - Clear Interrupt Disable
			this.I = false
		},

		CLV: () => {
			// Clear Overflow Flag
			this.V = false
		},

		DEC: (addr: number) => {
			// Decrement memory By One
			const val: number = this.memory[addr] = this.memory[addr] > 0 ? this.memory[addr] - 1 : 0xFF
			this.setNZ(val)
		},

		DEX: () => {
			// Decrement Index Register X By One
			this.X = this.X > 0 ? this.X - 1 : 0xFF
			this.setNZ(this.X)
		},

		DEY: () => {
			// Decrement Index Register Y By One
			this.Y = this.Y > 0 ? this.Y - 1 : 0xFF
			this.setNZ(this.Y)
		},

		EOR: (opr: number) => {
			// Exclusive OR
			this.A ^= opr
			this.setNZ(this.A)
		},

		INC: (addr: number) => {
			// Increment Memory By One
			const val: number = this.memory[addr] = this.memory[addr] < 0xFF ? this.memory[addr] + 1 : 0
			this.setNZ(val)
		},

		INX: () => {
			// Increment Index Register X By One
			this.X = this.X < 0xFF ? this.X + 1 : 0
			this.setNZ(this.X)
		},

		INY: () => {
			// Increment Index Register Y By One
			this.Y = this.Y < 0xFF ? this.Y + 1 : 0
			this.setNZ(this.Y)
		},

		LDA: (opr: number) => {
			// Load Accumulator with Memory
			this.A = opr
			this.setNZ(this.A)
		},

		LDX: (opr: number) => {
			// Load X Register
			this.X = opr
			this.setNZ(this.X)
		},

		LDY: (opr: number) => {
			// Load Y Register
			this.Y = opr
			this.setNZ(this.Y)
		},

		LSR: (addr: number) => {
			// Logical Shift Right
			const input: number = isNaN(addr) ? this.A : this.memory[addr]
			const out: number   = input >> 1

			if (isNaN(addr)) {
				this.A = out
			}
			else {
				this.memory[addr] = out
			}

			this.N = false
			this.Z = !out
			this.C = !!(input & 1)
		},

		NOP: () => {
			// NOP - No Operation
		},

		ORA: (opr: number) => {
			// Logical OR
			this.A |= opr
			this.setNZ(this.A)
		},

		PHA: () => {
			// Push Accumulator On Stack
			this.push(this.A)
		},

		PHP: () => {
			// Push Processor Status On Stack
			this.push(this.P)
		},

		PLA: () => {
			// Pull Accumulator From Stack
			this.A = this.pull()
			this.setNZ(this.A)
		},

		PLP: () => {
			// Pull Processor Status From Stack
			this.P = this.pull()
		},

		JMP: (addr: number) => {
			// Jump
			this.PC = addr
		},

		JSR: (addr: number) => {
			// Jump To Subroutine
			const returnAddress: number = this.PC - 1
			this.push(returnAddress & 0xFF)
			this.push((returnAddress >> 8) & 0xFF)
			this.PC = addr
		},

		ROL: (addr: number) => {
			// Rotate Left
			const input: number = isNaN(addr) ? this.A : this.memory[addr]
			const out: number   = (input << 1) + +this.C

			if (isNaN(addr)) {
				this.A = out
			}
			else {
				this.memory[addr] = out
			}

			this.N = !!((input >> 6) & 1)
			this.Z = !out
			this.C = !!((input >> 7) & 1)
		},

		ROR: (addr: number) => {
			// Rotate Right
			const input: number = isNaN(addr) ? this.A : this.memory[addr]
			const out: number   = ((input >> 1) + (+this.C << 7)) & 0xFF

			if (isNaN(addr)) {
				this.A = out
			}
			else {
				this.memory[addr] = out
			}

			this.N = this.C
			this.Z = !out
			this.C = !!(input & 1)
		},

		RTI: () => {
			// Return From Subroutine
			this.P  = this.pull()
			this.PC = (this.pull() << 8) + this.pull()
		},

		RTS: () => {
			// Return From Subroutine
			const address: number = (this.pull() << 8) + this.pull()
			this.PC = address + 1
		},

		SBC: (opr: number) => {
			// Subtract with Cary
			this.V = !!((this.A ^ opr) & 0x80);
			const value: number = 0xff + this.A - opr + (this.C ? 1 : 0)

			if (value < 0x100) {
				this.C = false
				if (this.V && value < 0x80) {
					this.V = false
				}
			}
			else {
				this.C = true
				if (this.V && value >= 0x180) {
					this.V = false
				}
			}

			this.A = value & 0xff
		},

		SEC: () => {
			// SEC - Set Carry Flag
			this.C = true
		},

		SED: () => {
			// SED - Set Decimal Mode
			this.D = true
		},

		SEI: () => {
			// SEI - Set Interrupt Disable
			this.I = true
		},

		STA: (addr: number) => {
			// Store Accumulator
			this.memory[addr] = this.A
		},

		STX: (addr: number) => {
			// Store X Register
			this.memory[addr] = this.X
		},

		STY: (addr: number) => {
			// Store Y Register
			this.memory[addr] = this.Y
		},

		TAX: () => {
			// TAX  - Transfer Accumulator To Index X
			this.X = this.A
			this.setNZ(this.X)
		},

		TAY: () => {
			// TAY  - Transfer Accumulator To Index Y
			this.Y = this.A
			this.setNZ(this.Y)
		},

		TSX: () => {
			// TSX - Transfer Stack Pointer To Index X
			this.X = this.S
			this.setNZ(this.X)
		},

		TXA: () => {
			// TXA - Transfer Index X To Accumulator
			this.A = this.X
			this.setNZ(this.A)
		},

		TXS: () => {
			// TXS - Transfer Index X To Stack Pointer
			this.S = this.X
		},

		TYA: () => {
			// Transfer Index Y To Accumulator
			this.A = this.Y
			this.setNZ(this.A)
		},
	}

	private loadWord(addr: number): number {
		return this.memory[addr] + (this.memory[addr + 1] << 8)
	}

	private push(val: number): void {
		this.memory[0x0100 + this.S] = val

		this.S -= 1

		if (this.S < 0) {
			this.S = 0xFF
		}
	}

	private pull(): number {
		this.S += 1

		if (this.S > 0xFF) {
			this.S = 0
		}

		return this.memory[0x0100 + this.S]
	}

	private branch(offset: number): void {
		this.PC += offset < 128 ? offset : offset - 256
	}

	private setNZ(val: number): void {
		this.N = !!(val >> 7)
		this.Z = !val
	}
}

module.exports.Cpu = Cpu
