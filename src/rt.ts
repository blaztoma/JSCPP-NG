import * as interp from "./interpreter";
import { asResult } from "./interpreter";
import { AbstractVariable, AnyType, ArithmeticBigSig, ArithmeticBigType, ArithmeticBigVariable, ArithmeticNumSig, ArithmeticNumType, ArithmeticNumVariable, ArithmeticSig, ArithmeticType, ArithmeticVariable, CFunction, ClassType, ClassVariable, Function, FunctionType, Gen, InitArithmeticBigVariable, InitArithmeticNumVariable, InitArithmeticVariable, InitClassVariable, InitIndexPointerVariable, InitPointerVariable, InitVariable, LValueHolder, LValueIndexHolder, MaybeLeft, MaybeLeftCV, MaybeUnboundVariable, ObjectType, PointeeVariable, PointerType, PointerVariable, ResultOrGen, TrueIndexPointerVariable, UnboundValue, Variable, variables } from "./variables";
import { TypeLookup, FunctionMatchResult, abstractFunctionReturnSig } from "./typelookup";
import { fromUtf8CharArray, toUtf8CharArray } from "./utf8";
import { sizeUntil } from './shared/string_utils';
import * as typecheck from './typecheck';
import * as ios_base from './shared/ios_base';
import { InitializerListVariable } from './initializer_list';
export type Specifier = "const" | "inline" | "_stdcall" | "extern" | "static" | "auto" | "register";

export interface IncludeModule {
    load(rt: CRuntime): void;
}

export type DebugData = {
    line: number,
    column: number,
    variables: { [name: string]: Variable }
};

export function big(x: number | bigint): bigint {
    return (typeof x === "number") ? BigInt(x & 0xFFFFFFFF) : x;
}

export function num(x: number | bigint): number {
    return (typeof x === "number") ? x : Number(BigInt.asUintN(32, x));
}


export interface Stdio {
    isMochaTest?: boolean;
    promiseError: (promise_error: unknown) => void;
    drain?: () => string;
    cinStop: () => void;
    cinProceed: () => void;
    cinState: () => boolean;
    setReadResult: (result: string) => void;
    getReadResult: () => string;
    getInput: () => Promise<string>;
    finishCallback: (ExitCode: number) => void;
    write: (s: string) => void;
    trap?: (api: ExternRuntimeApi) => void;
}


export interface JSCPPConfig {
    specifiers?: Specifier[];
    arithmeticResolutionMap?: { [x: string]: ArithmeticSig };
    includes?: { [fileName: string]: IncludeModule };
    loadedLibraries: string[];
    fstream?: {
        open: (context: any, fileName: string) => FileInstance;
    };
    stdio?: Stdio;
    unsigned_overflow?: "error" | "warn" | "ignore";

    debug?: boolean;
    maxExecutionSteps?: number;
    maxTimeout?: number;
    eventLoopSteps?: number;
    printStdin?: boolean; // default: false
    stopExecutionCheck?: () => boolean;
    trapAtFirstLine?: boolean;
}

export class CRuntimeError extends Error {
    line: number | null;
    column: number | null;

    constructor(name: string, line: number | null, column: number | null) {
        super(name);
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, CRuntimeError);
        }
        this.name = "CRuntimeError";
        this.line = line;
        this.column = column;
        Object.setPrototypeOf(this, CRuntimeError.prototype)
    }
}

export type OpSignature = "o(_--)" | "o(--_)" | "o(_-_)" | "o(-_)" | "o(_-=_)" | "o(_->_)" | "o(_,_)" | "o(!_)" | "o(_!=_)" | "o(_[_])" | "o(*_)" | "o(_*_)" | "o(_*=_)" | "o(_/_)" | "o(_/=_)" | "o(_&_)" | "o(&_)" | "o(_&=_)" | "o(_%_)" | "o(_%=_)" | "o(_^_)" | "o(_^=_)" | "o(_+_)" | "o(+_)" | "o(_++)" | "o(++_)" | "o(_+=_)" | "o(_<_)" | "o(_<<_)" | "o(_<<=_)" | "o(_<=_)" | "o(_=_)" | "o(_==_)" | "o(_>_)" | "o(_>=_)" | "o(_>>_)" | "o(_>>=_)" | "o(_|_)" | "o(_|=_)" | "o(~_)" | "o(_&&_)" | "o(_||_)" | "o(_bool)" | "o(_ctor)" | "o(_call)" | "o(_stub)";

export interface Member {
    type: ObjectType;
    name: string;
    initialize?: (rt: CRuntime, _this: Variable) => Variable;
}

export interface RuntimeScope {
    "$name": string;
    variables: {
        [name: string]: Variable;
    };
}

export interface NamespaceScope {
    [namespace: string]: {
        [objectName: string]: Variable;
    };
}

export interface MakeValueStringOptions {
    noArray?: boolean;
    noPointer?: boolean;
}

export function mergeConfig(a: any, b: any) {
    for (const o in b) {
        if (b.hasOwnProperty(o)) {
            if (o in a && (typeof b[o] === "object")) {
                mergeConfig(a[o], b[o]);
            } else {
                a[o] = b[o];
            }
        }
    }
};

export interface FunctionSymbol {
    type: string[],
    target: CFunction | null,
}


export type TypeHandlerMap = {
    functionDB: TypeLookup;
    functionsByID: FunctionSymbol[];
    memberObjectListCreator: MemberObjectListCreator;
    dataMemberNames: string[]
    memberTypes: { [identifier: string]: typecheck.MemberTypeInfo[] }
    displayFunction: ((rt: CRuntime, x: ClassVariable) => string) | null,
};

export type TypeSignature = {
    inline: string,
    array: string[],
};

export type FileInstance = {
    name: string;
    _open: boolean;
    is_open: () => boolean;
    read: (data: string) => string | void;
    clear: () => void;
    write: (data: string) => void;
    close: () => void;
};


export type FileManager = { freefd: number, files: { [fd: number]: FileInstance } };

export type FunctionCallInstance = {
    actions: FunctionMatchResult,
    target: FunctionSymbol,
};

export type MemberObject = {
    name: string,
    variable: Variable
};

export type MemberMap = { [member: string]: Variable };

export type MemberFactory = (template: ClassType) => ResultOrGen<MemberMap>;

export type MemberObjectListCreator = {
    numTemplateArgs: number,
    factory: MemberFactory 
};

export type ProceedMode = "continue" | "stepin" | "stepover" | "stepout";

export type VariableDisplayValue = {
    type: string,
    value: string | { [name: string]: VariableDisplayValue },
    displayString: string | null,
};

export type ExternRuntimeApi = {
    proceed(mode?: ProceedMode): void;
    stop(): void;
    setLineBreakpoints: (lines: number[]) => void;
    getVariables: () => VariableDisplayValue;
    getCurrentLine: () => number;
}

export type TypeMappingFunction = ((type: ObjectType) => ObjectType);

export class CRuntime {
    parser: typecheck.LLParser;
    config: JSCPPConfig;
    scope: RuntimeScope[];
    namespace: NamespaceScope;
    typeMap: { [domainIdentifier: string]: TypeHandlerMap };
    typedefs: { [name: string]: MaybeLeft<ObjectType> };
    // @ts-ignore (mystery)
    interp: interp.BaseInterpreter<any>;
    fileio: FileManager;
    ct: typecheck.ConversionTables;
    explicitListInitTable: { [name: string]: TypeMappingFunction };
    eapi: ExternRuntimeApi;
    debug: {
        // enabled: boolean;
        active: boolean;
        hasPassedFirstLine: boolean;
        lineBreakpoints: Set<number>;
        lastLine: number | null,
        proceedMode: ProceedMode;
        depth: number;
        lastDepth: number;
        isTriggered: boolean;
    };
    /** Variable index counter */
    vcnt: number;

