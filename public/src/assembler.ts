// noinspection JSMethodCanBeStatic

type CodeToken = {
	tokenType: 'label' | 'instruction' | 'set-pc' | 'error',
	instrName: string,
	codeLine: string,
	pcValue?: number,
	error?: string
}

type CodeTokenDto = {
	codeTokens: CodeToken[],
	variables: Record<string, string>,
	labels: Record<string, number>,
}

type InstructionToken = {
	pc: number,
	opc: number,
	name: string,
	bytes: number[],
	labelRequired?: string,
	error?: string,
}

type DisassemblyToken = {
	address: string,
	code: string[],
	text: string,
	mode: string,
	bytes: number,
	description: string,
}

type VariableMatch = {
	isVariable: boolean,
	varName?: string,
	error?: string,
}

type LabelMatch = {
	isLabel: boolean,
	labelName?: string,
	error?: string,
}

type CodePCMatch = {
	isPC: boolean,
	pcValue?: number,
	error?: string,
}

type CodePages = Record<string, Array<number | null>>

class Assembler {
	public static hexDump(codePages: CodePages): string {
		const dumpLines = []

		for (const pageAddress of Object.keys(codePages)) {
			dumpLines.push( pageAddress + ': ' + codePages[pageAddress]
				.map(n => n === null ? ' .' : Utils.byteToHex(n))
				.join(' ') )
		}

		return dumpLines.join('\n')
	}

	private readonly dataSheet: DataSheet

	constructor() {
		this.dataSheet = new DataSheet()
	}

	public load(sourcecode: string, memory: Uint8Array): void {
		const codePages: CodePages = this.assemble(sourcecode)
		let isPcSet = false

		for (const pageTag of Object.keys(codePages)) {
			const pageAddress = parseInt(pageTag, 16)
			for (let offset = 0; offset < codePages[pageTag].length; offset++){
				const value = codePages[pageTag][offset]
				if (typeof value === 'number') {
					const address = pageAddress + offset
					memory[address] = value

					if (!isPcSet ) {
						memory[0xFFFC] = address & 0x00FF
						memory[0xFFFD] = (address >> 8) & 0x00FF
						isPcSet = true
					}
				}
			}
		}
	}

	public assemble(sourceCode: string): CodePages {
		const codeDto: CodeTokenDto = this.tokenize(sourceCode)
		return this.parse(codeDto)
	}

	public tokenize(sourceCode: string): CodeTokenDto {
		const codeLines: string[] = this.cleanSourceCode(sourceCode)
		return this.tokenizeSourceCode(codeLines)
	}

	public parse(codeDto: CodeTokenDto): CodePages {
		const instTokens: InstructionToken[] = this.parseInstructions(codeDto)
		this.resolveUnsetLabels(codeDto, instTokens)
		return this.composeMachineCodePages(instTokens)
	}

	public disassemble(code: number[], initialPC: number) {
		const output: DisassemblyToken[] = []

		let index = 0
		let pc = initialPC

		while(index < code.length) {
			const opc: number = code[index]

			if (!this.dataSheet.opCodeName.hasOwnProperty(opc) ) {
				const token: DisassemblyToken = {
					address: Utils.wordToHex(pc),
					code   : [ Utils.byteToHex(opc) ],
					text   : '.BYTE $' + Utils.byteToHex(opc),
					mode   : 'Data',
					bytes  : 1,
					description: 'Data'
				}

				output.push(token)
				index += 1
				pc += 1

				continue
			}

			const name: string  = this.dataSheet.opCodeName[opc]
			const mode: string  = this.dataSheet.opCodeMode[opc]
			const bytes: number = this.dataSheet.opCodeBytes[opc]

			const token: DisassemblyToken = {
				address: Utils.wordToHex(pc),
				code   : [ Utils.byteToHex(opc) ],
				text   : this.dataSheet.opCodeName[opc],
				mode   : mode,
				bytes  : bytes,
				description: this.dataSheet.instrDescription[name]
			}

			if (bytes === 1) {
				// Accumulator implied mode: ASL A, LSR A, ROL A, ROR A
				if ( [0x0A, 0x4A, 0x2A, 0x6A].includes(opc) ) {
					token.text += ' A'
				}

				output.push(token)
				index += bytes
				pc += bytes
				continue
			}

			switch (mode) {
				case 'IMM':
					token.text += ' #$'
					break
				case 'IND':
				case 'INDX':
				case 'INDY':
					token.text += ' ($'
					break
				default:
					token.text += ' $'
					break
			}

			if ( ['BPL', 'BMI', 'BVC', 'BVS', 'BCC', 'BCS', 'BNE', 'BEQ'].includes(this.dataSheet.opCodeName[opc]) ) {
				// Relative mode
				token.code.push( Utils.byteToHex(code[index + 1]) )
				token.text += Utils.wordToHex(pc + code[index + 1] + bytes)
			}
			else if (bytes === 2) {
				token.code.push( Utils.byteToHex(code[index + 1]) )
				token.text += Utils.byteToHex(code[index + 1])
			}
			else if (bytes === 3) {
				// The machine code is Little-endian
				token.code.push( Utils.byteToHex(code[index + 1]) ) // LL
				token.code.push( Utils.byteToHex(code[index + 2]) ) // HH

				// The assembly code is Big-endian
				token.text += Utils.byteToHex(code[index + 2]) + Utils.byteToHex(code[index + 1])
			}

			switch (mode) {
				case 'ABSX':
				case 'ZPX':
					token.text += ',X'
					break
				case 'ABSY':
				case 'ZPY':
					token.text += ',Y'
					break
				case 'INDX':
					token.text += ',X)'
					break
				case 'INDY':
					token.text += '),Y'
					break
			}

			output.push(token)
			index += bytes
			pc += bytes
		}

		return output
	}

