import { DataSheet } from "./data-sheet.js";
import { Cpu } from "./cpu.js";
import { Utils } from "./utils.js";
import { Assembler } from "./assembler.js";
export class Emulator {
    constructor() {
        this.isStopRequired = false;
        this.instructionLog = [];
        this.dataSheet = new DataSheet();
        this.assembler = new Assembler();
        this.memory = new Uint8Array(0xFFFF + 1);
        this.cpu = new Cpu((addr) => this.memory[addr], (addr, data) => this.memory[addr] = data);
    }
    initialize() {
        this.codeEditor = document.getElementById("source-code");
        this.terminal = document.getElementById("terminal");
        this.codeEditor.addEventListener("keydown", this.codeEditor_keyDown.bind(this));
        const btnLoadCode = document.getElementById("btn-load-code");
        btnLoadCode.addEventListener("click", this.btnLoadCode_click.bind(this));
        const btnCpuReset = document.getElementById("btn-cpu-reset");
        btnCpuReset.addEventListener("click", this.btnReset_click.bind(this));
        const btnCpuStep = document.getElementById("btn-cpu-step");
        btnCpuStep.addEventListener("click", this.btnCpuStep_click.bind(this));
        const btnCpuDebug = document.getElementById("btn-cpu-debug");
        btnCpuDebug.addEventListener("click", this.btnDebug_click.bind(this));
        const btnCpuStop = document.getElementById("btn-cpu-stop");
        btnCpuStop.addEventListener("click", this.btnPause_click.bind(this));
        const btnCpuRun = document.getElementById("btn-cpu-run");
        btnCpuRun.addEventListener("click", this.btnRun_click.bind(this));
        const btnForever = document.getElementById("btn-run-forever");
        btnForever.addEventListener("click", this.btnForever_click.bind(this));
        this.loadExample();
    }
    loadExample() {
        this.getRequest("./example/game-of-life.asm", this.getRequest_ready.bind(this));
    }
    getRequest_ready(data) {
        this.codeEditor.value = data;
    }
    btnLoadCode_click(event) {
        event.preventDefault();
        const sourceCode = this.codeEditor.value;
        this.memory.fill(0x00);
        this.isStopRequired = true;
        this.terminal.innerText = "";
        this.instructionLog = [];
        const codeDto = this.assembler.tokenize(sourceCode);
        const errorOutput = codeDto.codeTokens
            .filter((token) => token.tokenType === "error")
            .reduce((acc, token) => {
            acc.push(`Error:       ${token.error}`);
            acc.push(`Code line:   ${token.codeLine}`);
            acc.push(`Instruction: ${token.instrName}`);
            return acc;
        }, []);
        if (errorOutput.length > 0) {
            this.terminal.innerText = errorOutput.join("\n") + "\n";
            return;
        }
        try {
            const codePages = this.assembler.load(sourceCode, this.memory);
            this.setInitialPCinMemory();
            this.cpu.reset();
            const disassembly = this.assembler
                .disassembleCodePages(codePages)
                .map((tkn) => `$${tkn.address}   ${tkn.code.join(" ").padEnd(8, " ")}   ` +
                `${tkn.text.padEnd(13, " ")}  ; ${tkn.description}`)
                .join("\n");
            const instTokens = this.assembler.parseInstructions(codeDto);
            this.assembler.resolveUnsetLabels(codeDto, instTokens);
            const labelsText = Object.keys(codeDto.labels)
                .map((key) => `${key.toUpperCase().padEnd(8, " ")} ` +
                `${codeDto.labels[key].toString(16).toUpperCase()}`)
                .join("\n");
            this.terminal.innerText = "" +
                "                       Disassembly\n" +
                "---------------------------------------------------------\n" +
                disassembly + "\n\n\n" +
                "                       Object code\n" +
                "---------------------------------------------------------\n" +
                Assembler.hexDump(codePages) + "\n\n\n" +
                "                       Labels\n" +
                "---------------------------------------------------------\n" +
                labelsText;
        }
        catch (e) {
            this.terminal.innerText += e.message + "\n";
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
            this.terminal.innerText += e.message + "\n";
        }
    }
    btnDebug_click(event) {
        event.preventDefault();
        this.isStopRequired = false;
        setTimeout(this.debugLoop.bind(this), 0);
    }
    debugLoop() {
        if (this.isStopRequired)
            return;
        try {
            this.cpu.step();
            this.dump();
            if (this.memory[this.cpu.PC] === 0x00)
                return;
        }
        catch (e) {
            this.terminal.innerText += e.message + "\n";
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
            this.terminal.innerText += e.message + "\n";
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
        this.terminal.innerText = "" +
            this.getCpuDump() + "\n\n\n\n\n" +
            "                         Instruction Log\n" +
            "-------------------------------------------------------------------------\n" +
            this.getAssemblyDump() + "\n\n\n\n\n" +
            "                           Memory Dump\n" +
            "-------------------------------------------------------------------------\n" +
            this.getMemoryDump() + "\n\n";
    }
    getCpuDump() {
        const getRegText = (val) => `${Utils.byteToHex(val)}  ${val.toString(10).padStart(3, " ")}  ${Utils.byteToSInt(val).padStart(4, " ")}`;
        const flagsText = `${+this.cpu.N} ${+this.cpu.V} 1 1 ${+this.cpu.D} ${+this.cpu.I} ${+this.cpu.Z} ${+this.cpu.C}`;
        return "" +
            "R  Hex  Dec   +/-    R   Hex   N V - B D I Z C\n" +
            "-----------------    -------   ---------------\n" +
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
            const currentInst = `$${tkn.address}   ${tkn.code.join(" ").padEnd(8, " ")}   ` +
                `${tkn.text.padEnd(13, " ")}  ; ${tkn.description}`;
            this.instructionLog.push(currentInst);
            this.instructionLog = this.instructionLog.slice(-3);
        }
        return this.instructionLog
            .map((line, index) => (index === this.instructionLog.length - 1 ? " --> " : "     ") + line)
            .join("\n");
    }
    getMemoryDump() {
        const lines = [];
        for (let line = 0; line < this.memory.length / 16; line += 1) {
            const currentBytes = [];
            const currentChars = [];
            const lineAddress = line * 16;
            const lineAddressText = Utils.wordToHex(line * 16);
            for (let col = 0; col < 16; col += 1) {
                const address = line * 16 + col;
                const value = this.memory[address];
                currentBytes.push(Utils.byteToHex(value));
                currentChars.push(value >= 0x20 && value <= 0x7E ? String.fromCharCode(value) : ".");
            }
            if (lineAddress % 0x0100 === 0 && lines.length > 0 && lines[lines.length - 1] !== "")
                lines.push("");
            if (currentBytes.some((e) => e !== "00"))
                lines.push(`${lineAddressText} | ${currentBytes.join(" ")} | ${currentChars.join("")}`);
        }
        return lines.join("\n");
    }
    codeEditor_keyDown(event) {
        if (event.key !== "Tab")
            return;
        event.preventDefault();
        const selectionStart = this.codeEditor.selectionStart;
        this.codeEditor.value = this.codeEditor.value.substring(0, this.codeEditor.selectionStart) +
            "    " +
            this.codeEditor.value.substring(this.codeEditor.selectionEnd);
        this.codeEditor.selectionEnd = selectionStart + 4;
    }
    setInitialPCinMemory() {
        const initialPc = document.getElementById("initial-pc").value;
        const address = parseInt(initialPc, 16);
        this.memory[0xFFFC] = address & 0x00FF;
        this.memory[0xFFFD] = (address >> 8) & 0x00FF;
    }
    runForever() {
        if (this.isStopRequired)
            return;
        try {
            this.cpuRun();
        }
        catch (e) {
            this.terminal.innerText += e.message + "\n";
        }
        setTimeout(this.runForever.bind(this), 500);
    }
    getRequest(url, callback) {
        const xmlHttp = new XMLHttpRequest();
        xmlHttp.onreadystatechange = readyStateChange;
        xmlHttp.open("GET", url, true);
        xmlHttp.send();
        function readyStateChange() {
            if (xmlHttp.readyState === 4)
                callback(xmlHttp.status === 200 ? xmlHttp.responseText : "");
        }
    }
}
//# sourceMappingURL=emulator.js.map