    constructor(config: JSCPPConfig) {
        this.parser = typecheck.constructTypeParser();
        this.config = config;
        this.typeMap = {};
        this.addTypeDomain("{global}", { numTemplateArgs: 0, factory: () => ({}) }, [], {}, null);
        this.fileio = { freefd: 4, files: {} };

        this.scope = [{ "$name": "{global}", variables: {} }];
        this.namespace = {};
        this.typedefs = {};
        this.ct = { implicit: {}, list: {}, memberType: {} };
        this.explicitListInitTable = {};
        this.debug = {
            // enabled: config.debug ?? false,
            active: false,
            hasPassedFirstLine: (config.trapAtFirstLine ?? false) !== true,
            lineBreakpoints: new Set<number>(),
            lastLine: null,
            proceedMode: "continue",
            depth: 0,
            lastDepth: 0,
            isTriggered: false,
        };
        this.vcnt = 0;
        const rt = this;
        this.eapi = {
            proceed(mode: ProceedMode = "continue"): void {
                const PROCEED_MODES: ProceedMode[] = ["continue", "stepin", "stepover", "stepout"];
                if (PROCEED_MODES.includes(mode)) {
                    rt.debug.proceedMode = mode;
                } else {
                    rt.raiseException("DEBUGGER: Invalid proceed mode");
                }
                rt.debug.isTriggered = false;
                rt.stdio().cinProceed();
            },
            stop(): void {
                rt.stdio().cinStop();
            },
            setLineBreakpoints(lines: number[]): void {
                rt.debug.lineBreakpoints.clear();
                for (const line of lines) {
                    if (!(line in rt.debug.lineBreakpoints)) {
                        rt.debug.lineBreakpoints.add(line);
                    }
                }
            },
            getVariables(): VariableDisplayValue {
                return rt.getVariablesTree();
            },
            getCurrentLine(): number {
                return rt.debug.lastLine ?? 0;
            }
        };
    }
    getVariablesList(enableTypes: boolean, enableValues: boolean): {
        voffset: number,
        list: [VariableDisplayValue, Variable][],
        rdict: { [name: string]: VariableDisplayValue },
        parentList: [string, number][]
    } {
        if (this.debug.active) {
            return { voffset: this.vcnt, list: [], rdict: {}, parentList: [] };
        }
        this.debug.active = true;
        const vbegin = this.vcnt;
        this.vcnt++;
        let queue: [VariableDisplayValue, Variable][] = [];
        let qi: number = 0;
        let rdict: { [name: string]: VariableDisplayValue } = {};
        let parentList: [string, number][] = [["", 0]];
        const rt = this;
        function insertVal(dict: { [name: string]: VariableDisplayValue }, name: string, val: MaybeUnboundVariable, parentId: number, nameAsChild: string): void {
            const vid = (val as any)._vid;
            if (typeof vid === "number" && vid >= vbegin) {
                if (enableValues) {
                    let x = vid;
                    let path: string[] = [];
                    while (x > 0) {
                        path.push(parentList[x - vbegin][0]);
                        x = parentList[x - vbegin][1];
                    }
                    path.reverse();
                    dict[name] = {
                        type: (enableTypes) ? rt.makeTypeStringOfVar(val) : "",
                        value: path.join(''),
                        displayString: null,
                    }
                } else {
                    dict[name] = {
                        type: (enableTypes) ? rt.makeTypeStringOfVar(val) : "",
                        value: "",
                        displayString: null,
                    }
                }
            } else {
                (val as any)._vid = rt.vcnt++;
                // TODO: makeValueString may be overwritten afterwards
                // This must be optimised
                const valNode: VariableDisplayValue = {
                    type: (enableTypes) ? rt.makeTypeStringOfVar(val) : "",
                    value: (enableValues) ? rt.makeValueString(val) : "",
                    displayString: null,
                }
                dict[name] = valNode;
                if (val.state !== "UNBOUND") {
                    queue.push([valNode, val as Variable]);
                }
                parentList.push([nameAsChild, parentId]);
            }

        }
        for (let i = this.scope.length - 1; i >= 0; i--) {
            let scope = this.scope[i];
            for (const [name, val] of Object.entries(scope.variables)) {
                if (!(name in rdict) && "t" in val && Object.entries(val).length > 1 && !("hidden" in val)) {
                    insertVal(rdict, name, val, 0, name);
                }
            }
        }

        const MAX_ENTRIES = 25000;
        while (qi < queue.length) {
            if (qi >= MAX_ENTRIES) {
                this.raiseSoftException(`DEBUG: Maximum variable entry limit of ${MAX_ENTRIES} reached.`)
                break;
            }
            const [parentNode, parentVar] = queue[qi];
            const parentId = (parentVar as any)._vid as number;
            let dict: { [name: string]: VariableDisplayValue } = {};
            if (parentVar.t.sig === "CLASS" && parentVar.state === "INIT") {
                const parentClass = parentVar as InitClassVariable;
                const domain = this.domainString(parentClass.t);
                if (domain in this.typeMap) {
                    let dfunc = this.typeMap[domain].displayFunction;
                    if (dfunc) {
                        parentNode.displayString = dfunc(this, parentClass);
                    }
                }
                function getBeginEndVars(): [Variable, Variable] | null {
                    const beginInst = rt.tryGetFuncByParams(parentClass.t, "begin", [parentClass], []);
                    const endInst = rt.tryGetFuncByParams(parentClass.t, "end", [parentClass], []);
                    if (beginInst === null || endInst === null) {
                        return null;
                    }
                    const beginYield = rt.invokeCall(beginInst, [], parentClass);
                    const endYield = rt.invokeCall(endInst, [], parentClass);
                    const beginResult = yieldBlocking(beginYield);
                    const endResult = yieldBlocking(endYield);
                    if (beginResult === null || endResult === null) {
                        return null;
                    }
                    const beginVar = variables.clone(rt, rt.unbound(beginResult), "SELF", false);
                    const endVar = variables.clone(rt, rt.unbound(endResult), "SELF", false);
                    return [beginVar, endVar];
                }
                function yieldBlocking(x: ResultOrGen<MaybeUnboundVariable | "VOID">): MaybeUnboundVariable | null {
                    if (interp.asResult(x)) {
                        if (x === "VOID") {
                            return null;
                        }
                        return rt.unbound(x as MaybeUnboundVariable);
                    } else {
                        const call = x as Gen<MaybeUnboundVariable | "VOID">;
                        for (let i: number = 0; i < 100_000; i++) {
                            const _retv = call.next();
                            if (_retv.done === true) {
                                if (_retv.value === "VOID") {
                                    return null;
                                }
                                return _retv.value;
                            }
                        }
                    }
                    rt.raiseException("<internal>: failed to invoke a given function (runtime limit exceeded)");
                    return null;
                }
                function rangeBasedFor(): MaybeUnboundVariable[] | null {
                    const maybeBeginEnd = getBeginEndVars();
                    if (!maybeBeginEnd) {
                        return null;
                    }
                    const [beginVar, endVar] = maybeBeginEnd;
                    if (!variables.typesEqual(beginVar.t, endVar.t)) {
                        return null;
                    }
                    const ppInst = rt.getOpByParams("{global}", "o(++_)", [beginVar], []);
                    const neqInst = rt.getOpByParams("{global}", "o(_!=_)", [beginVar, beginVar], []);
                    const neqTestYield = rt.invokeCall(neqInst, [], beginVar, beginVar);
                    const neqTestVar = yieldBlocking(neqTestYield);
                    if (neqTestVar === null || neqTestVar.t.sig !== "BOOL") {
                        return null;
                    }
                    const neqYield0 = rt.invokeCall(neqInst, [], beginVar, endVar) as ResultOrGen<ArithmeticVariable>;
                    const neqVar0 = yieldBlocking(neqYield0);
                    if (rt.arithmeticValue(neqVar0 as ArithmeticVariable) === 0) {
                        return [];
                    }
                    const derefInst = rt.getOpByParams("{global}", "o(*_)", [beginVar], []);
                    const derefTestYield = rt.invokeCall(derefInst, [], beginVar);
                    const derefTestVar = yieldBlocking(derefTestYield);
                    if (derefTestVar === null) {
                        return null;
                    }
                    let resultList: MaybeUnboundVariable[] = [];
                    while (true) {
                        const neqYield = rt.invokeCall(neqInst, [], beginVar, endVar) as ResultOrGen<ArithmeticVariable>;
                        const neqVar = yieldBlocking(neqYield);
                        if (rt.arithmeticValue(neqVar as ArithmeticVariable) === 0) {
                            break;
                        }

                        const elemYield = rt.invokeCall(derefInst, [], beginVar) as ResultOrGen<MaybeUnboundVariable>;
                        let elemVar = yieldBlocking(elemYield);
                        if (elemVar === null) {
                            return null;
                        }

                        /* body goes here */
                        resultList.push(elemVar);

                        const ppYield = rt.invokeCall(ppInst, [], beginVar);
                        yieldBlocking(ppYield);
                    }

                    return resultList;
                }
                let resultList: MaybeUnboundVariable[] | null = null;
                try {
                    resultList = rangeBasedFor();
                } catch (_e) {
                    // do nothing; output nothing
                }
                if (resultList) {
                    if (resultList.length === 0) {
                        parentNode.value = "{ }";
                    } else {
                        // enumerated values
                        for (const [ii, iv] of resultList.entries()) {
                            if (!("hidden" in iv)) {
                                insertVal(dict, `[${ii}]`, iv, parentId, `[${ii}]`);
                            }
                        }
                    }
                } else {
                    // default list of members
                    for (const [name, val] of Object.entries(parentClass.members)) {
                        if (!(name in dict) && !("hidden" in val)) {
                            insertVal(dict, name, val, parentId, `.${name}`);
                        }
                    }
                }
            } else if (parentVar.t.sig === "PTR" && parentVar.state === "INIT" && typeof parentVar.t.sizeConstraint === "number" && (parentVar as InitPointerVariable<Variable>).subtype === "INDEX" && (parentVar as InitIndexPointerVariable<Variable>).pointee !== null) {
                const parentArray = parentVar as TrueIndexPointerVariable<Variable>;
                const memory = parentArray.pointee;
                const index = parentArray.index;
                for (let j = 0; j < parentVar.t.sizeConstraint; j++) {
                    // Always bound. Even if unbound condition happens, we don't care that much
                    let val = variables.arrayMember(memory, index + j) as Variable;
                    if (!("hidden" in val)) {
                        insertVal(dict, `[${j}]`, val, parentId, `[${j}]`);
                    }
                }
            } else if (parentVar.t.sig === "PTR" && parentVar.state === "INIT" && parentVar.t.sizeConstraint === null && parentVar.t.pointee.sig !== "I8") {
                const parentPtr = parentVar as InitIndexPointerVariable<Variable>;
                let parentName = parentList[parentId - vbegin][0];
                if (parentName.startsWith(".")) {
                    parentName = parentName.slice(1);
                }
                let nameAsChild = `->${parentName}`;
                if (parentName.startsWith("[")) {
                    nameAsChild = `${parentName}[0]`;
                    parentName = `<pointer>`;
                }
                let val = variables.deref(parentPtr) as MaybeUnboundVariable;
                if (!("hidden" in val) && val.state !== "UNBOUND") {
                    insertVal(dict, `*${parentName}`, val, parentList[parentId - vbegin][1], nameAsChild);
                }
            }
            if (Object.entries(dict).length > 0) {
                parentNode.value = dict;
            }
            qi++;
        }

        this.debug.active = false;
        return { voffset: vbegin, list: queue, parentList, rdict };
    }

    getVariablesTree(): VariableDisplayValue {
        const vars = this.getVariablesList(true, true);
        return { type: "", value: vars.rdict, displayString: null };
    }

    openFile(path: TrueIndexPointerVariable<ArithmeticNumVariable>, mode: number): number {
        const { fstream } = this.config;
        if (fstream === undefined) {
            this.raiseException("[CRuntime].config.fstream is undefined");
        }
        const fileName = this.getStringFromCharArray(path);
        const fileInst = fstream.open({ t: { name: "ofstream" } }, fileName);
        if (((mode & ios_base.openmode.out) !== 0 && (mode & ios_base.openmode.app) === 0) || (mode & ios_base.openmode.trunc) !== 0) {
            fileInst.clear();
        }
        this.fileio.files[this.fileio.freefd] = fileInst;
        return fileInst.is_open() ? this.fileio.freefd++ : -1;
    }

    fileRead(fd: InitArithmeticNumVariable): InitIndexPointerVariable<ArithmeticVariable> {
        const fileInst = this.fileio.files[fd.value] ?? this.raiseException("Invalid file descriptor");
        const readData = fileInst.read("");
        if (readData === undefined) {
            this.raiseException("File read failed unexpectedly")
        }
        return this.getCharArrayFromString(readData);
    }

