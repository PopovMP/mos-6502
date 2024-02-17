// noinspection JSMethodCanBeStatic

type CodeToken = {
    tokenType     : "label" | "instruction" | "set-pc" | "error" | "directive"
    instrName     : string
    codeLine      : string
    pcValue      ?: number
    error        ?: string
    directiveData?: string
}

type CodeTokenDto = {
    codeTokens: CodeToken[]
    variables : Record<string, string>
    labels    : Record<string, number>
}

type InstructionToken = {
    pc            : number
    opc           : number
    name          : string
    bytes         : number[]
    labelRequired?: string
    error        ?: string,
}

type DisassemblyToken = {
    address    : string
    code       : string[]
    text       : string
    mode       : string
    bytes      : number
    description: string
}

type VariableMatch = {
    isVariable: boolean,
    varName  ?: string,
    error    ?: string,
}

type LabelMatch = {
    isLabel   : boolean
    labelName?: string
    error    ?: string
}

type CodePCMatch = {
    isPC    : boolean
    pcValue?: number
    error  ?: string
}

type CodePages = Record<string, Array<number | null>>

class Assembler {
    public static hexDump(codePages: CodePages): string {
        const dumpLines: string[] = [];

        for (const pageAddress of Object.keys(codePages)) {
            dumpLines.push(pageAddress + ": " + codePages[pageAddress]
                .map((n: number | null): string => n === null ? " ." : Utils.byteToHex(n))
                .join(" "));
        }

        return dumpLines.sort().join("\n");
    }

    private readonly dataSheet: DataSheet;

    constructor() {
        this.dataSheet = new DataSheet();
    }

    public load(sourcecode: string, memory: Uint8Array): CodePages {
        const codePages: CodePages = this.assemble(sourcecode);
        let   isPcSet  : boolean   = false;

        for (const pageTag of Object.keys(codePages)) {
            const pageAddress: number = parseInt(pageTag, 16);
            for (let offset: number = 0; offset < codePages[pageTag].length; offset += 1) {
                const value: number | null = codePages[pageTag][offset];
                if (typeof value === "number") {
                    const address: number = pageAddress + offset;
                    memory[address] = value;

                    if (!isPcSet) {
                        memory[0xFFFC] = address & 0x00FF;
                        memory[0xFFFD] = (address >> 8) & 0x00FF;
                        isPcSet        = true;
                    }
                }
            }
        }

        return codePages;
    }

    public assemble(sourceCode: string): CodePages {
        const codeDto: CodeTokenDto = this.tokenize(sourceCode);
        return this.parse(codeDto);
    }

    public tokenize(sourceCode: string): CodeTokenDto {
        const codeLines: string[] = this.cleanSourceCode(sourceCode);
        return this.tokenizeSourceCode(codeLines);
    }

    public parse(codeDto: CodeTokenDto): CodePages {
        const instTokens: InstructionToken[] = this.parseInstructions(codeDto);
        this.resolveUnsetLabels(codeDto, instTokens);
        return this.composeMachineCodePages(instTokens);
    }

