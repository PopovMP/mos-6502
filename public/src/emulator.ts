class Emulator {
	private readonly dataSheet: DataSheet
	private readonly assembler: Assembler
	private readonly memory: Uint8Array
	private readonly cpu: Cpu

	// @ts-ignore
	private codeEditor: HTMLTextAreaElement
	// @ts-ignore
	private terminal: HTMLElement

	private isStopRequired: boolean = false

	constructor() {
		this.dataSheet = new DataSheet()
		this.assembler = new Assembler()
		this.memory    = new Uint8Array(0xFFFF)
		this.cpu       = new Cpu(this.memory)
	}

	// noinspection JSUnusedGlobalSymbols
	public initialize() {
		this.codeEditor = document.getElementById('source-code') as HTMLTextAreaElement
		this.terminal   = document.getElementById('terminal') as HTMLElement

		this.codeEditor.addEventListener('keydown', this.codeEditor_keyDown.bind(this))

		const btnGenerateCode: HTMLElement = document.getElementById('btn-generate-code') as HTMLElement
		btnGenerateCode.addEventListener('click', this.btnGenerateCode_click.bind(this))

		const btnCpuStep: HTMLElement = document.getElementById('btn-cpu-step') as HTMLElement
		btnCpuStep.addEventListener('click', this.btnCpuStep_click.bind(this))

		const btnCpuDebug: HTMLElement = document.getElementById('btn-cpu-debug') as HTMLElement
		btnCpuDebug.addEventListener('click', this.btnDebug_click.bind(this))

		const btnCpuStop: HTMLElement = document.getElementById('btn-cpu-stop') as HTMLElement
		btnCpuStop.addEventListener('click', this.btnStop_click.bind(this))

		const btnCpuRun: HTMLElement = document.getElementById('btn-cpu-run') as HTMLElement
		btnCpuRun.addEventListener('click', this.btnRun_click.bind(this))
	}

	private btnGenerateCode_click(event: Event): void {
		event.preventDefault()

		const sourceCode = this.codeEditor.value
		if (!sourceCode) {
			return
		}

		this.cpu.stop()
		this.isStopRequired = false
		this.terminal.innerText = ''
		this.memory.fill(0x00)

		const codeDto: CodeTokenDto = this.assembler.tokenize(sourceCode)

		const errorOutput = codeDto.codeTokens
			.filter(token => token.tokenType === 'error')
			.reduce( (acc: string[], token: CodeToken) => {
				acc.push(`Error:       ${token.error}`)
				acc.push(`Code line:   ${token.codeLine}`)
				acc.push(`Instruction: ${token.instrName}`)
				return acc
			}, [])

		if (errorOutput.length > 0) {
			this.terminal.innerHTML = '<div class="inverse">' + errorOutput.join('\n') + '</div>'
			return
		}

		try {
			this.assembler.load(sourceCode, this.memory)
			this.cpu.reset()
		}
		catch (e) {
			this.terminal.innerText += e.message
		}

		const codePages: CodePages = this.assembler.parse(codeDto)
		const codeBytes: number[]  = this.assembler.codePagesToBytes(codePages)
		const disassemblyTokens: DisassemblyToken[] = this.assembler.disassemble(codeBytes, this.cpu.currentPC)

		const output = []

		for (const tkn of disassemblyTokens) {
			output.push(`$${tkn.address}   ${tkn.code.join(' ').padEnd(8, ' ')}   ${tkn.text.padEnd(13, ' ')}  ; ${tkn.description}`)
		}

		this.terminal.innerText = '' +
			'                       Disassembly\n' +
			'---------------------------------------------------------\n' +
			output.join('\n') + '\n\n\n' +
			'                       Object code\n' +
			'---------------------------------------------------------\n' +
			Assembler.hexDump(codePages)

	}

	private btnCpuStep_click(event: Event): void {
		event.preventDefault()

		this.isStopRequired = false

		try {
			this.cpu.step()
			this.dump()
		}
		catch (e) {
			this.terminal.innerText += e.message
		}
	}

	private btnDebug_click(event: Event): void {
		event.preventDefault()
		this.isStopRequired = false

		setTimeout(this.debugLoop.bind(this), 0)
	}

	private debugLoop() {
		if (this.isStopRequired) {
			return;
		}

		try {
			const isReady = this.cpu.step()
			this.dump()

			if (isReady) {
				return;
			}
		}
		catch (e) {
			this.terminal.innerText += e.message
		}

		setTimeout(this.debugLoop.bind(this), 700)
	}

	private btnRun_click(event: Event): void {
		event.preventDefault()
		this.isStopRequired = false

		try {
			this.cpu.run()
			this.dump()
		}
		catch (e) {
			this.terminal.innerText += e.message
		}
	}

	private btnStop_click(event: Event): void {
		event.preventDefault()

		this.isStopRequired = true
		this.cpu.stop()
	}

	private dump(): void {
		this.terminal.innerText = '' +
			this.cpu.dumpStatus()  + '\n\n\n\n\n' +
			this.getAssemblyDump() + '\n\n\n\n\n' +
			'                           Memory Dump\n' +
			'-------------------------------------------------------------------------\n' +
			this.getMemoryDump()
	}

	private getAssemblyDump(): string {
		const pc: number     = this.cpu.currentPC
		const opc: number    = this.memory[pc]
		const bytes: number  = this.dataSheet.opCodeBytes[opc]
		const code: number[] = Array.from( this.memory.slice(pc, pc + bytes) )
		const tokens: DisassemblyToken[] = this.assembler.disassemble(code, pc)
		const tkn: DisassemblyToken = tokens[0]


		return '                         Current Instruction\n' +
			'-------------------------------------------------------------------------\n' +
			`$${tkn.address}   ${tkn.code.join(' ').padEnd(8, ' ')}   ${tkn.text.padEnd(13, ' ')}  ; ${tkn.description}`
	}

	private getMemoryDump(): string {
		const lines: string[] = []
		let previousLineText = ''
		let isLineSkipped = false

		for (let line = 0; line < this.memory.length / 16; line++) {
			const currentBytes = []
			const currentChars = []
			const lineAddress: string = Utils.wordToHex(line * 16)

			for (let col = 0; col < 16; col++) {
				const address: number = line * 16 + col
				const value: number = this.memory[address]
				currentBytes.push( Utils.byteToHex(value) )
				currentChars.push( value >= 0x20 && value <= 0x7E ? String.fromCharCode(value) : '.' )
			}

			const currentLineText = currentBytes.join(' ')
			if (currentLineText !== previousLineText || line === (this.memory.length / 16) - 1) {
				lines.push(`${lineAddress} | ${currentLineText} | ${currentChars.join('')}`)
				previousLineText = currentLineText
				isLineSkipped = false
			}
			else {
				if (!isLineSkipped) {
					isLineSkipped = true
					lines.push('*')
				}
			}

		}

		return lines.join('\n')
	}

	private codeEditor_keyDown(event: KeyboardEvent): void {
		if (event.key !== 'Tab') {
			return
		}

		event.preventDefault();

		const selectionStart = this.codeEditor.selectionStart
		this.codeEditor.value =
			this.codeEditor.value.substring(0, this.codeEditor.selectionStart) +
			"    " +
			this.codeEditor.value.substring(this.codeEditor.selectionEnd)
		this.codeEditor.selectionEnd = selectionStart + 4
	}
}

module.exports.Emulator = Emulator