    fileClose(fd: InitArithmeticNumVariable): void {
        const fileInst = this.fileio.files[fd.value] ?? this.raiseException("Invalid file descriptor");
        fileInst.close();
    }

    fileWrite(fd: InitArithmeticNumVariable, data: TrueIndexPointerVariable<ArithmeticNumVariable>): void {
        const fileInst = this.fileio.files[fd.value] ?? this.raiseException("Invalid file descriptor");
        fileInst.write(this.getStringFromCharArray(data, sizeUntil(this, data, variables.arithmeticNum("I8", 0, null))))
    }

    addTypeDomain(domain: string, memberList: MemberObjectListCreator, dataMemberNames: string[], memberTypes: { [identifier: string]: typecheck.MemberTypeInfo[] }, displayFunction: ((rt: CRuntime, x: ClassVariable) => string) | null) {
        if (domain in this.typeMap) {
            this.raiseException(`Domain ${domain} already exists`);
        }
        this.typeMap[domain] = {
            functionDB: new TypeLookup(this.parser),
            functionsByID: [],
            memberObjectListCreator: memberList,
            dataMemberNames,
            memberTypes,
            displayFunction,
        };
    }

    include(name: string) {
        if (this.config.includes === undefined) {
            this.raiseException("[CRuntime].config.includes is undefined");
        }
        const {
            includes
        } = this.config;
        if (name in includes) {
            // const lib = includes[name];
            if (this.config.loadedLibraries.includes(name))
                return;
            this.config.loadedLibraries.push(name);
            // lib.load(this);
        } else {
            this.raiseException("cannot find library: " + name);
        }
    };

    getSizeByType(t: AnyType): number {
        let at: ArithmeticType | null;
        let pt: PointerType<ObjectType | FunctionType> | null;
        if ((pt = variables.asPointerType(t)) !== null) {
            if (pt.sizeConstraint !== null) {
                return this.getSizeByType(pt.pointee) * pt.sizeConstraint;
            }
            this.raiseException("Not yet implemented");
        } else if ((at = variables.asArithmeticNumType(t)) !== null) {
            return variables.arithmeticProperties[at.sig].bytes;
        } else if ((at = variables.asArithmeticBigType(t)) !== null) {
            return variables.arithmeticProperties[at.sig].bytes;
        }
        this.raiseException("Not yet implemented");
    };

    getMember(l: Variable, identifier: string): Variable {
        //l = this.asCapturedVariable(l);
        let lc = variables.asClass(l);
        if (lc !== null) {
            if (!lc.lvHolder === null) {
                this.raiseException("Access to a member of a non-lvalue variable is forbidden");
            }
            if (lc.state !== "INIT") {
                this.raiseException("Access to an unbounded index member")
            }
            const domainName: string = this.domainString(lc.t);
            if (domainName in this.typeMap) {
                if (identifier in lc.members) {
                    return lc.members[identifier];
                } else {
                    this.raiseException(`type '${this.makeTypeString(lc.t)}' does not have a member called '${identifier}'`);
                }
            } else {
                this.raiseException(`type '${this.makeTypeString(lc.t)}' is unknown`);
            }
        } else {
            this.raiseException("only a class or struct can have members");
        }
    };

    stdio(): Stdio {
        if (this.config.stdio === undefined) {
            this.raiseException("[CRuntime].config.stdio is undefined");
        }
        return this.config.stdio;
    }

    arrayTypeSignature(array: string[]): TypeSignature {
        const inline: string = array.join(" ");
        if (!typecheck.parse(this.parser, array)) {
            this.raiseException(`Malformed type signature: '${inline}'`)
        }
        return { inline, array };
    };

    typeSignature(inline: string, strict_order: boolean = true): TypeSignature {
        const array: string[] = inline.split(" ");
        if (!typecheck.parse(this.parser, array, "Type", strict_order)) {
            this.raiseException(`Malformed type signature: '${inline}'`)
        }
        return { inline, array };
    };

    typeSignatureUnchecked(array: string[]): TypeSignature {
        return { inline: array.join(" "), array };
    };

    /** This function is only used when defining a function with an exact type, typically at runtime. For matching, use TypeLookup-associated functions */
    createFunctionTypeSignature(domain: ClassType | "{global}" | "{lambda}", retType: MaybeLeft<ObjectType> | "VOID", argTypes: MaybeLeftCV<ObjectType>[], noThis = false): TypeSignature {
        const thisSig: string[] = (typeof domain === "string" || noThis) ? [] : variables.toStringSequence(this, domain, true, false);
        const returnSig: string[] = retType === "VOID" ? [retType] : variables.toStringSequence(this, retType.t, retType.lvHolder !== null, false);
        const argTypeSig: string[][] = argTypes.map((x) => variables.toStringSequence(this, x.t, x.lvHolder !== null, x.isConst));
        const result: string[] = [[["FUNCTION"], returnSig, ["("], thisSig], argTypeSig, [[")"]]].flat(2);
        return this.arrayTypeSignature(result);
    }

    defFunc(domain: ClassType | "{global}" | "{lambda}", name: string, retType: MaybeLeft<ObjectType> | "VOID", argTypes: MaybeLeftCV<ObjectType>[], argNames: string[], optionalArgs: MemberObject[], stmts: interp.XCompoundStatement | null, interp: interp.Interpreter, locals: { [name: string]: Variable } | null = null): void {
        while (true) {
            let f: CFunction | null = null;
            const _optionalArgs = [...optionalArgs]; // cloned array passed to a closure
            if (stmts != null) {
                f = function*(rt: CRuntime, templateArgs: ObjectType[], ...args: Variable[]) {
                    if (templateArgs.length > 1) {
                        rt.raiseException("Not yet implemented");
                    }
                    // logger.warn("calling function: %j", name);
                    rt.enterScope("function " + name);
                    if (args.length + _optionalArgs.length !== argTypes.length) {
                        rt.raiseException(`Expected ${argTypes.length} arguments, got ${args.length}`)
                    }
                    argNames.slice(0, args.length).forEach(function(argName, i) {
                        if (argTypes[i].lvHolder === null) {
                            const arg = args[i];
                            if (arg.t.sig !== "PTR" || arg.t.sizeConstraint === null) {
                                args[i] = variables.clone(rt, args[i], "SELF", false);
                            }
                        }
                        if (args[i].isConst && !argTypes[i].isConst) {
                            rt.raiseException("Cannot pass a const-value where a volatile value is required")
                        } else if (!args[i].isConst && argTypes[i].isConst) {
                            args[i] = variables.clone(rt, args[i], args[i].lvHolder, false);
                            (args[i] as any).isConst = true;
                        }
                        rt.defVar(argName, args[i]);
                    });
                    for (const optarg of _optionalArgs) {
                        rt.defVar(optarg.name, variables.clone(rt, optarg.variable, "SELF", false));
                    }
                    if (locals !== null) {
                        for (const [localName, localVar] of Object.entries(locals)) {
                            rt.defVar(localName, localVar);
                        }
                    }
                    let ret = yield* interp.run(stmts, interp.source, { scope: "function" });
                    if (retType === "VOID") {
                        if (Array.isArray(ret)) {
                            if ((ret[0] === "return") && ret[1]) {
                                rt.raiseException("void function cannot return a value");
                            }
                        }
                        ret = "VOID";
                    } else {
                        if (ret instanceof Array && (ret[0] === "return")) {
                            const castYield = rt.cast(retType.t, rt.expectValue(ret[1]));
                            ret = asResult(castYield) ?? (yield* castYield as Gen<InitVariable>);
                        } else if (name === "main") {
                            ret = variables.arithmeticNum("I32", 0, null);
                        } else {
                            rt.raiseException("non-void function must return a value");
                        }
                    }
                    rt.exitScope("function " + name);
                    // logger.warn("function: returning %j", ret);
                    return ret;
                };
            }
            const fnsig = this.createFunctionTypeSignature(domain, retType, argTypes);
            this.regFunc(f, domain, name, fnsig, [], null);
            if (optionalArgs.length === 0) {
                return;
            }
            argTypes.push(optionalArgs[0].variable);
            argNames.push(optionalArgs[0].name);
            optionalArgs = optionalArgs.slice(1);
        }
    };

    /** Convenience function for static type checking of operators */
    getOpByParams(domain: "{global}", identifier: OpSignature, params: MaybeLeftCV<ObjectType>[], templateTypes: (string | string[])[]): FunctionCallInstance {
        return this.getFuncByParams(domain, identifier, params, templateTypes);
    }

    tryGetOpByParams(domain: "{global}", identifier: OpSignature, params: MaybeLeftCV<ObjectType>[], templateTypes: (string | string[])[]): FunctionCallInstance | null {
        return this.tryGetFuncByParams(domain, identifier, params, templateTypes);
    }

    getFuncByParams(domain: ClassType | "{global}", identifier: string, params: MaybeLeftCV<ObjectType>[], templateTypes: (string | string[])[]): FunctionCallInstance {
        const fn = this.tryGetFuncByParams(domain, identifier, params, templateTypes);
        if (fn === null) {
            const domainSig: string = this.domainString(domain);
            if (!(domainSig in this.typeMap)) {
                this.raiseException(`domain '${domainSig}' is unknown`);
            }
            const domainMap: TypeHandlerMap = this.typeMap[domainSig];
            const prettyPrintParams = "(" + params.map((x) => this.makeTypeString(x.t, x.lvHolder !== null, x.isConst)).join(", ") + ")";
            const overloads = domainMap.functionDB.functions[identifier];
            const overloadsMsg = (overloads !== undefined)
                ? "Available overloads: \n" + overloads.overloads.map((x, i) => `${i + 1}) ${x.annotation}`).join("\n")
                : "No available overloads";
            this.raiseException(`No matching function '${domainSig === "{global}" ? "" : `${domainSig}::`}${identifier}${prettyPrintParams}'\n${overloadsMsg}`);
        }
        return fn;
    };

