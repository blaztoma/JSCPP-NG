
import { CRuntime } from "../rt";
import { StringVariable } from "../shared/string_utils";
import * as ios_base from "../shared/ios_base";
import * as common from "../shared/common";
import * as utf8 from "../utf8";
import { AbstractVariable, ArithmeticBigVariable, ArithmeticNumVariable, ClassType, ClassVariable, InitArithmeticBigVariable, InitArithmeticNumVariable, InitPointerVariable, MaybeLeft, PointerVariable, TrueIndexPointerVariable, Variable, variables } from "../variables";

type IfstreamValue = ios_base.IStreamValue & {
    members: {
        _is_open: InitArithmeticNumVariable,
    }
};
type IfStreamVariable = AbstractVariable<ios_base.OStreamType, IfstreamValue>;

export = {
    load(rt: CRuntime) {
        if (!("ws_t" in rt.typeMap)) {
            const endl = rt.getCharArrayFromString("\n");
            rt.addToNamespace("std", "endl", endl, true);

            rt.defineStruct("{global}", "ws_t", [], {});
            const ws: ClassVariable = {
                t: {
                    sig: "CLASS",
                    identifier: "ws_t",
                    memberOf: null,
                    templateSpec: [],
                },
                isConst: true,
                lvHolder: "SELF",
                members: {},
                state: "INIT"
            }
            rt.addToNamespace("std", "ws", ws, true);
        }

        const charType = variables.arithmeticNumType("I8");
        rt.defineStruct("{global}", "ifstream", [
            {
                name: "buf",
                variable: variables.indexPointer<ArithmeticNumVariable>(variables.arrayMemory<ArithmeticNumVariable>(charType, []), 0, false, "SELF")
            },
            {
                name: "fd",
                variable: variables.uninitArithmeticNum("I32", "SELF"),
            },
            {
                name: "eofbit",
                variable: variables.arithmeticNum("BOOL", 0, "SELF"),
            },
            {
                name: "badbit",
                variable: variables.arithmeticNum("BOOL", 0, "SELF"),
            },
            {
                name: "failbit",
                variable: variables.arithmeticNum("BOOL", 0, "SELF"),
            },
            {
                name: "_is_open",
                variable: variables.arithmeticNum("BOOL", 0, "SELF"),
            },
            {
                name: "boolalpha",
                variable: variables.arithmeticNum("BOOL", 0, "SELF"),
            },
            {
                name: "skipws",
                variable: variables.arithmeticNum("BOOL", 1, "SELF"),
            }
        ], {});

        const whitespaceChars = [0, 9, 10, 11, 12, 13, 32];

        common.regOps(rt, [
            {
                op: "o(!_)",
                type: "FUNCTION BOOL ( LREF CLASS ifstream < > )",
                default(_rt: CRuntime, _templateTypes, ...args: Variable[]): InitArithmeticNumVariable {
                    const [_this] = args as [IfStreamVariable];
                    const failbit = _this.members.failbit.value;
                    const badbit = _this.members.badbit.value;
                    return variables.arithmeticNum("BOOL", failbit | badbit, null);
                }
            },
            {
                op: "o(_bool)",
                type: "FUNCTION BOOL ( LREF CLASS ifstream < > )",
                default(_rt: CRuntime, _templateTypes, ...args: Variable[]): ArithmeticNumVariable {
                    const [_this] = args as [IfStreamVariable];
                    const failbit = _this.members.failbit.value;
                    const badbit = _this.members.badbit.value;
                    return variables.arithmeticNum("BOOL", (failbit !== 0 || badbit !== 0) ? 0 : 1, null);
                }
            },
            {
                op: "o(_>>_)",
                type: "FUNCTION LREF CLASS ifstream < > ( LREF CLASS ifstream < > LREF Arithmetic )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): IfStreamVariable {
                    const [l, r] = args as [IfStreamVariable, ArithmeticNumVariable | ArithmeticBigVariable];
                    // TODO: this and istream functions share equal code. Merge into a single shared function
                    const buf = l.members.buf;
                    //const fd = l.members.fd;
                    const eofbit = l.members.eofbit;
                    const failbit = l.members.failbit;
                    //const badbit = l.members.badbit;
                    if (eofbit.value) {
                        failbit.value = 1;
                        return l;
                    }
                    let char: number;
                    while (true) {
                        if (buf.pointee.values.length <= buf.index) {
                            failbit.value = 1;
                            eofbit.value = 1;
                            return l;
                        }
                        char = rt.arithmeticValue(variables.arrayMember(buf.pointee, buf.index)) as number;
                        if (l.members.skipws.value === 0 || !(whitespaceChars.includes(char))) {
                            break;
                        }
                        buf.index++;
                    }
                    if (r.t.sig === "I8") {
                        variables.arithmeticNumAssign(rt, r as ArithmeticNumVariable, char);
                        buf.index++;
                    } else {
                        let wordValues: number[] = [];
                        while (!(whitespaceChars.includes(char))) {
                            wordValues.push(char);
                            buf.index++;
                            if (buf.pointee.values.length <= buf.index) {
                                eofbit.value = 1;
                                break;
                            }
                            char = rt.arithmeticValue(variables.arrayMember(buf.pointee, buf.index)) as number;
                            if (failbit.value === 1) {
                                return l;
                            }
                        }
                        if (wordValues.length === 0) {
                            failbit.value = 1;
                            return l;
                        }
                        const wordString = utf8.fromUtf8CharArray(new Uint8Array(wordValues));
                        if (r.t.sig in variables.arithmeticNumSig) {
                            const num = Number.parseFloat(wordString);
                            if (Number.isNaN(num)) {
                                l.members.failbit.value = 1;
                                return l;
                            }
                            variables.arithmeticNumAssign(rt, r as ArithmeticNumVariable, num);
                        } else {
                            let num: bigint;
                            try {
                                num = BigInt(wordString);
                            } catch (e) {
                                l.members.failbit.value = 1;
                                return l;
                            }
                            variables.arithmeticBigAssign(rt, r as ArithmeticBigVariable, num);
                        }
                    }
                    rt.adjustArithmeticAnyValue(r as InitArithmeticNumVariable | InitArithmeticBigVariable);
                    return l;
                },
            },
            {
                op: "o(_>>_)",
                type: "FUNCTION LREF CLASS istream < > ( LREF CLASS ifstream < > CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): IfStreamVariable {
                    const [l, r] = args as [IfStreamVariable, StringVariable];
                    const eofbit = l.members.eofbit;
                    const failbit = l.members.failbit;
                    const buf = l.members.buf;
                    let char: InitArithmeticNumVariable;
                    while (true) {
                        char = rt.expectValue(variables.arrayMember(buf.pointee, buf.index)) as InitArithmeticNumVariable;
                        if (char.value === 0) {
                            eofbit.value = 1;
                            failbit.value = 1;
                            return l;
                        }
                        if (!(whitespaceChars.includes(char.value))) {
                            break;
                        }
                        buf.index++;
                    }

                    let i = 0;
                    const memory = variables.arrayMemory<ArithmeticNumVariable>(variables.arithmeticNumType("I8"), []);
                    while (!(whitespaceChars.includes(char.value))) {
                        memory.values.push(variables.arithmeticNum("I8", char.value, { array: memory, index: i }));
                        buf.index++;
                        char = rt.expectValue(variables.arrayMember(buf.pointee, buf.index)) as InitArithmeticNumVariable;
                        i++;
                        if (char.value === 0) {
                            eofbit.value = 1;
                            break;
                        }
                    }
                    memory.values.push(variables.arithmeticNum("I8", 0, { array: memory, index: i }));

                    variables.indexPointerAssign(rt, r.members._ptr, memory, 0);
                    r.members._size.value = i;

                    if (i === 0) {
                        failbit.value = 1;
                        return l;
                    }

                    return l;
                }
            },
            {
                op: "o(_>>_)",
                type: "FUNCTION LREF CLASS ifstream < > ( LREF CLASS ifstream < > CLREF CLASS ws_t < > )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): IfStreamVariable {
                    const [l, _r] = args as [IfStreamVariable, ClassVariable];
                    const eofbit = l.members.eofbit;
                    const failbit = l.members.failbit;
                    const buf = l.members.buf;
                    let char: InitArithmeticNumVariable;
                    while (true) {
                        char = rt.expectValue(variables.arrayMember(buf.pointee, buf.index)) as InitArithmeticNumVariable;
                        if (char.value === 0) {
                            eofbit.value = 1;
                            failbit.value = 1;
                            return l;
                        }
                        if (!(whitespaceChars.includes(char.value))) {
                            break;
                        }
                        buf.index++;
                    }

                    return l;
                }
            },

        ]);

        const thisType = (rt.simpleType(["ifstream"]) as MaybeLeft<ClassType>).t;

        const ctorHandlers: common.OpHandler[] = [
            {
                op: "o(_ctor)",
                type: "FUNCTION CLASS ifstream < > ( PTR I8 )",
                default(_rt: CRuntime, _templateTypes, ...args: Variable[]): IfStreamVariable {
                    const [_path] = args as [PointerVariable<ArithmeticNumVariable>];
                    const pathPtr = variables.asTrueIndexPointerOfElem(_path, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Unexpected null- or invalid pointer " + (rt.getVariableNames(_path) ?? "<internal>"));
                    const result = rt.defaultValue(thisType, "SELF") as IfStreamVariable;

                    variables.arithmeticNumAssign(rt, result.members.fd, _open(_rt, result, pathPtr));
                    return result;
                }
            },
            {
                op: "o(_ctor)",
                type: "FUNCTION CLASS ifstream < > ( CLREF CLASS string < > )",
                default(_rt: CRuntime, _templateTypes, ...args: Variable[]): IfStreamVariable {
                    const [_path] = args as [StringVariable];
                    const pathPtr = variables.asTrueIndexPointerOfElem(_path.members._ptr, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Unexpected null-string " + (rt.getVariableNames(_path) ?? "<internal>"));
                    const result = rt.defaultValue(thisType, "SELF") as IfStreamVariable;

                    variables.arithmeticNumAssign(rt, result.members.fd, _open(_rt, result, pathPtr));
                    return result;
                }
            },
        ];

        for (const ctorHandler of ctorHandlers) {
            rt.regFunc(ctorHandler.default, thisType, ctorHandler.op, rt.typeSignature(ctorHandler.type), [-1], null);
        }

        function _get(rt: CRuntime, l: IfStreamVariable, _s: InitPointerVariable<ArithmeticNumVariable>, _count: ArithmeticNumVariable, _delim: ArithmeticNumVariable, consumeDelimiter: boolean): IfStreamVariable {
            let b = l.members.buf;
            const count = rt.arithmeticValue(_count);
            const delim = rt.arithmeticValue(_delim);
            const s = variables.asTrueIndexPointerOfElem(_s, variables.uninitArithmeticNum("I8", null));
            if (s === null) {
                rt.raiseException("Unexpected null- or invalid pointer");
            }
            if (b.index >= b.pointee.values.length) {
                variables.arithmeticNumAssign(rt, l.members.eofbit, 1);
            }
            let cnt = 0;
            while (cnt < count) {
                const si = rt.unbound(variables.arrayMember(s.pointee, s.index + cnt)) as ArithmeticNumVariable;
                if (cnt + 1 === count) {
                    variables.arithmeticNumAssign(rt, si, 0);
                    break;
                }
                const bi = rt.arithmeticValue(variables.arrayMember(b.pointee, b.index)) as number;
                if (bi === delim || bi === 0) {
                    if (consumeDelimiter && bi === delim) {
                        b.index++;
                    }
                    variables.arithmeticNumAssign(rt, si, 0);
                    break;
                }
                variables.arithmeticNumAssign(rt, si, bi);
                b.index++;
                cnt++;
            }
            if (cnt === 0) {
                l.members.failbit.value = 1;
            }
            return l;
        }
        function _ignore(rt: CRuntime, l: IfStreamVariable, _count: ArithmeticNumVariable, _delim: ArithmeticNumVariable): IfStreamVariable {
            let b = l.members.buf;
            const count = rt.arithmeticValue(_count);
            const delim = rt.arithmeticValue(_delim);
            for (let i = 0; i < count; i++) {
                const bi = rt.arithmeticValue(variables.arrayMember(b.pointee, b.index));
                b.index++;
                if (bi === delim) {
                    break;
                }
            }
            return l;
        }
        function _getlineStr(rt: CRuntime, l: IfStreamVariable, s: StringVariable, _delim: ArithmeticNumVariable): void {
            let b = l.members.buf;
            const delim = rt.arithmeticValue(_delim);
            const i8type = s.members._ptr.t.pointee;
            if (b.index >= b.pointee.values.length) {
                l.members.eofbit.value = 1;
                l.members.failbit.value = 1;
                return;
            }
            let cnt = 0;
            const memory = variables.arrayMemory<ArithmeticNumVariable>(i8type, []);
            while (true) {
                const bi = rt.arithmeticNumValue2(variables.arrayMember(b.pointee, b.index));
                if (bi === delim || bi === 0) {
                    // consume the delimiter
                    b.index++;
                    if (bi !== 0) {
                        cnt++;
                    }
                    //variables.arithmeticAssign(rt, si, 0);
                    break;
                }
                memory.values.push(variables.arithmeticNum(i8type.sig, bi, { array: memory, index: cnt }));
                b.index++;
                cnt++;
            }
            memory.values.push(variables.arithmeticNum(i8type.sig, 0, { array: memory, index: cnt }));
            if (cnt === 0) {
                variables.arithmeticNumAssign(rt, l.members.failbit, 1);
            }
            variables.indexPointerAssign(rt, s.members._ptr, memory, 0);
            s.members._size.value = cnt;
        }
        common.regMemberFuncs(rt, "ifstream", [
            {
                op: "peek",
                type: "FUNCTION I32 ( LREF CLASS ifstream < > )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): InitArithmeticNumVariable {
                    const [l] = args as [IfStreamVariable];
                    let b = l.members.buf;
                    if ((l.members.eofbit.value | l.members.failbit.value | l.members.badbit.value) === 0) {
                        const top = variables.arrayMember(b.pointee, b.index);
                        const retv = variables.arithmeticNum("I32", rt.arithmeticNumValue2(top), null, false);
                        rt.adjustArithmeticNumValue(retv);
                        return retv;
                    } else {
                        return variables.arithmeticNum("I32", -1, null);
                    }
                }
            },
            {
                op: "get",
                type: "FUNCTION I32 ( LREF CLASS ifstream < > )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): InitArithmeticNumVariable {
                    const [l] = args as [IfStreamVariable];
                    let b = l.members.buf;
                    if (b.pointee.values.length <= b.index) {
                        l.members.eofbit.value = 1;
                        l.members.failbit.value = 1;
                        return variables.arithmeticNum("I32", -1, null);
                    }
                    const top = variables.arrayMember(b.pointee, b.index);
                    variables.indexPointerAssignIndex(rt, l.members.buf, l.members.buf.index + 1);
                    const retv = variables.arithmeticNum("I32", rt.arithmeticNumValue2(top), null, false);
                    rt.adjustArithmeticNumValue(retv);
                    return retv;
                }
            },
            {
                op: "get",
                type: "FUNCTION LREF CLASS ifstream < > ( LREF CLASS ifstream < > PTR I8 I32 I8 )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): IfStreamVariable {
                    const [l, _s, _count, _delim] = args as [IfStreamVariable, InitPointerVariable<ArithmeticNumVariable>, ArithmeticNumVariable, ArithmeticNumVariable];
                    return _get(rt, l, _s, _count, _delim, false);
                }
            },
            {
                op: "get",
                type: "FUNCTION LREF CLASS ifstream < > ( LREF CLASS ifstream < > PTR I8 I32 )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): IfStreamVariable {
                    const [l, _s, _count] = args as [IfStreamVariable, InitPointerVariable<ArithmeticNumVariable>, ArithmeticNumVariable];
                    return _get(rt, l, _s, _count, variables.arithmeticNum("I8", 10, "SELF"), false);
                }
            },
            {
                op: "get",
                type: "FUNCTION LREF CLASS ifstream < > ( LREF CLASS ifstream < > LREF I8 )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): IfStreamVariable {
                    const [l, ch] = args as [IfStreamVariable, ArithmeticNumVariable];
                    let b = l.members.buf;
                    if (b.pointee.values.length <= b.index) {
                        l.members.eofbit.value = 1;
                        l.members.failbit.value = 1;
                    } else {
                        const top = variables.arrayMember(b.pointee, b.index);
                        variables.indexPointerAssignIndex(rt, l.members.buf, l.members.buf.index + 1);
                        variables.arithmeticNumAssign(rt, ch, rt.arithmeticNumValue2(top));
                        rt.adjustArithmeticNumValue(ch as InitArithmeticNumVariable);
                    }
                    return l;
                }
            },
            {
                op: "ignore",
                type: "FUNCTION LREF CLASS ifstream < > ( LREF CLASS ifstream < > I32 I8 )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): IfStreamVariable {
                    const [l, _count, _delim] = args as [IfStreamVariable, ArithmeticNumVariable, ArithmeticNumVariable];
                    return _ignore(rt, l, _count, _delim);
                }
            },
            {
                op: "ignore",
                type: "FUNCTION LREF CLASS ifstream < > ( LREF CLASS ifstream < > I32 )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): IfStreamVariable {
                    const [l, _count] = args as [IfStreamVariable, ArithmeticNumVariable];
                    return _ignore(rt, l, _count, variables.arithmeticNum("I8", 10, null));
                }
            },
            {
                op: "ignore",
                type: "FUNCTION LREF CLASS ifstream < > ( LREF CLASS ifstream < > )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): IfStreamVariable {
                    const [l] = args as [IfStreamVariable];
                    return _ignore(rt, l, variables.arithmeticNum("I32", 1, null), variables.arithmeticNum("I8", 10, null));
                }
            },
            {
                op: "getline",
                type: "FUNCTION LREF CLASS ifstream < > ( LREF CLASS ifstream < > PTR I8 I32 I8 )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): IfStreamVariable {
                    const [l, _s, _count, _delim] = args as [IfStreamVariable, InitPointerVariable<ArithmeticNumVariable>, ArithmeticNumVariable, ArithmeticNumVariable];
                    return _get(rt, l, _s, _count, _delim, true);
                }
            },
            {
                op: "getline",
                type: "FUNCTION LREF CLASS ifstream < > ( LREF CLASS ifstream < > PTR I8 I32 )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): IfStreamVariable {
                    const [l, _s, _count] = args as [IfStreamVariable, InitPointerVariable<ArithmeticNumVariable>, ArithmeticNumVariable];
                    return _get(rt, l, _s, _count, variables.arithmeticNum("I8", 10, "SELF"), true);
                }
            },
            {
                op: "close",
                type: "FUNCTION VOID ( LREF CLASS ifstream < > )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): "VOID" {
                    const [l] = args as [IfStreamVariable];
                    rt.fileClose(l.members.fd);
                    return "VOID"
                }
            },
            {
                op: "open",
                type: "FUNCTION VOID ( LREF CLASS ifstream < > PTR I8 )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): "VOID" {
                    const [l, _path] = args as [IfStreamVariable, PointerVariable<ArithmeticNumVariable>];
                    const pathPtr = variables.asTrueIndexPointerOfElem(_path, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    _open(rt, l, pathPtr);
                    return "VOID";
                }
            },
            {
                op: "is_open",
                type: "FUNCTION BOOL ( LREF CLASS ifstream < > )",
                default(_rt: CRuntime, _templateTypes, ...args: Variable[]): InitArithmeticNumVariable {
                    const [l] = args as [IfStreamVariable];
                    return variables.arithmeticNum("BOOL", l.members._is_open.value, null);
                }
            },
            {
                op: "good",
                type: "FUNCTION BOOL ( LREF CLASS ifstream < > )",
                default(_rt: CRuntime, _templateTypes, ...args: Variable[]): InitArithmeticNumVariable {
                    const [l] = args as [IfStreamVariable];
                    const eofbit = l.members.eofbit.value;
                    const failbit = l.members.failbit.value;
                    const badbit = l.members.badbit.value;
                    return variables.arithmeticNum("BOOL", 1 - (eofbit | failbit | badbit), null);
                }
            },
            {
                op: "fail",
                type: "FUNCTION BOOL ( LREF CLASS ifstream < > )",
                default(_rt: CRuntime, _templateTypes, ...args: Variable[]): InitArithmeticNumVariable {
                    const [l] = args as [IfStreamVariable];
                    const failbit = l.members.failbit.value;
                    const badbit = l.members.badbit.value;
                    return variables.arithmeticNum("BOOL", failbit | badbit, null);
                }
            },
            {
                op: "bad",
                type: "FUNCTION BOOL ( LREF CLASS ifstream < > )",
                default(_rt: CRuntime, _templateTypes, ...args: Variable[]): InitArithmeticNumVariable {
                    const [l] = args as [IfStreamVariable];
                    const badbit = l.members.badbit.value;
                    return variables.arithmeticNum("BOOL", badbit, null);
                }
            },
            {
                op: "eof",
                type: "FUNCTION BOOL ( LREF CLASS ifstream < > )",
                default(_rt: CRuntime, _templateTypes, ...args: Variable[]): InitArithmeticNumVariable {
                    const [l] = args as [IfStreamVariable];
                    const eofbit = l.members.eofbit.value;
                    return variables.arithmeticNum("BOOL", eofbit, null);
                }
            },
        ]);

        common.regGlobalFuncs(rt, [
            {
                op: "getline",
                type: "FUNCTION LREF CLASS ifstream < > ( LREF CLASS ifstream < > CLREF CLASS string < > I8 )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): IfStreamVariable {
                    const [input, str, delim] = args as [IfStreamVariable, StringVariable, ArithmeticNumVariable];
                    _getlineStr(rt, input, str, delim);
                    return input;
                }
            },
            {
                op: "getline",
                type: "FUNCTION LREF CLASS ifstream < > ( LREF CLASS ifstream < > CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): IfStreamVariable {
                    const [input, str] = args as [IfStreamVariable, StringVariable];
                    _getlineStr(rt, input, str, variables.arithmeticNum("I8", 10, null));
                    return input;
                }
            },
        ]);

        const _open = function(_rt: CRuntime, _this: IfStreamVariable, right: TrueIndexPointerVariable<ArithmeticNumVariable>): number {
            const fd = _rt.openFile(right, ios_base.openmode.in);

            if (fd !== -1) {
                variables.arithmeticNumAssign(rt, _this.members.fd, fd);
                _this.members._is_open.value = 1;
                variables.indexPointerAssign(rt, _this.members.buf, _rt.fileRead(_this.members.fd).pointee, 0);
            } else {
                _this.members.failbit.value = 1;
            }
            return fd;
        };
    }
};


