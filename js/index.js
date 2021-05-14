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
                case 'INDX':
                case 'INDY':
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
                case 'INDX':
                    token.text += ',X)';
                    break;
                case 'INDY':
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
    parseInstructions(codeDtoPassOne) {
        const instructionTokens = [];
        let pc = 0x0800;
        for (const token of codeDtoPassOne.codeTokens) {
            if (token.tokenType === 'set-pc') {
                pc = token.pcValue;
                continue;
            }
            if (token.tokenType === 'label') {
                codeDtoPassOne.labels[token.instrName] = pc;
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
                        .map(num => this.parseValue(num))
                        .reduce((acc, word) => {
                        acc.push(word & 0xFF);
                        acc.push((word >> 8) & 0xFF);
                        return acc;
                    }, []);
                    instructionTokens.push({ pc, bytes, name: '.BYTE', opc: -1 });
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
                const value = this.parseValue(operandText, codeDtoPassOne.labels);
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
                const value = this.parseValue(matchABS[1], codeDtoPassOne.labels);
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
                const value = this.parseValue(matchABSX[1], codeDtoPassOne.labels);
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
                const value = this.parseValue(matchABSY[1]);
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
                const value = this.parseValue(matchIND[1], codeDtoPassOne.labels);
                instructionTokens.push(getInstrToken(pc, name, opc, value));
                pc += this.dataSheet.opCodeBytes[opc];
                continue;
            }
            const matchINDX = /^[A-Z]{3} \(([$%]?[0-9A-Z]+),X\)$/.exec(line);
            if (matchINDX) {
                const opc = this.dataSheet.getOpc(name, 'INDX');
                const value = this.parseValue(matchINDX[1]);
                instructionTokens.push({ pc, opc, name, bytes: [opc, value] });
                pc += this.dataSheet.opCodeBytes[opc];
                continue;
            }
            const matchINDY = /^[A-Z]{3} \(([$%]?[0-9A-Z]+)\),Y$/.exec(line);
            if (matchINDY) {
                const opc = this.dataSheet.getOpc(name, 'INDY');
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
            if (labels.hasOwnProperty(valueText)) {
                return valueText;
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
        this.isStopRequired = false;
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
            INDX: () => this.loadWord(this.memory[this.PC + 1] + this.X),
            INDY: () => this.loadWord(this.memory[this.PC + 1]) + this.Y,
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
                return true;
            },
            AND: (opr) => {
                this.A &= opr;
                this.setNZ(this.A);
                return true;
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
                return true;
            },
            BCC: (opr, cycles) => {
                if (!this.C) {
                    this.branch(opr, cycles);
                    return false;
                }
                return true;
            },
            BCS: (opr, cycles) => {
                if (this.C) {
                    this.branch(opr, cycles);
                    return false;
                }
                return true;
            },
            BEQ: (opr, cycles) => {
                if (this.Z) {
                    this.branch(opr, cycles);
                    return false;
                }
                return true;
            },
            BIT: (opr) => {
                const val = this.A & opr;
                this.N = !!(opr >> 7);
                this.V = !!(opr >> 6);
                this.Z = !val;
                return true;
            },
            BMI: (opr, cycles) => {
                if (this.N) {
                    this.branch(opr, cycles);
                    return false;
                }
                return true;
            },
            BNE: (opr, cycles) => {
                if (!this.Z) {
                    this.branch(opr, cycles);
                    return false;
                }
                return true;
            },
            BPL: (opr, cycles) => {
                if (!this.N) {
                    this.branch(opr, cycles);
                    return false;
                }
                return true;
            },
            BRK: () => {
                const addr = this.PC + 2;
                this.push(addr & 0xFF);
                this.push((addr >> 8) & 0xFF);
                this.B = true;
                this.push(this.P);
                this.B = false;
                this.PC = this.loadWord(0xFFFE);
                this.cycles += 7;
                return false;
            },
            BVC: (opr, cycles) => {
                if (!this.V) {
                    this.branch(opr, cycles);
                    return false;
                }
                return true;
            },
            BVS: (opr, cycles) => {
                if (this.V) {
                    this.branch(opr, cycles);
                    return false;
                }
                return true;
            },
            CMP: (opr) => {
                const delta = this.A - opr;
                this.C = this.A >= opr;
                this.setNZ(delta);
                return true;
            },
            CPX: (opr) => {
                const delta = this.X - opr;
                this.C = this.X >= opr;
                this.setNZ(delta);
                return true;
            },
            CPY: (opr) => {
                const delta = this.Y - opr;
                this.C = this.Y >= opr;
                this.setNZ(delta);
                return true;
            },
            CLC: () => {
                this.C = false;
                return true;
            },
            CLD: () => {
                this.D = false;
                return true;
            },
            CLI: () => {
                this.I = false;
                return true;
            },
            CLV: () => {
                this.V = false;
                return true;
            },
            DEC: (addr) => {
                const val = this.memory[addr] = this.memory[addr] > 0 ? this.memory[addr] - 1 : 0xFF;
                this.setNZ(val);
                return true;
            },
            DEX: () => {
                this.X = this.X > 0 ? this.X - 1 : 0xFF;
                this.setNZ(this.X);
                return true;
            },
            DEY: () => {
                this.Y = this.Y > 0 ? this.Y - 1 : 0xFF;
                this.setNZ(this.Y);
                return true;
            },
            EOR: (opr) => {
                this.A ^= opr;
                this.setNZ(this.A);
                return true;
            },
            INC: (addr) => {
                const val = this.memory[addr] = this.memory[addr] < 0xFF ? this.memory[addr] + 1 : 0;
                this.setNZ(val);
                return true;
            },
            INX: () => {
                this.X = this.X < 0xFF ? this.X + 1 : 0;
                this.setNZ(this.X);
                return true;
            },
            INY: () => {
                this.Y = this.Y < 0xFF ? this.Y + 1 : 0;
                this.setNZ(this.Y);
                return true;
            },
            LDA: (opr) => {
                this.A = opr;
                this.setNZ(this.A);
                return true;
            },
            LDX: (opr) => {
                this.X = opr;
                this.setNZ(this.X);
                return true;
            },
            LDY: (opr) => {
                this.Y = opr;
                this.setNZ(this.Y);
                return true;
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
                return true;
            },
            NOP: () => {
                return true;
            },
            ORA: (opr) => {
                this.A |= opr;
                this.setNZ(this.A);
                return true;
            },
            PHA: () => {
                this.push(this.A);
                return true;
            },
            PHP: () => {
                this.push(this.P);
                return true;
            },
            PLA: () => {
                this.A = this.pull();
                this.setNZ(this.A);
                return true;
            },
            PLP: () => {
                this.P = this.pull();
                return true;
            },
            JMP: (addr, cycles) => {
                this.PC = addr;
                this.cycles += cycles;
                return false;
            },
            JSR: (addr, cycles) => {
                const returnAddress = this.PC + 2;
                this.push(returnAddress & 0xFF);
                this.push((returnAddress >> 8) & 0xFF);
                this.PC = addr;
                this.cycles += cycles;
                return false;
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
                return true;
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
                return true;
            },
            RTI: (opr, cycles) => {
                this.P = this.pull();
                this.PC = (this.pull() << 8) + this.pull();
                this.cycles += cycles;
                return false;
            },
            RTS: (opr, cycles) => {
                const address = (this.pull() << 8) + this.pull();
                this.PC = address + 1;
                this.cycles += cycles;
                return false;
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
                return true;
            },
            SEC: () => {
                this.C = true;
                return true;
            },
            SED: () => {
                this.D = true;
                return true;
            },
            SEI: () => {
                this.I = true;
                return true;
            },
            STA: (addr) => {
                this.memory[addr] = this.A;
                return true;
            },
            STX: (addr) => {
                this.memory[addr] = this.X;
                return true;
            },
            STY: (addr) => {
                this.memory[addr] = this.Y;
                return true;
            },
            TAX: () => {
                this.X = this.A;
                this.setNZ(this.X);
                return true;
            },
            TAY: () => {
                this.Y = this.A;
                this.setNZ(this.Y);
                return true;
            },
            TSX: () => {
                this.X = this.S;
                this.setNZ(this.X);
                return true;
            },
            TXA: () => {
                this.A = this.X;
                this.setNZ(this.A);
                return true;
            },
            TXS: () => {
                this.S = this.X;
                return true;
            },
            TYA: () => {
                this.A = this.Y;
                this.setNZ(this.A);
                return true;
            },
        };
        this.dataSheet = new DataSheet();
        this.memory = memory;
        this.A = 0x00;
        this.X = 0x00;
        this.Y = 0x00;
        this.S = 0xFF;
        this.PC = 0x0000;
        this.N = false;
        this.V = false;
        this.B = false;
        this.D = false;
        this.I = false;
        this.Z = false;
        this.C = false;
        this.cycles = 0;
    }
    get P() {
        return (+this.N << 7) | (+this.V << 6) | (1 << 5) | (+this.B << 4) |
            (+this.D << 3) | (+this.I << 2) | (+this.Z << 1) | (+this.C << 0);
    }
    set P(val) {
        this.N = !!((val >> 7) & 0x01);
        this.V = !!((val >> 6) & 0x01);
        this.B = !!((val >> 4) & 0x01);
        this.D = !!((val >> 3) & 0x01);
        this.I = !!((val >> 2) & 0x01);
        this.Z = !!((val >> 1) & 0x01);
        this.C = !!((val >> 0) & 0x01);
    }
    get currentPC() {
        return this.PC;
    }
    reset() {
        this.isStopRequired = false;
        this.A = 0x00;
        this.X = 0x00;
        this.Y = 0x00;
        this.S = 0xFF;
        this.PC = 0x0000;
        this.N = false;
        this.V = false;
        this.B = false;
        this.D = false;
        this.I = false;
        this.Z = false;
        this.C = false;
        this.cycles = 7;
        this.PC = this.loadWord(0xFFFC);
    }
    run() {
        this.isStopRequired = false;
        this.cycles = 7;
        while (!this.isStopRequired && this.cycles < 1000000) {
            this.step();
        }
    }
    step() {
        this.isStopRequired = false;
        const opc = this.memory[this.PC];
        if (opc === undefined) {
            throw new Error(`Invalid instruction: $${Utils.wordToHex(this.PC)}   ${Utils.byteToHex(opc)}`);
        }
        const name = this.dataSheet.opCodeName[opc];
        const mode = this.dataSheet.opCodeMode[opc];
        const opr = this.addressInstructions.includes(name)
            ? this.operandAddress[mode]()
            : mode === 'IMPL'
                ? this.A
                : this.memory[this.operandAddress[mode]()];
        const cycles = this.dataSheet.opCodeCycles[opc];
        const isGenericOperation = this.instruction[name](opr, cycles);
        if (isGenericOperation) {
            this.PC += this.dataSheet.opCodeBytes[opc];
            this.cycles += cycles;
        }
        this.isStopRequired = this.B || this.I || this.memory[this.PC] === 0x00;
        return this.isStopRequired;
    }
    dumpStatus() {
        const getRegText = (val) => `${Utils.byteToHex(val)}  ${val.toString(10).padStart(3, ' ')}  ${Utils.byteToSInt(val).padStart(4, ' ')}`;
        const flagsText = `${+this.N} ${+this.V} 1 ${+this.B} ${+this.D} ${+this.I} ${+this.Z} ${+this.C}`;
        return '' +
            'R  Hex  Dec   +/-    R   Hex   N V - B D I Z C\n' +
            '-----------------    -------   ---------------\n' +
            `A   ${getRegText(this.A)}    P    ${Utils.byteToHex(this.P)}   ${flagsText}\n` +
            `X   ${getRegText(this.X)}    S    ${Utils.byteToHex(this.S)}\n` +
            `Y   ${getRegText(this.Y)}    PC ${Utils.wordToHex(this.PC)}   Cycles: ${this.cycles}`;
    }
    stop() {
        this.isStopRequired = true;
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
        const val = this.memory[0x0100 + this.S];
        if (this.S > 0xFF) {
            this.S = 0;
        }
        return val;
    }
    branch(offset, cycles) {
        this.PC = offset > 0x7F
            ? this.PC + 2 - (0x100 - offset)
            : this.PC + 2 + offset;
        this.cycles += cycles + 1;
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
            '---',
            'IMM',
            'ZP',
            'ZPX',
            'ZPY',
            'ABS',
            'ABSX',
            'ABSY',
            'IND',
            'INDX',
            'INDY',
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
            INDX: 2,
            INDY: 2,
            IMPL: 1,
            REL: 2,
        };
        this.Opcodes = [
            ['ADC', 0x69, 0x65, 0x75, null, 0x6D, 0x7D, 0x79, null, 0x61, 0x71, null, null],
            ['AND', 0x29, 0x25, 0x35, null, 0x2D, 0x3D, 0x39, null, 0x21, 0x31, null, null],
            ['ASL', null, 0x06, 0x16, null, 0x0E, 0x1E, null, null, null, null, 0x0A, null],
            ['BIT', null, 0x24, null, null, 0x2C, null, null, null, null, null, null, null],
            ['BPL', null, null, null, null, null, null, null, null, null, null, null, 0x10],
            ['BMI', null, null, null, null, null, null, null, null, null, null, null, 0x30],
            ['BVC', null, null, null, null, null, null, null, null, null, null, null, 0x50],
            ['BVS', null, null, null, null, null, null, null, null, null, null, null, 0x70],
            ['BCC', null, null, null, null, null, null, null, null, null, null, null, 0x90],
            ['BCS', null, null, null, null, null, null, null, null, null, null, null, 0xB0],
            ['BNE', null, null, null, null, null, null, null, null, null, null, null, 0xD0],
            ['BEQ', null, null, null, null, null, null, null, null, null, null, null, 0xF0],
            ['BRK', null, null, null, null, null, null, null, null, null, null, 0x00, null],
            ['CMP', 0xC9, 0xC5, 0xD5, null, 0xCD, 0xDD, 0xD9, null, 0xC1, 0xD1, null, null],
            ['CPX', 0xE0, 0xE4, null, null, 0xEC, null, null, null, null, null, null, null],
            ['CPY', 0xC0, 0xC4, null, null, 0xCC, null, null, null, null, null, null, null],
            ['DEC', null, 0xC6, 0xD6, null, 0xCE, 0xDE, null, null, null, null, null, null],
            ['EOR', 0x49, 0x45, 0x55, null, 0x4D, 0x5D, 0x59, null, 0x41, 0x51, null, null],
            ['CLC', null, null, null, null, null, null, null, null, null, null, 0x18, null],
            ['SEC', null, null, null, null, null, null, null, null, null, null, 0x38, null],
            ['CLI', null, null, null, null, null, null, null, null, null, null, 0x58, null],
            ['SEI', null, null, null, null, null, null, null, null, null, null, 0x78, null],
            ['CLV', null, null, null, null, null, null, null, null, null, null, 0xB8, null],
            ['CLD', null, null, null, null, null, null, null, null, null, null, 0xD8, null],
            ['SED', null, null, null, null, null, null, null, null, null, null, 0xF8, null],
            ['INC', null, 0xE6, 0xF6, null, 0xEE, 0xFE, null, null, null, null, null, null],
            ['JMP', null, null, null, null, 0x4C, null, null, 0x6C, null, null, null, null],
            ['JSR', null, null, null, null, 0x20, null, null, null, null, null, null, null],
            ['LDA', 0xA9, 0xA5, 0xB5, null, 0xAD, 0xBD, 0xB9, null, 0xA1, 0xB1, null, null],
            ['LDX', 0xA2, 0xA6, null, 0xB6, 0xAE, null, 0xBE, null, null, null, null, null],
            ['LDY', 0xA0, 0xA4, 0xB4, null, 0xAC, 0xBC, null, null, null, null, null, null],
            ['LSR', null, 0x46, 0x56, null, 0x4E, 0x5E, null, null, null, null, 0x4A, null],
            ['NOP', null, null, null, null, null, null, null, null, null, null, 0xEA, null],
            ['ORA', 0x09, 0x05, 0x15, null, 0x0D, 0x1D, 0x19, null, 0x01, 0x11, null, null],
            ['TAX', null, null, null, null, null, null, null, null, null, null, 0xAA, null],
            ['TXA', null, null, null, null, null, null, null, null, null, null, 0x8A, null],
            ['DEX', null, null, null, null, null, null, null, null, null, null, 0xCA, null],
            ['INX', null, null, null, null, null, null, null, null, null, null, 0xE8, null],
            ['TAY', null, null, null, null, null, null, null, null, null, null, 0xA8, null],
            ['TYA', null, null, null, null, null, null, null, null, null, null, 0x98, null],
            ['DEY', null, null, null, null, null, null, null, null, null, null, 0x88, null],
            ['INY', null, null, null, null, null, null, null, null, null, null, 0xC8, null],
            ['ROR', null, 0x66, 0x76, null, 0x6E, 0x7E, null, null, null, null, 0x6A, null],
            ['ROL', null, 0x26, 0x36, null, 0x2E, 0x3E, null, null, null, null, 0x2A, null],
            ['RTI', null, null, null, null, null, null, null, null, null, null, 0x40, null],
            ['RTS', null, null, null, null, null, null, null, null, null, null, 0x60, null],
            ['SBC', 0xE9, 0xE5, 0xF5, null, 0xED, 0xFD, 0xF9, null, 0xE1, 0xF1, null, null],
            ['STA', null, 0x85, 0x95, null, 0x8D, 0x9D, 0x99, null, 0x81, 0x91, null, null],
            ['TXS', null, null, null, null, null, null, null, null, null, null, 0x9A, null],
            ['TSX', null, null, null, null, null, null, null, null, null, null, 0xBA, null],
            ['PHA', null, null, null, null, null, null, null, null, null, null, 0x48, null],
            ['PLA', null, null, null, null, null, null, null, null, null, null, 0x68, null],
            ['PHP', null, null, null, null, null, null, null, null, null, null, 0x08, null],
            ['PLP', null, null, null, null, null, null, null, null, null, null, 0x28, null],
            ['STX', null, 0x86, null, 0x96, 0x8E, null, null, null, null, null, null, null],
            ['STY', null, 0x84, 0x94, null, 0x8C, null, null, null, null, null, null, null],
            ['WDM', 0x42, 0x42, null, null, null, null, null, null, null, null, null, null],
            ['---', null, null, null, null, null, null, null, null, null, null, null, null],
        ];
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
        this.opCodeCycles = {
            0x00: 7,
            0x01: 6,
            0x05: 3,
            0x06: 5,
            0x08: 3,
            0x09: 2,
            0x0A: 2,
            0x0D: 4,
            0x0E: 6,
            0x10: 2,
            0x11: 5,
            0x15: 4,
            0x16: 6,
            0x18: 2,
            0x19: 4,
            0x1D: 4,
            0x1E: 7,
            0x20: 6,
            0x21: 6,
            0x24: 3,
            0x25: 3,
            0x26: 5,
            0x28: 4,
            0x29: 2,
            0x2A: 2,
            0x2C: 4,
            0x2D: 4,
            0x2E: 6,
            0x30: 2,
            0x31: 5,
            0x35: 4,
            0x36: 6,
            0x38: 2,
            0x39: 4,
            0x3D: 4,
            0x3E: 7,
            0x40: 6,
            0x41: 6,
            0x45: 3,
            0x46: 5,
            0x48: 3,
            0x49: 2,
            0x4A: 2,
            0x4C: 3,
            0x4D: 4,
            0x4E: 6,
            0x50: 2,
            0x51: 5,
            0x55: 4,
            0x56: 6,
            0x58: 2,
            0x59: 4,
            0x5D: 4,
            0x5E: 7,
            0x60: 6,
            0x61: 6,
            0x65: 3,
            0x66: 5,
            0x68: 4,
            0x69: 2,
            0x6A: 2,
            0x6C: 5,
            0x6D: 4,
            0x6E: 6,
            0x70: 2,
            0x71: 5,
            0x75: 4,
            0x76: 6,
            0x78: 2,
            0x79: 4,
            0x7D: 4,
            0x7E: 7,
            0x81: 6,
            0x84: 3,
            0x85: 3,
            0x86: 3,
            0x88: 2,
            0x8A: 2,
            0x8C: 4,
            0x8D: 4,
            0x8E: 4,
            0x90: 2,
            0x91: 6,
            0x94: 4,
            0x95: 4,
            0x96: 4,
            0x98: 2,
            0x99: 5,
            0x9A: 2,
            0x9D: 5,
            0xA0: 2,
            0xA1: 6,
            0xA2: 2,
            0xA4: 3,
            0xA5: 3,
            0xA6: 3,
            0xA8: 2,
            0xA9: 2,
            0xAA: 2,
            0xAC: 4,
            0xAD: 4,
            0xAE: 4,
            0xB0: 2,
            0xB1: 5,
            0xB4: 4,
            0xB5: 4,
            0xB6: 4,
            0xB8: 2,
            0xB9: 4,
            0xBA: 2,
            0xBC: 4,
            0xBD: 4,
            0xBE: 4,
            0xC0: 2,
            0xC1: 6,
            0xC4: 3,
            0xC5: 3,
            0xC6: 5,
            0xC8: 2,
            0xC9: 2,
            0xCA: 2,
            0xCC: 4,
            0xCD: 4,
            0xCE: 6,
            0xD0: 2,
            0xD1: 5,
            0xD5: 4,
            0xD6: 6,
            0xD8: 2,
            0xD9: 4,
            0xDD: 4,
            0xDE: 7,
            0xE0: 2,
            0xE1: 6,
            0xE4: 3,
            0xE5: 3,
            0xE6: 5,
            0xE8: 2,
            0xE9: 2,
            0xEA: 2,
            0xEC: 4,
            0xED: 4,
            0xEE: 6,
            0xF0: 2,
            0xF1: 5,
            0xF5: 4,
            0xF6: 6,
            0xF8: 2,
            0xF9: 4,
            0xFD: 4,
            0xFE: 7,
        };
        this.Opcodes.forEach(rec => {
            if (typeof rec[0] === 'string' && rec[0] !== '---') {
                this.instructions.push(rec[0]);
            }
            rec.forEach((opc, index) => {
                this.populateData(rec, opc, index);
            });
        });
    }
    populateData(rec, opc, index) {
        if (typeof opc === 'number') {
            this.opCodeName[opc] = rec[0];
            const addressingMode = this.addressingModes[index];
            this.opCodeMode[opc] = addressingMode;
            this.opCodeBytes[opc] = this.addressingModeBytes[addressingMode];
        }
    }
    getOpc(instName, mode) {
        const instIndex = this.instructions.indexOf(instName);
        const instRecord = this.Opcodes[instIndex];
        const modeIndex = this.addressingModes.indexOf(mode);
        return instRecord[modeIndex];
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
    }
    btnLoadCode_click(event) {
        event.preventDefault();
        const sourceCode = this.codeEditor.value;
        this.cpu.stop();
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
            const isReady = this.cpu.step();
            this.dump();
            if (isReady) {
                return;
            }
        }
        catch (e) {
            this.terminal.innerText += e.message + '\n';
        }
        setTimeout(this.debugLoop.bind(this), 700);
    }
    btnRun_click(event) {
        event.preventDefault();
        this.isStopRequired = false;
        try {
            this.cpu.run();
            this.dump();
        }
        catch (e) {
            this.terminal.innerText += e.message + '\n';
        }
    }
    btnForever_click(event) {
        event.preventDefault();
        this.runForever();
    }
    btnPause_click(event) {
        event.preventDefault();
        this.isStopRequired = true;
        this.cpu.stop();
    }
    dump() {
        this.terminal.innerText = '' +
            this.cpu.dumpStatus() + '\n\n\n\n\n' +
            '                         Instruction Log\n' +
            '-------------------------------------------------------------------------\n' +
            this.getAssemblyDump() + '\n\n\n\n\n' +
            '                           Memory Dump\n' +
            '-------------------------------------------------------------------------\n' +
            this.getMemoryDump() + '\n\n';
    }
    getAssemblyDump() {
        const pc = this.cpu.currentPC;
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
            if (lineAddress % 0x0100 === 0 && lineAddress > 0 && lines[lines.length - 1] !== '*') {
                lines.push('*');
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
        return address;
    }
    runForever() {
        try {
            this.cpu.run();
            this.dump();
        }
        catch (e) {
            this.terminal.innerText += e.message + '\n';
        }
        setTimeout(this.runForever.bind(this), 500);
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
}
module.exports.Utils = Utils;
//# sourceMappingURL=index.js.map