    tryGetFuncByParams(domain: ClassType | "{global}", identifier: string, params: MaybeLeftCV<ObjectType>[], templateTypes: (string | string[])[]): FunctionCallInstance | null {
        if (identifier.startsWith("std::")) {
            identifier = identifier.slice(5);
        }
        const domainSig: string = this.domainString(domain);
        if (!(domainSig in this.typeMap)) {
            this.raiseException(`domain '${domainSig}' is unknown`);
        }
        const paramSig = params.map((x) => variables.toStringSequence(this, x.t, x.lvHolder !== null, x.isConst));
        //console.log(`getfunc: '${domainSig}::${identifier}( ${paramSig.flat().join(" ")} )'`);
        const domainMap: TypeHandlerMap = this.typeMap[domainSig];
        const fn = domainMap.functionDB.matchFunctionByParams(this, identifier, paramSig, templateTypes, this.ct);
        if (fn === null) {
            return null;
        }
        return { actions: fn, target: domainMap.functionsByID[fn.fnid] };
    };

    *convertParams(actions: typecheck.ParseFunctionMatchInnerResult, templateArgs: ObjectType[], args: Variable[]): Gen<void> {
        for (const castAction of actions.castActions) {
            switch (castAction.cast.type) {
                case "ARITHMETIC":
                    {
                        const castYield = this.cast({ sig: castAction.cast.targetSig }, this.expectValue(args[castAction.index]));
                        args[castAction.index] = interp.asResult(castYield) ?? (yield* castYield as Gen<InitVariable>);
                    }
                    break;
                case "CTOR":
                    {
                        const fnid = this.typeMap[castAction.cast.domain].functionDB.matchExactOverload("o(_ctor)", castAction.cast.fnsig);
                        if (fnid === -1) {
                            this.raiseException("Implicit cast via constructor: Failed to cast (expected a match)");
                        }
                        const fncall = this.typeMap[castAction.cast.domain].functionsByID[fnid];
                        if (fncall.target === null) {
                            this.raiseException("Implicit cast via constructor: Constructor is defined but no implementation is found");
                        }
                        if (templateArgs.length > 0) {
                            this.raiseException("Implicit cast via constructor: Not yet implemented")
                        }
                        const castYield = fncall.target(this, [], args[castAction.index]);
                        const castResult = interp.asResult(castYield) ?? (yield* castYield as Gen<InitVariable>);
                        if (castResult === "VOID") {
                            this.raiseException("Implicit cast via constructor: Expected a non-void result");
                        }
                        args[castAction.index] = this.unbound(castResult);
                    }
                    break;
                case "FNPTR":
                    args[castAction.index] = variables.directPointer(args[castAction.index], "SELF", false);
                    break;
                case "MEMBERTYPE":
                    const innerList = [args[castAction.index]];
                    yield* this.convertParams(castAction.cast.ops, [], innerList);
                    args[castAction.index] = innerList[0];
                    break;
                case "LIST":
                    if (args[castAction.index].t.sig !== "CLASS" || (args[castAction.index] as ClassVariable).t.identifier !== typecheck.prototypeListSpecifier) {
                        this.raiseException(`Implicit object from list construction: expected a list object, got ${this.makeTypeStringOfVar(args[castAction.index])}`);
                    } else {
                        const arg = args[castAction.index] as ClassVariable;
                        let listArgs: Variable[] = [];
                        for (let i = 0; i < arg.t.templateSpec.length; i++) {
                            if (!(i.toString() in arg.members)) {
                                this.raiseException(`Implicit object from list construction: Argument '${i.toString()}' is missing`);
                            }
                            listArgs.push(arg.members[i.toString()]);
                        }
                        yield* this.convertParams(castAction.cast.ops, [], listArgs);
                        if (castAction.cast.isInitList) {
                            if (listArgs.length === 0) {
                                this.raiseException("Implicit object from list construction: Not yet implemented");
                            }
                            const childType: ObjectType = listArgs[0].t;
                            const memory = variables.arrayMemory<Variable>(childType, []);
                            let i = 0;
                            for (const child of listArgs) {
                                memory.values.push({
                                    ...child,
                                    lvHolder: { array: memory, index: i } as LValueIndexHolder<Variable>,
                                } as Variable);
                                i++;
                            }
                            const initList: InitializerListVariable<Variable> = {
                                t: {
                                    sig: "CLASS",
                                    memberOf: null,
                                    templateSpec: [childType],
                                    identifier: "initializer_list"
                                },
                                isConst: false,
                                lvHolder: null,
                                state: "INIT",
                                members: {
                                    _values: variables.indexPointer(memory, 0, false, null)
                                }
                            };
                            args[castAction.index] = initList;
                        } else {
                            const constructedType = typecheck.parseToObjectType(this.parser, castAction.cast.targetSig) ?? this.raiseException(`Implicit object from list construction: Failed to constructed an object from type '${typecheck.parsePrint(this.parser, castAction.cast.targetSig, null, "Type", false)}'`);
                            const constructedClassType = variables.asClassType(constructedType);
                            if (constructedClassType !== null) {
                                if (!(constructedClassType.identifier in this.typeMap)) {
                                    this.raiseException(`Implicit object from list construction: Unknown class '${constructedClassType.identifier}'`);
                                }
                                const dataMemberNames = this.typeMap[constructedClassType.identifier].dataMemberNames;
                                if (dataMemberNames.length < listArgs.length) {
                                    this.raiseException(`Implicit object from list construction: Expected at most ${dataMemberNames.length} data members for class '${constructedClassType.identifier}', received ${listArgs.length}`);
                                }
                                let members: { [name: string]: Variable } = {};
                                for (let i = 0; i < listArgs.length; i++) {
                                    members[dataMemberNames[i]] = listArgs[i];
                                }
                                const classVariable: ClassVariable = {
                                    t: constructedClassType,
                                    isConst: false,
                                    lvHolder: null,
                                    state: "INIT",
                                    members
                                }
                                args[castAction.index] = classVariable;
                            } else {
                                this.raiseException("Implicit object from list construction: Not yet implemented");
                            }
                        }
                    }
                    break;
            }
        }
        actions.valueActions.forEach((action, i) => {
            if (action === "CLONE") {
                const arg = args[i];
                if (arg.t.sig !== "PTR" || arg.t.sizeConstraint === null) {
                    args[i] = variables.clone(this, this.expectValue(args[i]), "SELF", false);
                }
            }
        })
    }

    *invokeCallFromVariable(funvar: Function, ...args: Variable[]): ResultOrGen<MaybeUnboundVariable | "VOID"> {
        const paramSig = args.map((x) => variables.toStringSequence(this, x.t, x.lvHolder !== null, x.isConst));
        const targetSig: string[] = ["FUNCTION", "Return", "("].concat(...paramSig).concat(")");
        //console.log(`getfunc: '${funvar.name}( ${paramSig.flat().join(" ")} )'`);
        const funmatch = typecheck.parseFunctionMatch(this.parser, targetSig, abstractFunctionReturnSig(funvar.t.fulltype), this.ct, []);
        if (funmatch === null) {
            this.raiseException("Invalid arguments"); // TODO: make message more comprehensive
        }
        if (funvar.target === null) {
            this.raiseException("Function is defined but no implementation is found");
        }
        yield* this.convertParams(funmatch, [], args);
        // function pointers can only point to a single untemplated instance
        const returnYield = funvar.target(this, [], ...args);
        return interp.asResult(returnYield) ?? (yield* returnYield as Gen<MaybeUnboundVariable | "VOID">);

    }

    *invokeCall(callInst: FunctionCallInstance, templateArgs: ObjectType[], ...args: Variable[]): ResultOrGen<MaybeUnboundVariable | "VOID"> {
        if (callInst.target.target === null) {
            this.raiseException("Function is defined but no implementation is found");
        }
        yield* this.convertParams(callInst.actions, templateArgs, args);
        const returnYield = callInst.target.target(this, templateArgs, ...args);
        return interp.asResult(returnYield) ?? (yield* returnYield as Gen<MaybeUnboundVariable | "VOID">);
    }

    makeBinaryOperatorFuncName = (name: string) => `o(_${name}_)`;
    makePrefixOperatorFuncName = (name: string) => `o(${name}_)`;
    makePostfixOperatorFuncName = (name: string) => `o(_${name})`;

    domainString(domain: ClassType | "{global}" | "{lambda}"): string {
        if (typeof domain === "string") {
            return domain;
        }
        let seq: string[] = [domain.identifier];
        let sub: ClassType = domain;
        while (sub.memberOf !== null) {
            seq.push(sub.memberOf.identifier);
            sub = sub.memberOf;
        }
        return seq.reverse().join(".");
    }

    regFunc(f: CFunction | null, domain: ClassType | "{global}" | "{lambda}", name: string, fnsig: TypeSignature, templateTypes: number[], isOverrideOf: string | null): void {
        const domainInlineSig: string = this.domainString(domain);
        if (!(domainInlineSig in this.typeMap)) {
            this.raiseException(`type '${fnsig.inline}' is unknown`);
        }
        const domainMap: TypeHandlerMap = this.typeMap[domainInlineSig];
        //console.log(`regfunc: '${fnsig.inline}'`);

        const existingOverloadId = domainMap.functionDB.matchExactOverload(name, fnsig.inline);
        if (existingOverloadId !== -1) {
            const overload = domainMap.functionsByID[existingOverloadId];
            if (overload.target === null) {
                if (f === null) {
                    this.raiseException(`Redefinition of a function prototype '${domainInlineSig}::${name}'`);
                }
                overload.target = f;
            } else {
                this.raiseException(`Reimplementation of function '${domainInlineSig}::${name}' of type '${fnsig.inline}'.`)
            }
        } else {
            if (this.varAlreadyDefined(name)) {
                if (!(typeof domain === "string" && name in this.scope[0].variables && variables.asFunction(this.scope[0].variables[name]) !== null)) {
                    if (typeof domain === "string" && name in this.scope[0].variables) {
                        this.raiseException(`Global function '${name}' is already declared as a non-function variable of type ${this.makeTypeStringOfVar(this.scope[0].variables[name])}.`)
                    } else {
                        this.raiseException(`Redeclaration of '${domainInlineSig}::${name}' (overloading member functions is not yet implemented)`)
                    }
                }
            }
            domainMap.functionDB.addFunctionOverload(this, name, fnsig.array, templateTypes, domainMap.functionsByID.length, isOverrideOf);
            domainMap.functionsByID.push({ type: fnsig.array, target: f });
            if (name === "o(_ctor)" && typeof domain !== "string") {
                const dstTypeInline = variables.toStringSequence(this, domain, false, false).join(" ");
                if (!(dstTypeInline in this.ct.implicit)) {
                    this.ct.implicit[dstTypeInline] = {};
                }
                const srcArgStart = fnsig.inline.indexOf("(") + 2;
                const srcTypeInline = fnsig.inline.slice(srcArgStart, -2);
                const abstractSig = abstractFunctionReturnSig(fnsig.array).join(" ");
                this.ct.implicit[dstTypeInline][srcTypeInline] = { fnsig: abstractSig, domain: domainInlineSig };
            }
        }
    };

