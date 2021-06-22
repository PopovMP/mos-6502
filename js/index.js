"use strict";
class Assembler {
    constructor() {
        this.dataSheet = new DataSheet();
    }
    static hexDump(codePages) {
        const dumpLines = [];
        for (const pageAddress of Object.keys(codePages)) {
            dumpLines.push(pageAddress + ': ' + codePages[pageAddress]
                .map(n => n === null ? ' .' : Utils.byteToHex(n))
                .join(' '));
        }
        return dumpLines.sort().join('\n');
    }
    load(sourcecode, memory) {
        const codePages = this.assemble(sourcecode);
        let isPcSet = false;
        for (const pageTag of Object.keys(codePages)) {
            const pageAddress = parseInt(pageTag, 16);
            for (let offset = 0; offset < codePages[pageTag].length; offset++) {
                const value = codePages[pageTag][offset];
                if (typeof value === 'number') {
                    const address = pageAddress + offset;
                    memory[address] = value;
                    if (!isPcSet) {
                        memory[0xFFFC] = address & 0x00FF;
                        memory[0xFFFD] = (address >> 8) & 0x00FF;
                        isPcSet = true;
                    }
                }
            }
        }
        return codePages;
    }
    assemble(sourceCode) {
        const codeDto = this.tokenize(sourceCode);
        return this.parse(codeDto);
    }
    tokenize(sourceCode) {
        const codeLines = this.cleanSourceCode(sourceCode);
        return this.tokenizeSourceCode(codeLines);
    }
    parse(codeDto) {
        const instTokens = this.parseInstructions(codeDto);
        this.resolveUnsetLabels(codeDto, instTokens);
        return this.composeMachineCodePages(instTokens);
    }
    disassemble(code, initialPC) {
        const output = [];
        let index = 0;
        let pc = initialPC;
        while (index < code.length) {
            const opc = code[index];
            if (!this.dataSheet.opCodeName.hasOwnProperty(opc)) {
                const token = {
                    address: Utils.wordToHex(pc),
                    code: [Utils.byteToHex(opc)],
                    text: '.BYTE $' + Utils.byteToHex(opc),
                    mode: 'Data',
                    bytes: 1,
                    description: 'Data'
                };
                output.push(token);
                index += 1;
                pc += 1;
                continue;
            }
            const name = this.dataSheet.opCodeName[opc];
            const mode = this.dataSheet.opCodeMode[opc];
            const bytes = this.dataSheet.opCodeBytes[opc];
            const token = {
                address: Utils.wordToHex(pc),
                code: [Utils.byteToHex(opc)],
                text: this.dataSheet.opCodeName[opc],
                mode: mode,
                bytes: bytes,
                description: this.dataSheet.instrDescription[name]
            };
            if (bytes === 1) {
                if ([0x0A, 0x4A, 0x2A, 0x6A].includes(opc)) {
                    token.text += ' A';
                }
                output.push(token);
                index += bytes;
                pc += bytes;
                continue;
            }
            switch (mode) {
                case 'IMM':
                    token.text += ' #$';
                    break;
                case 'IND':
                case 'XZPI':
                case 'ZPIY':
                    token.text += ' ($';
                    break;
                default:
                    token.text += ' $';
                    break;
            }
            if (['BPL', 'BMI', 'BVC', 'BVS', 'BCC', 'BCS', 'BNE', 'BEQ'].includes(this.dataSheet.opCodeName[opc])) {
                token.code.push(Utils.byteToHex(code[index + 1]));
                token.text += Utils.wordToHex(pc + code[index + 1] + bytes);
            }
            else if (bytes === 2) {
                token.code.push(Utils.byteToHex(code[index + 1]));
                token.text += Utils.byteToHex(code[index + 1]);
            }
            else if (bytes === 3) {
                token.code.push(Utils.byteToHex(code[index + 1]));
                token.code.push(Utils.byteToHex(code[index + 2]));
                token.text += Utils.byteToHex(code[index + 2]) + Utils.byteToHex(code[index + 1]);
            }
            switch (mode) {
                case 'ABSX':
                case 'ZPX':
                    token.text += ',X';
                    break;
                case 'ABSY':
                case 'ZPY':
                    token.text += ',Y';
                    break;
                case 'XZPI':
                    token.text += ',X)';
                    break;
                case 'ZPIY':
                    token.text += '),Y';
                    break;
            }
            output.push(token);
            index += bytes;
            pc += bytes;
        }
        return output;
    }
    disassembleCodePages(codePages) {
        const output = [];
        let code = [];
        let codePC = -1;
        let prevAddress = -1;
        for (const pageAddress of Object.keys(codePages).map(key => parseInt(key, 16)).sort()) {
            if (prevAddress > -1 && pageAddress - prevAddress > 16) {
                output.push(...this.disassemble(code, codePC));
                code = [];
                codePC = -1;
            }
            if (codePC === -1) {
                codePC = pageAddress;
            }
            prevAddress = pageAddress;
            const pageData = codePages[Utils.wordToHex(pageAddress)];
            for (let index = 0; index < pageData.length; index++) {
                if (typeof pageData[index] === 'number') {
                    code.push(pageData[index]);
                }
            }
        }
        output.push(...this.disassemble(code, codePC));
        return output;
    }
    composeMachineCodePages(instTokens) {
        const pages = {};
        for (const token of instTokens) {
            for (let b = 0; b < token.bytes.length; b++) {
                const pageAddress = token.pc + b - (token.pc + b) % 16;
                const pageKey = Utils.wordToHex(pageAddress);
                if (!pages.hasOwnProperty(pageKey)) {
                    pages[pageKey] = new Array(16).fill(null);
                }
                pages[pageKey][token.pc + b - pageAddress] = token.bytes[b];
            }
        }
        return pages;
    }
    resolveUnsetLabels(codeDto, instTokens) {
        for (const token of instTokens) {
            if (token.labelRequired) {
                const labelValue = codeDto.labels[token.labelRequired];
                if (isNaN(labelValue)) {
                    throw new Error(`Label "${token.labelRequired}" has no value: ${token.name}`);
                }
                if (this.dataSheet.opCodeMode[token.opc] === 'REL') {
                    token.bytes = [token.opc, labelValue - token.pc - 2];
                }
                else {
                    token.bytes = [token.opc, labelValue & 0xFF, (labelValue >> 8) & 0xFF];
                }
                delete token.labelRequired;
            }
        }
    }
    parseInstructions(codeTokenDto) {
        const instructionTokens = [];
        let pc = 0x0800;
        for (const token of codeTokenDto.codeTokens) {
            if (token.tokenType === 'set-pc') {
                pc = token.pcValue;
                continue;
            }
            if (token.tokenType === 'label') {
                codeTokenDto.labels[token.instrName] = pc;
                continue;
            }
            if (token.tokenType === 'directive') {
                if (token.instrName === '.BYTE' && token.directiveData) {
                    const bytes = token.directiveData
                        .split(/,[ \t]*/)
                        .map(num => this.parseValue(num));
                    instructionTokens.push({ pc, bytes, name: '.BYTE', opc: -1 });
                    pc += bytes.length;
                }
                if (token.instrName === '.WORD' && token.directiveData) {
                    const bytes = token.directiveData
                        .split(/,[ \t]*/)
                        .map(num => this.parseValue(num, codeTokenDto.labels))
                        .reduce((acc, word) => {
                        acc.push(word & 0xFF);
                        acc.push((word >> 8) & 0xFF);
                        return acc;
                    }, []);
                    instructionTokens.push({ pc, bytes, name: '.WORD', opc: -1 });
                    pc += bytes.length;
                }
                continue;
            }
            const name = token.instrName;
            const line = token.codeLine;
            if (name === line) {
                const opc = this.dataSheet.getOpc(name, 'IMPL');
                instructionTokens.push({ pc, opc, name, bytes: [opc] });
                pc += this.dataSheet.opCodeBytes[opc];
                continue;
            }
            if (['BPL', 'BMI', 'BVC', 'BVS', 'BCC', 'BCS', 'BNE', 'BEQ'].includes(name)) {
                const opc = this.dataSheet.getOpc(name, 'REL');
                const operandText = line.slice(4);
                const value = this.parseValue(operandText, codeTokenDto.labels);
                instructionTokens.push(typeof value === 'number' ? {
                    pc, opc, name,
                    bytes: [opc, value - pc - 2],
                } : {
                    pc, opc, name,
                    bytes: [opc, NaN],
                    labelRequired: value,
                });
                pc += this.dataSheet.opCodeBytes[opc];
                continue;
            }
            const matchIMM = /^[A-Z]{3} #([$%]?[0-9A-Z]+)$/.exec(line);
            if (matchIMM) {
                const opc = this.dataSheet.getOpc(name, 'IMM');
                const value = this.parseValue(matchIMM[1]);
                instructionTokens.push({ pc, opc, name, bytes: [opc, value] });
                pc += this.dataSheet.opCodeBytes[opc];
                continue;
            }
            const matchABS = /^[A-Z]{3} ([$%]?[0-9A-Z_]+)$/.exec(line);
            if (matchABS) {
                const value = this.parseValue(matchABS[1], codeTokenDto.labels);
                if (typeof value === 'number' && value >= 0x00 && value <= 0xFF) {
                    const opc = this.dataSheet.getOpc(name, 'ZP');
                    instructionTokens.push({ pc, opc, name, bytes: [opc, value] });
                    pc += this.dataSheet.opCodeBytes[opc];
                    continue;
                }
                const opc = this.dataSheet.getOpc(name, 'ABS');
                instructionTokens.push(getInstrToken(pc, name, opc, value));
                pc += this.dataSheet.opCodeBytes[opc];
                continue;
            }
            const matchABSX = /^[A-Z]{3} ([$%]?[0-9A-Z_]+),X$/.exec(line);
            if (matchABSX) {
                const value = this.parseValue(matchABSX[1], codeTokenDto.labels);
                if (typeof value === 'number' && value >= 0x00 && value <= 0xFF) {
                    const opc = this.dataSheet.getOpc(name, 'ZPX');
                    instructionTokens.push({ pc, opc, name, bytes: [opc, value] });
                    pc += this.dataSheet.opCodeBytes[opc];
                    continue;
                }
                const opc = this.dataSheet.getOpc(name, 'ABSX');
                instructionTokens.push(getInstrToken(pc, name, opc, value));
                pc += this.dataSheet.opCodeBytes[opc];
                continue;
            }
            const matchABSY = /^[A-Z]{3} ([$%]?[0-9A-Z_]+),Y$/.exec(line);
            if (matchABSY) {
                const value = this.parseValue(matchABSY[1], codeTokenDto.labels);
                if (typeof value === 'number' && value >= 0x00 && value <= 0xFF) {
                    const opc = this.dataSheet.getOpc(name, 'ZPY');
                    instructionTokens.push({ pc, opc, name, bytes: [opc, value] });
                    pc += this.dataSheet.opCodeBytes[opc];
                    continue;
                }
                const opc = this.dataSheet.getOpc(name, 'ABSY');
                instructionTokens.push(getInstrToken(pc, name, opc, value));
                pc += this.dataSheet.opCodeBytes[opc];
                continue;
            }
            const matchIND = /^[A-Z]{3} \(([$%]?[0-9A-Z_]+)\)$/.exec(line);
            if (matchIND) {
                const opc = this.dataSheet.getOpc(name, 'IND');
                const value = this.parseValue(matchIND[1], codeTokenDto.labels);
                instructionTokens.push(getInstrToken(pc, name, opc, value));
                pc += this.dataSheet.opCodeBytes[opc];
                continue;
            }
            const matchINDX = /^[A-Z]{3} \(([$%]?[0-9A-Z]+),X\)$/.exec(line);
            if (matchINDX) {
                const opc = this.dataSheet.getOpc(name, 'XZPI');
                const value = this.parseValue(matchINDX[1]);
                instructionTokens.push({ pc, opc, name, bytes: [opc, value] });
                pc += this.dataSheet.opCodeBytes[opc];
                continue;
            }
            const matchINDY = /^[A-Z]{3} \(([$%]?[0-9A-Z]+)\),Y$/.exec(line);
            if (matchINDY) {
                const opc = this.dataSheet.getOpc(name, 'ZPIY');
                const value = this.parseValue(matchINDY[1]);
                instructionTokens.push({ pc, opc, name, bytes: [opc, value] });
                pc += this.dataSheet.opCodeBytes[opc];
                continue;
            }
            instructionTokens.push({
                pc, name,
                opc: NaN,
                bytes: [],
                error: `Cannot parse instruction:  ${line}`,
            });
        }
        return instructionTokens;
        function getInstrToken(pc, name, opc, value) {
            return typeof value === 'number' ? {
                pc, opc, name,
                bytes: [opc, value & 0xFF, (value >> 8) & 0xFF],
            } : {
                pc, opc, name,
                bytes: [opc, NaN, NaN],
                labelRequired: value,
            };
        }
    }
    parseValue(valueText, labels = {}) {
        if (valueText.startsWith('$')) {
            const value = parseInt(valueText.slice(1), 16);
            if (isNaN(value)) {
                throw new Error(`Cannot parse a hex number: ${valueText}`);
            }
            return value;
        }
        if (valueText.startsWith('%')) {
            const value = parseInt(valueText.slice(1), 2);
            if (isNaN(value)) {
                throw new Error(`Cannot parse a bin number: ${valueText}`);
            }
            return value;
        }
        const value = parseInt(valueText, 10);
        if (isNaN(value)) {
            const valuetextUp = valueText.toUpperCase();
            if (labels.hasOwnProperty(valuetextUp)) {
                return isNaN(labels[valuetextUp])
                    ? valuetextUp
                    : labels[valuetextUp];
            }
            throw new Error(`Cannot find a label: ${valueText}`);
        }
        return value;
    }
    cleanSourceCode(sourceCode) {
        return sourceCode.split('\n')
            .map(line => line.replace(/;.*$/m, ''))
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .reduce((acc, line) => {
            const matchLabelInstr = /^([a-zA-Z_][a-zA-Z_0-9]+):?[ \t]+(([a-zA-Z]{3})[ \t]*.*)$/m.exec(line);
            if (matchLabelInstr) {
                const labelName = matchLabelInstr[1];
                const instrPart = matchLabelInstr[2];
                const instrName = matchLabelInstr[3];
                if (!this.dataSheet.instructions.includes(labelName.toUpperCase()) &&
                    this.dataSheet.instructions.includes(instrName.toUpperCase())) {
                    acc.push(labelName.trim().toUpperCase());
                    acc.push(instrPart.trim().toUpperCase());
                    return acc;
                }
            }
            const matchLabelDirective = /^([a-zA-Z_][a-zA-Z_0-9]+):?[ \t]+(\.[a-zA-Z]+)[ \t]+(.+)$/m.exec(line);
            if (matchLabelDirective) {
                const labelName = matchLabelDirective[1];
                const directive = matchLabelDirective[2];
                const data = matchLabelDirective[3];
                if (!this.dataSheet.instructions.includes(labelName.toUpperCase())) {
                    acc.push(labelName.trim().toUpperCase());
                    acc.push(directive.trim().toUpperCase() + ' ' + data.trim());
                    return acc;
                }
            }
            const matchLabelColon = /^([a-zA-Z_][a-zA-Z_0-9]+):$/m.exec(line);
            if (matchLabelColon) {
                const labelName = matchLabelColon[1];
                if (!this.dataSheet.instructions.includes(labelName.toUpperCase())) {
                    acc.push(labelName.trim().toUpperCase());
                    return acc;
                }
            }
            const matchDirective = /^[ \t]*(\.[a-zA-Z]+)[ \t]+(.+)$/m.exec(line);
            if (matchDirective) {
                const directive = matchDirective[1];
                const data = matchDirective[2];
                acc.push(directive.trim().toUpperCase() + ' ' + data.trim());
                return acc;
            }
            acc.push(line.toUpperCase());
            return acc;
        }, [])
            .reduce((acc, line) => {
            const matchInstrOperand = /^([a-zA-Z]{3})[ \t]+(.+)$/m.exec(line);
            if (matchInstrOperand) {
                const instrName = matchInstrOperand[1];
                const operand = matchInstrOperand[2];
                if (this.dataSheet.instructions.includes(instrName.toUpperCase())) {
                    acc.push(instrName.trim().toUpperCase() + ' ' + operand.replace(/[ \t]*/g, '').toUpperCase());
                    return acc;
                }
            }
            const matchDirective = /^(\.[A-Z]+) (.+)$/m.exec(line);
            if (matchDirective) {
                const directive = matchDirective[1];
                const data = matchDirective[2];
                acc.push(directive + ' ' + data);
                return acc;
            }
            acc.push(line.replace(/[ \t]*/g, '').toUpperCase());
            return acc;
        }, []);
    }
    tokenizeSourceCode(sourceCodeLines) {
        const variables = {};
        const labels = {};
        const codeTokens = sourceCodeLines.reduce((tokens, line) => {
            const codePCMatch = this.matchCodePC(line);
            if (codePCMatch.isPC) {
                if (codePCMatch.error) {
                    tokens.push({
                        tokenType: 'error',
                        instrName: 'PC',
                        codeLine: line,
                        error: codePCMatch.error,
                    });
                }
                else {
                    tokens.push({
                        tokenType: 'set-pc',
                        instrName: 'PC',
                        codeLine: line,
                        pcValue: codePCMatch.pcValue
                    });
                }
                return tokens;
            }
            const variableMatch = this.matchVariableInitialization(line, variables);
            if (variableMatch.isVariable) {
                if (variableMatch.error) {
                    tokens.push({
                        tokenType: 'error',
                        instrName: variableMatch.varName,
                        codeLine: line,
                        error: variableMatch.error,
                    });
                }
                return tokens;
            }
            const labelMatch = this.matchLabelDeclaration(line, labels);
            if (labelMatch.isLabel) {
                if (labelMatch.error) {
                    tokens.push({
                        tokenType: 'error',
                        instrName: labelMatch.labelName,
                        codeLine: line,
                        error: labelMatch.error,
                    });
                }
                else {
                    tokens.push({
                        tokenType: 'label',
                        instrName: labelMatch.labelName,
                        codeLine: line,
                    });
                }
                return tokens;
            }
            const instructionImplied = /^([A-Z]{3})( A)?$/m.exec(line);
            if (instructionImplied) {
                const instrName = instructionImplied[1];
                tokens.push({
                    tokenType: 'instruction',
                    instrName: instrName,
                    codeLine: instrName,
                });
                return tokens;
            }
            const matchInstWithVarOrLabel = /^([A-Z]{3}) [#(]?([A-Z0-9_]+)/m.exec(line);
            if (matchInstWithVarOrLabel) {
                const instrName = matchInstWithVarOrLabel[1];
                const varLabelName = matchInstWithVarOrLabel[2];
                if (variables.hasOwnProperty(varLabelName)) {
                    tokens.push({
                        tokenType: 'instruction',
                        instrName: instrName,
                        codeLine: line.replace(varLabelName, variables[varLabelName]),
                    });
                    return tokens;
                }
                tokens.push({
                    tokenType: 'instruction',
                    instrName: instrName,
                    codeLine: line,
                });
                return tokens;
            }
            const matchInstrLine = /^([A-Z]{3}) /m.exec(line);
            if (matchInstrLine) {
                tokens.push({
                    tokenType: 'instruction',
                    instrName: matchInstrLine[1],
                    codeLine: line,
                });
                return tokens;
            }
            const matchDirective = /^(\.[A-Z]+) (.+)/m.exec(line);
            if (matchDirective) {
                tokens.push({
                    tokenType: 'directive',
                    instrName: matchDirective[1],
                    codeLine: line,
                    directiveData: matchDirective[2],
                });
                return tokens;
            }
            tokens.push({
                tokenType: 'error',
                instrName: 'error',
                codeLine: line,
                error: `Cannot parse code line: ${line}`
            });
            return tokens;
        }, []);
        return {
            codeTokens,
            variables,
            labels,
        };
    }
    matchCodePC(codeLine) {
        const matchInitialPC = /\*=\$([A-H0-9]{4})/.exec(codeLine);
        if (matchInitialPC) {
            const valueText = matchInitialPC[1];
            const pcValue = parseInt(valueText, 16);
            if (isNaN(pcValue)) {
                return {
                    isPC: true,
                    error: `Cannot parse the code PC: ${valueText}`,
                };
            }
            return { isPC: true, pcValue: pcValue };
        }
        return { isPC: false };
    }
    matchVariableInitialization(codeLine, variables) {
        const matchVarInit = /([A-Z0-9_]+)=([$%]?[A-H0-9]+)/.exec(codeLine);
        if (matchVarInit) {
            const variable = matchVarInit[1];
            if (this.dataSheet.instructions.includes(variable)) {
                return {
                    isVariable: true,
                    varName: variable,
                    error: `Variable matches an instruction name: ${variable}`
                };
            }
            if (variables.hasOwnProperty(variable)) {
                return {
                    isVariable: true,
                    varName: variable,
                    error: `Variable already defined: ${variable}`
                };
            }
            variables[variable] = matchVarInit[2];
            return { isVariable: true, varName: variable };
        }
        return { isVariable: false };
    }
    matchLabelDeclaration(codeLine, labels) {
        const matchLabel = /^([A-Z0-9_]+)$/m.exec(codeLine);
        if (matchLabel) {
            const label = matchLabel[1];
            if (this.dataSheet.instructions.includes(label)) {
                return { isLabel: false };
            }
            if (labels.hasOwnProperty(label)) {
                return {
                    isLabel: true,
                    labelName: label,
                    error: `Label already defined: ${label}`
                };
            }
            labels[label] = NaN;
            return { isLabel: true, labelName: label };
        }
        return { isLabel: false };
    }
}
module.exports.Assembler = Assembler;
class Cpu {
    constructor(memory) {
        this.addressInstructions = [
            'ASL', 'DEC', 'INC', 'LSR', 'JMP', 'JSR', 'ROL', 'ROR', 'STA', 'STX', 'STY'
        ];
        this.operandAddress = {
            IMPL: () => NaN,
            IMM: () => this.PC + 1,
            ZP: () => this.memory[this.PC + 1],
            ZPX: () => this.memory[this.PC + 1] + this.X,
            ZPY: () => this.memory[this.PC + 1] + this.Y,
            ABS: () => this.loadWord(this.PC + 1),
            ABSX: () => this.loadWord(this.PC + 1) + this.X,
            ABSY: () => this.loadWord(this.PC + 1) + this.Y,
            IND: () => this.loadWord(this.PC + 1),
            XZPI: () => this.loadWord(this.memory[this.PC + 1] + this.X),
            ZPIY: () => this.loadWord(this.memory[this.PC + 1]) + this.Y,
            REL: () => this.PC + 1,
        };
        this.instruction = {
            ADC: (opr) => {
                this.V = !((this.A ^ opr) & 0x80);
                const val = this.A + opr + +this.C;
                this.A = val & 0xFF;
                if (val >= 0x100) {
                    this.C = true;
                    if (this.V && val >= 0x180) {
                        this.V = false;
                    }
                }
                else {
                    this.C = false;
                    if (this.V && val < 0x80) {
                        this.V = false;
                    }
                }
                this.setNZ(this.A);
            },
            AND: (opr) => {
                this.A &= opr;
                this.setNZ(this.A);
            },
            ASL: (addr) => {
                const input = isNaN(addr) ? this.A : this.memory[addr];
                const temp = input << 1;
                this.C = (temp >> 8) === 1;
                const val = temp & 0xFF;
                if (isNaN(addr)) {
                    this.A = val;
                }
                else {
                    this.memory[addr] = val;
                }
                this.setNZ(val);
            },
            BCC: (opr) => {
                if (!this.C) {
                    this.branch(opr);
                }
            },
            BCS: (opr) => {
                if (this.C) {
                    this.branch(opr);
                }
            },
            BEQ: (opr) => {
                if (this.Z) {
                    this.branch(opr);
                }
            },
            BIT: (opr) => {
                const val = this.A & opr;
                this.N = !!(opr >> 7);
                this.V = !!(opr >> 6);
                this.Z = !val;
            },
            BMI: (opr) => {
                if (this.N) {
                    this.branch(opr);
                }
            },
            BNE: (opr) => {
                if (!this.Z) {
                    this.branch(opr);
                }
            },
            BPL: (opr) => {
                if (!this.N) {
                    this.branch(opr);
                }
            },
            BRK: () => {
                this.PC += 1;
                this.push((this.PC >> 8) & 0xFF);
                this.push(this.PC & 0xFF);
                this.PC = this.loadWord(0xFFFE);
            },
            BVC: (opr) => {
                if (!this.V) {
                    this.branch(opr);
                }
            },
            BVS: (opr) => {
                if (this.V) {
                    this.branch(opr);
                }
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
            CMP: (opr) => {
                const delta = this.A - opr;
                this.C = this.A >= opr;
                this.setNZ(delta);
            },
            CPX: (opr) => {
                const delta = this.X - opr;
                this.C = this.X >= opr;
                this.setNZ(delta);
            },
            CPY: (opr) => {
                const delta = this.Y - opr;
                this.C = this.Y >= opr;
                this.setNZ(delta);
            },
            DEC: (addr) => {
                const val = this.memory[addr] = (this.memory[addr] - 1) & 0xFF;
                this.setNZ(val);
            },
            DEX: () => {
                this.X = (this.X - 1) & 0xFF;
                this.setNZ(this.X);
            },
            DEY: () => {
                this.Y = (this.Y - 1) & 0xFF;
                this.setNZ(this.Y);
            },
            EOR: (opr) => {
                this.A ^= opr;
                this.setNZ(this.A);
            },
            INC: (addr) => {
                const val = this.memory[addr] = (this.memory[addr] + 1) & 0xFF;
                this.setNZ(val);
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
            LDA: (opr) => {
                this.A = opr;
                this.setNZ(this.A);
            },
            LDX: (opr) => {
                this.X = opr;
                this.setNZ(this.X);
            },
            LDY: (opr) => {
                this.Y = opr;
                this.setNZ(this.Y);
            },
            LSR: (addr) => {
                const input = isNaN(addr) ? this.A : this.memory[addr];
                const out = input >> 1;
                if (isNaN(addr)) {
                    this.A = out;
                }
                else {
                    this.memory[addr] = out;
                }
                this.N = false;
                this.Z = !out;
                this.C = !!(input & 1);
            },
            NOP: () => {
            },
            ORA: (opr) => {
                this.A |= opr;
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
                const input = isNaN(addr) ? this.A : this.memory[addr];
                const out = (input << 1) + +this.C;
                if (isNaN(addr)) {
                    this.A = out;
                }
                else {
                    this.memory[addr] = out;
                }
                this.N = !!((input >> 6) & 1);
                this.Z = !out;
                this.C = !!((input >> 7) & 1);
            },
            ROR: (addr) => {
                const input = isNaN(addr) ? this.A : this.memory[addr];
                const out = ((input >> 1) + (+this.C << 7)) & 0xFF;
                if (isNaN(addr)) {
                    this.A = out;
                }
                else {
                    this.memory[addr] = out;
                }
                this.N = this.C;
                this.Z = !out;
                this.C = !!(input & 1);
            },
            RTI: () => {
                this.P = this.pull();
                this.PC = this.pull() + (this.pull() << 8);
                this.I = false;
            },
            RTS: () => {
                this.PC = this.pull() + (this.pull() << 8) + 1;
            },
            SBC: (opr) => {
                this.V = !!((this.A ^ opr) & 0x80);
                const value = 0xff + this.A - opr + (this.C ? 1 : 0);
                if (value < 0x100) {
                    this.C = false;
                    if (this.V && value < 0x80) {
                        this.V = false;
                    }
                }
                else {
                    this.C = true;
                    if (this.V && value >= 0x180) {
                        this.V = false;
                    }
                }
                this.A = value & 0xff;
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
                this.memory[addr] = this.A;
            },
            STX: (addr) => {
                this.memory[addr] = this.X;
            },
            STY: (addr) => {
                this.memory[addr] = this.Y;
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
        this.dataSheet = new DataSheet();
        this.memory = memory;
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
    get B() { return true; }
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
    set P(val) {
        this.N = !!((val >> 7) & 0x01);
        this.V = !!((val >> 6) & 0x01);
        this.D = !!((val >> 3) & 0x01);
        this.I = !!((val >> 2) & 0x01);
        this.Z = !!((val >> 1) & 0x01);
        this.C = !!((val >> 0) & 0x01);
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
        const opc = this.memory[this.PC];
        const name = this.dataSheet.opCodeName[opc];
        if (name === undefined) {
            throw new Error(`Invalid instruction '${Utils.byteToHex(opc)}' at: $${Utils.wordToHex(this.PC)}`);
        }
        const mode = this.dataSheet.opCodeMode[opc];
        const opr = this.addressInstructions.includes(name)
            ? this.operandAddress[mode]()
            : mode === 'IMPL'
                ? this.A
                : this.memory[this.operandAddress[mode]()];
        this.PC += this.dataSheet.opCodeBytes[opc];
        this.instruction[name](opr);
    }
    irq() {
        if (this.I) {
            return;
        }
        this.push((this.PC >> 8) & 0xFF);
        this.push(this.PC & 0xFF);
        this.push((this.P | 0x02) & ~(1 << 0x04));
        this.PC = this.loadWord(0xFFFE);
    }
    nmi() {
        this.push((this.PC >> 8) & 0xFF);
        this.push(this.PC & 0xFF);
        this.push((this.P | 0x02) & ~(1 << 0x04));
        this.PC = this.loadWord(0xFFFA);
    }
    loadWord(addr) {
        return this.memory[addr] + (this.memory[addr + 1] << 8);
    }
    push(val) {
        this.memory[0x0100 + this.S] = val;
        this.S -= 1;
        if (this.S < 0) {
            this.S = 0xFF;
        }
    }
    pull() {
        this.S += 1;
        if (this.S > 0xFF) {
            this.S = 0;
        }
        return this.memory[0x0100 + this.S];
    }
    branch(offset) {
        this.PC += offset < 128 ? offset : offset - 256;
    }
    setNZ(val) {
        this.N = !!(val >> 7);
        this.Z = !val;
    }
}
module.exports.Cpu = Cpu;
class DataSheet {
    constructor() {
        this.instructions = [];
        this.opCodeBytes = {};
        this.opCodeMode = {};
        this.opCodeName = {};
        this.addressingModes = [
            'IMM',
            'ZP',
            'ZPX',
            'ZPY',
            'ABS',
            'ABSX',
            'ABSY',
            'IND',
            'XZPI',
            'ZPIY',
            'IMPL',
            'REL',
        ];
        this.addressingModeBytes = {
            IMM: 2,
            ZP: 2,
            ZPX: 2,
            ZPY: 2,
            ABS: 3,
            ABSX: 3,
            ABSY: 3,
            IND: 3,
            XZPI: 2,
            ZPIY: 2,
            IMPL: 1,
            REL: 2,
        };
        this.Opcodes = {
            ADC: [0x69, 0x65, 0x75, NaN, 0x6D, 0x7D, 0x79, NaN, 0x61, 0x71, NaN, NaN],
            AND: [0x29, 0x25, 0x35, NaN, 0x2D, 0x3D, 0x39, NaN, 0x21, 0x31, NaN, NaN],
            ASL: [NaN, 0x06, 0x16, NaN, 0x0E, 0x1E, NaN, NaN, NaN, NaN, 0x0A, NaN],
            BCC: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x90],
            BCS: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0xB0],
            BEQ: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0xF0],
            BIT: [NaN, 0x24, NaN, NaN, 0x2C, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
            BMI: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x30],
            BNE: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0xD0],
            BPL: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x10],
            BRK: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x00, NaN],
            BVC: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x50],
            BVS: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x70],
            CLC: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x18, NaN],
            CLD: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0xD8, NaN],
            CLI: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x58, NaN],
            CLV: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0xB8, NaN],
            CMP: [0xC9, 0xC5, 0xD5, NaN, 0xCD, 0xDD, 0xD9, NaN, 0xC1, 0xD1, NaN, NaN],
            CPX: [0xE0, 0xE4, NaN, NaN, 0xEC, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
            CPY: [0xC0, 0xC4, NaN, NaN, 0xCC, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
            DEC: [NaN, 0xC6, 0xD6, NaN, 0xCE, 0xDE, NaN, NaN, NaN, NaN, NaN, NaN],
            DEX: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0xCA, NaN],
            DEY: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x88, NaN],
            EOR: [0x49, 0x45, 0x55, NaN, 0x4D, 0x5D, 0x59, NaN, 0x41, 0x51, NaN, NaN],
            INC: [NaN, 0xE6, 0xF6, NaN, 0xEE, 0xFE, NaN, NaN, NaN, NaN, NaN, NaN],
            INX: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0xE8, NaN],
            INY: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0xC8, NaN],
            JMP: [NaN, NaN, NaN, NaN, 0x4C, NaN, NaN, 0x6C, NaN, NaN, NaN, NaN],
            JSR: [NaN, NaN, NaN, NaN, 0x20, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
            LDA: [0xA9, 0xA5, 0xB5, NaN, 0xAD, 0xBD, 0xB9, NaN, 0xA1, 0xB1, NaN, NaN],
            LDX: [0xA2, 0xA6, NaN, 0xB6, 0xAE, NaN, 0xBE, NaN, NaN, NaN, NaN, NaN],
            LDY: [0xA0, 0xA4, 0xB4, NaN, 0xAC, 0xBC, NaN, NaN, NaN, NaN, NaN, NaN],
            LSR: [NaN, 0x46, 0x56, NaN, 0x4E, 0x5E, NaN, NaN, NaN, NaN, 0x4A, NaN],
            NOP: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0xEA, NaN],
            ORA: [0x09, 0x05, 0x15, NaN, 0x0D, 0x1D, 0x19, NaN, 0x01, 0x11, NaN, NaN],
            PHA: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x48, NaN],
            PHP: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x08, NaN],
            PLA: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x68, NaN],
            PLP: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x28, NaN],
            ROL: [NaN, 0x26, 0x36, NaN, 0x2E, 0x3E, NaN, NaN, NaN, NaN, 0x2A, NaN],
            ROR: [NaN, 0x66, 0x76, NaN, 0x6E, 0x7E, NaN, NaN, NaN, NaN, 0x6A, NaN],
            RTI: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x40, NaN],
            RTS: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x60, NaN],
            SBC: [0xE9, 0xE5, 0xF5, NaN, 0xED, 0xFD, 0xF9, NaN, 0xE1, 0xF1, NaN, NaN],
            SEC: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x38, NaN],
            SED: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0xF8, NaN],
            SEI: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x78, NaN],
            STA: [NaN, 0x85, 0x95, NaN, 0x8D, 0x9D, 0x99, NaN, 0x81, 0x91, NaN, NaN],
            STX: [NaN, 0x86, NaN, 0x96, 0x8E, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
            STY: [NaN, 0x84, 0x94, NaN, 0x8C, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
            TAX: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0xAA, NaN],
            TAY: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0xA8, NaN],
            TSX: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0xBA, NaN],
            TXA: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x8A, NaN],
            TXS: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x9A, NaN],
            TYA: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0x98, NaN],
        };
        this.instrDescription = {
            ADC: 'Add with Carry',
            AND: 'Logical AND',
            ASL: 'Arithmetic Shift Left',
            BCC: 'Branch if Carry Clear',
            BCS: 'Branch if Carry Set',
            BEQ: 'Branch if Equal',
            BIT: 'Bit Test',
            BMI: 'Branch if Minus',
            BNE: 'Branch if Not Equal',
            BPL: 'Branch if Plus',
            BRK: 'Force Interrupt',
            BVC: 'Branch if Overflow Clear',
            BVS: 'Branch if Overflow Set',
            CLC: 'Clear Carry Flag',
            CLD: 'Clear Decimal Mode',
            CLI: 'Clear Interrupt Disable',
            CLV: 'Clear Overflow Flag',
            CMP: 'Compare',
            CPX: 'Compare X Register',
            CPY: 'Compare Y Register',
            DEC: 'Decrement Memory',
            DEX: 'Decrement X Register',
            DEY: 'Decrement Y Register',
            EOR: 'Exclusive OR',
            INC: 'Increment Memory',
            INX: 'Increment X Register',
            INY: 'Increment Y Register',
            JMP: 'Jump',
            JSR: 'Jump to Subroutine',
            LDA: 'Load Accumulator',
            LDX: 'Load X Register',
            LDY: 'Load Y Register',
            LSR: 'Logical Shift Right',
            NOP: 'No Operation',
            ORA: 'Logical OR',
            PHA: 'Push Accumulator',
            PHP: 'Push Processor Status',
            PLA: 'Pull Accumulator',
            PLP: 'Pull Processor Status',
            ROL: 'Rotate Left',
            ROR: 'Rotate Right',
            RTI: 'Return from Interrupt',
            RTS: 'Return from Subroutine',
            SBC: 'Subtract with Carry',
            SEC: 'Set Carry Flag',
            SED: 'Set Decimal Flag',
            SEI: 'Set Interrupt Disable',
            STA: 'Store Accumulator',
            STX: 'Store X Register',
            STY: 'Store Y Register',
            TAX: 'Transfer Accumulator to X',
            TAY: 'Transfer Accumulator to Y',
            TSX: 'Transfer Stack Pointer to X',
            TXA: 'Transfer X to Accumulator',
            TXS: 'Transfer X to Stack Pointer',
            TYA: 'Transfer Y to Accumulator',
        };
        Object.keys(this.Opcodes).forEach(instr => {
            this.instructions.push(instr);
            this.Opcodes[instr].forEach((opc, index) => {
                this.populateData(instr, opc, index);
            });
        });
    }
    populateData(instr, opc, index) {
        if (isNaN(opc)) {
            return;
        }
        const addressingMode = this.addressingModes[index];
        this.opCodeName[opc] = instr;
        this.opCodeMode[opc] = addressingMode;
        this.opCodeBytes[opc] = this.addressingModeBytes[addressingMode];
    }
    getOpc(instName, mode) {
        const modeIndex = this.addressingModes.indexOf(mode);
        return this.Opcodes[instName][modeIndex];
    }
}
module.exports.DataSheet = DataSheet;
class Emulator {
    constructor() {
        this.isStopRequired = false;
        this.instructionLog = [];
        this.dataSheet = new DataSheet();
        this.assembler = new Assembler();
        this.memory = new Uint8Array(0xFFFF + 1);
        this.cpu = new Cpu(this.memory);
    }
    initialize() {
        this.codeEditor = document.getElementById('source-code');
        this.terminal = document.getElementById('terminal');
        this.codeEditor.addEventListener('keydown', this.codeEditor_keyDown.bind(this));
        const btnLoadCode = document.getElementById('btn-load-code');
        btnLoadCode.addEventListener('click', this.btnLoadCode_click.bind(this));
        const btnCpuReset = document.getElementById('btn-cpu-reset');
        btnCpuReset.addEventListener('click', this.btnReset_click.bind(this));
        const btnCpuStep = document.getElementById('btn-cpu-step');
        btnCpuStep.addEventListener('click', this.btnCpuStep_click.bind(this));
        const btnCpuDebug = document.getElementById('btn-cpu-debug');
        btnCpuDebug.addEventListener('click', this.btnDebug_click.bind(this));
        const btnCpuStop = document.getElementById('btn-cpu-stop');
        btnCpuStop.addEventListener('click', this.btnPause_click.bind(this));
        const btnCpuRun = document.getElementById('btn-cpu-run');
        btnCpuRun.addEventListener('click', this.btnRun_click.bind(this));
        const btnForever = document.getElementById('btn-run-forever');
        btnForever.addEventListener('click', this.btnForever_click.bind(this));
        this.loadExample();
    }
    loadExample() {
        this.getRequest('./example/game-of-life.asm', this.getRequest_ready.bind(this));
    }
    getRequest_ready(data) {
        this.codeEditor.value = data;
    }
    btnLoadCode_click(event) {
        event.preventDefault();
        const sourceCode = this.codeEditor.value;
        this.memory.fill(0x00);
        this.isStopRequired = true;
        this.terminal.innerText = '';
        this.instructionLog = [];
        const codeDto = this.assembler.tokenize(sourceCode);
        const errorOutput = codeDto.codeTokens
            .filter(token => token.tokenType === 'error')
            .reduce((acc, token) => {
            acc.push(`Error:       ${token.error}`);
            acc.push(`Code line:   ${token.codeLine}`);
            acc.push(`Instruction: ${token.instrName}`);
            return acc;
        }, []);
        if (errorOutput.length > 0) {
            this.terminal.innerText = errorOutput.join('\n') + '\n';
            return;
        }
        try {
            const codePages = this.assembler.load(sourceCode, this.memory);
            this.setInitialPCinMemory();
            this.cpu.reset();
            const disassembly = this.assembler
                .disassembleCodePages(codePages)
                .map(tkn => `$${tkn.address}   ${tkn.code.join(' ').padEnd(8, ' ')}   ${tkn.text.padEnd(13, ' ')}  ; ${tkn.description}`)
                .join('\n');
            this.terminal.innerText = '' +
                '                       Disassembly\n' +
                '---------------------------------------------------------\n' +
                disassembly + '\n\n\n' +
                '                       Object code\n' +
                '---------------------------------------------------------\n' +
                Assembler.hexDump(codePages);
        }
        catch (e) {
            this.terminal.innerText += e.message + '\n';
        }
    }
    btnReset_click(event) {
        event.preventDefault();
        this.isStopRequired = true;
        this.setInitialPCinMemory();
        this.cpu.reset();
        this.dump();
    }
    btnCpuStep_click(event) {
        event.preventDefault();
        this.isStopRequired = false;
        try {
            this.cpu.step();
            this.dump();
        }
        catch (e) {
            this.terminal.innerText += e.message + '\n';
        }
    }
    btnDebug_click(event) {
        event.preventDefault();
        this.isStopRequired = false;
        setTimeout(this.debugLoop.bind(this), 0);
    }
    debugLoop() {
        if (this.isStopRequired) {
            return;
        }
        try {
            this.cpu.step();
            this.dump();
            if (this.memory[this.cpu.PC] === 0x00) {
                return;
            }
        }
        catch (e) {
            this.terminal.innerText += e.message + '\n';
        }
        setTimeout(this.debugLoop.bind(this), 700);
    }
    cpuRun() {
        let isFirstStep = true;
        while (isFirstStep || this.memory[this.cpu.PC] !== 0x00) {
            isFirstStep = false;
            this.cpu.step();
        }
        this.dump();
    }
    btnRun_click(event) {
        event.preventDefault();
        this.isStopRequired = false;
        try {
            this.cpuRun();
        }
        catch (e) {
            this.terminal.innerText += e.message + '\n';
        }
    }
    btnForever_click(event) {
        event.preventDefault();
        this.isStopRequired = false;
        this.runForever();
    }
    btnPause_click(event) {
        event.preventDefault();
        this.isStopRequired = true;
    }
    dump() {
        this.terminal.innerText = '' +
            this.getCpuDump() + '\n\n\n\n\n' +
            '                         Instruction Log\n' +
            '-------------------------------------------------------------------------\n' +
            this.getAssemblyDump() + '\n\n\n\n\n' +
            '                           Memory Dump\n' +
            '-------------------------------------------------------------------------\n' +
            this.getMemoryDump() + '\n\n';
    }
    getCpuDump() {
        const getRegText = (val) => `${Utils.byteToHex(val)}  ${val.toString(10).padStart(3, ' ')}  ${Utils.byteToSInt(val).padStart(4, ' ')}`;
        const flagsText = `${+this.cpu.N} ${+this.cpu.V} 1 ${+this.cpu.B} ${+this.cpu.D} ${+this.cpu.I} ${+this.cpu.Z} ${+this.cpu.C}`;
        return '' +
            'R  Hex  Dec   +/-    R   Hex   N V - B D I Z C\n' +
            '-----------------    -------   ---------------\n' +
            `A   ${getRegText(this.cpu.A)}    P    ${Utils.byteToHex(this.cpu.P)}   ${flagsText}\n` +
            `X   ${getRegText(this.cpu.X)}    S    ${Utils.byteToHex(this.cpu.S)}\n` +
            `Y   ${getRegText(this.cpu.Y)}    PC ${Utils.wordToHex(this.cpu.PC)}`;
    }
    getAssemblyDump() {
        const pc = this.cpu.PC;
        const opc = this.memory[pc];
        const bytes = this.dataSheet.opCodeBytes[opc];
        const code = Array.from(this.memory.slice(pc, pc + bytes));
        const tokens = this.assembler.disassemble(code, pc);
        if (tokens.length > 0) {
            const tkn = tokens[0];
            const currentInst = `$${tkn.address}   ${tkn.code.join(' ').padEnd(8, ' ')}   ${tkn.text.padEnd(13, ' ')}  ; ${tkn.description}`;
            this.instructionLog.push(currentInst);
            this.instructionLog = this.instructionLog.slice(-3);
        }
        return this.instructionLog.map((line, index) => (index === this.instructionLog.length - 1 ? ' --> ' : '     ') + line).join('\n');
    }
    getMemoryDump() {
        const lines = [];
        let isLineSkipped = false;
        for (let line = 0; line < this.memory.length / 16; line++) {
            const currentBytes = [];
            const currentChars = [];
            const lineAddress = line * 16;
            const lineAddressText = Utils.wordToHex(line * 16);
            for (let col = 0; col < 16; col++) {
                const address = line * 16 + col;
                const value = this.memory[address];
                currentBytes.push(Utils.byteToHex(value));
                currentChars.push(value >= 0x20 && value <= 0x7E ? String.fromCharCode(value) : '.');
            }
            if (lineAddress % 0x0100 === 0 && lines.length > 0 && lines[lines.length - 1] !== '') {
                lines.push('');
            }
            if (currentBytes.some(e => e !== '00')) {
                lines.push(`${lineAddressText} | ${currentBytes.join(' ')} | ${currentChars.join('')}`);
                isLineSkipped = false;
            }
        }
        return lines.join('\n');
    }
    codeEditor_keyDown(event) {
        if (event.key !== 'Tab') {
            return;
        }
        event.preventDefault();
        const selectionStart = this.codeEditor.selectionStart;
        this.codeEditor.value =
            this.codeEditor.value.substring(0, this.codeEditor.selectionStart) +
                "    " +
                this.codeEditor.value.substring(this.codeEditor.selectionEnd);
        this.codeEditor.selectionEnd = selectionStart + 4;
    }
    setInitialPCinMemory() {
        const initialPc = document.getElementById('initial-pc').value;
        const address = parseInt(initialPc, 16);
        this.memory[0xFFFC] = address & 0x00FF;
        this.memory[0xFFFD] = (address >> 8) & 0x00FF;
    }
    runForever() {
        if (this.isStopRequired) {
            return;
        }
        try {
            this.cpuRun();
        }
        catch (e) {
            this.terminal.innerText += e.message + '\n';
        }
        setTimeout(this.runForever.bind(this), 500);
    }
    getRequest(url, callback) {
        const xmlHttp = new XMLHttpRequest();
        xmlHttp.onreadystatechange = readyStateChange;
        xmlHttp.open('GET', url, true);
        xmlHttp.send();
        function readyStateChange() {
            if (xmlHttp.readyState === 4 && xmlHttp.status === 200) {
                callback(xmlHttp.responseText);
            }
        }
    }
}
module.exports.Emulator = Emulator;
class Utils {
    static byteToHex(val) {
        const hex = '0123456789ABCDEF';
        return hex[(val >> 4) & 0xF] + hex[val & 0xF];
    }
    static wordToHex(val) {
        const hex = '0123456789ABCDEF';
        return hex[(val >> 12) & 0xF] + hex[(val >> 8) & 0xF] + hex[(val >> 4) & 0xF] + hex[val & 0xF];
    }
    static byteToSInt(val) {
        if (val > 0x7F) {
            return '-' + (((~val) + 1) & 0xFF).toString(10);
        }
        return val.toString(10);
    }
    static randomByte() {
        return Math.floor((0xFF + 1) * Math.random());
    }
    static randomBit() {
        return Math.floor(2 * Math.random());
    }
}
module.exports.Utils = Utils;
//# sourceMappingURL=index.js.map