import * as prepast from "./prepast";
// @ts-ignore
import * as PEGUtil from "pegjs-util";
import { BaseInterpreter } from "./interpreter";
import { CRuntime, CRuntimeError } from "./rt";

interface Macro {
    type: "function" | "simple";
    args?: any[];
    replacement: any;
};

interface TranslationUnitSpec {
    type: "TranslationUnit",
    lines: any[]
}

interface CodeSpec {
    type: "Code",
    val: (any | string)[],
}

interface PrepIncludeLibSpec {
    type: "PrepIncludeLib",
    name: string
}

interface PrepIncludeLocalSpec {
    type: "PrepIncludeLocal",
    name: string
}

interface PrepSimpleMacroSpec {
    type: "PrepSimpleMacro",
    Identifier: IdentifierSpec,
    Replacement: any,
}

interface PrepFunctionMacroSpec {
    type: "PrepFunctionMacro",
    Identifier: IdentifierSpec,
    Args: any,
    Replacement: any,
}

interface PrepUndefSpec {
    type: "PrepUndef",
    Identifier: IdentifierSpec,
}
interface PrepIfdefSpec {
    type: "PrepIfdef",
    Identifier: IdentifierSpec,
}
interface PrepIfndefSpec {
    type: "PrepIfndef",
    Identifier: IdentifierSpec,
}
interface PrepElseSpec {
    type: "PrepElse",
}
interface PrepEndifSpec {
    type: "PrepEndif",
}
interface IdentifierSpec {
    type: "Identifier",
    val: string
}

type Statement = TranslationUnitSpec | CodeSpec | PrepIncludeLibSpec | PrepIncludeLocalSpec | PrepSimpleMacroSpec | PrepFunctionMacroSpec | PrepUndefSpec | PrepIfdefSpec | PrepIfndefSpec | PrepElseSpec | PrepEndifSpec | IdentifierSpec;

class Preprocessor extends BaseInterpreter<Statement> {
    ret: string;
    macros: { [name: string]: Macro };
    doinclude: boolean[];
    macroStack: Statement[];
    visitors: { [name: string]: (interp: Preprocessor, s: Statement, param?: any) => any };

    constructor(rt: CRuntime) {
        super(rt);
        const pushInc = function(b: boolean) {
            this.doinclude.push(this.doinclude[this.doinclude.length - 1] && b);
        };

        this.rt = rt;
        this.ret = "";
        this.macros = {};
        this.macroStack = [];
        this.doinclude = [true];
        this.visitors = {
            TranslationUnit(interp, s: TranslationUnitSpec, code) {
                let i = 0;
                while (i < s.lines.length) {
                    const dec = s.lines[i];
                    interp.visit(dec, code);
                    interp.ret += dec.space;
                    i++;
                }
                return interp.ret;
            },
            Code(interp, s: CodeSpec, _code) {
                if (interp.doinclude[interp.doinclude.length - 1]) {
                    let i = 0;
                    while (i < s.val.length) {
                        const x = interp.work(s.val[i]);
                        interp.ret += x;
                        i++;
                    }
                }
            },
            PrepSimpleMacro(interp, s: PrepSimpleMacroSpec, _code) {
                interp.newMacro(s.Identifier, s.Replacement);
            },
            PrepFunctionMacro(interp, s: PrepFunctionMacroSpec, _code) {
                interp.newMacroFunction(s.Identifier, s.Args, s.Replacement);
            },
            PrepIncludeLib(interp, s: PrepIncludeLibSpec, _code) {
                interp.rt.include(s.name);
            },
            PrepIncludeLocal(interp, s: PrepIncludeLocalSpec, _code) {
                if (interp.rt.config.includes === undefined) {
                    interp.rt.raiseException("[Preprocessor].interp.rt.config.includes is undefined");
                } else {
                    const {
                        includes
                    } = interp.rt.config;
                    if (s.name in includes) {
                        interp.rt.include(s.name);// includes[s.name].load(interp.rt);
                    } else {
                        interp.rt.raiseException("cannot find file: " + s.name);
                    }
                }
            },
            PrepUndef(interp, s: PrepUndefSpec, _code) {
                if (interp.isMacroDefined(s.Identifier)) {
                    delete interp.macros[s.Identifier.val];
                }
            },
            PrepIfdef(interp, s: PrepIfdefSpec, _code) {
                pushInc(interp.isMacroDefined(s.Identifier));
            },
            PrepIfndef(interp, s: PrepIfndefSpec, _code) {
                pushInc(!interp.isMacroDefined(s.Identifier));
            },
            PrepElse(interp, _s: PrepElseSpec, _code) {
                if (interp.doinclude.length > 1) {
                    const x = interp.doinclude.pop();
                    pushInc(!x);
                } else {
                    interp.rt.raiseException("#else must be used after a #if");
                }
            },
            PrepEndif(interp, _s: PrepEndifSpec, _code) {
                if (interp.doinclude.length > 1) {
                    interp.doinclude.pop();
                } else {
                    interp.rt.raiseException("#endif must be used after a #if");
                }
            },
            unknown(interp, s, _code) {
                interp.rt.raiseException("unhandled syntax " + s.type);
            }
        };
    }
    visit(s: Statement, code: string) {
        if ("type" in s) {
            // const _node = this.currentNode;
            this.currentNode = s;
            if (s.type in this.visitors) {
                return this.visitors[s.type](this, s, code);
            } else {
                return this.visitors["unknown"](this, s, code);
            }
            // this.currentNode = _node;
        } else {
            this.currentNode = s;
            this.rt.raiseException("untyped syntax structure: " + JSON.stringify(s));
        }
    };