    registerTypedef(basttype: MaybeLeft<ObjectType>, name: string) {
        this.typedefs[name] = basttype;
    };

    promoteNumeric(l: ArithmeticType, r: ArithmeticType): ArithmeticType {
        const lProperties = variables.arithmeticProperties[l.sig];
        const rProperties = variables.arithmeticProperties[r.sig];
        if (variables.arithmeticTypesEqual(l, r)) {
            if (l.sig === "BOOL") {
                return variables.arithmeticNumType("I32");
            }
            if (l.sig === "I8") {
                return variables.arithmeticNumType("I32");
            }
            if (l.sig === "U8") {
                return variables.arithmeticNumType("U32");
            }
            return l;
        } else if (!lProperties.isFloat && !rProperties.isFloat) {
            const sl = { sig: lProperties.asSigned };
            const sr = { sig: rProperties.asSigned };
            if (variables.arithmeticTypesEqual(sl, sr)) {
                return sl;
            } else {
                if (lProperties.bytes <= rProperties.bytes) {
                    return (!lProperties.isSigned && !rProperties.isSigned) ? r : sr;
                } else {
                    return (!lProperties.isSigned && !rProperties.isSigned) ? l : sl;
                }
            }
        } else if (lProperties.isFloat && !rProperties.isFloat) {
            return l;
        } else if (!lProperties.isFloat && rProperties.isFloat) {
            return r;
        } else {
            return variables.arithmeticNumType("F64");
        }
    };

    readScopedVar(scope: RuntimeScope, varname: string) {
        return this.resolveNamespacePath(scope.variables, varname);
    };

    readVarOrFunc(varname: string): Variable | Function {
        const rvar = this.tryReadVar(varname);
        if (rvar !== null) {
            return rvar;
        }
        const fnid = this.typeMap["{global}"].functionDB.matchSingleFunction(this, varname);
        if (fnid !== -1) {
            const fninfo = this.typeMap["{global}"].functionsByID[fnid];
            return variables.function(fninfo.type, varname, fninfo.target, null, "SELF");
        }
        this.raiseException("variable '" + varname + "' does not exist");
    };

    tryReadVar(varname: string): Variable | null {
        let i = this.scope.length - 1;
        while (i >= 0) {
            const vc = this.scope[i];
            if (varname in vc.variables) {
                return vc.variables[varname];
            }
            i--;
        }
        return null;
    };

    deleteVar(varname: string): void {
        let i = this.scope.length - 1;
        while (i >= 0) {
            const vc = this.scope[i];
            if (vc.variables[varname] != null) {
                delete vc.variables[varname];
                return;
            }
            i--;
        }
        this.raiseException("variable '" + varname + "' does not exist");
    };

    varAlreadyDefined(varname: string): boolean {
        // NOTE: This is not how it's supposed to work.
        // TODO: fix this
        let i = this.scope.length - 1;
        //while (i >= 0) {
        const vc = this.scope[i];
        if (varname in vc.variables) {
            return true;
        }
        //    i--;
        //}
        return false;
    };

    simpleType(_type: (string | interp.XScopedIdentifier | interp.XScopedMaybeTemplatedIdentifier)[]): MaybeLeft<ObjectType> | "VOID" {
        type SimpleTypeNode = {
            name: string,
            templateSpec: SimpleTypeNode[][] | null;
        };
        function makeSimplifiedTypeNotation(type: (string | interp.XScopedIdentifier | interp.XScopedMaybeTemplatedIdentifier)[]): SimpleTypeNode[] {
            return type.flatMap<SimpleTypeNode>(x => {
                if (typeof x === "string") {
                    return (["const", "auto"].includes(x)) ? [] : { name: x, templateSpec: null };
                } else if (x.type === "ScopedIdentifier") {
                    return { name: x.Identifier, templateSpec: null }
                } else {
                    return {
                        name: (typeof x.ScopedIdentifier === "string") ? x.ScopedIdentifier : x.ScopedIdentifier.Identifier,
                        templateSpec: x.TemplateType !== null ? x.TemplateType.map(makeSimplifiedTypeNotation) : null
                    };
                }
            });
        }
        function printTypeSpec(type: SimpleTypeNode[]): string {
            return type.map(x => x.name + (x.templateSpec === null ? "" : ("<" + x.templateSpec.map(printTypeSpec).join(", ") + ">"))).join(" ");
        }
        function makeSimpleType(rt: CRuntime, typeArr: SimpleTypeNode[]): MaybeLeft<ObjectType> | "VOID" {
            if (typeArr.every(x => x.templateSpec === null)) {
                let typeStr = typeArr.map(x => x.name).join(" ");
                if (typeStr in variables.defaultArithmeticResolutionMap) {
                    return { t: { sig: variables.defaultArithmeticResolutionMap[typeStr] }, lvHolder: null };
                }
                if (typeStr === "void") {
                    return "VOID";
                }
            }
            if (typeArr.length === 1) {
                const type = typeArr[0];
                if (type.name in rt.typeMap) {
                    const fn = rt.typeMap[type.name].functionDB.matchExactOverload("o(_stub)", "FUNCTION Return ( )");

                    if (fn !== null) {
                        const templateSpec = type.templateSpec === null ? [] : type.templateSpec.map(x => {
                            let a = makeSimpleType(rt, x);
                            if (a === "VOID") {
                                rt.raiseException("Type lookup: void types inside template specifiers are not supported");
                            }
                            return a.t;
                        });
                        return { t: variables.classType(type.name, templateSpec, null), lvHolder: null }
                    } else {
                        rt.raiseException("Type lookup: No constructor for the specified structure");
                    }
                }
                if (type.name in rt.typedefs) {
                    return rt.typedefs[type.name];
                }
            }
            rt.raiseException(`Type lookup: Unknown type '${printTypeSpec(typeArr)}'`);
        }
        if (_type instanceof Array) {
            return makeSimpleType(this, makeSimplifiedTypeNotation(_type));
        }
        this.raiseException("Type lookup: Invalid argument (internal erro)");
    };

    defVar(varname: string, object: Variable, allowRedefine: boolean = false, hidden: boolean = false) {
        if (!allowRedefine && this.varAlreadyDefined(varname)) {
            this.raiseException("Variable '" + varname + "' already defined");
        }

        const vc = this.scope[this.scope.length - 1];

        //console.log(`defining variable: '${varname}' of type '${this.makeTypeStringOfVar(object)}'`);

        if (object.lvHolder === null) {
            //@ts-ignore
            object.lvHolder = "SELF";
        }

        if (hidden) {
            (object as any).hidden = true;
        }

        vc.variables[varname] = object;
    };

    inrange(x: number | bigint, t: ArithmeticType, onError?: () => string) {
        const properties = variables.arithmeticProperties[t.sig];
        const overflow = !((x <= properties.maxv) && (x >= properties.minv));
        if (onError && overflow) {
            const errorMsg = onError();
            if (properties.isSigned === false) {
                if (this.config.unsigned_overflow === "error") {
                    console.error(errorMsg);
                    this.raiseException(errorMsg);
                } else if (this.config.unsigned_overflow === "warn") {
                    console.error(errorMsg);
                }
                return true;
            } else {
                this.raiseException(errorMsg);
            }
        }
        return !overflow;
    };

    castable(type1: ObjectType, type2: ObjectType) {
        // TODO: unweird this function
        if (variables.typesEqual(type1, type2)) {
            return true;
        }
        let ptr1: PointerType<ObjectType | FunctionType> | null;
        let ptr2: PointerType<ObjectType | FunctionType> | null;
        let class1: ClassType | null;
        let class2: ClassType | null;
        if (type1.sig in variables.arithmeticSig && type1.sig in variables.arithmeticSig) {
            return true;
        } else if ((ptr1 = variables.asPointerType(type1)) !== null && (ptr2 = variables.asPointerType(type2)) !== null) {
            if (variables.asFunctionType(ptr1.pointee) !== null) {
                return variables.asFunctionType(ptr2.pointee) !== null;
            }
            return !variables.asFunctionType(ptr2.pointee); // ???
        } else if ((class1 = variables.asClassType(type1)) !== null && (class2 = variables.asClassType(type2)) !== null) {
            return false;
        } else if (variables.asClassType(type1) || variables.asClassType(type2)) {
            this.raiseException("not implemented");
        }
        this.raiseException("not implemented");
    };

    makeTypeStringOfVar(object: MaybeLeftCV<ObjectType>): string {
        return this.makeTypeString(object.t, !(object.lvHolder !== null), object.isConst);
    }

    makeTypeString(type: AnyType, isLValue: boolean = false, isConst: boolean = false): string {
        const inner = (t: AnyType) => this.makeTypeString(t, false, false);
        const branch: { [sig in string]: () => string } = {
            "ARITHMETIC": () => {
                const x = type as ArithmeticType;
                return variables.arithmeticProperties[x.sig].name;
            },
            "NULLPTR_T": () => {
                return "nullptr_t";
            },
            "VOID": () => {
                return "void";
            },
            "PTR": () => {
                const x = type as PointerType<ObjectType | FunctionType>;
                if (x.sizeConstraint !== null) {
                    return inner(x.pointee) + "[" + String(x.sizeConstraint) + "]";
                } else {
                    return inner(x.pointee) + "*";
                }
            },
            "CLASS": () => {
                const x = type as ClassType;
                return (x.memberOf ? inner(x.memberOf) + "::" : "") + x.identifier + ((x.templateSpec.length === 0) ? "" : "<" + x.templateSpec.map(inner).join(", ") + ">");
            },
            "FUNCTION": () => {
                const x = type as FunctionType;
                return "{" + x.fulltype.join(" ") + "}";
            },
        }
        const where = (type.sig in variables.arithmeticSig) ? "ARITHMETIC" : type.sig;
        return [isConst ? "const " : "", branch[where](), isLValue ? "&" : ""].join("");
    }