    public disassemble(code: number[], initialPC: number): DisassemblyToken[] {
        const output: DisassemblyToken[] = [];

        let index: number = 0;
        let pc   : number = initialPC;

        while (index < code.length) {
            const opc: number = code[index];

            if (!this.dataSheet.opCodeName.hasOwnProperty(opc)) {
                const token: DisassemblyToken = {
                    address    : Utils.wordToHex(pc),
                    code       : [Utils.byteToHex(opc)],
                    text       : ".BYTE $" + Utils.byteToHex(opc),
                    mode       : "Data",
                    bytes      : 1,
                    description: "Data",
                };

                output.push(token);
                index += 1;
                pc    += 1;

                continue;
            }

            const name : string = this.dataSheet.opCodeName[opc];
            const mode : string = this.dataSheet.opCodeMode[opc];
            const bytes: number = this.dataSheet.opCodeBytes[opc];

            const token: DisassemblyToken = {
                address    : Utils.wordToHex(pc),
                code       : [Utils.byteToHex(opc)],
                text       : this.dataSheet.opCodeName[opc],
                mode       : mode,
                bytes      : bytes,
                description: this.dataSheet.instrDescription[name],
            };

            if (bytes === 1) {
                // Accumulator implied mode: ASL A, LSR A, ROL A, ROR A
                if ([0x0A, 0x4A, 0x2A, 0x6A].includes(opc))
                    token.text += " A";

                output.push(token);
                index += bytes;
                pc    += bytes;
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
                // Relative mode
                token.code.push(Utils.byteToHex(code[index + 1]));
                token.text += Utils.wordToHex(pc + code[index + 1] + bytes);
            } else if (bytes === 2) {
                token.code.push(Utils.byteToHex(code[index + 1]));
                token.text += Utils.byteToHex(code[index + 1]);
            } else if (bytes === 3) {
                // The machine code is Little-endian
                token.code.push(Utils.byteToHex(code[index + 1])); // LL
                token.code.push(Utils.byteToHex(code[index + 2])); // HH

                // The assembly code is Big-endian
                token.text += Utils.byteToHex(code[index + 2]) + Utils.byteToHex(code[index + 1]);
            }

            switch (mode) {
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

    public disassembleCodePages(codePages: CodePages): DisassemblyToken[] {
        const output: DisassemblyToken[] = [];
        let   code       : number[]      = [];
        let   codePC     : number        = -1;
        let   prevAddress: number        = -1;

        for (const pageAddress of Object.keys(codePages).map(key => parseInt(key, 16)).sort()) {
            if (prevAddress > -1 && pageAddress - prevAddress > 16) {
                output.push(...this.disassemble(code, codePC));
                code   = [];
                codePC = -1;
            }

            if (codePC === -1)
                codePC = pageAddress;

            prevAddress = pageAddress;

            const pageData: Array<number | null> = codePages[Utils.wordToHex(pageAddress)];
            for (let i: number = 0; i < pageData.length; i++) {
                if (typeof pageData[i] === "number")
                    code.push(pageData[i] as number);
            }
        }

        output.push(...this.disassemble(code, codePC));

        return output;
    }

    private composeMachineCodePages(instTokens: InstructionToken[]): CodePages {
        const pages: CodePages = {};

        // Make pages
        for (const token of instTokens) {
            for (let b: number = 0; b < token.bytes.length; b += 1) {
                const pageAddress: number = token.pc + b - (token.pc + b) % 16;
                const pageKey    : string = Utils.wordToHex(pageAddress);
                if (!pages.hasOwnProperty(pageKey))
                    pages[pageKey] = new Array(16).fill(null);
                pages[pageKey][token.pc + b - pageAddress] = token.bytes[b];
            }
        }

        return pages;
    }

    public resolveUnsetLabels(codeDto: CodeTokenDto, instTokens: InstructionToken[]): void {
        for (const token of instTokens) {
            if (token.labelRequired) {
                const labelValue: number = codeDto.labels[token.labelRequired];

                if (isNaN(labelValue))
                    throw new Error(`Label "${token.labelRequired}" has no value: ${token.name}`);

                token.bytes = this.dataSheet.opCodeMode[token.opc] === "REL"
                              ? [token.opc, labelValue - token.pc - 2]
                              : [token.opc, labelValue & 0xFF, (labelValue >> 8) & 0xFF];

                delete token.labelRequired;
            }
        }
    }

    public parseInstructions(codeTokenDto: CodeTokenDto): InstructionToken[] {
        const instructionTokens: InstructionToken[] = [];

        let pc: number = 0x0800; // Default PC

        for (const token of codeTokenDto.codeTokens) {
            if (token.tokenType === "set-pc") {
                pc = token.pcValue as number;
                continue;
            }

            // Set label to the current PC
            if (token.tokenType === "label") {
                codeTokenDto.labels[token.instrName] = pc;
                continue;
            }

            // Set directives
            if (token.tokenType === "directive") {
                if (token.instrName === ".BYTE" && token.directiveData) {
                    const bytes: number[] = token.directiveData
                        .split(/,[ \t]*/)
                        .map((num :string): number =>
                                 this.parseValue(num as string, codeTokenDto.labels, codeTokenDto.variables) as number);
                    instructionTokens.push({pc, bytes, name: ".BYTE", opc: -1});
                    pc += bytes.length;
                }
                if (token.instrName === ".WORD" && token.directiveData) {
                    const bytes: number[] = token.directiveData
                        .split(/,[ \t]*/)
                        .map((num :string): number =>
                                 this.parseValue(num as string, codeTokenDto.labels, codeTokenDto.variables) as number)
                        .reduce((acc: number[], word: number) => {
                            acc.push(word & 0xFF);
                            acc.push((word >> 8) & 0xFF);
                            return acc;
                        }, []);
                    instructionTokens.push({pc, bytes, name: ".WORD", opc: -1});
                    pc += bytes.length;
                }
                continue;
            }

            const name: string = token.instrName;
            const line: string = token.codeLine;

            // OPC ; Implied
            if (name === line) {
                const opc: number = this.dataSheet.getOpc(name, "IMPL");
                instructionTokens.push({pc, opc, name, bytes: [opc]});
                pc += this.dataSheet.opCodeBytes[opc];
                continue;
            }

            // BCC $FF   ; Relative
            // BCC LABEL ; Relative
            if (["BPL", "BMI", "BVC", "BVS", "BCC", "BCS", "BNE", "BEQ"].includes(name)) {
                const opc        : number = this.dataSheet.getOpc(name, "REL");
                const operandText: string = line.slice(4);
                const value      : number | string = this.parseValue(operandText, codeTokenDto.labels);
                instructionTokens.push(typeof value === "number"
                                        ? {pc, opc, name, bytes: [opc, value - pc - 2]}
                                        : {pc, opc, name, bytes: [opc, NaN], labelRequired: value}
                );
                pc += this.dataSheet.opCodeBytes[opc];
                continue;
            }

            // OPC #$FF ; Immediate
            const matchIMM: RegExpMatchArray | null = /^[A-Z]{3} #([$%]?[\dA-Z]+)$/.exec(line);
            if (matchIMM) {
                const opc  : number = this.dataSheet.getOpc(name, "IMM");
                const value: number = this.parseValue(matchIMM[1]) as number;
                instructionTokens.push({pc, opc, name, bytes: [opc, value]});
                pc += this.dataSheet.opCodeBytes[opc];
                continue;
            }

            // OPC $FFFF ; Absolute
            const matchABS: RegExpMatchArray | null = /^[A-Z]{3} ([$%]?[\dA-Z_]+)$/.exec(line);
            if (matchABS) {
                const value: number | string = this.parseValue(matchABS[1], codeTokenDto.labels);

                // Zero Page
                if (typeof value === "number" && value >= 0x00 && value <= 0xFF) {
                    const opc: number = this.dataSheet.getOpc(name, "ZP");
                    instructionTokens.push({pc, opc, name, bytes: [opc, value]});
                    pc += this.dataSheet.opCodeBytes[opc];
                    continue;
                }

                // Absolute
                const opc: number = this.dataSheet.getOpc(name, "ABS");
                instructionTokens.push(getInstrToken(pc, name, opc, value));
                pc += this.dataSheet.opCodeBytes[opc];
                continue;
            }

            // OPC $FFFF,X ; X-Indexed Absolute
            const matchABSX: RegExpMatchArray | null = /^[A-Z]{3} ([$%]?[\dA-Z_]+),X$/.exec(line);
            if (matchABSX) {
                const value: number | string = this.parseValue(matchABSX[1], codeTokenDto.labels);

                // X-Indexed Zero Page
                if (typeof value === "number" && value >= 0x00 && value <= 0xFF) {
                    const opc: number = this.dataSheet.getOpc(name, "ZPX");
                    instructionTokens.push({pc, opc, name, bytes: [opc, value]});
                    pc += this.dataSheet.opCodeBytes[opc];
                    continue;
                }

                // X-Indexed Absolute
                const opc: number = this.dataSheet.getOpc(name, "ABSX");
                instructionTokens.push(getInstrToken(pc, name, opc, value));
                pc += this.dataSheet.opCodeBytes[opc];
                continue;
            }

            // OPC $FFFF,Y ; Y-Indexed Absolute
            const matchABSY: RegExpMatchArray | null = /^[A-Z]{3} ([$%]?[\dA-Z_]+),Y$/.exec(line);
            if (matchABSY) {
                const value: string | number = this.parseValue(matchABSY[1], codeTokenDto.labels);

                // Y-Indexed Zero Page
                if (typeof value === "number" && value >= 0x00 && value <= 0xFF && name !== "LDA") {
                    const opc: number = this.dataSheet.getOpc(name, "ZPY");
                    instructionTokens.push({pc, opc, name, bytes: [opc, value]});
                    pc += this.dataSheet.opCodeBytes[opc];
                    continue;
                }

                // Y-Indexed Absolute
                const opc: number = this.dataSheet.getOpc(name, "ABSY");
                instructionTokens.push(getInstrToken(pc, name, opc, value));
                pc += this.dataSheet.opCodeBytes[opc];
                continue;
            }

            // OPC ($FFFF) ; Absolut Indirect
            const matchIND: RegExpMatchArray | null = /^[A-Z]{3} \(([$%]?[\dA-Z_]+)\)$/.exec(line);
            if (matchIND) {
                const opc  : number          = this.dataSheet.getOpc(name, "IND");
                const value: number | string = this.parseValue(matchIND[1], codeTokenDto.labels);
                instructionTokens.push(getInstrToken(pc, name, opc, value));
                pc += this.dataSheet.opCodeBytes[opc];
                continue;
            }

            // OPC ($FF,X) ; X-Indexed Zero Page Indirect
            const matchINDX: RegExpMatchArray | null = /^[A-Z]{3} \(([$%]?[\dA-Z]+),X\)$/.exec(line);
            if (matchINDX) {
                const opc  : number = this.dataSheet.getOpc(name, "XZPI");
                const value: number = this.parseValue(matchINDX[1]) as number;
                instructionTokens.push({pc, opc, name, bytes: [opc, value]});
                pc += this.dataSheet.opCodeBytes[opc];
                continue;
            }

            // OPC ($FF),Y ; Zero Page Indirect Y-Indexed
            const matchINDY: RegExpMatchArray | null = /^[A-Z]{3} \(([$%]?[\dA-Z]+)\),Y$/.exec(line);
            if (matchINDY) {
                const opc  : number = this.dataSheet.getOpc(name, "ZPIY");
                const value: number = this.parseValue(matchINDY[1]) as number;
                instructionTokens.push({pc, opc, name, bytes: [opc, value]});
                pc += this.dataSheet.opCodeBytes[opc];
                continue;
            }

            instructionTokens.push({
                pc, name,
                opc  : NaN,
                bytes: [],
                error: `Cannot parse instruction:  ${line}`,
            });
        }

        return instructionTokens;

        function getInstrToken(pc: number, name: string, opc: number, value: number | string): InstructionToken {
            return typeof value === "number" ? {pc, opc, name, bytes: [opc, value & 0xFF, (value >> 8) & 0xFF]}
                                             : {pc, opc, name, bytes: [opc, NaN, NaN], labelRequired: value};
        }
    }

    private parseValue(valueText: string, labels: Record<string, number> = {},
                       variables: Record<string, string> = {}): number | string {
        // Parse a hex number
        if (valueText.startsWith("$")) {
            const value: number = parseInt(valueText.slice(1), 16);
            if (isNaN(value))
                throw new Error(`Cannot parse a hex number: ${valueText}`);

            return value;
        }

        // Parse a bin number
        if (valueText.startsWith("%")) {
            const value: number = parseInt(valueText.slice(1), 2);
            if (isNaN(value))
                throw new Error(`Cannot parse a bin number: ${valueText}`);

            return value;
        }

        // Parse a decimal number
        const value: number = parseInt(valueText, 10);
        if (isNaN(value)) {
            const valuetextUp: string = valueText.toUpperCase(); // Because pragma operands are not uppercase
            if (labels.hasOwnProperty(valuetextUp)) {
                return isNaN(labels[valuetextUp])
                       ? valuetextUp
                       : labels[valuetextUp];
            } else if (variables.hasOwnProperty(valuetextUp)) {
                return this.parseValue(variables[valuetextUp]);
            }

            throw new Error(`Cannot find a label: ${valueText}`);
        }

        return value;
    }

    private cleanSourceCode(sourceCode: string): string[] {
        return sourceCode.split("\n")                   // Split code in lines
            .map(line => line.replace(/;.*$/m, ""))     // Remove comments
            .map(line => line.trim())                   // Trim white spaces
            .filter(line => line.length > 0)            // Remove empty lines
            .reduce((acc: string[], line: string) => {
                // Move labels on a new line if they are with an instruction
                const matchLabelInstr: RegExpMatchArray | null = /^([a-zA-Z_]\w+):?[ \t]+(([a-zA-Z]{3})[ \t]*.*)$/m.exec(line);
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
                const matchLabelDirective: RegExpMatchArray | null = /^([a-zA-Z_]\w+):?[ \t]+(\.[a-zA-Z]+)[ \t]+(.+)$/m.exec(line);
                if (matchLabelDirective) {
                    const labelName = matchLabelDirective[1];
                    const directive = matchLabelDirective[2];
                    const data      = matchLabelDirective[3];
                    if (!this.dataSheet.instructions.includes(labelName.toUpperCase())) {
                        acc.push(labelName.trim().toUpperCase());
                        acc.push(directive.trim().toUpperCase() + " " + data.trim());
                        return acc;
                    }
                }
                const matchLabelColon: RegExpMatchArray | null = /^([a-zA-Z_]\w+):$/m.exec(line);
                if (matchLabelColon) {
                    const labelName = matchLabelColon[1];
                    if (!this.dataSheet.instructions.includes(labelName.toUpperCase())) {
                        acc.push(labelName.trim().toUpperCase());
                        return acc;
                    }
                }
                const matchDirective: RegExpMatchArray | null = /^[ \t]*(\.[a-zA-Z]+)[ \t]+(.+)$/m.exec(line);
                if (matchDirective) {
                    const directive = matchDirective[1];
                    const data      = matchDirective[2];
                    acc.push(directive.trim().toUpperCase() + " " + data.trim());
                    return acc;
                }
                acc.push(line.toUpperCase());
                return acc;
            }, [])
            .reduce((acc: string[], line: string) => {
                // Clean spaces within instructions
                const matchInstrOperand = /^([a-zA-Z]{3})[ \t]+(.+)$/m.exec(line);
                if (matchInstrOperand) {
                    const instrName: string = matchInstrOperand[1];
                    const operand  : string = matchInstrOperand[2];
                    if (this.dataSheet.instructions.includes(instrName.toUpperCase())) {
                        // The only space is between instr and operand
                        acc.push(instrName.trim().toUpperCase() + " " + operand.replace(/[ \t]*/g, "").toUpperCase());
                        return acc;
                    }
                }
                const matchDirective: RegExpMatchArray | null = /^(\.[A-Z]+) (.+)$/m.exec(line);
                if (matchDirective) {
                    const directive: string = matchDirective[1];
                    const data     : string = matchDirective[2];
                    acc.push(directive + " " + data);
                    return acc;
                }
                // Clean all unnecessary spaces
                acc.push(line.replace(/[ \t]*/g, "").toUpperCase());
                return acc;
            }, []);
    }

    private tokenizeSourceCode(sourceCodeLines: string[]): CodeTokenDto {
        const variables: Record<string, string> = {};
        const labels: Record<string, number>    = {};

        const codeTokens: CodeToken[] = sourceCodeLines.reduce((tokens: CodeToken[], line: string) => {

            // Match initial PC from: * = $0800
            const codePCMatch: CodePCMatch = this.matchCodePC(line);
            if (codePCMatch.isPC) {
                if (codePCMatch.error) {
                    tokens.push({
                        tokenType: "error",
                        instrName: "PC",
                        codeLine : line,
                        error    : codePCMatch.error,
                    });
                } else {
                    tokens.push({
                        tokenType: "set-pc",
                        instrName: "PC",
                        codeLine : line,
                        pcValue  : codePCMatch.pcValue,
                    });
                }
                return tokens;
            }

            // Match variable initialization
            const variableMatch: VariableMatch = this.matchVariableInitialization(line, variables);
            if (variableMatch.isVariable) {
                if (variableMatch.error) {
                    tokens.push({
                        tokenType: "error",
                        instrName: variableMatch.varName as string,
                        codeLine : line,
                        error    : variableMatch.error,
                    });
                }

                return tokens;
            }

            // Match label declaration
            const labelMatch: LabelMatch = this.matchLabelDeclaration(line, labels);
            if (labelMatch.isLabel) {
                if (labelMatch.error) {
                    tokens.push({
                        tokenType: "error",
                        instrName: labelMatch.labelName as string,
                        codeLine : line,
                        error    : labelMatch.error,
                    });
                } else {
                    tokens.push({
                        tokenType: "label",
                        instrName: labelMatch.labelName as string,
                        codeLine : line,
                    });
                }
                return tokens;
            }

            // Instruction - Implied
            const instructionImplied: RegExpMatchArray | null = /^([A-Z]{3})( A)?$/m.exec(line);
            if (instructionImplied) {
                const instrName: string = instructionImplied[1];
                tokens.push({
                    tokenType: "instruction",
                    instrName: instrName,
                    codeLine : instrName,
                });
                return tokens;
            }

            // Instruction with variable or label
            const matchInstWithVarOrLabel: RegExpMatchArray | null = /^([A-Z]{3}) [#(]?([A-Z\d_]+)/m.exec(line);
            if (matchInstWithVarOrLabel) {
                const instrName   : string = matchInstWithVarOrLabel[1];
                const varLabelName: string = matchInstWithVarOrLabel[2];

                if (variables.hasOwnProperty(varLabelName)) {
                    tokens.push({
                        tokenType: "instruction",
                        instrName: instrName,
                        codeLine : line.replace(varLabelName, variables[varLabelName]),
                    });
                    return tokens;
                }

                // It is a label
                tokens.push({
                    tokenType: "instruction",
                    instrName: instrName,
                    codeLine : line,
                });
                return tokens;
            }

            const matchInstrLine: RegExpMatchArray | null = /^([A-Z]{3}) /m.exec(line);
            if (matchInstrLine) {
                tokens.push({
                    tokenType: "instruction",
                    instrName: matchInstrLine[1],
                    codeLine : line,
                });
                return tokens;
            }

            const matchDirective: RegExpMatchArray | null = /^(\.[A-Z]+) (.+)/m.exec(line);
            if (matchDirective) {
                tokens.push({
                    tokenType    : "directive",
                    instrName    : matchDirective[1],
                    codeLine     : line,
                    directiveData: matchDirective[2],
                });
                return tokens;
            }

            tokens.push({
                tokenType: "error",
                instrName: "error",
                codeLine : line,
                error    : `Cannot parse code line: ${line}`,
            });
            return tokens;

        }, []);

        return {
            codeTokens,
            variables,
            labels,
        };
    }

    private matchCodePC(codeLine: string): CodePCMatch {
        const matchInitialPC: RegExpMatchArray | null = /\*=\$([A-H\d]{4})/.exec(codeLine);
        if (matchInitialPC) {
            const valueText: string = matchInitialPC[1];
            const pcValue: number   = parseInt(valueText, 16);

            if (isNaN(pcValue)) {
                return {
                    isPC : true,
                    error: `Cannot parse the code PC: ${valueText}`,
                };
            }

            return {isPC: true, pcValue: pcValue};
        }

        return {isPC: false};
    }

    private matchVariableInitialization(codeLine: string, variables: Record<string, string>): VariableMatch {
        const matchVarInit: RegExpMatchArray | null = /([A-Z\d_]+)=([$%]?[A-H\d]+)/.exec(codeLine);
        if (matchVarInit) {
            const variable: string = matchVarInit[1];

            if (this.dataSheet.instructions.includes(variable)) {
                return {
                    isVariable: true,
                    varName   : variable,
                    error     : `Variable matches an instruction name: ${variable}`,
                };
            }

            if (variables.hasOwnProperty(variable)) {
                return {
                    isVariable: true,
                    varName   : variable,
                    error     : `Variable already defined: ${variable}`,
                };
            }

            variables[variable] = matchVarInit[2];

            return {isVariable: true, varName: variable};
        }

        return {isVariable: false};
    }

    private matchLabelDeclaration(codeLine: string, labels: Record<string, number>): LabelMatch {
        const matchLabel: RegExpMatchArray | null = /^([A-Z\d_]+)$/m.exec(codeLine);
        if (matchLabel) {
            const label: string = matchLabel[1];

            if (this.dataSheet.instructions.includes(label))
                return {isLabel: false};

            if (labels.hasOwnProperty(label)) {
                return {
                    isLabel  : true,
                    labelName: label,
                    error    : `Label already defined: ${label}`,
                };
            }

            labels[label] = NaN;

            return {isLabel: true, labelName: label};
        }

        return {isLabel: false};
    }
}

module.exports.Assembler = Assembler;