	public codePagesToBytes(codePages: CodePages): number[] {
		const code: number[] = []

		for (const pageAddressText of Object.keys(codePages)) {
			const pageData: Array<number | null> = codePages[pageAddressText]
			for (let index = 0; index < pageData.length; index++){
				if (typeof pageData[index] === 'number') {
					code.push( pageData[index] as number)
				}
			}
		}

		return code
	}

	private composeMachineCodePages(instTokens: InstructionToken[]): CodePages {
		const pages: CodePages = {}

		// Make pages
		for(const token of instTokens) {
			for (let b = 0; b < token.bytes.length; b++) {
				const pageAddress = token.pc + b - (token.pc + b) % 16
				const pageKey :string = Utils.wordToHex(pageAddress)
				if ( !pages.hasOwnProperty(pageKey) ) {
					pages[pageKey] = new Array(16).fill(null)
				}
				pages[pageKey][token.pc + b - pageAddress] = token.bytes[b]
			}
		}

		return pages
	}

	private resolveUnsetLabels(codeDto: CodeTokenDto, instTokens: InstructionToken[]): void {
		for (const token of instTokens) {
			if (token.labelRequired) {
				const labelValue: number = codeDto.labels[token.labelRequired]

				if ( isNaN(labelValue) ) {
					throw new Error(`Label "${token.labelRequired}" has no value: ${token.name}`)
				}

				if (this.dataSheet.opCodeMode[token.opc] === 'REL') {
					token.bytes = [token.opc, labelValue - token.pc - 2]
				}
				else {
					token.bytes = [token.opc, labelValue & 0xFF, (labelValue >> 8) & 0xFF]
				}

				delete token.labelRequired
			}
		}
	}