    isMacroDefined(node: Statement): boolean {
        if (node.type === "Identifier") {
            return node.val in this.macros;
        } else if ("Identifier" in node) {
            return node.Identifier.val in this.macros;
        } else {
            return false;
        }
    };

    isMacro(node: Statement): boolean {
        return this.isMacroDefined(node) && "val" in node && (this.macros[node.val as string].type === "simple");
    };

    isMacroFunction(node: Statement): boolean {
        return this.isMacroDefined(node) && "Identifier" in node && (this.macros[node.Identifier.val].type === "function");
    };

    newMacro(id: any, replacement: any): void {
        if (this.isMacroDefined(id)) {
            this.rt.raiseException("macro " + id.val + " is already defined");
        }
        this.macros[id.val] = {
            type: "simple",
            replacement
        };
    };

    newMacroFunction(id: any, args: any[], replacement: any): void {
        if (this.isMacroDefined(id)) {
            this.rt.raiseException("macro " + id.val + " is already defined");
        }
        this.macros[id.val] = {
            type: "function",
            args,
            replacement
        };
    };

    work(node: any) {
        if (node.type === "Seperator") {
            return node.val + node.space;
        } else {
            if (node in this.macroStack) {
                this.rt.raiseException("recursive macro detected");
            }
            this.macroStack.push(node);
            if (node.type === "Identifier") {
                return this.replaceMacro(node) + node.space;
            } else if (node.type === "PrepFunctionMacroCall") {
                return this.replaceMacroFunction(node);
            } else if (node.type === "StringLiteral") {
                return (node.prefix ?? "") + JSON.stringify(node.value);
            }
            this.macroStack.pop();
        }
    };

    replaceMacro(id: any) {
        if (this.isMacro(id)) {
            let ret = "";
            const rep = this.macros[id.val].replacement;
            let i = 0;
            while (i < rep.length) {
                const v = this.work(rep[i]);
                ret += v;
                i++;
            }
            return ret;
        } else {
            return id.val;
        }
    };

    replaceMacroFunction(_node: Statement) {
        if (this.isMacroFunction(_node)) {
            const node = _node as any;
            const name = node.Identifier.val;
            const argsText = node.Args;
            if (!(name in this.macros)) {
                this.rt.raiseException(`[Preprocessor].macros[${name}] is undefined`);
            }
            const rep = this.macros[name].replacement;
            const {
                args
            } = this.macros[name];
            if (args === undefined) {
                this.rt.raiseException("args is undefined");
            }
            if (args.length === argsText.length) {
                let ret = "";
                let i = 0;
                while (i < rep.length) {
                    if (rep[i].type === "Seperator") {
                        const v = this.work(rep[i]);
                        ret += v;
                    } else if (rep[i].type === "StringLiteral") {
                        this.rt.raiseException("StringLiteral handling in macros is not yet implemented!");
                    } else {
                        let argi = -1;
                        let j = 0;
                        while (j < args.length) {
                            if ((rep[i].type === "Identifier") && (args[j].val === rep[i].val)) {
                                argi = j;
                                break;
                            }
                            j++;
                        }
                        if (argi >= 0) {
                            let v = "";
                            j = 0;
                            while (j < argsText[argi].length) {
                                v += this.work(argsText[argi][j]);
                                j++;
                            }
                            ret += v + rep[i].space;
                        } else {
                            const v = this.work(rep[i]);
                            ret += v;
                        }
                    }
                    i++;
                }
                return ret;
            } else {
                this.rt.raiseException("macro " + name + " requires " + args.length + " arguments (" + argsText.length + " given)");
            }
        } else {
            const node = _node as any;
            const argsText = node.Args;
            const v = [];
            let i = 0;
            while (i < argsText.length) {
                let x = "";
                let j = 0;
                while (j < argsText[i].length) {
                    x += this.work(argsText[i][j]);
                    j++;
                }
                v.push(x);
                i++;
            }
            return node.Identifier.val + "(" + v.join(",") + ")" + node.space;
        }
    };

    parse(code: string) {
        const result = PEGUtil.parse(prepast, code);
        if (result.error != null) {
            const line = result.error.line;
            const column = result.error.column
            throw new CRuntimeError(`[line ${line}:${column}] Syntax error`, line, column);
        }
        this.rt.interp = this;
        return this.visit(result.ast, code);
    };
}


export function parse(rt: CRuntime, code: string) {
    return new Preprocessor(rt).parse(code);
}
