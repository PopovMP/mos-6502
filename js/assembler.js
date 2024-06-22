import { Utils } from "./utils.js";
import { DataSheet } from "./data-sheet.js";
export class Assembler {
    static hexDump(codePages) {
        const dumpLines = [];
        for (const pageAddress of Object.keys(codePages)) {
            dumpLines.push(pageAddress + ": " + codePages[pageAddress]
                .map((n) => n === null ? " ." : Utils.byteToHex(n))
                .join(" "));
        }
        return dumpLines.sort().join("\n");
    }
    constructor() {
        this.dataSheet = new DataSheet();
    }
    load(sourcecode, memory) {
        const codePages = this.assemble(sourcecode);
        let isPcSet = false;
        for (const pageTag of Object.keys(codePages)) {
            const pageAddress = parseInt(pageTag, 16);
            for (let offset = 0; offset < codePages[pageTag].length; offset += 1) {
                const value = codePages[pageTag][offset];
                if (typeof value === "number") {
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
                    text: ".BYTE $" + Utils.byteToHex(opc),
                    mode: "Data",
                    bytes: 1,
                    description: "Data",
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
                description: this.dataSheet.instrDescription[name],
            };
            if (bytes === 1) {
                if ([0x0A, 0x4A, 0x2A, 0x6A].includes(opc))
                    token.text += " A";
                output.push(token);
                index += bytes;
                pc += bytes;
                continue;
            }
            switch (mode) {
                case "IMM":
                    token.text += " #$";
                    break;
                case "IND":
                case "XZPI":
                case "ZPIY":
                    token.text += " ($";
                    break;
                default:
                    token.text += " $";
                    break;
            }
            if (["BPL", "BMI", "BVC", "BVS", "BCC", "BCS", "BNE", "BEQ"].includes(this.dataSheet.opCodeName[opc])) {
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
                case "IND":
                    token.text += ")";
                    break;
                case "ABSX":
                case "ZPX":
                    token.text += ",X";
                    break;
                case "ABSY":
                case "ZPY":
                    token.text += ",Y";
                    break;
                case "XZPI":
                    token.text += ",X)";
                    break;
                case "ZPIY":
                    token.text += "),Y";
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
            if (codePC === -1)
                codePC = pageAddress;
            prevAddress = pageAddress;
            const pageData = codePages[Utils.wordToHex(pageAddress)];
            for (let i = 0; i < pageData.length; i++) {
                if (typeof pageData[i] === "number")
                    code.push(pageData[i]);
            }
        }
        output.push(...this.disassemble(code, codePC));
        return output;
    }
    composeMachineCodePages(instTokens) {
        const pages = {};
        for (const token of instTokens) {
            for (let b = 0; b < token.bytes.length; b += 1) {
                const pageAddress = token.pc + b - (token.pc + b) % 16;
                const pageKey = Utils.wordToHex(pageAddress);
                if (!pages.hasOwnProperty(pageKey))
                    pages[pageKey] = new Array(16).fill(null);
                pages[pageKey][token.pc + b - pageAddress] = token.bytes[b];
            }
        }
        return pages;
    }
    resolveUnsetLabels(codeDto, instTokens) {
        for (const token of instTokens) {
            if (token.labelRequired) {
                const labelValue = codeDto.labels[token.labelRequired];
                if (isNaN(labelValue))
                    throw new Error(`Label "${token.labelRequired}" has no value: ${token.name}`);
                token.bytes = this.dataSheet.opCodeMode[token.opc] === "REL"
                    ? [token.opc, labelValue - token.pc - 2]
                    : [token.opc, labelValue & 0xFF, (labelValue >> 8) & 0xFF];
                delete token.labelRequired;
            }
        }
    }
    parseInstructions(codeTokenDto) {
        const instructionTokens = [];
        let pc = 0x0800;
        for (const token of codeTokenDto.codeTokens) {
            if (token.tokenType === "set-pc") {
                pc = token.pcValue;
                continue;
            }
            if (token.tokenType === "label") {
                codeTokenDto.labels[token.instrName] = pc;
                continue;
            }
            if (token.tokenType === "directive") {
                if (token.instrName === ".BYTE" && token.directiveData) {
                    const bytes = token.directiveData
                        .split(/,[ \t]*/)
                        .map((num) => this.parseValue(num, codeTokenDto.labels, codeTokenDto.variables));
                    instructionTokens.push({ pc, bytes, name: ".BYTE", opc: -1 });
                    pc += bytes.length;
                }
                if (token.instrName === ".WORD" && token.directiveData) {
                    const bytes = token.directiveData
                        .split(/,[ \t]*/)
                        .map((num) => this.parseValue(num, codeTokenDto.labels, codeTokenDto.variables))
                        .reduce((acc, word) => {
                        acc.push(word & 0xFF);
                        acc.push((word >> 8) & 0xFF);
                        return acc;
                    }, []);
                    instructionTokens.push({ pc, bytes, name: ".WORD", opc: -1 });
                    pc += bytes.length;
                }
                continue;
            }
            const name = token.instrName;
            const line = token.codeLine;
            if (name === line) {
                const opc = this.dataSheet.getOpc(name, "IMPL");
                instructionTokens.push({ pc, opc, name, bytes: [opc] });
                pc += this.dataSheet.opCodeBytes[opc];
                continue;
            }
            if (["BPL", "BMI", "BVC", "BVS", "BCC", "BCS", "BNE", "BEQ"].includes(name)) {
                const opc = this.dataSheet.getOpc(name, "REL");
                const operandText = line.slice(4);
                const value = this.parseValue(operandText, codeTokenDto.labels);
                instructionTokens.push(typeof value === "number"
                    ? { pc, opc, name, bytes: [opc, value - pc - 2] }
                    : { pc, opc, name, bytes: [opc, NaN], labelRequired: value });
                pc += this.dataSheet.opCodeBytes[opc];
                continue;
            }
            const matchIMM = /^[A-Z]{3} #([$%]?[\dA-Z]+)$/.exec(line);
            if (matchIMM) {
                const opc = this.dataSheet.getOpc(name, "IMM");
                const value = this.parseValue(matchIMM[1]);
                instructionTokens.push({ pc, opc, name, bytes: [opc, value] });
                pc += this.dataSheet.opCodeBytes[opc];
                continue;
            }
            const matchABS = /^[A-Z]{3} ([$%]?[\dA-Z_]+)$/.exec(line);
            if (matchABS) {
                const value = this.parseValue(matchABS[1], codeTokenDto.labels);
                if (typeof value === "number" && value >= 0x00 && value <= 0xFF) {
                    const opc = this.dataSheet.getOpc(name, "ZP");
                    instructionTokens.push({ pc, opc, name, bytes: [opc, value] });
                    pc += this.dataSheet.opCodeBytes[opc];
                    continue;
                }
                const opc = this.dataSheet.getOpc(name, "ABS");
                instructionTokens.push(getInstrToken(pc, name, opc, value));
                pc += this.dataSheet.opCodeBytes[opc];
                continue;
            }
            const matchABSX = /^[A-Z]{3} ([$%]?[\dA-Z_]+),X$/.exec(line);
            if (matchABSX) {
                const value = this.parseValue(matchABSX[1], codeTokenDto.labels);
                if (typeof value === "number" && value >= 0x00 && value <= 0xFF) {
                    const opc = this.dataSheet.getOpc(name, "ZPX");
                    instructionTokens.push({ pc, opc, name, bytes: [opc, value] });
                    pc += this.dataSheet.opCodeBytes[opc];
                    continue;
                }
                const opc = this.dataSheet.getOpc(name, "ABSX");
                instructionTokens.push(getInstrToken(pc, name, opc, value));
                pc += this.dataSheet.opCodeBytes[opc];
                continue;
            }
            const matchABSY = /^[A-Z]{3} ([$%]?[\dA-Z_]+),Y$/.exec(line);
            if (matchABSY) {
                const value = this.parseValue(matchABSY[1], codeTokenDto.labels);
                if (typeof value === "number" && value >= 0x00 && value <= 0xFF && name !== "LDA") {
                    const opc = this.dataSheet.getOpc(name, "ZPY");
                    instructionTokens.push({ pc, opc, name, bytes: [opc, value] });
                    pc += this.dataSheet.opCodeBytes[opc];
                    continue;
                }
                const opc = this.dataSheet.getOpc(name, "ABSY");
                instructionTokens.push(getInstrToken(pc, name, opc, value));
                pc += this.dataSheet.opCodeBytes[opc];
                continue;
            }
            const matchIND = /^[A-Z]{3} \(([$%]?[\dA-Z_]+)\)$/.exec(line);
            if (matchIND) {
                const opc = this.dataSheet.getOpc(name, "IND");
                const value = this.parseValue(matchIND[1], codeTokenDto.labels);
                instructionTokens.push(getInstrToken(pc, name, opc, value));
                pc += this.dataSheet.opCodeBytes[opc];
                continue;
            }
            const matchINDX = /^[A-Z]{3} \(([$%]?[\dA-Z]+),X\)$/.exec(line);
            if (matchINDX) {
                const opc = this.dataSheet.getOpc(name, "XZPI");
                const value = this.parseValue(matchINDX[1]);
                instructionTokens.push({ pc, opc, name, bytes: [opc, value] });
                pc += this.dataSheet.opCodeBytes[opc];
                continue;
            }
            const matchINDY = /^[A-Z]{3} \(([$%]?[\dA-Z]+)\),Y$/.exec(line);
            if (matchINDY) {
                const opc = this.dataSheet.getOpc(name, "ZPIY");
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
            return typeof value === "number" ? { pc, opc, name, bytes: [opc, value & 0xFF, (value >> 8) & 0xFF] }
                : { pc, opc, name, bytes: [opc, NaN, NaN], labelRequired: value };
        }
    }
    parseValue(valueText, labels = {}, variables = {}) {
        if (valueText.startsWith("$")) {
            const value = parseInt(valueText.slice(1), 16);
            if (isNaN(value))
                throw new Error(`Cannot parse a hex number: ${valueText}`);
            return value;
        }
        if (valueText.startsWith("%")) {
            const value = parseInt(valueText.slice(1), 2);
            if (isNaN(value))
                throw new Error(`Cannot parse a bin number: ${valueText}`);
            return value;
        }
        const value = parseInt(valueText, 10);
        if (isNaN(value)) {
            const valuetextUp = valueText.toUpperCase();
            if (labels.hasOwnProperty(valuetextUp))
                return isNaN(labels[valuetextUp]) ? valuetextUp : labels[valuetextUp];
            if (variables.hasOwnProperty(valuetextUp))
                return this.parseValue(variables[valuetextUp]);
            throw new Error(`Cannot find a label: ${valueText}`);
        }
        return value;
    }
    cleanSourceCode(sourceCode) {
        return sourceCode.split("\n")
            .map(line => line.replace(/;.*$/m, ""))
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .reduce((acc, line) => {
            const matchLabelInstr = /^([a-zA-Z_]\w+):?[ \t]+(([a-zA-Z]{3})[ \t]*.*)$/m.exec(line);
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
            const matchLabelDirective = /^([a-zA-Z_]\w+):?[ \t]+(\.[a-zA-Z]+)[ \t]+(.+)$/m.exec(line);
            if (matchLabelDirective) {
                const labelName = matchLabelDirective[1];
                const directive = matchLabelDirective[2];
                const data = matchLabelDirective[3];
                if (!this.dataSheet.instructions.includes(labelName.toUpperCase())) {
                    acc.push(labelName.trim().toUpperCase());
                    acc.push(directive.trim().toUpperCase() + " " + data.trim());
                    return acc;
                }
            }
            const matchLabelColon = /^([a-zA-Z_]\w+):$/m.exec(line);
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
                acc.push(directive.trim().toUpperCase() + " " + data.trim());
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
                    acc.push(instrName.trim().toUpperCase() + " " + operand.replace(/[ \t]*/g, "").toUpperCase());
                    return acc;
                }
            }
            const matchDirective = /^(\.[A-Z]+) (.+)$/m.exec(line);
            if (matchDirective) {
                const directive = matchDirective[1];
                const data = matchDirective[2];
                acc.push(directive + " " + data);
                return acc;
            }
            acc.push(line.replace(/[ \t]*/g, "").toUpperCase());
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
                        tokenType: "error",
                        instrName: "PC",
                        codeLine: line,
                        error: codePCMatch.error,
                    });
                }
                else {
                    tokens.push({
                        tokenType: "set-pc",
                        instrName: "PC",
                        codeLine: line,
                        pcValue: codePCMatch.pcValue,
                    });
                }
                return tokens;
            }
            const variableMatch = this.matchVariableInitialization(line, variables);
            if (variableMatch.isVariable) {
                if (variableMatch.error) {
                    tokens.push({
                        tokenType: "error",
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
                        tokenType: "error",
                        instrName: labelMatch.labelName,
                        codeLine: line,
                        error: labelMatch.error,
                    });
                }
                else {
                    tokens.push({
                        tokenType: "label",
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
                    tokenType: "instruction",
                    instrName: instrName,
                    codeLine: instrName,
                });
                return tokens;
            }
            const matchInstWithVarOrLabel = /^([A-Z]{3}) [#(]?([A-Z\d_]+)/m.exec(line);
            if (matchInstWithVarOrLabel) {
                const instrName = matchInstWithVarOrLabel[1];
                const varLabelName = matchInstWithVarOrLabel[2];
                if (variables.hasOwnProperty(varLabelName)) {
                    tokens.push({
                        tokenType: "instruction",
                        instrName: instrName,
                        codeLine: Utils.replaceLastInstance(line, varLabelName, variables[varLabelName]),
                    });
                    return tokens;
                }
                tokens.push({
                    tokenType: "instruction",
                    instrName: instrName,
                    codeLine: line,
                });
                return tokens;
            }
            const matchInstrLine = /^([A-Z]{3}) /m.exec(line);
            if (matchInstrLine) {
                tokens.push({
                    tokenType: "instruction",
                    instrName: matchInstrLine[1],
                    codeLine: line,
                });
                return tokens;
            }
            const matchDirective = /^(\.[A-Z]+) (.+)/m.exec(line);
            if (matchDirective) {
                tokens.push({
                    tokenType: "directive",
                    instrName: matchDirective[1],
                    codeLine: line,
                    directiveData: matchDirective[2],
                });
                return tokens;
            }
            tokens.push({
                tokenType: "error",
                instrName: "error",
                codeLine: line,
                error: `Cannot parse code line: ${line}`,
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
        const matchInitialPC = /\*=\$([A-H\d]{4})/.exec(codeLine);
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
        const matchVarInit = /([A-Z\d_]+)=([$%]?[A-H\d]+)/.exec(codeLine);
        if (matchVarInit) {
            const variable = matchVarInit[1];
            if (this.dataSheet.instructions.includes(variable)) {
                return {
                    isVariable: true,
                    varName: variable,
                    error: `Variable matches an instruction name: ${variable}`,
                };
            }
            if (variables.hasOwnProperty(variable)) {
                return {
                    isVariable: true,
                    varName: variable,
                    error: `Variable already defined: ${variable}`,
                };
            }
            variables[variable] = matchVarInit[2];
            return { isVariable: true, varName: variable };
        }
        return { isVariable: false };
    }
    matchLabelDeclaration(codeLine, labels) {
        const matchLabel = /^([A-Z\d_]+)$/m.exec(codeLine);
        if (matchLabel) {
            const label = matchLabel[1];
            if (this.dataSheet.instructions.includes(label))
                return { isLabel: false };
            if (labels.hasOwnProperty(label)) {
                return {
                    isLabel: true,
                    labelName: label,
                    error: `Label already defined: ${label}`,
                };
            }
            labels[label] = NaN;
            return { isLabel: true, labelName: label };
        }
        return { isLabel: false };
    }
}
//# sourceMappingURL=assembler.js.map