	private parseInstructions(codeDtoPassOne: CodeTokenDto): InstructionToken[] {
		const instructionTokens: InstructionToken[] = []

		let pc = 0

		for (const token of codeDtoPassOne.codeTokens) {
			if (token.tokenType === 'set-pc') {
				pc = token.pcValue as number
				continue
			}

			// Set label to the current PC
			if (token.tokenType === 'label') {
				codeDtoPassOne.labels[token.instrName] = pc
				continue
			}

			const name = token.instrName
			const line = token.codeLine

			// OPC ; Implied
			if (name === line) {
				const opc = this.dataSheet.getOpc(name, 'IMPL')
				instructionTokens.push({pc, opc, name, bytes : [opc]})
				pc += this.dataSheet.opCodeBytes[opc]
				continue
			}

			// BCC $FF   ; Relative
			// BCC LABEL ; Relative
			if (['BPL', 'BMI', 'BVC', 'BVS', 'BCC', 'BCS', 'BNE', 'BEQ'].includes(name)) {
				const opc = this.dataSheet.getOpc(name, 'REL')
				const operandText: string = line.slice(4)
				const value: number | string = this.parseValue(operandText, codeDtoPassOne.labels)
				instructionTokens.push(typeof value === 'number' ? {
					pc, opc, name,
					bytes: [opc, value - pc - 2],
				} : {
					pc, opc, name,
					bytes: [opc, NaN],
					labelRequired: value,
				})
				pc += this.dataSheet.opCodeBytes[opc]
				continue
			}

			// OPC #$FF ; Immediate
			const matchIMM = /^[A-Z]{3} #([$%]?[0-9A-Z]+)$/.exec(line)
			if (matchIMM) {
				const opc = this.dataSheet.getOpc(name, 'IMM')
				const value: number = this.parseValue(matchIMM[1]) as number
				instructionTokens.push({pc, opc, name, bytes : [opc, value]})
				pc += this.dataSheet.opCodeBytes[opc]
				continue
			}

			// OPC $FFFF ; Absolute
			const matchABS = /^[A-Z]{3} ([$%]?[0-9A-Z_]+)$/.exec(line)
			if (matchABS) {
				const value: number | string = this.parseValue(matchABS[1], codeDtoPassOne.labels)

				// Zero Page
				if (typeof value === 'number' && value >= 0x00 && value <= 0xFF) {
					const opc = this.dataSheet.getOpc(name, 'ZP')
					instructionTokens.push({pc, opc, name, bytes: [opc, value]})
					pc += this.dataSheet.opCodeBytes[opc]
					continue
				}

				// Absolute
				const opc = this.dataSheet.getOpc(name, 'ABS')
				instructionTokens.push( getInstrToken(pc, name, opc, value) )
				pc += this.dataSheet.opCodeBytes[opc]
				continue
			}

			// OPC $FFFF,X ; X-Indexed Absolute
			const matchABSX = /^[A-Z]{3} ([$%]?[0-9A-Z_]+),X$/.exec(line)
			if (matchABSX) {
				const value: number | string = this.parseValue(matchABSX[1], codeDtoPassOne.labels)

				// X-Indexed Zero Page
				if (typeof value === 'number' && value >= 0x00 && value <= 0xFF) {
					const opc = this.dataSheet.getOpc(name, 'ZPX')
					instructionTokens.push({pc, opc, name, bytes: [opc, value]})
					pc += this.dataSheet.opCodeBytes[opc]
					continue
				}

				// X-Indexed Absolute
				const opc = this.dataSheet.getOpc(name, 'ABSX')
				instructionTokens.push( getInstrToken(pc, name, opc, value) )
				pc += this.dataSheet.opCodeBytes[opc]
				continue
			}

			// OPC $FFFF,Y ; Y-Indexed Absolute
			const matchABSY = /^[A-Z]{3} ([$%]?[0-9A-Z_]+),Y$/.exec(line)
			if (matchABSY) {
				const value = this.parseValue(matchABSY[1])

				// Y-Indexed Zero Page
				if (typeof value === 'number' && value >= 0x00 && value <= 0xFF) {
					const opc = this.dataSheet.getOpc(name, 'ZPY')
					instructionTokens.push({pc, opc, name, bytes: [opc, value]})
					pc += this.dataSheet.opCodeBytes[opc]
					continue
				}

				// Y-Indexed Absolute
				const opc = this.dataSheet.getOpc(name, 'ABSY')
				instructionTokens.push( getInstrToken(pc, name, opc, value) )
				pc += this.dataSheet.opCodeBytes[opc]
				continue
			}

			// OPC ($FFFF) ; Absolut Indirect
			const matchIND = /^[A-Z]{3} \(([$%]?[0-9A-Z_]+)\)$/.exec(line)
			if (matchIND) {
				const opc = this.dataSheet.getOpc(name, 'IND')
				const value: number | string = this.parseValue(matchIND[1], codeDtoPassOne.labels)
				instructionTokens.push( getInstrToken(pc, name, opc, value) )
				pc += this.dataSheet.opCodeBytes[opc]
				continue
			}

			// OPC ($FF,X) ; X-Indexed Zero Page Indirect
			const matchINDX = /^[A-Z]{3} \(([$%]?[0-9A-Z]+),X\)$/.exec(line)
			if (matchINDX) {
				const opc = this.dataSheet.getOpc(name, 'INDX')
				const value: number = this.parseValue(matchINDX[1]) as number
				instructionTokens.push({pc, opc, name, bytes: [opc, value]})
				pc += this.dataSheet.opCodeBytes[opc]
				continue
			}

			// OPC ($FF),Y ; Zero Page Indirect Y-Indexed
			const matchINDY = /^[A-Z]{3} \(([$%]?[0-9A-Z]+)\),Y$/.exec(line)
			if (matchINDY) {
				const opc: number = this.dataSheet.getOpc(name, 'INDY')
				const value: number = this.parseValue(matchINDY[1]) as number
				instructionTokens.push({pc, opc, name, bytes: [opc, value]})
				pc += this.dataSheet.opCodeBytes[opc]
				continue
			}

			instructionTokens.push({
				pc,
				name,
				opc: NaN,
				bytes: [],
				error: `Cannot parse instruction:  ${line}`,
			});
		}

		return instructionTokens

		function getInstrToken(pc: number, name: string, opc: number, value: number | string): InstructionToken {
			return typeof value === 'number' ? {
				pc, opc, name,
				bytes: [opc, value & 0xFF, (value >> 8) & 0xFF],
			} : {
				pc, opc, name,
				bytes: [opc, NaN, NaN],
				labelRequired: value,
			}
		}
	}

