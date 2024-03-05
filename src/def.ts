
export type CodeToken = {
    tokenType     : "label" | "instruction" | "set-pc" | "error" | "directive"
    instrName     : string
    codeLine      : string
    pcValue      ?: number
    error        ?: string
    directiveData?: string
}

export type CodeTokenDto = {
    codeTokens: CodeToken[]
    variables : Record<string, string>
    labels    : Record<string, number>
}

export type InstructionToken = {
    pc            : number
    opc           : number
    name          : string
    bytes         : number[]
    labelRequired?: string
    error        ?: string
}

export type DisassemblyToken = {
    address    : string
    code       : string[]
    text       : string
    mode       : string
    bytes      : number
    description: string
}

export type VariableMatch = {
    isVariable: boolean
    varName  ?: string
    error    ?: string
}

export type LabelMatch = {
    isLabel   : boolean
    labelName?: string
    error    ?: string
}

export type CodePCMatch = {
    isPC    : boolean
    pcValue?: number
    error  ?: string
}

export type CodePages = Record<string, Array<number | null>>
