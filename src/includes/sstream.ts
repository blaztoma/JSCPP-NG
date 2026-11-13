import { CRuntime } from "../rt";
import { StringVariable } from "../shared/string_utils";
import * as ios_base from "../shared/ios_base";
import * as common from "../shared/common";
import * as utf8 from "../utf8";
import { AbstractVariable, ArithmeticBigVariable, ArithmeticNumVariable, ClassType, InitArithmeticBigVariable, InitArithmeticNumVariable, InitIndexPointerVariable, InitPointerVariable, MaybeLeft, Variable, variables } from "../variables";

type IStringStreamValue = ios_base.IStreamValue;
type IStringStreamVariable = AbstractVariable<ios_base.OStreamType, IStringStreamValue>;

export = {
    load(rt: CRuntime) {
        rt.include("cctype"); // gcc-specific

        if (!rt.varAlreadyDefined("endl")) {
            const endl = rt.getCharArrayFromString("\n");
            rt.addToNamespace("std", "endl", endl, true);
        }

        for (const structName of ["istringstream", "stringstream"]) {
            const charType = variables.arithmeticNumType("I8");
            rt.defineStruct("{global}", structName, [
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
            ], {});

            const whitespaceChars = [0, 9, 10, 11, 12, 13, 32];

            common.regOps(rt, [
                {
                    op: "o(!_)",
                    type: `FUNCTION BOOL ( LREF CLASS ${structName} < > )`,
                    default(_rt: CRuntime, _templateTypes, ...args: Variable[]): InitArithmeticNumVariable {
                        const [_this] = args as [IStringStreamVariable];
                        const failbit = _this.members.failbit.value;
                        const badbit = _this.members.badbit.value;
                        return variables.arithmeticNum("BOOL", failbit | badbit, null);
                    }
                },
                {
                    op: "o(_bool)",
                    type: `FUNCTION BOOL ( LREF CLASS ${structName} < > )`,
                    default(_rt: CRuntime, _templateTypes, ...args: Variable[]): ArithmeticNumVariable {
                        const [_this] = args as [IStringStreamVariable];
                        const failbit = _this.members.failbit.value;
                        const badbit = _this.members.badbit.value;
                        return variables.arithmeticNum("BOOL", (failbit !== 0 || badbit !== 0) ? 0 : 1, null);
                    }
                },
                {
                    op: "o(_>>_)",
                    type: `FUNCTION LREF CLASS ${structName} < > ( LREF CLASS ${structName} < > LREF Arithmetic )`,
                    default(_rt: CRuntime, _templateTypes, ...args: Variable[]): IStringStreamVariable {
                        const [l, r] = args as [IStringStreamVariable, ArithmeticNumVariable | ArithmeticBigVariable];
                        // TODO: this and istream functions share equal code. Merge into a single shared function
                        const buf = l.members.buf;
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
                            char = rt.arithmeticNumValue2(variables.arrayMember(buf.pointee, buf.index));
                            if (!(whitespaceChars.includes(char))) {
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
                                char = rt.arithmeticNumValue2(variables.arrayMember(buf.pointee, buf.index));
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
                        rt.adjustArithmeticAnyValue((r as InitArithmeticNumVariable | InitArithmeticBigVariable));
                        return l;
                    },
                },
                {
                    op: "o(_>>_)",
                    type: `FUNCTION LREF CLASS istream < > ( LREF CLASS ${structName} < > CLREF CLASS string < > )`,
                    default(rt: CRuntime, _templateTypes, ...args: Variable[]): IStringStreamVariable {
                        const [l, r] = args as [IStringStreamVariable, StringVariable];
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
                            variables.indexPointerAssignIndex(rt, buf, buf.index + 1);
                        }

                        let i = 0;
                        const memory = variables.arrayMemory<ArithmeticNumVariable>(variables.arithmeticNumType("I8"), []);
                        while (!(whitespaceChars.includes(char.value))) {
                            memory.values.push(variables.arithmeticNum("I8", char.value, { array: memory, index: i }));
                            variables.indexPointerAssignIndex(rt, buf, buf.index + 1);
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
                }
            ]);

            const thisType = (rt.simpleType([`${structName}`]) as MaybeLeft<ClassType>).t;

            const ctorHandler: common.OpHandler = {
                op: "o(_ctor)",
                type: `FUNCTION CLASS ${structName} < > ( CLREF CLASS string < > )`,
                default(_rt: CRuntime, _templateTypes, ...args: Variable[]): IStringStreamVariable {
                    const [s] = args as [StringVariable];
                    const result = rt.defaultValue(thisType, "SELF") as IStringStreamVariable;
                    const sbuf = variables.asInitIndexPointer(s.members._ptr) as InitIndexPointerVariable<ArithmeticNumVariable> | null;
                    if (sbuf !== null) {
                        variables.indexPointerAssign(rt, result.members.buf, sbuf.pointee, sbuf.index);
                    }

                    return result;
                }
            };

            rt.regFunc(ctorHandler.default, thisType, ctorHandler.op, rt.typeSignature(ctorHandler.type), [-1], null);

            function _getline(rt: CRuntime, l: IStringStreamVariable, _s: InitPointerVariable<ArithmeticNumVariable>, _count: ArithmeticNumVariable, _delim: ArithmeticNumVariable): IStringStreamVariable {
                let b = l.members.buf;
                const count = rt.arithmeticNumValue(_count);
                const delim = rt.arithmeticNumValue(_delim);
                const s = variables.asTrueIndexPointerOfElem(_s, variables.uninitArithmeticNum("I8", null));
                if (s === null) {
                    rt.raiseException("Unexpected null- or invalid pointer");
                }
                if (b.index >= b.pointee.values.length) {
                    variables.arithmeticNumAssign(rt, l.members.eofbit, 1);
                }
                let cnt = 0;
                while (cnt < count - 1) {
                    const si = rt.unbound(variables.arrayMember(s.pointee, s.index + cnt)) as ArithmeticNumVariable;
                    const bi = rt.arithmeticNumValue2(variables.arrayMember(b.pointee, b.index));
                    if (bi === delim || bi === 0) {
                        // consume the delimiter
                        variables.indexPointerAssignIndex(rt, b, b.index + 1);
                        variables.arithmeticNumAssign(rt, si, 0);
                        break;
                    }
                    variables.arithmeticNumAssign(rt, si, bi);
                    variables.indexPointerAssignIndex(rt, b, b.index + 1);
                    cnt++;
                }
                if (cnt === 0) {
                    variables.arithmeticNumAssign(rt, l.members.failbit, 1);
                }
                return l;
            }
            function _getlineStr(rt: CRuntime, l: IStringStreamVariable, s: StringVariable, _delim: ArithmeticNumVariable): void {
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
                        variables.indexPointerAssignIndex(rt, b, b.index + 1);
                        //variables.arithmeticAssign(rt, si, 0);
                        break;
                    }
                    memory.values.push(variables.arithmeticNum(i8type.sig, bi, { array: memory, index: cnt }));
                    variables.indexPointerAssignIndex(rt, b, b.index + 1);
                    cnt++;
                }
                memory.values.push(variables.arithmeticNum(i8type.sig, 0, { array: memory, index: cnt }));
                if (cnt === 0) {
                    variables.arithmeticNumAssign(rt, l.members.failbit, 1);
                }
                variables.indexPointerAssign(rt, s.members._ptr, memory, 0);
                s.members._size.value = cnt;
            }
            common.regMemberFuncs(rt, `${structName}`, [
                {
                    op: "get",
                    type: `FUNCTION I32 ( LREF CLASS ${structName} < > )`,
                    default(rt: CRuntime, _templateTypes, ...args: Variable[]): InitArithmeticNumVariable {
                        const [l] = args as [IStringStreamVariable];
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
                    op: "getline",
                    type: `FUNCTION LREF CLASS ${structName} < > ( LREF CLASS ${structName} < > PTR I8 I32 I8 )`,
                    default(rt: CRuntime, _templateTypes, ...args: Variable[]): IStringStreamVariable {
                        const [l, _s, _count, _delim] = args as [IStringStreamVariable, InitPointerVariable<ArithmeticNumVariable>, ArithmeticNumVariable, ArithmeticNumVariable];
                        return _getline(rt, l, _s, _count, _delim);
                    }
                },
                {
                    op: "getline",
                    type: `FUNCTION LREF CLASS ${structName} < > ( LREF CLASS ${structName} < > PTR I8 I32 )`,
                    default(rt: CRuntime, _templateTypes, ...args: Variable[]): IStringStreamVariable {
                        const [l, _s, _count] = args as [IStringStreamVariable, InitPointerVariable<ArithmeticNumVariable>, ArithmeticNumVariable];
                        return _getline(rt, l, _s, _count, variables.arithmeticNum("I8", 10, "SELF"));
                    }
                },
            ]);

            common.regGlobalFuncs(rt, [
                {
                    op: "getline",
                    type: `FUNCTION LREF CLASS sstream < > ( LREF CLASS ${structName} < > CLREF CLASS string < > I8 )`,
                    default(rt: CRuntime, _templateTypes, ...args: Variable[]): IStringStreamVariable {
                        const [input, str, delim] = args as [IStringStreamVariable, StringVariable, ArithmeticNumVariable];
                        _getlineStr(rt, input, str, delim);
                        return input;
                    }
                },
                {
                    op: "getline",
                    type: `FUNCTION LREF CLASS sstream < > ( LREF CLASS ${structName} < > CLREF CLASS string < > )`,
                    default(rt: CRuntime, _templateTypes, ...args: Variable[]): IStringStreamVariable {
                        const [input, str] = args as [IStringStreamVariable, StringVariable];
                        _getlineStr(rt, input, str, variables.arithmeticNum("I8", 10, null));
                        return input;
                    }
                },
            ]);
        }
    }
};