	private parseValue(valueText: string, labels: Record<string, number> = {}): number | string {
		// Parse a hex number
		if ( valueText.startsWith('$') ) {
			const value = parseInt(valueText.slice(1), 16)
			if ( isNaN(value) ) {
				throw new Error(`Cannot parse a hex number: ${valueText}`)
			}

			return value
		}

		// Parse a bin number
		if ( valueText.startsWith('%') ) {
			const value = parseInt(valueText.slice(1), 2)
			if ( isNaN(value) ) {
				throw new Error(`Cannot parse a bin number: ${valueText}`)
			}

			return value
		}

		// Parse a decimal number
		const value = parseInt(valueText, 10)
		if ( isNaN(value) ) {
			if ( labels.hasOwnProperty(valueText) ) {
				return valueText
			}

			throw new Error(`Cannot find a label: ${valueText}`)
		}

		return value
	}

	private cleanSourceCode(sourceCode: string): string[] {
		return sourceCode.split('\n')                   // Split code in lines
			.map(line => line.replace(/;.*$/m, ''))     // Remove comments
			.map(line => line.trim())                   // Trim white spaces
			.filter(line => line.length > 0)            // Remove empty lines
			.reduce((acc: string[], line: string) => {
				// Move labels on a new line if they are with an instruction
				const matchLabelInstr = /^([a-zA-Z_][a-zA-Z_0-9]+):?[ \t]+(([a-zA-Z]{3})[ \t]*.*)$/m.exec(line)
				if (matchLabelInstr) {
					const labelName = matchLabelInstr[1]
					const instrPart = matchLabelInstr[2]
					const instrName = matchLabelInstr[3]
					if (!this.dataSheet.instructions.includes(labelName.toUpperCase()) &&
						 this.dataSheet.instructions.includes(instrName.toUpperCase())) {
						acc.push(labelName.trim().toUpperCase())
						acc.push(instrPart.trim().toUpperCase())
						return acc
					}
				}
				const matchLabelColon = /^([a-zA-Z_][a-zA-Z_0-9]+):$/m.exec(line)
				if (matchLabelColon) {
					const labelName = matchLabelColon[1]
					if (!this.dataSheet.instructions.includes(labelName.toUpperCase())) {
						acc.push(labelName.trim().toUpperCase())
						return acc
					}
				}
				acc.push(line.toUpperCase())
				return acc
			}, [])
			.reduce((acc: string[], line: string) => {
				// Clean spaces within instructions
				const matchInstrOperand = /^([a-zA-Z]{3})[ \t]+(.+)$/m.exec(line)
				if (matchInstrOperand) {
					const instrName = matchInstrOperand[1]
					const operand   = matchInstrOperand[2]
					if (this.dataSheet.instructions.includes(instrName.toUpperCase())) {
						// The only space is between instr and operand
						acc.push(instrName.trim().toUpperCase() + ' ' + operand.replace(/[ \t]*/g, '').toUpperCase())
						return acc
					}
				}
				// Clean all other spaces
				acc.push(line.replace(/[ \t]*/g, '').toUpperCase())
				return acc
			}, [])
	}

