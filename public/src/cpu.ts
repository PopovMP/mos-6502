// noinspection DuplicatedCode

class Cpu {
	// The following instructions acts mostly on the address
	// designated by the operand instead of its value
	private readonly addressOperands = [
		'ASL', 'DEC', 'INC', 'LSR', 'JMP', 'JSR', 'ROL', 'ROR', 'STA', 'STX', 'STY'
	]
	private readonly dataSheet: DataSheet
	private readonly memory: Uint8Array

	private A: number
	private X: number
	private Y: number
	private S: number // Stack Pointer
	private PC: number

	private N: boolean // Negative flag
	private V: boolean // Overflow flag
	private B: boolean // Break Command
	private D: boolean // Decimal flag
	private I: boolean // Interrupt Disabled flag
	private Z: boolean // Zero flag
	private C: boolean // Carry flag

	private cycles: number
	private isStopRequired: boolean = false

	private get P(): number {
		return (+this.N << 7) | (+this.V << 6) | (      1 << 5) | (+this.B << 4) |
			   (+this.D << 3) | (+this.I << 2) | (+this.Z << 1) | (+this.C << 0)
	}

	private set P(val: number) {
		this.N = !!((val >> 7) & 0x01)
		this.V = !!((val >> 6) & 0x01)
		this.B = !!((val >> 4) & 0x01)
		this.D = !!((val >> 3) & 0x01)
		this.I = !!((val >> 2) & 0x01)
		this.Z = !!((val >> 1) & 0x01)
		this.C = !!((val >> 0) & 0x01)
	}

	public get currentPC(): number {
		return this.PC
	}

	constructor(memory: Uint8Array) {
		this.dataSheet = new DataSheet()
		this.memory = memory

		this.A = 0x00
		this.X = 0x00
		this.Y = 0x00
		this.S = 0xFF

		this.PC = 0x0000

		this.N = false
		this.V = false
		this.B = false
		this.D = false
		this.I = false
		this.Z = false
		this.C = false

		this.cycles = 0
	}

	public reset() {
		this.isStopRequired = false

		this.A = 0x00
		this.X = 0x00
		this.Y = 0x00
		this.S = 0xFF

		this.PC = 0x0000

		this.N = false
		this.V = false
		this.B = false
		this.D = false
		this.I = false
		this.Z = false
		this.C = false

		this.cycles = 7
		this.PC = this.loadWord(0xFFFC)
	}

	public run(): void {
		while (!this.isStopRequired) {
			this.step()
		}
	}

	public step(): boolean {
		if (this.isStopRequired) {
			return true
		}

		const opc: number  = this.memory[this.PC]
		const name: string = this.dataSheet.opCodeName[opc]
		const mode: string = this.dataSheet.opCodeMode[opc]
		const addr: number = this.effectiveAddress[mode]()
		const opr: number  = this.addressOperands.includes(name)
				? addr                      // Instruction needs the address to modify memory
				: mode === 'IMPL'           // Implied addressing mode doesn't require address
					? this.A                // However, it may need A register (Accumulator mode)
					: this.memory[addr]     // Instruction needs the operand value
		const bytes: number  = this.dataSheet.opCodeBytes[opc]
		const cycles: number = this.dataSheet.opCodeCycles[opc]

		const instrFunction: (opr: number, cycles: number) => boolean = this.instruction[name]

		if (instrFunction === undefined) {
			throw new Error('Instruction not implemented: ' + name)
		}

		const isGenericOperation = instrFunction(opr, cycles)

		if (isGenericOperation) {
			this.PC     += bytes
			this.cycles += cycles
		}

		this.isStopRequired = this.B || this.I || this.memory[this.PC] === 0x00
		return this.isStopRequired
	}