    /** For integers, performs a two's-complement integer overflow on demand.
      * > Does not really depend on signedness, just on limits set by basic arithmetic types. 
      * For floating-point values, rounds to the nearest precision available.*/
    adjustArithmeticNumValue(x: InitArithmeticNumVariable): void {
        const info = variables.arithmeticProperties[x.t.sig];
        if (!info.isFloat && !Number.isInteger(x.value)) {
            x.value = Math.sign(x.value) * Math.floor(Math.abs(x.value));
        }
        if (info.isFloat || (x.value >= info.minv && x.value <= info.maxv)) {
            if (x.t.sig === "F32") {
                // javascript numbers are typically double-precision FP values.
                x.value = Math.fround(x.value);
            }
            return;
        }
        let q: number = (x.value - (info.minv as number)) % (info.maxv as number + 1 - (info.minv as number));
        if (q < 0) {
            q += info.maxv as number + 1 - (info.minv as number);
        }
        x.value = q + (info.minv as number);
    }

    adjustArithmeticBigValue(x: InitArithmeticBigVariable): void {
        const info = variables.arithmeticProperties[x.t.sig];
        if (x.value >= info.minv && x.value <= info.maxv) {
            return;
        }
        if (info.isSigned) {
            x.value = BigInt.asIntN(info.bytes * 8, x.value);
        } else {
            x.value = BigInt.asUintN(info.bytes * 8, x.value);
        }
        /*const minv = BigInt(info.minv);
        const maxv = BigInt(info.maxv);
        let q: bigint = (x.v.value - minv) % (maxv + BigInt(1) - minv);
        if (q < 0) {
            q += maxv + BigInt(1) - minv;
        }
        x.v.value = q + minv;*/
    }

    adjustArithmeticAnyValue(x: InitArithmeticVariable): void {
        // TODO: rename as 'adjustArithmeticValue' after refactoring
        if (x.t.sig in variables.arithmeticNumSig) {
            this.adjustArithmeticNumValue(x as InitArithmeticNumVariable);
        } else {
            this.adjustArithmeticBigValue(x as InitArithmeticBigVariable);
        }
    }


    makeValueString(_v: MaybeUnboundVariable | Function, options: MakeValueStringOptions = {}): string {
        if (_v.state === "UNINIT") {
            return "<uninitialised>";
        }
        if (_v.state === "UNBOUND") {
            return "<out of bounds>";
        }
        const v = _v as Variable | Function;
        const arithmeticVar = variables.asArithmetic(v) as InitArithmeticVariable | null;
        if (arithmeticVar !== null) {
            const val = arithmeticVar.value;
            const sig = arithmeticVar.t.sig;
            const properties = variables.arithmeticProperties[sig];
            if (sig === "I8") {
                // 31 /* hex = 0x21, ascii = '!' */
                // '!' /* dec = 31, hex = 0x21 */
                const unsignedVal: number = val >= 0 ? (val as number) : ((properties.maxv as number) - (properties.minv as number)) + 1 + (val as number);
                const hexVal = unsignedVal.toString(16).padStart(properties.bytes * 2, '0');
                let cstr: string;
                if (unsignedVal >= 127) {
                    cstr = `\\x${hexVal}`;
                } else {
                    cstr = JSON.stringify(String.fromCharCode(unsignedVal));
                    cstr = cstr.slice(1, cstr.length - 1);
                }
                return `'${cstr}' /* dec = ${val}, hex = 0x${hexVal} */`;
            } else if (sig === "BOOL") {
                return val !== 0 ? "true" : "false";
            } else if (!properties.isFloat) {
                // 160 /* hex = 0xA0 */
                return val.toString();
                //const signedVal = val >= 0 ? val : properties.maxv + 1 + val;
                //return `${val} /* hex = 0x${signedVal.toString(16).padStart(properties.bytes * 2, '0')} */`;
            } else {
                return val.toString();
            }
        }
        const pointerVar = variables.asPointer(v) as InitPointerVariable<PointeeVariable> | null;
        if (pointerVar !== null) {
            if (pointerVar.pointee === null) {
                return "nullptr";
            }
            if (variables.asFunctionType(pointerVar.t.pointee) !== null) {
                return "<function>";
            }
            if (options.noPointer) {
                return "->/*...*/";
            } else {
                options.noPointer = true;
                if (pointerVar.subtype === "DIRECT") {
                    return "->" + this.makeValueString(pointerVar.pointee, { ...options });
                } else {
                    const indexPointerVar = pointerVar as TrueIndexPointerVariable<Variable>;
                    if (indexPointerVar.t.pointee.sig === "I8" || indexPointerVar.t.pointee.sig === "U8") {
                        // string representation
                        return `"${this.getStringFromCharArray(indexPointerVar as TrueIndexPointerVariable<ArithmeticNumVariable>)}"`;
                    } else if (options.noArray) {
                        return "{ /*...*/ }";
                    } else {
                        options.noArray = true;
                        const displayList = [];
                        const slice = indexPointerVar.pointee.values.slice(indexPointerVar.index);
                        for (let i = 0; i < slice.length; i++) {
                            displayList.push(this.makeValueString(slice[i], { ...options }));
                        }
                        return "{ " + displayList.join(", ") + " }";
                    }
                }
            }
        }
        if (variables.asClassType(v.t) !== null) {
            return "<class>";
        }
        return "<unknown>";
    };

    /** Parses an character array representing the UTF-8 sequence into a string. */
    getStringFromCharArray(src: TrueIndexPointerVariable<ArithmeticNumVariable>, len: number | null = null): string {
        if (!(src.t.pointee.sig === "I8" || src.t.pointee.sig === "U8")) {
            this.raiseException("Not a char array")
        }
        if (len === null) {
            len = src.pointee.values.length - src.index;
        }
        const byteArray = new Uint8Array(src.pointee.values.slice(src.index, src.index + len).map((x: ArithmeticNumVariable) => x.state === "INIT" ? x.value : 0));
        // remove trailing null-terminators '\0' from the end
        return fromUtf8CharArray(byteArray).replace(/\0+$/, "");
    }

    getCharArrayFromString(src: string): TrueIndexPointerVariable<ArithmeticNumVariable> {
        let array = toUtf8CharArray(src);
        //console.log(Array.from(array).map((x) => { return `\\x${x.toString(16)}`; }).join(""));
        let memoryObject = variables.arrayMemory<ArithmeticNumVariable>({ sig: "I8" }, new Array<ArithmeticNumVariable>())
        array.forEach((iv, ii) => {
            const lvHolder: LValueIndexHolder<ArithmeticNumVariable> = { array: memoryObject, index: ii };
            memoryObject.values.push(variables.arithmeticNum("I8", iv, lvHolder, false));
        })
        // add a null-terminator ('\0')
        const lvHolder: LValueIndexHolder<ArithmeticNumVariable> = { array: memoryObject, index: array.length };
        memoryObject.values.push(variables.arithmeticNum("I8", 0, lvHolder, false));

        return variables.indexPointer(memoryObject, 0, true, null, false);
    }

    cast(target: ObjectType, v: InitVariable, allowUToSOverflow: boolean = false): ResultOrGen<InitVariable> {
        // TODO: looking for global overload
        if (variables.typesEqual(v.t, target)) {
            return v;
        }
        const arithmeticTarget = variables.asArithmeticType(target);
        const arithmeticVar = variables.asArithmetic(v);
        if (arithmeticTarget !== null && arithmeticVar !== null) {
            const targetInfo = variables.arithmeticProperties[arithmeticTarget.sig];
            const fromInfo = variables.arithmeticProperties[arithmeticVar.t.sig];
            const arithmeticValue = this.arithmeticValue(arithmeticVar);
            if (target.sig === "BOOL") {
                return variables.arithmeticNum(target.sig, arithmeticValue === 0 ? 0 : 1, null);
            } else if (targetInfo.isFloat) {
                const onErr = () => `overflow when casting '${this.makeValueString(v)}' of type '${this.makeTypeStringOfVar(v)}' to '${this.makeTypeString(target)}'`;
                if (this.inrange(arithmeticValue, arithmeticTarget, onErr)) {
                    return variables.arithmeticNum(arithmeticTarget.sig as ArithmeticNumSig, Number(arithmeticValue), null);
                }
            } else {
                const conversionErrorMsg: () => string = () => `${this.makeValueString(v)} of type ${this.makeTypeStringOfVar(v)} to type ${this.makeTypeString(target)}`;
                if (!targetInfo.isBig) {
                    const targetValue = (typeof arithmeticValue === "number") ? arithmeticValue : Number(arithmeticValue % BigInt(0xFFFFFFFF));
                    const sig = arithmeticTarget.sig as ArithmeticNumSig;
                    if (!targetInfo.isSigned) {
                        if (targetValue < 0) {
                            const newVar = variables.arithmeticNum(sig, targetValue, null);
                            this.adjustArithmeticNumValue(newVar);
                            //if (this.inrange(newVar.v.value as number, newVar.t, () => "cannot cast negative value " + conversionErrorMsg())) {
                            return newVar;
                            //}
                        }
                    }
                    if (fromInfo.isFloat) {
                        const intVar = variables.arithmeticNum(sig, targetValue > 0 ? Math.floor(targetValue) : Math.ceil(targetValue), null);
                        if (this.inrange(intVar.value, intVar.t, () => "overflow when casting value " + conversionErrorMsg())) {
                            this.adjustArithmeticNumValue(intVar);
                            return intVar;
                        }
                    } else {
                        const newVar = variables.arithmeticNum(sig, targetValue, null);
                        if (allowUToSOverflow || this.inrange(newVar.value, newVar.t, () => "overflow when casting value " + conversionErrorMsg())) {
                            this.adjustArithmeticNumValue(newVar);
                            return newVar;
                        }
                    }
                } else {
                    const sig = arithmeticTarget.sig as ArithmeticBigSig;
                    if (!targetInfo.isSigned) {
                        const targetValue = BigInt.asUintN(targetInfo.bytes * 8, BigInt(arithmeticValue));
                        return variables.arithmeticBig(sig, targetValue, null);
                    }
                    if (fromInfo.isFloat) {
                        const targetValue = (typeof arithmeticValue === "number")
                            ? BigInt(arithmeticValue > 0 ? Math.floor(arithmeticValue) : Math.ceil(arithmeticValue))
                            : arithmeticValue;
                        const intVar = variables.arithmeticBig(sig, targetValue, null);
                        if (this.inrange(intVar.value, intVar.t, () => "overflow when casting value " + conversionErrorMsg())) {
                            return intVar;
                        }
                    } else {
                        const targetValue = BigInt(arithmeticValue);
                        if (allowUToSOverflow || this.inrange(targetValue, { sig }, () => "overflow when casting value " + conversionErrorMsg())) {
                            return variables.arithmeticBig(sig, BigInt.asIntN(targetInfo.bytes * 8, targetValue), null);
                        }
                    }

                }
            }
        }
        else if (arithmeticTarget?.sig === "BOOL") {
            const boolSym = this.getOpByParams("{global}", "o(_bool)", [v], []);
            return this.invokeCall(boolSym, [], v) as ResultOrGen<InitArithmeticVariable>;
        }
        const pointerTarget = variables.asPointerType(target);
        const iptrVar = variables.asInitIndexPointer(v);
        //const dptrVar = variables.asInitDirectPointer(v);
        if (pointerTarget !== null && iptrVar !== null) {
            if (variables.typesEqual(pointerTarget.pointee, iptrVar.t.pointee)) {
                if (pointerTarget.sizeConstraint === null || pointerTarget.sizeConstraint === iptrVar.t.sizeConstraint) {
                    if (iptrVar.pointee !== null) {
                        return variables.indexPointer(iptrVar.pointee, iptrVar.index, pointerTarget.sizeConstraint !== null, null);
                    } else {
                        return variables.indexNullPointer(iptrVar.t.pointee, iptrVar.index, null);
                    }
                }
            }
        }
        // A value return can use the same converting constructor as initialisation.
        // Resolve the constructor normally rather than special-casing std::string.
        if (target.sig === "CLASS") {
            const constructor = this.tryGetFuncByParams(target, "o(_ctor)", [v], []);
            if (constructor !== null) return this.invokeCall(constructor, [], v) as ResultOrGen<InitVariable>;
        }
        this.raiseException("Cast: Type error or not yet implemented");
    };