	private tokenizeSourceCode(sourceCodeLines: string[]): CodeTokenDto {
		const variables: Record<string, string> = {}
		const labels: Record<string, number> = {}

		const codeTokens: CodeToken[] = sourceCodeLines.reduce( (tokens: CodeToken[], line :string) => {

			// Match initial PC from: * = $0800
			const codePCMatch: CodePCMatch = this.matchCodePC(line)
			if (codePCMatch.isPC) {
				if (codePCMatch.error) {
					tokens.push( {
						tokenType: 'error',
						instrName: 'PC',
						codeLine: line,
						error: codePCMatch.error,
					})
				}
				else {
					tokens.push({
						tokenType: 'set-pc',
						instrName: 'PC',
						codeLine: line,
						pcValue: codePCMatch.pcValue
					})
				}
				return tokens
			}

			// Match variable initialization
			const variableMatch: VariableMatch = this.matchVariableInitialization(line, variables)
			if ( variableMatch.isVariable ) {
				if (variableMatch.error) {
					tokens.push( {
						tokenType: 'error',
						instrName: variableMatch.varName as string,
						codeLine: line,
						error: variableMatch.error,
					})
				}

				return tokens
			}

			// Match label declaration
			const labelMatch: LabelMatch = this.matchLabelDeclaration(line, labels)
			if (labelMatch.isLabel) {
				if (labelMatch.error) {
					tokens.push( {
						tokenType: 'error',
						instrName: labelMatch.labelName as string,
						codeLine: line,
						error: labelMatch.error,
					})
				}
				else {
					tokens.push( {
						tokenType: 'label',
						instrName: labelMatch.labelName as string,
						codeLine: line,
					})
				}
				return tokens
			}

			// Instruction  - Implied
			const instructionImplied = /^([A-Z]{3})( A)?$/m.exec(line)
			if (instructionImplied) {
				const instrName: string = instructionImplied[1]
				tokens.push( {
					tokenType: 'instruction',
					instrName: instrName,
					codeLine: instrName,
				})
				return tokens
			}

			// Instruction  with variable or label
			const matchInstWithVarOrLabel = /^([A-Z]{3}) [#(]?([A-Z0-9_]+)/m.exec(line)
			if (matchInstWithVarOrLabel) {
				const instrName: string    = matchInstWithVarOrLabel[1]
				const varLabelName: string = matchInstWithVarOrLabel[2]

				if ( variables.hasOwnProperty(varLabelName) ) {
					tokens.push( {
						tokenType: 'instruction',
						instrName: instrName,
						codeLine: line.replace(varLabelName, variables[varLabelName]),
					})
					return tokens
				}

				// It is a label
				tokens.push( {
					tokenType: 'instruction',
					instrName: instrName,
					codeLine: line,
				})
				return tokens
			}

			const matchInstrLine = /^([A-Z]{3}) /m.exec(line)
			if (matchInstrLine) {
				tokens.push({
					tokenType: 'instruction',
					instrName: matchInstrLine[1],
					codeLine: line,
				})
				return tokens
			}

			tokens.push({
				tokenType: 'error',
				instrName: 'error',
				codeLine: line,
				error: `Cannot parse code line: ${line}`
			})
			return tokens

		}, [])

		return {
			codeTokens,
			variables,
			labels,
		}
	}

	private matchCodePC(codeLine: string): CodePCMatch {
		const matchInitialPC = /\*=\$([A-H0-9]{4})/.exec(codeLine)
		if (matchInitialPC) {
			const valueText: string = matchInitialPC[1]
			const pcValue: number   = parseInt(valueText, 16)

			if ( isNaN(pcValue) ) {
				return {
					isPC: true,
					error: `Cannot parse the code PC: ${valueText}`,
				}
			}

			return {isPC: true, pcValue: pcValue}
		}

		return {isPC: false}
	}

	private matchVariableInitialization(codeLine: string, variables: Record<string, string>): VariableMatch {
		const matchVarInit = /([A-Z0-9_]+)=([$%]?[A-H0-9]+)/.exec(codeLine)
		if (matchVarInit) {
			const variable: string = matchVarInit[1]

			if (this.dataSheet.instructions.includes(variable)) {
				return {
					isVariable: true,
					varName: variable,
					error: `Variable matches an instruction name: ${variable}`
				}
			}

			if ( variables.hasOwnProperty(variable) ) {
				return {
					isVariable: true,
					varName: variable,
					error: `Variable already defined: ${variable}`
				}
			}

			variables[variable] = matchVarInit[2]

			return {isVariable: true, varName: variable}
		}

		return {isVariable: false}
	}

	private matchLabelDeclaration(codeLine: string, labels: Record<string, number>): LabelMatch {
		const matchLabel = /^([A-Z0-9_]+)$/m.exec(codeLine)
		if (matchLabel) {
			const label: string = matchLabel[1]

			if (this.dataSheet.instructions.includes(label)) {
				return {isLabel: false}
			}

			if ( labels.hasOwnProperty(label) ) {
				return {
					isLabel: true,
					labelName: label,
					error: `Label already defined: ${label}`
				}
			}

			labels[label] = NaN

			return {isLabel: true, labelName: label}
		}

		return {isLabel: false}
	}
}

module.exports.Assembler = Assembler
