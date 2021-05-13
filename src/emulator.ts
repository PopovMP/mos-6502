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
	private instructionLog: string[] = []

	constructor() {
		this.dataSheet = new DataSheet()
		this.assembler = new Assembler()
		this.memory    = new Uint8Array(0xFFFF + 1)
		this.cpu       = new Cpu(this.memory)
	}

	// noinspection JSUnusedGlobalSymbols
	public initialize() {
		this.codeEditor = document.getElementById('source-code') as HTMLTextAreaElement
		this.terminal   = document.getElementById('terminal') as HTMLElement

		this.codeEditor.addEventListener('keydown', this.codeEditor_keyDown.bind(this))

		const btnLoadCode: HTMLElement = document.getElementById('btn-load-code') as HTMLElement
		btnLoadCode.addEventListener('click', this.btnLoadCode_click.bind(this))

		const btnCpuReset: HTMLElement = document.getElementById('btn-cpu-reset') as HTMLElement
		btnCpuReset.addEventListener('click', this.btnReset_click.bind(this))

		const btnCpuStep: HTMLElement = document.getElementById('btn-cpu-step') as HTMLElement
		btnCpuStep.addEventListener('click', this.btnCpuStep_click.bind(this))

		const btnCpuDebug: HTMLElement = document.getElementById('btn-cpu-debug') as HTMLElement
		btnCpuDebug.addEventListener('click', this.btnDebug_click.bind(this))

		const btnCpuStop: HTMLElement = document.getElementById('btn-cpu-stop') as HTMLElement
		btnCpuStop.addEventListener('click', this.btnPause_click.bind(this))

		const btnCpuRun: HTMLElement = document.getElementById('btn-cpu-run') as HTMLElement
		btnCpuRun.addEventListener('click', this.btnRun_click.bind(this))
	}

	private btnLoadCode_click(event: Event): void {
		event.preventDefault()

		const sourceCode = this.codeEditor.value

		this.cpu.stop()
		this.memory.fill(0x00)
		this.isStopRequired     = true
		this.terminal.innerText = ''
		this.instructionLog     = []

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
			this.terminal.innerText = errorOutput.join('\n') + '\n'
			return
		}

		try {
			const codePages: CodePages = this.assembler.load(sourceCode, this.memory)
			this.setInitialPCinMemory()
			this.cpu.reset()

			const disassembly: string  = this.assembler
				.disassembleCodePages(codePages)
				.map(tkn => `$${tkn.address}   ${tkn.code.join(' ').padEnd(8, ' ')}   ${tkn.text.padEnd(13, ' ')}  ; ${tkn.description}`)
				.join('\n')

			this.terminal.innerText = '' +
				'                       Disassembly\n' +
				'---------------------------------------------------------\n' +
				disassembly + '\n\n\n' +
				'                       Object code\n' +
				'---------------------------------------------------------\n' +
				Assembler.hexDump(codePages)
		}
		catch (e) {
			this.terminal.innerText += e.message + '\n'
		}
	}

	private btnReset_click(event: Event): void {
		event.preventDefault()

		this.isStopRequired = true
		this.setInitialPCinMemory()
		this.cpu.reset()

		this.dump()
	}

	private btnCpuStep_click(event: Event): void {
		event.preventDefault()

		this.isStopRequired = false

		try {
			this.cpu.step()
			this.dump()
		}
		catch (e) {
			this.terminal.innerText += e.message + '\n'
		}
	}

	private btnDebug_click(event: Event): void {
		event.preventDefault()
		this.isStopRequired = false

		setTimeout(this.debugLoop.bind(this), 0)
	}

	private debugLoop() {
		if (this.isStopRequired) {
			return
		}

		try {
			const isReady = this.cpu.step()
			this.dump()

			if (isReady) {
				return
			}
		}
		catch (e) {
			this.terminal.innerText += e.message + '\n'
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
			this.terminal.innerText += e.message + '\n'
		}
	}

	private btnPause_click(event: Event): void {
		event.preventDefault()

		this.isStopRequired = true
		this.cpu.stop()
	}

	private dump(): void {
		this.terminal.innerText = '' +
			this.cpu.dumpStatus()  + '\n\n\n\n\n' +
			'                         Instruction Log\n' +
			'-------------------------------------------------------------------------\n' +
			this.getAssemblyDump() + '\n\n\n\n\n' +
			'                           Memory Dump\n' +
			'-------------------------------------------------------------------------\n' +
			this.getMemoryDump() + '\n\n'
	}

	private getAssemblyDump(): string {
		const pc: number     = this.cpu.currentPC
		const opc: number    = this.memory[pc]
		const bytes: number  = this.dataSheet.opCodeBytes[opc]
		const code: number[] = Array.from( this.memory.slice(pc, pc + bytes) )
		const tokens: DisassemblyToken[] = this.assembler.disassemble(code, pc)

		if (tokens.length > 0) {
			const tkn: DisassemblyToken = tokens[0]
			const currentInst = `$${tkn.address}   ${tkn.code.join(' ').padEnd(8, ' ')}   ${tkn.text.padEnd(13, ' ')}  ; ${tkn.description}`
			this.instructionLog.push(currentInst)
			this.instructionLog = this.instructionLog.slice(-3)
		}

		return this.instructionLog.map((line, index) => (
				index === this.instructionLog.length - 1 ? ' --> ' : '     ') + line,
			).join('\n');
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

	private setInitialPCinMemory(): number {
		const initialPc: string = (document.getElementById('initial-pc') as HTMLInputElement).value
		const address: number = parseInt(initialPc, 16)

		this.memory[0xFFFC] = address & 0x00FF
		this.memory[0xFFFD] = (address >> 8) & 0x00FF

		return address
	}
}

module.exports.Emulator = Emulator
