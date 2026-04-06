import { CRuntime } from "../rt";
import { StringVariable } from "../shared/string_utils";
import * as ios_base from "../shared/ios_base";
import * as common from "../shared/common";
import * as utf8 from "../utf8";
import { AbstractVariable, ArithmeticVariable, ClassType, ClassVariable, InitArithmeticVariable, InitIndexPointerVariable, InitPointerVariable, MaybeLeft, PointerVariable, variables } from "../variables";
import { IOManipTokenVariable, iomanip_token_mode } from "../shared/ios_base";

type IfstreamValue = ios_base.IStreamValue & {
    members: {
        _is_open: InitArithmeticVariable,
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
                v: {
                    isConst: true,
                    lvHolder: "SELF",
                    members: {},
                    state: "INIT"
                }
            }
            rt.addToNamespace("std", "ws", ws, true);
        }

        const charType = variables.arithmeticType("I8");
        rt.defineStruct("{global}", "ifstream", [
            {
                name: "buf",
                variable: variables.indexPointer<ArithmeticVariable>(variables.arrayMemory(charType, []), 0, false, "SELF")
            },
            {
                name: "fd",
                variable: variables.uninitArithmetic("I32", "SELF"),
            },
            {
                name: "eofbit",
                variable: variables.arithmetic("BOOL", 0, "SELF"),
            },
            {
                name: "badbit",
                variable: variables.arithmetic("BOOL", 0, "SELF"),
            },
            {
                name: "failbit",
                variable: variables.arithmetic("BOOL", 0, "SELF"),
            },
            {
                name: "_is_open",
                variable: variables.arithmetic("BOOL", 0, "SELF"),
            },
            {
                name: "boolalpha",
                variable: variables.arithmetic("BOOL", 0, "SELF"),
            },
            {
                name: "skipws",
                variable: variables.arithmetic("BOOL", 1, "SELF"),
            }
        ], {});

        const whitespaceChars = [0, 9, 10, 32];

        common.regOps(rt, [
            {
                op: "o(!_)",
                type: "FUNCTION BOOL ( LREF CLASS ifstream < > )",
                default(_rt: CRuntime, _templateTypes: [], _this: IfStreamVariable) {
                    const failbit = _this.v.members.failbit.v.value;
                    const badbit = _this.v.members.badbit.v.value;
                    return variables.arithmetic("BOOL", failbit | badbit, null);
                }
            },
            {
                op: "o(_bool)",
                type: "FUNCTION BOOL ( LREF CLASS ifstream < > )",
                default(_rt: CRuntime, _templateTypes: [], _this: IfStreamVariable): ArithmeticVariable {
                    const failbit = _this.v.members.failbit.v.value;
                    const badbit = _this.v.members.badbit.v.value;
                    return variables.arithmetic("BOOL", (failbit !== 0 || badbit !== 0) ? 0 : 1, null);
                }
            },
            {
                op: "o(_>>_)",
                type: "FUNCTION LREF CLASS ifstream < > ( LREF CLASS ifstream < > LREF Arithmetic )",
                default(rt: CRuntime, _templateTypes: [], l: IfStreamVariable, r: ArithmeticVariable): IfStreamVariable {
                    // TODO: this and istream functions share equal code. Merge into a single shared function
                    const buf = l.v.members.buf;
                    //const fd = l.v.members.fd;
                    const eofbit = l.v.members.eofbit;
                    const failbit = l.v.members.failbit;
                    //const badbit = l.v.members.badbit;
                    if (eofbit.v.value) {
                        failbit.v.value = 1;
                        return l;
                    }
                    let char: number;
                    while (true) {
                        if (buf.v.pointee.values.length <= buf.v.index) {
                            failbit.v.value = 1;
                            eofbit.v.value = 1;
                            return l;
                        }
                        char = rt.arithmeticValue(variables.arrayMember(buf.v.pointee, buf.v.index));
                        if (l.v.members.skipws.v.value === 0 || !(whitespaceChars.includes(char))) {
                            break;
                        }
                        buf.v.index++;
                    }
                    if (r.t.sig === "I8") {
                        variables.arithmeticAssign(rt, r, char);
                        buf.v.index++;
                    } else {
                        let wordValues: number[] = [];
                        while (!(whitespaceChars.includes(char))) {
                            wordValues.push(char);
                            buf.v.index++;
                            if (buf.v.pointee.values.length <= buf.v.index) {
                                eofbit.v.value = 1;
                                break;
                            }
                            char = rt.arithmeticValue(variables.arrayMember(buf.v.pointee, buf.v.index));
                            if (failbit.v.value === 1) {
                                return l;
                            }
                        }
                        if (wordValues.length === 0) {
                            failbit.v.value = 1;
                            return l;
                        }
                        const wordString = utf8.fromUtf8CharArray(new Uint8Array(wordValues));
                        const num = Number.parseFloat(wordString);
                        if (Number.isNaN(num)) {
                            failbit.v.value = 1;
                            return l;
                        }
                        variables.arithmeticAssign(rt, r, num);
                    }
                    rt.adjustArithmeticValue((r as InitArithmeticVariable));
                    return l;
                },
            },
            {
                op: "o(_>>_)",
                type: "FUNCTION LREF CLASS istream < > ( LREF CLASS ifstream < > CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes: [], l: IfStreamVariable, r: StringVariable): IfStreamVariable {
                    const eofbit = l.v.members.eofbit;
                    const failbit = l.v.members.failbit;
                    const buf = l.v.members.buf;
                    let char: InitArithmeticVariable;
                    while (true) {
                        char = rt.expectValue(variables.arrayMember(buf.v.pointee, buf.v.index)) as InitArithmeticVariable;
                        if (char.v.value === 0) {
                            eofbit.v.value = 1;
                            failbit.v.value = 1;
                            return l;
                        }
                        if (!(whitespaceChars.includes(char.v.value))) {
                            break;
                        }
                        buf.v.index++;
                    }

                    let i = 0;
                    const memory = variables.arrayMemory<ArithmeticVariable>(variables.arithmeticType("I8"), []);
                    while (!(whitespaceChars.includes(char.v.value))) {
                        memory.values.push(variables.arithmetic("I8", char.v.value, { array: memory, index: i }).v);
                        buf.v.index++;
                        char = rt.expectValue(variables.arrayMember(buf.v.pointee, buf.v.index)) as InitArithmeticVariable;
                        i++;
                        if (char.v.value === 0) {
                            eofbit.v.value = 1;
                            break;
                        }
                    }
                    memory.values.push(variables.arithmetic("I8", 0, { array: memory, index: i }).v);

                    variables.indexPointerAssign(rt, r.v.members._ptr, memory, 0);
                    r.v.members._size.v.value = i;

                    if (i === 0) {
                        failbit.v.value = 1;
                        return l;
                    }

                    return l;
                }
            },
            {
                op: "o(_>>_)",
                type: "FUNCTION LREF CLASS ifstream < > ( LREF CLASS ifstream < > CLREF CLASS ws_t < > )",
                default(rt: CRuntime, _templateTypes: [], l: IfStreamVariable, _r: ClassVariable): IfStreamVariable {
                    const eofbit = l.v.members.eofbit;
                    const failbit = l.v.members.failbit;
                    const buf = l.v.members.buf;
                    let char: InitArithmeticVariable;
                    while (true) {
                        char = rt.expectValue(variables.arrayMember(buf.v.pointee, buf.v.index)) as InitArithmeticVariable;
                        if (char.v.value === 0) {
                            eofbit.v.value = 1;
                            failbit.v.value = 1;
                            return l;
                        }
                        if (!(whitespaceChars.includes(char.v.value))) {
                            break;
                        }
                        buf.v.index++;
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
                default(_rt: CRuntime, _templateTypes: [ClassType], _path: PointerVariable<ArithmeticVariable>): IfStreamVariable {
                    const pathPtr = variables.asInitIndexPointerOfElem(_path, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    const result = rt.defaultValue(thisType, "SELF") as IfStreamVariable;

                    variables.arithmeticAssign(rt, result.v.members.fd, _open(_rt, result, pathPtr));
                    return result;
                }
            },
            {
                op: "o(_ctor)",
                type: "FUNCTION CLASS ifstream < > ( CLREF CLASS string < > )",
                default(_rt: CRuntime, _templateTypes: [ClassType], _path: StringVariable): IfStreamVariable {
                    const pathPtr = variables.asInitIndexPointerOfElem(_path.v.members._ptr, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    const result = rt.defaultValue(thisType, "SELF") as IfStreamVariable;

                    variables.arithmeticAssign(rt, result.v.members.fd, _open(_rt, result, pathPtr));
                    return result;
                }
            },
        ];

        for (const ctorHandler of ctorHandlers) {
            rt.regFunc(ctorHandler.default, thisType, ctorHandler.op, rt.typeSignature(ctorHandler.type), [-1]);
        }

        function _get(rt: CRuntime, l: IfStreamVariable, _s: InitPointerVariable<ArithmeticVariable>, _count: ArithmeticVariable, _delim: ArithmeticVariable, consumeDelimiter: boolean): IfStreamVariable {
            let b = l.v.members.buf;
            const count = rt.arithmeticValue(_count);
            const delim = rt.arithmeticValue(_delim);
            const s = variables.asInitIndexPointerOfElem(_s, variables.uninitArithmetic("I8", null));
            if (s === null) {
                rt.raiseException("Not an index pointer");
            }
            if (b.v.index >= b.v.pointee.values.length) {
                variables.arithmeticAssign(rt, l.v.members.eofbit, 1);
            }
            let cnt = 0;
            while (cnt < count) {
                const si = rt.unbound(variables.arrayMember(s.v.pointee, s.v.index + cnt)) as ArithmeticVariable;
                if (cnt + 1 === count) {
                    variables.arithmeticAssign(rt, si, 0);
                    break;
                }
                const bi = rt.arithmeticValue(variables.arrayMember(b.v.pointee, b.v.index));
                if (bi === delim || bi === 0) {
                    if (consumeDelimiter && bi === delim) {
                        b.v.index++;
                    }
                    variables.arithmeticAssign(rt, si, 0);
                    break;
                }
                variables.arithmeticAssign(rt, si, bi);
                b.v.index++;
                cnt++;
            }
            if (cnt === 0) {
                l.v.members.failbit.v.value = 1;
            }
            return l;
        }
        function _ignore(rt: CRuntime, l: IfStreamVariable, _count: ArithmeticVariable, _delim: ArithmeticVariable): IfStreamVariable {
            let b = l.v.members.buf;
            const count = rt.arithmeticValue(_count);
            const delim = rt.arithmeticValue(_delim);
            for (let i = 0; i < count; i++) {
                const bi = rt.arithmeticValue(variables.arrayMember(b.v.pointee, b.v.index));
                if (bi === delim) {
                    b.v.index++;
                } else {
                    break;
                }
            }
            return l;
        }
        function _getlineStr(rt: CRuntime, l: IfStreamVariable, s: StringVariable, _delim: ArithmeticVariable): void {
            let b = l.v.members.buf;
            const delim = rt.arithmeticValue(_delim);
            const i8type = s.v.members._ptr.t.pointee;
            if (b.v.index >= b.v.pointee.values.length) {
                l.v.members.eofbit.v.value = 1;
                l.v.members.failbit.v.value = 1;
                return;
            }
            let cnt = 0;
            const memory = variables.arrayMemory<ArithmeticVariable>(i8type, []);
            while (true) {
                const bi = rt.arithmeticValue(variables.arrayMember(b.v.pointee, b.v.index));
                if (bi === delim || bi === 0) {
                    // consume the delimiter
                    b.v.index++;
                    if (bi !== 0) {
                        cnt++;
                    }
                    //variables.arithmeticAssign(rt, si, 0);
                    break;
                }
                memory.values.push(variables.arithmetic(i8type.sig, bi, { array: memory, index: cnt }).v);
                b.v.index++;
                cnt++;
            }
            memory.values.push(variables.arithmetic(i8type.sig, 0, { array: memory, index: cnt }).v);
            if (cnt === 0) {
                variables.arithmeticAssign(rt, l.v.members.failbit, 1);
            }
            variables.indexPointerAssign(rt, s.v.members._ptr, memory, 0);
            s.v.members._size.v.value = cnt;
        }
        common.regMemberFuncs(rt, "ifstream", [
            {
                op: "peek",
                type: "FUNCTION I32 ( LREF CLASS ifstream < > )",
                default(rt: CRuntime, _templateTypes: [], l: IfStreamVariable): InitArithmeticVariable {
                    let b = l.v.members.buf;
                    if ((l.v.members.eofbit.v.value | l.v.members.failbit.v.value | l.v.members.badbit.v.value) === 0) {
                        const top = variables.arrayMember(b.v.pointee, b.v.index);
                        const retv = variables.arithmetic("I32", rt.arithmeticValue(top), null, false);
                        rt.adjustArithmeticValue(retv);
                        return retv;
                    } else {
                        return variables.arithmetic("I32", -1, null);
                    }
                }
            },
            {
                op: "get",
                type: "FUNCTION I32 ( LREF CLASS ifstream < > )",
                default(rt: CRuntime, _templateTypes: [], l: IfStreamVariable): InitArithmeticVariable {
                    let b = l.v.members.buf;
                    if (b.v.pointee.values.length <= b.v.index) {
                        variables.arithmeticAssign(rt, l.v.members.eofbit, 1);
                        variables.arithmeticAssign(rt, l.v.members.failbit, 1);
                        return variables.arithmetic("I32", -1, null);
                    }
                    const top = variables.arrayMember(b.v.pointee, b.v.index);
                    variables.indexPointerAssignIndex(rt, l.v.members.buf, l.v.members.buf.v.index + 1);
                    const retv = variables.arithmetic("I32", rt.arithmeticValue(top), null, false);
                    rt.adjustArithmeticValue(retv);
                    return retv;
                }
            },
            {
                op: "get",
                type: "FUNCTION LREF CLASS ifstream < > ( LREF CLASS ifstream < > PTR I8 I32 I8 )",
                default(rt: CRuntime, _templateTypes: [], l: IfStreamVariable, _s: InitPointerVariable<ArithmeticVariable>, _count: ArithmeticVariable, _delim: ArithmeticVariable): IfStreamVariable {
                    return _get(rt, l, _s, _count, _delim, false);
                }
            },
            {
                op: "get",
                type: "FUNCTION LREF CLASS ifstream < > ( LREF CLASS ifstream < > PTR I8 I32 )",
                default(rt: CRuntime, _templateTypes: [], l: IfStreamVariable, _s: InitPointerVariable<ArithmeticVariable>, _count: ArithmeticVariable): IfStreamVariable {
                    return _get(rt, l, _s, _count, variables.arithmetic("I8", 10, "SELF"), false);
                }
            },
            {
                op: "get",
                type: "FUNCTION LREF CLASS ifstream < > ( LREF CLASS ifstream < > LREF I8 )",
                default(rt: CRuntime, _templateTypes: [], l: IfStreamVariable, ch: ArithmeticVariable): IfStreamVariable {
                    let b = l.v.members.buf;
                    if (b.v.pointee.values.length <= b.v.index) {
                        variables.arithmeticAssign(rt, l.v.members.eofbit, 1);
                        variables.arithmeticAssign(rt, l.v.members.failbit, 1);
                    } else {
                        const top = variables.arrayMember(b.v.pointee, b.v.index);
                        variables.indexPointerAssignIndex(rt, l.v.members.buf, l.v.members.buf.v.index + 1);
                        variables.arithmeticAssign(rt, ch, rt.arithmeticValue(top));
                        rt.adjustArithmeticValue(ch as InitArithmeticVariable);
                    }
                    return l;
                }
            },
            {
                op: "ignore",
                type: "FUNCTION LREF CLASS ifstream < > ( LREF CLASS ifstream < > I32 I8 )",
                default(rt: CRuntime, _templateTypes: [], l: IfStreamVariable, _count: ArithmeticVariable, _delim: ArithmeticVariable): IfStreamVariable {
                    return _ignore(rt, l, _count, _delim);
                }
            },
            {
                op: "ignore",
                type: "FUNCTION LREF CLASS ifstream < > ( LREF CLASS ifstream < > I32 )",
                default(rt: CRuntime, _templateTypes: [], l: IfStreamVariable, _count: ArithmeticVariable): IfStreamVariable {
                    return _ignore(rt, l, _count, variables.arithmetic("I8", 10, null));
                }
            },
            {
                op: "ignore",
                type: "FUNCTION LREF CLASS ifstream < > ( LREF CLASS ifstream < > )",
                default(rt: CRuntime, _templateTypes: [], l: IfStreamVariable): IfStreamVariable {
                    return _ignore(rt, l, variables.arithmetic("I32", 1, null), variables.arithmetic("I8", 10, null));
                }
            },
            {
                op: "getline",
                type: "FUNCTION LREF CLASS ifstream < > ( LREF CLASS ifstream < > PTR I8 I32 I8 )",
                default(rt: CRuntime, _templateTypes: [], l: IfStreamVariable, _s: InitPointerVariable<ArithmeticVariable>, _count: ArithmeticVariable, _delim: ArithmeticVariable): IfStreamVariable {
                    return _get(rt, l, _s, _count, _delim, true);
                }
            },
            {
                op: "getline",
                type: "FUNCTION LREF CLASS ifstream < > ( LREF CLASS ifstream < > PTR I8 I32 )",
                default(rt: CRuntime, _templateTypes: [], l: IfStreamVariable, _s: InitPointerVariable<ArithmeticVariable>, _count: ArithmeticVariable): IfStreamVariable {
                    return _get(rt, l, _s, _count, variables.arithmetic("I8", 10, "SELF"), true);
                }
            },
            {
                op: "close",
                type: "FUNCTION VOID ( LREF CLASS ifstream < > )",
                default(rt: CRuntime, _templateTypes: [], l: IfStreamVariable): "VOID" {
                    rt.fileClose(l.v.members.fd);
                    return "VOID"
                }
            },
            {
                op: "open",
                type: "FUNCTION VOID ( LREF CLASS ifstream < > PTR I8 )",
                default(rt: CRuntime, _templateTypes: [], l: IfStreamVariable, _path: PointerVariable<ArithmeticVariable>): "VOID" {
                    const pathPtr = variables.asInitIndexPointerOfElem(_path, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    _open(rt, l, pathPtr);
                    return "VOID";
                }
            },
            {
                op: "is_open",
                type: "FUNCTION BOOL ( LREF CLASS ifstream < > )",
                default(_rt: CRuntime, _templateTypes: [], l: IfStreamVariable): InitArithmeticVariable {
                    return variables.arithmetic("BOOL", l.v.members._is_open.v.value, null);
                }
            },
            {
                op: "good",
                type: "FUNCTION BOOL ( LREF CLASS ifstream < > )",
                default(_rt: CRuntime, _templateTypes: [], l: IfStreamVariable): InitArithmeticVariable {
                    const eofbit = l.v.members.eofbit.v.value;
                    const failbit = l.v.members.failbit.v.value;
                    const badbit = l.v.members.badbit.v.value;
                    return variables.arithmetic("BOOL", 1 - (eofbit | failbit | badbit), null);
                }
            },
            {
                op: "fail",
                type: "FUNCTION BOOL ( LREF CLASS ifstream < > )",
                default(_rt: CRuntime, _templateTypes: [], l: IfStreamVariable): InitArithmeticVariable {
                    const failbit = l.v.members.failbit.v.value;
                    const badbit = l.v.members.badbit.v.value;
                    return variables.arithmetic("BOOL", failbit | badbit, null);
                }
            },
            {
                op: "bad",
                type: "FUNCTION BOOL ( LREF CLASS ifstream < > )",
                default(_rt: CRuntime, _templateTypes: [], l: IfStreamVariable): InitArithmeticVariable {
                    const badbit = l.v.members.badbit.v.value;
                    return variables.arithmetic("BOOL", badbit, null);
                }
            },
            {
                op: "eof",
                type: "FUNCTION BOOL ( LREF CLASS ifstream < > )",
                default(_rt: CRuntime, _templateTypes: [], l: IfStreamVariable): InitArithmeticVariable {
                    const eofbit = l.v.members.eofbit.v.value;
                    return variables.arithmetic("BOOL", eofbit, null);
                }
            },
        ]);

        common.regGlobalFuncs(rt, [
            {
                op: "getline",
                type: "FUNCTION LREF CLASS ifstream < > ( LREF CLASS ifstream < > CLREF CLASS string < > I8 )",
                default(rt: CRuntime, _templateTypes: [], input: IfStreamVariable, str: StringVariable, delim: ArithmeticVariable) {
                    _getlineStr(rt, input, str, delim);
                    return input;
                }
            },
            {
                op: "getline",
                type: "FUNCTION LREF CLASS ifstream < > ( LREF CLASS ifstream < > CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes: [], input: IfStreamVariable, str: StringVariable) {
                    _getlineStr(rt, input, str, variables.arithmetic("I8", 10, null));
                    return input;
                }
            },
        ]);

        const _open = function(_rt: CRuntime, _this: IfStreamVariable, right: InitIndexPointerVariable<ArithmeticVariable>): number {
            const fd = _rt.openFile(right, ios_base.openmode.in);

            if (fd !== -1) {
                variables.arithmeticAssign(rt, _this.v.members.fd, fd);
                _this.v.members._is_open.v.value = 1;
                variables.indexPointerAssign(rt, _this.v.members.buf, _rt.fileRead(_this.v.members.fd).v.pointee, 0);
            } else {
                _this.v.members.failbit.v.value = 1;
            }
            return fd;
        };
    }
};