	public dumpStatus(): string {
		const getRegText = (val: number): string =>
			`${Utils.byteToHex(val)}  ${val.toString(10).padStart(3, ' ')}  ${Utils.byteToSInt(val).padStart(4, ' ')}`

		const flagsText = `${+this.N} ${+this.V} 1 ${+this.B} ${+this.D} ${+this.I} ${+this.Z} ${+this.C}`

		return '' +
			'R  Hex  Dec   +/-    R   Hex   N V - B D I Z C\n' +
			'-----------------    -------   ---------------\n' +
			`A   ${getRegText(this.A)}    P    ${Utils.byteToHex(this.P)}   ${flagsText}\n` +
			`X   ${getRegText(this.X)}    S    ${Utils.byteToHex(this.S)}\n` +
			`Y   ${getRegText(this.Y)}    PC ${Utils.wordToHex(this.PC)}   Cycles: ${this.cycles}`
	}

	public stop(): void {
		this.isStopRequired = true
	}

	private readonly effectiveAddress: Record<string, () => number> = {
		IMPL: () => NaN,
		IMM : () => this.PC + 1,
		ZP  : () => this.memory[this.PC + 1],
		ZPX : () => this.memory[this.PC + 1] + this.X,
		ZPY : () => this.memory[this.PC + 1] + this.Y,
		ABS : () => this.loadWord(this.PC + 1),
		ABSX: () => this.loadWord(this.PC + 1) + this.X,
		ABSY: () => this.loadWord(this.PC + 1) + this.Y,
		IND : () => this.loadWord(this.PC + 1),
		INDX: () => this.loadWord(this.memory[this.PC + 1] + this.X),
		INDY: () => this.loadWord(this.memory[this.PC + 1]) + this.Y,
		REL : () => this.PC + 1,
	}