    addToNamespace(namespacePath: string, name: string, obj: any, hidden: boolean = false) {
        const namespaces = namespacePath.split('::');
        let currentNamespace: any = this.namespace;

        for (let i = 0; i < namespaces.length; i++) {
            const namespace = namespaces[i];
            if (!currentNamespace[namespace])
                currentNamespace[namespace] = {};
            currentNamespace = currentNamespace[namespace];
        }

        if (hidden) {
            obj.hidden = true;
        }

        currentNamespace[name] = obj;
    };

    resolveNamespacePath(obj: any, path: string) {
        const keys = path.split('::');

        let current = obj;
        for (const key of keys) {
            if (current.hasOwnProperty(key)) {
                current = current[key];
            } else {
                return undefined;
            }
        }

        return current;
    };

    getFromNamespace(namespacePath: string) {
        const namespaces = namespacePath.split('::');
        if (namespaces.length <= 1)
            return null;

        let currentNamespaceObj: any = this.namespace;
        for (let i = 0; i < namespaces.length; i++) {
            const namespace = namespaces[i];
            if (!(namespace in currentNamespaceObj))
                return undefined;
            currentNamespaceObj = currentNamespaceObj[namespace];
        }

        return currentNamespaceObj;
    };

    enterScope(scopename: string) {
        this.debug.depth++;
        this.scope.push({ "$name": scopename, variables: {} });
    };

    exitScope(scopename: string) {
        // logger.info("%j", this.scope);
        this.debug.depth--;
        while (true) {
            const s = this.scope.pop();
            if (!scopename || !(this.scope.length > 1) || ((s as RuntimeScope)["$name"] === scopename)) {
                break;
            }
        }
    };

    defineStruct(domain: ClassType | "{global}", identifier: string, memberList: MemberObject[], memberTypes: { [identifier: string]: typecheck.MemberTypeInfo[] }, displayFunction: ((rt: CRuntime, x: ClassVariable) => string) | null = null) {
        const classType = variables.classType(identifier, [], domain === "{global}" ? null : domain);
        const domainInline = this.domainString(classType);
        const factory: MemberObjectListCreator = {
            numTemplateArgs: 0, factory: () => {
                let memberMap: MemberMap = {};
                for (const member of memberList) {
                    memberMap[member.name] = member.variable;
                }
                return memberMap;
            }
        };
        const dataMemberNames: string[] = memberList.map(x => x.name);
        this.addTypeDomain(domainInline, factory, dataMemberNames, memberTypes, displayFunction);

        const members: { [name: string]: Variable } = {};
        memberList.forEach((x: MemberObject) => { members[x.name] = x.variable })
        const stubClass = variables.class(classType, members, null);

        const stubClassTypeSig = variables.toStringSequence(this, stubClass.t, false, false);
        const listPrototypeType = variables.classType(typecheck.prototypeListSpecifier, memberList.map(x => x.variable.t), null);
        const listPrototypeTypeSig = variables.toStringSequence(this, listPrototypeType, false, false);
        if (!(identifier in this.ct.list)) {
            this.ct.list[identifier] = { dst: stubClassTypeSig, src: [] };
        } else {
            this.raiseException("Struct definition error: Template struct overloads are not yet implemented");
        }
        this.ct.list[identifier].src.push(listPrototypeTypeSig);

        const stubCtorTypeSig = this.createFunctionTypeSignature(classType, { t: classType, lvHolder: null }, [], true)
        this.regFunc(function(rt: CRuntime): InitClassVariable {
            return variables.clone(rt, stubClass, null, false);
        }, classType, "o(_stub)", stubCtorTypeSig, [-1], null);
    };

    defineStruct2(domain: ClassType | "{global}", identifier: string, memberList: MemberObjectListCreator, dataMemberNames: string[], memberTypes: { [identifier: string]: typecheck.MemberTypeInfo[] }, displayFunction: ((rt: CRuntime, x: ClassVariable) => string) | null = null) {
        const classType = variables.classType(identifier, [], domain === "{global}" ? null : domain);
        const domainInline = this.domainString(classType);
        this.addTypeDomain(domainInline, memberList, dataMemberNames, memberTypes, displayFunction);

        let stubClassTypeSig: string[] = [];
        for (let i = 0; i < memberList.numTemplateArgs; i++) {
            stubClassTypeSig.push("!ParamObject")
        }
        stubClassTypeSig.push("CLASS", identifier, "<");
        for (let i = 0; i < memberList.numTemplateArgs; i++) {
            stubClassTypeSig.push(`?${i}`);
        }
        stubClassTypeSig.push(">");

        //let listPrototypeTypeSig : string[] = ["CLASS", typecheck.prototypeListSpecifier, "<"];
        if (!(identifier in this.ct.list)) {
            this.ct.list[identifier] = { dst: stubClassTypeSig, src: [] };
            this.ct.memberType[identifier] = memberTypes;
        } else {
            this.raiseException("Struct definition error: Template struct overloads are not yet implemented");
        }
        //this.ct.list[identifier].src.push(listPrototypeTypeSig);

        const stubCtorTypeSig = this.createFunctionTypeSignature(classType, { t: classType, lvHolder: null }, [], true)
        this.regFunc((function*(_rt: CRuntime, templateArgs: [ClassType]): Gen<InitClassVariable> {
            const members: { [name: string]: Variable } = {};
            const memListYield: ResultOrGen<MemberMap> = memberList.factory(...templateArgs);
            const memList: { [member: string]: Variable } = interp.asResult(memListYield) ?? (yield* memListYield as Gen<MemberMap>);
            Object.entries(memList).forEach(([member, memvar]) => { members[member] = memvar });
            return variables.class(variables.classType(identifier, templateArgs[0].templateSpec, domain === "{global}" ? null : domain), members, null);
        }) as CFunction, classType, "o(_stub)", stubCtorTypeSig, [-1], null);
    };

    getVariableNames(...variables: MaybeUnboundVariable[]): (string | null)[] {
        try {
            const { voffset, parentList } = this.getVariablesList(false, false);
            function findName(x: MaybeUnboundVariable): string | null {
                const vid = (x as any)._vid;
                if (typeof vid === "number" && vid >= voffset) {
                    let x = vid;
                    let path: string[] = [];
                    while (x > 0) {
                        path.push(parentList[x - voffset][0]);
                        x = parentList[x - voffset][1];
                    }
                    path.reverse();
                    return path.join('');
                } else {
                    return null;
                }
            }
            return variables.map(findName);
        } catch (_) {
            return variables.map(() => null);
        }
    }

    getVariableName(variable: MaybeUnboundVariable): string | null {
        try {
            const { voffset, parentList } = this.getVariablesList(false, false);
            function findName(x: MaybeUnboundVariable): string | null {
                const vid = (x as any)._vid;
                if (typeof vid === "number" && vid >= voffset) {
                    let x = vid;
                    let path: string[] = [];
                    while (x > 0) {
                        path.push(parentList[x - voffset][0]);
                        x = parentList[x - voffset][1];
                    }
                    path.reverse();
                    return path.join('');
                } else {
                    return null;
                }
            }
            return findName(variable);
        } catch (_) {
            return null;
        }
    }

    /** Safely accesses values.
      * Panics if value is uninitalised. */
    arithmeticValue(variable: MaybeUnboundVariable): number | bigint {
        if (!(variable.t.sig in variables.arithmeticSig)) {
            this.raiseException("Expected an arithmetic value for variable " + (this.getVariableNames(variable)[0] ?? "<internal>"));
        }
        if (variable.state === "UNINIT") {
            this.raiseException("Access of an uninitialised value of variable " + (this.getVariableNames(variable)[0] ?? "<internal>"));
        } else if (variable.state === "UNBOUND") {
            if (variable.lvHolder === "SELF") {
                this.raiseException(`(Segmentation fault) dereference of a null-pointer ${this.getVariableNames(variable)[0] ?? ""}`);
            } else {
                this.raiseException(`(Segmentation fault) access of an out-of-bounds index ${variable.lvHolder.index} in an array of size ${variable.lvHolder.array.values.length}.`);
            }
        }
        return (variable as InitArithmeticVariable).value;
    }

