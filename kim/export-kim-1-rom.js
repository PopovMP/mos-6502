'use strict'

const fs = require('fs')

const { Assembler } = require('../js')
const { Utils } = require('../js')

const sourceDir   =  (__dirname).endsWith('kim') ? __dirname : __dirname + '/kim'
const sourcePath  = sourceDir + '/kim-1-6530-002.asm'
const sourceCode  = fs.readFileSync(sourcePath, 'utf8')
const binFilePath = sourceDir + '/bin/rom-32k.bin'

const assembler = new Assembler()
const codePages = assembler.assemble(sourceCode)

const buffSize = 32 * 1024
const buffer   = Buffer.alloc(buffSize, 0xFF)
const romStart = 0x1800   // 0001 1000 0000 0000

for (const pageTag of Object.keys(codePages)) {
	const pageAddress = parseInt(pageTag, 16)
	for (let offset = 0; offset < codePages[pageTag].length; offset++){
		const value = codePages[pageTag][offset]
		if (typeof value === 'number') {
			const address = pageAddress + offset
			const valHex  = Utils.byteToHex(value)
			const val = parseInt(valHex, 16)
			buffer.writeUInt8(val, address - romStart)
		}
	}
}


fs.writeFileSync(binFilePath, buffer, 'binary')

const codeDto    = assembler.tokenize(sourceCode)
const instTokens = assembler.parseInstructions(codeDto)
assembler.resolveUnsetLabels(codeDto, instTokens)

// Export labels
Object.keys(codeDto.labels).sort().forEach( key =>  {
	console.log( `${key.toUpperCase().padEnd(8, ' ')} ${codeDto.labels[key].toString(16).toUpperCase()}`)
})