	private readonly instruction: Record<string, (opr: number, cycles: number) => boolean> = {
		ADC: (opr: number) => {
			this.V = !((this.A ^ opr) & 0x80)

			const temp: number = this.A + opr + (this.C ? 1 : 0)
			this.A = temp & 0xFF

			if (temp >= 0x100) {
				this.C = true
				if (this.V && temp >= 0x180) {
					this.V = false
				}
			}
			else {
				this.C = false
				if (this.V && temp < 0x80) {
					this.V = false
				}
			}

			this.setNZ(this.A)
			return true
		},

		AND: (opr: number) => {
			// "AND" Memory with Accumulator
			this.A &= opr
			this.setNZ(this.A)
			return true
		},

		ASL: (addr: number) => {
			// Arithmetic Shift Left
			const input = isNaN(addr) ? this.A : this.memory[addr]
			const temp = input << 1
			this.C = (temp >> 8) === 1
			const val = temp & 0xFF

			if (isNaN(addr)) {
				this.A = val
			}
			else {
				this.memory[addr] = val
			}

			this.setNZ(val)
			return true
		},

		BCC: (opr: number, cycles: number) => {
			// Branch if Carry Clear
			if (!this.C) {
				this.branch(opr, cycles)
				return false
			}
			return true
		},

		BCS: (opr: number, cycles: number) => {
			// Branch if Carry Set
			if (this.C) {
				this.branch(opr, cycles)
				return false
			}
			return true
		},

		BEQ: (opr: number, cycles: number) => {
			// Branch if Equal
			if (this.Z) {
				this.branch(opr, cycles)
				return false
			}
			return true
		},

		BIT: (opr: number) => {
			// Test Bits in Memory with Accumulator
			const val = this.A & opr

			this.N = !!(opr >> 7)
			this.V = !!(opr >> 6)
			this.Z = !val

			return true
		},

		BMI: (opr: number, cycles: number) => {
			// Branch if Minus
			if (this.N) {
				this.branch(opr, cycles)
				return false
			}
			return true
		},

		BNE: (opr: number, cycles: number) => {
			// Branch if Not Equal
			if (!this.Z) {
				this.branch(opr, cycles)
				return false
			}
			return true
		},

		BPL: (opr: number, cycles: number) => {
			// BCS - Branch if Plus
			if (!this.N) {
				this.branch(opr, cycles)
				return false
			}
			return true
		},

		BRK: () => {
			// Break
			const addr = this.PC + 2
			this.push(addr & 0xFF)
			this.push((addr >> 8) & 0xFF)
			this.B = true
			this.push(this.P)
			this.B = false
			this.PC = this.loadWord(0xFFFE)
			this.cycles += 7
			return false
		},

		BVC: (opr: number, cycles: number) => {
			// Branch if Overflow Clear
			if (!this.V) {
				this.branch(opr, cycles)
				return false
			}
			return true
		},

		BVS: (opr: number, cycles: number) => {
			// Branch if Overflow Set
			if (this.V) {
				this.branch(opr, cycles)
				return false
			}
			return true
		},

		CMP: (opr: number) => {
			// Compare Memory and Accumulator
			const delta: number = this.A - opr
			this.C = this.A >= opr
			this.setNZ(delta)
			return true
		},

		CPX: (opr: number) => {
			// Compare Index Register X To Memory
			const delta: number = this.X - opr
			this.C = this.X >= opr
			this.setNZ(delta)
			return true
		},

		CPY: (opr: number) => {
			// Compare Index Register X To Memory
			const delta: number = this.Y - opr
			this.C = this.Y >= opr
			this.setNZ(delta)
			return true
		},

		CLC: () => {
			// CLC - Clear Carry Flag
			this.C = false
			return true
		},

		CLD: () => {
			// CLD - Clear Decimal Mode
			this.D = false
			return true
		},

		CLI: () => {
			// CLI - Clear Interrupt Disable
			this.I = false
			return true
		},

		CLV: () => {
			// Clear Overflow Flag
			this.V = false
			return true
		},

		DEC: (addr: number) => {
			// Decrement memory By One
			const val = isNaN(addr)
				? (this.A = this.A > 0 ? this.A - 1 : 0)
				: (this.memory[addr] = this.memory[addr] > 0 ? this.memory[addr] - 1 : 0xFF)
			this.setNZ(val)
			return true
		},

		DEX: () => {
			// Decrement Index Register X By One
			this.X = this.X > 0 ? this.X - 1 : 0xFF
			this.setNZ(this.X)
			return true
		},

		DEY: () => {
			// Decrement Index Register Y By One
			this.Y = this.Y > 0 ? this.Y - 1 : 0xFF
			this.setNZ(this.Y)
			return true
		},

		EOR: (opr: number) => {
			// Exclusive OR
			this.A ^= opr
			this.setNZ(this.A)
			return true
		},

		INC: (addr: number) => {
			// Increment Memory By One
			const val = isNaN(addr)
				? (this.A = this.A < 0xFF ? this.A + 1 : 0)
				: (this.memory[addr] = this.memory[addr] < 0xFF ? this.memory[addr] + 1 : 0)
			this.setNZ(val)
			return true
		},

		INX: () => {
			// Increment Index Register X By One
			this.X = this.X < 0xFF ? this.X + 1 : 0
			this.setNZ(this.X)
			return true
		},

		INY: () => {
			// Increment Index Register Y By One
			this.Y = this.Y < 0xFF ? this.Y + 1 : 0
			this.setNZ(this.Y)
			return true
		},

		LDA: (opr: number) => {
			// Load Accumulator with Memory
			this.A = opr
			this.setNZ(this.A)
			return true
		},

		LDX: (opr: number) => {
			// Load X Register
			this.X = opr
			this.setNZ(this.X)
			return true
		},

		LDY: (opr: number) => {
			// Load Y Register
			this.Y = opr
			this.setNZ(this.Y)
			return true
		},

		LSR: (addr: number) => {
			// Logical Shift Right
			const input = isNaN(addr) ? this.A : this.memory[addr]
			const out = input >> 1

			if (isNaN(addr)) {
				this.A = out
			}
			else {
				this.memory[addr] = out
			}

			this.N = false
			this.Z = !out
			this.C = !!(input & 1)
			return true
		},

		NOP: () => {
			// NOP - No Operation
			return true
		},

		ORA: (opr: number) => {
			// Logical OR
			this.A |= opr
			this.setNZ(this.A)
			return true
		},

		PHA: () => {
			// Push Accumulator On Stack
			this.push(this.A)
			return true
		},

		PHP: () => {
			// Push Processor Status On Stack
			this.push(this.P)
			return true
		},

		PLA: () => {
			// Pull Accumulator From Stack
			this.A = this.pull()
			this.setNZ(this.A)
			return true
		},

		PLP: () => {
			// Pull Processor Status From Stack
			this.P = this.pull()
			return true
		},

		JMP: (addr: number) => {
			// Jump
			this.PC = addr
			return false
		},

		JSR: (addr: number, cycles: number) => {
			// Jump To Subroutine
			const returnAddress = this.PC + 2
			this.push(returnAddress & 0xFF)
			this.push((returnAddress >> 8) & 0xFF)
			this.PC = addr
			this.cycles += cycles
			return false
		},

		ROL: (addr: number) => {
			// Rotate Left
			const input = isNaN(addr) ? this.A : this.memory[addr]
			const out = (input << 1) + +this.C

			if (isNaN(addr)) {
				this.A = out
			}
			else {
				this.memory[addr] = out
			}

			this.N = !!((input >> 6) & 1)
			this.Z = !out
			this.C = !!((input >> 7) & 1)
			return true
		},

		ROR: (addr: number) => {
			// Rotate Right
			const input = isNaN(addr) ? this.A : this.memory[addr]
			const out = ((input >> 1) + (+this.C << 7)) & 0xFF

			if (isNaN(addr)) {
				this.A = out
			}
			else {
				this.memory[addr] = out
			}

			this.N = this.C
			this.Z = !out
			this.C = !!(input & 1)
			return true
		},

		RTI: (opr: number, cycles: number) => {
			// Return From Subroutine
			this.P = this.pull()
			this.PC = (this.pull() << 8) + this.pull()
			this.cycles += cycles
			return false
		},

		RTS: (opr: number, cycles: number) => {
			// Return From Subroutine
			const address = (this.pull() << 8) + this.pull()
			this.PC = address + 1
			this.cycles += cycles
			return false
		},

		SBC: (opr: number) => {
			// Subtract with Cary
			this.V = !!((this.A ^ opr) & 0x80);
			const value = 0xff + this.A - opr + (this.C ? 1 : 0)

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
			return true
		},

		SEC: () => {
			// SEC - Set Carry Flag
			this.C = true
			return true
		},

		SED: () => {
			// SED - Set Decimal Mode
			this.D = true
			return true
		},

		SEI: () => {
			// SEI - Set Interrupt Disable
			this.I = true
			return true
		},

		STA: (addr: number) => {
			// Store Accumulator
			this.memory[addr] = this.A
			return true
		},

		STX: (addr: number) => {
			// Store X Register
			this.memory[addr] = this.X
			return true
		},

		STY: (addr: number) => {
			// Store Y Register
			this.memory[addr] = this.Y
			return true
		},

		TAX: () => {
			// TAX  - Transfer Accumulator To Index X
			this.X = this.A
			this.setNZ(this.X)
			return true
		},

		TAY: () => {
			// TAY  - Transfer Accumulator To Index Y
			this.Y = this.A
			this.setNZ(this.Y)
			return true
		},

		TSX: () => {
			// TSX - Transfer Stack Pointer To Index X
			this.X = this.S
			this.setNZ(this.X)
			return true
		},

		TXA: () => {
			// TXA - Transfer Index X To Accumulator
			this.A = this.X
			this.setNZ(this.A)
			return true
		},

		TXS: () => {
			// TXS - Transfer Index X To Stack Pointer
			this.S = this.X
			return true
		},

		TYA: () => {
			// Transfer Index Y To Accumulator
			this.A = this.Y
			this.setNZ(this.A)
			return true
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
		const val = this.memory[0x0100 + this.S]

		if (this.S > 0xFF) {
			this.S = 0
		}

		return val
	}

	private branch(offset: number, cycles: number): void {
		this.PC = offset > 0x7F
			? this.PC + 2 - (0x100 - offset)
			: this.PC + 2 + offset

		this.cycles += cycles + 1
	}

	private setNZ(val: number): void {
		this.N = !!(val >> 7)
		this.Z = !val
	}
}

module.exports.Cpu = Cpu