    /** Safely accesses values.
      * Panics if value is uninitalised. 
      * Casts to 32-bit signed integer of 'number' type if 'bigint' is found
      * Panics if bigint is outside 32-bit signed integer bounds */
    arithmeticExpectNumValue(variable: MaybeUnboundVariable): number {
        if (!(variable.t.sig in variables.arithmeticSig)) {
            this.raiseException("Expected an arithmetic value for variable " + (this.getVariableNames(variable)[0] ?? "<internal>"));
        }
        if (variable.state === "UNINIT") {
            this.raiseException("Access of an uninitialised value of variable " + (this.getVariableNames(variable)[0] ?? "<internal>"));
        } else if (variable.state === "UNBOUND") {
            if (variable.lvHolder === "SELF") {
                this.raiseException(`(Segmentation fault) dereference of a null-pointer ${this.getVariableNames(variable)[0] ?? ""}`);
            } else {
                this.raiseException(`(Segmentation fault) access of an out-of-bounds index ${variable.lvHolder.index} in an array of size ${variable.lvHolder.array.values.length}.`);
            }
        }
        const value = (variable as InitArithmeticVariable).value;
        if (typeof value === "number") {
            return value;
        }
        const { minv, maxv } = variables.arithmeticProperties["I32"];
        if (value < minv || value > maxv) {
            this.raiseException(`Expected 32-bit signed integer, got ${value} (integer overflow)`);
        }
        return Number(value);
    }

    /** Safely accesses values.
      * Panics if value is uninitalised. 
      * Accepts only variables known to be bound by default.
      * This function performs less checks compared to arithmeticValue, arithmeticNumExpectValue or arithmeticNumValue2 */
    arithmeticNumValue(variable: ArithmeticNumVariable): number {
        if (variable.state === "UNINIT") {
            this.raiseException("Access of an uninitialised value of variable " + (this.getVariableNames(variable)[0] ?? "<internal>"));
        }
        return (variable as InitArithmeticNumVariable).value;
    }

    /** Safely accesses values.
      * Panics if value is uninitalised. 
      * Accepts only variables known to be bound by default.
      * This function performs less checks compared to arithmeticValue and arithmeticNumExpectValue */
    arithmeticNumValue2(variable: ArithmeticNumVariable | AbstractVariable<ArithmeticNumType, UnboundValue<ArithmeticNumVariable>>): number {
        if (variable.state === "UNINIT") {
            this.raiseException("Access of an uninitialised value of variable " + (this.getVariableNames(variable)[0] ?? "<internal>"));
        } else if (variable.state === "UNBOUND") {
            if (variable.lvHolder === "SELF") {
                this.raiseException(`(Segmentation fault) dereference of a null-pointer ${this.getVariableNames(variable)[0] ?? ""}`);
            } else {
                this.raiseException(`(Segmentation fault) access of an out-of-bounds index ${variable.lvHolder.index} in an array of size ${variable.lvHolder.array.values.length}.`);
            }
        }
        return (variable as InitArithmeticNumVariable).value;
    }

    expectValue(variable: MaybeUnboundVariable): InitVariable {
        if (variable.state === "UNINIT") {
            this.raiseException("Access of an uninitialised value of variable " + (this.getVariableNames(variable)[0] ?? "<internal>"));
        } else if (variable.state === "UNBOUND") {
            if (variable.lvHolder === "SELF") {
                this.raiseException(`(Segmentation fault) dereference of a null-pointer ${this.getVariableNames(variable)[0] ?? ""}`);
            } else {
                this.raiseException(`(Segmentation fault) access of an out-of-bounds index ${variable.lvHolder.index} in an array of size ${variable.lvHolder.array.values.length}.`);
            }
        }
        return variable as InitVariable;
    }

    unbound(variable: MaybeUnboundVariable): Variable {
        if (variable.state === "UNBOUND") {
            if (variable.lvHolder === "SELF") {
                this.raiseException(`(Segmentation fault) dereference of a null-pointer ${this.getVariableNames(variable)[0] ?? ""}`);
            } else {
                this.raiseException(`(Segmentation fault) access of an out-of-bounds index ${variable.lvHolder.index} in an array of size ${variable.lvHolder.array.values.length}.`);
            }
        }
        return variable as Variable;
    }

    defaultValue(type: ObjectType, lvHolder: LValueHolder<Variable>): ResultOrGen<Variable> {
        let classType: ClassType | null;
        let pointerType: PointerType<ObjectType | FunctionType> | null;
        if (type.sig in variables.arithmeticSig) {
            if (type.sig in variables.arithmeticNumSig) {
                return variables.uninitArithmeticNum(type.sig as ArithmeticNumSig, lvHolder as LValueHolder<ArithmeticNumVariable>, false);
            } else {
                return variables.uninitArithmeticBig(type.sig as ArithmeticBigSig, lvHolder as LValueHolder<ArithmeticBigVariable>, false);
            }
        } else if ((classType = variables.asClassType(type)) !== null) {
            const domainName = classType.identifier;
            if (!(domainName in this.typeMap)) {
                this.raiseException(`Could not resolve a class named '${domainName}'`)
            }
            const fnid = this.typeMap[domainName].functionDB.matchExactOverload("o(_stub)", "FUNCTION Return ( )");
            if (fnid !== -1 && this.typeMap[domainName].functionsByID[fnid].target !== null) {
                return (this.typeMap[domainName].functionsByID[fnid].target as CFunction)(this, [type]) as ResultOrGen<InitClassVariable>;
            } else {
                this.raiseException(`Could not find a stub-constructor for class/struct named '${classType.identifier}'`)
            }
        } else if ((pointerType = variables.asPointerType(type)) !== null) {
            if (pointerType.sizeConstraint === null) {
                return variables.uninitPointer(pointerType.pointee, null, lvHolder as LValueHolder<PointerVariable<PointeeVariable>>, false);
            } else {

            }
        }
        this.raiseException("Not yet implemented");
    };

    *defaultValue2<VElem extends Variable>(type: VElem['t'], lvHolder: LValueHolder<Variable>, zeroInitialise: boolean = false): Gen<VElem> {
        let classType: ClassType | null;
        let pointerType: PointerType<ObjectType | FunctionType> | null;
        if (type.sig in variables.arithmeticNumSig) {
            const lvHolder1 = lvHolder as LValueHolder<ArithmeticNumVariable>;
            return zeroInitialise
                ? { t: type as ArithmeticNumType, isConst: false, state: "INIT", lvHolder: lvHolder1, value: 0 } as VElem
                : { t: type as ArithmeticNumType, isConst: false, state: "UNINIT", lvHolder: lvHolder1 } as VElem;
        } else if (type.sig in variables.arithmeticBigSig) {
            const lvHolder1 = lvHolder as LValueHolder<ArithmeticBigVariable>;
            return zeroInitialise
                ? { t: type as ArithmeticBigType, isConst: false, state: "INIT", lvHolder: lvHolder1, value: BigInt(0) } as VElem
                : { t: type as ArithmeticBigType, isConst: false, state: "UNINIT", lvHolder: lvHolder1 } as VElem;
        } else if ((classType = variables.asClassType(type)) !== null) {
            // TODO: zero-initialise class members
            const domainName = classType.identifier;
            if (!(domainName in this.typeMap)) {
                this.raiseException(`Could not resolve a class named '${domainName}'`)
            }
            const fnid = this.typeMap[domainName].functionDB.matchExactOverload("o(_stub)", "FUNCTION Return ( )");
            if (fnid !== -1 && this.typeMap[domainName].functionsByID[fnid].target !== null) {
                const retvYield = (this.typeMap[domainName].functionsByID[fnid].target as CFunction)(this, [type]) as ResultOrGen<InitClassVariable>;
                const retv = interp.asResult(retvYield) ?? (yield* retvYield as Gen<InitClassVariable>);
                (retv as any).lvHolder = lvHolder;
                return retv as VElem;
            } else {
                this.raiseException(`Could not find a stub-constructor for class/struct named '${classType.identifier}'`)
            }
        } else if ((pointerType = variables.asPointerType(type)) !== null) {
            // TODO: zero-initialise as nullptr_t
            if (pointerType.sizeConstraint === null) {
                return variables.uninitPointer(pointerType.pointee, null, lvHolder as LValueHolder<PointerVariable<PointeeVariable>>, false) as VElem;
            } else if (pointerType.sizeConstraint < 0) {
                // negative sizeConstraint value is reserved for occasions when the variable is a sized array but array size expression is not given.
                // e.g.: int a[] = { 3, 4, 5 };
                this.raiseException("Array size or a brace-enclosed list initialiser must be provided at the point of declaration of a static array");
            } else {
                if (pointerType.pointee.sig === "FUNCTION") {
                    this.raiseException("Cannot declare an array of functions (perhaps you meant an array of function pointers?)")
                }
                const memory = variables.arrayMemory<Variable>(pointerType.pointee, []);
                for (let i = 0; i < pointerType.sizeConstraint; i++) {
                    // variables.clone() is a shallow clone, do not put defaultVal outside the for-loop
                    const defaultVal = yield* this.defaultValue2(pointerType.pointee, null, zeroInitialise);
                    memory.values.push(variables.clone(this, defaultVal, { array: memory, index: i }, false, true));
                }
                return variables.indexPointer(memory, 0, true, lvHolder as LValueHolder<PointerVariable<Variable>>) as VElem;
            }
        }
        this.raiseException("Not yet implemented");
    };

    raiseException(message: string, currentNode?: any): never {
        if (this?.debug?.isTriggered) {
            throw new Error("Error when debugging"); // will be caught
        }
        if (this?.interp) {
            if (currentNode == null) {
                ({
                    currentNode
                } = this.interp);
            }
            const posInfo =
                (() => {
                    if (currentNode != null) {
                        const ln = currentNode.sLine;
                        const col = currentNode.sColumn;
                        return `[line ${ln}:${col}]`;
                    } else {
                        return "[position unavailable]";
                    }
                })();
            throw new CRuntimeError(posInfo + " " + message, currentNode?.sLine ?? null, currentNode?.sColumn ?? null);
        } else {
            throw new CRuntimeError(message, null, null);
        }
    };

    raiseSoftException(message: string, currentNode?: any) {
        if (this?.interp) {
            if (currentNode == null) {
                ({
                    currentNode
                } = this.interp);
            }
            const posInfo =
                (() => {
                    if (currentNode != null) {
                        const ln = currentNode.sLine;
                        const col = currentNode.sColumn;
                        return `[line ${ln}:${col}]`;
                    } else {
                        return "[position unavailable]";
                    }
                })();
            console.error(posInfo + " WARN: " + message);
        } else {
            console.error(message);
        }
    };

}
