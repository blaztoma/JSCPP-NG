import { asResult } from "../interpreter";
import { CRuntime, OpSignature } from "../rt";
import * as common from "../shared/common";
import { strcmp, StringType, StringVariable, strncmp } from "../shared/string_utils";
import { ArithmeticBigVariable, ArithmeticNumVariable, ClassVariable, Gen, InitArithmeticBigVariable, InitArithmeticNumValue, InitArithmeticNumVariable, InitIndexPointerVariable, InitPointerVariable, LValueIndexHolder, MaybeLeft, PointerVariable, ResultOrGen, Variable, variables } from "../variables";

export = {
    load(rt: CRuntime) {
        rt.include("cstddef");
        rt.defineStruct("{global}", "string", [
            {
                name: "_ptr",
                variable: variables.uninitPointer(variables.arithmeticNumType("I8"), null, "SELF"),
            },
            {
                name: "_size",
                variable: variables.arithmeticNum("I32", 0, "SELF")
            }
        ], {}, ((rt, x: StringVariable) => {
            const lptr = variables.asTrueIndexPointerOfElem(x.members._ptr, variables.uninitArithmeticNum("I8", null));
            if (lptr !== null) {
                return JSON.stringify(rt.getStringFromCharArray(lptr));
            } else {
                return "\"\"";
            }
        }) as (rt: CRuntime, x: ClassVariable) => string);

        rt.addToNamespace("std::string", "npos", variables.arithmeticNum("I32", -1, "SELF", true), true);

        function cmpOverloads(op: OpSignature, fn: (strcmpRetv: number) => boolean): common.OpHandler[] {
            return [{
                op,
                type: "FUNCTION BOOL ( CLREF CLASS string < > CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): InitArithmeticNumVariable {
                    const [l, r] = args as [StringVariable, StringVariable];
                    const lptr = variables.asTrueIndexPointerOfElem(l.members._ptr, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    const rptr = variables.asTrueIndexPointerOfElem(r.members._ptr, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    return variables.arithmeticNum("BOOL", fn(strncmp(rt, lptr, rptr, l.members._size.value)) ? 1 : 0, null);
                }
            },
            {
                op,
                type: "FUNCTION BOOL ( CLREF CLASS string < > PTR I8 )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): InitArithmeticNumVariable {
                    const [l, r] = args as [StringVariable, PointerVariable<ArithmeticNumVariable>];
                    const lptr = variables.asTrueIndexPointerOfElem(l.members._ptr, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    const rptr = variables.asTrueIndexPointerOfElem(r, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    return variables.arithmeticNum("BOOL", fn(strcmp(rt, lptr, rptr)) ? 1 : 0, null);
                }
            },
            {
                op,
                type: "FUNCTION BOOL ( PTR I8 CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): InitArithmeticNumVariable {
                    const [l, r] = args as [PointerVariable<ArithmeticNumVariable>, StringVariable];
                    const lptr = variables.asTrueIndexPointerOfElem(l, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    const rptr = variables.asTrueIndexPointerOfElem(r.members._ptr, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    return variables.arithmeticNum("BOOL", fn(strcmp(rt, lptr, rptr)) ? 1 : 0, null);
                }
            }];
        }

        common.regOps(rt, [
            {
                op: "o(_=_)",
                type: "FUNCTION LREF CLASS string < > ( LREF CLASS string < > PTR I8 )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): StringVariable {
                    const [l, _r] = args as [StringVariable, PointerVariable<ArithmeticNumVariable>];
                    const r = variables.asTrueIndexPointerOfElem(_r, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    let i: number = 0;
                    while (rt.arithmeticValue(variables.arrayMember(r.pointee, r.index + i)) !== 0) {
                        i++;
                    }
                    l.members._size.value = i;
                    variables.indexPointerAssign(rt, l.members._ptr, r.pointee, r.index);

                    return l;
                }
            },
            {
                op: "o(_=_)",
                type: "FUNCTION LREF CLASS string < > ( LREF CLASS string < > CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): StringVariable {
                    const [l, r] = args as [StringVariable, StringVariable];
                    l.members._size.value = r.members._size.value;
                    const rptr = variables.asTrueIndexPointerOfElem(r.members._ptr, variables.uninitArithmeticNum("I8", null));
                    if (rptr === null) {
                        l.members._ptr.pointee = null;
                        return l;
                    }
                    variables.indexPointerAssign(rt, l.members._ptr, rptr.pointee, rptr.index);
                    return l;
                },
                isOverrideOf: "!Class FUNCTION ?0 ( LREF ?0 CLREF ?0 )",
            },
            ...cmpOverloads("o(_==_)", (x) => x == 0),
            ...cmpOverloads("o(_!=_)", (x) => x != 0),
            ...cmpOverloads("o(_>=_)", (x) => x >= 0),
            ...cmpOverloads("o(_<=_)", (x) => x <= 0),
            ...cmpOverloads("o(_>_)", (x) => x > 0),
            ...cmpOverloads("o(_<_)", (x) => x < 0),
            {
                op: "o(_[_])",
                type: "FUNCTION LREF I8 ( LREF CLASS string < > I32 )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): ArithmeticNumVariable {
                    const [l, _idx] = args as [StringVariable, ArithmeticNumVariable];
                    const idx = rt.arithmeticNumValue(_idx);
                    if (idx < 0 || idx >= l.members._size.value) {
                        return variables.uninitArithmeticNum("I8", "SELF"); // C++11 behaviour
                    }
                    const lptr = variables.asTrueIndexPointerOfElem(l.members._ptr, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("unreachable");
                    return variables.arrayMember(lptr.pointee, lptr.index + idx) as ArithmeticNumVariable;
                }
            },
            {
                op: "o(_+_)",
                type: "FUNCTION CLASS string < > ( CLREF CLASS string < > CLREF CLASS string < > )",
                *default(rt: CRuntime, _templateTypes, ...args: Variable[]): Gen<StringVariable> {
                    const [l, r] = args as [StringVariable, StringVariable];
                    const strYield = rt.defaultValue2(thisType, "SELF") as ResultOrGen<StringVariable>;
                    const str = asResult(strYield) ?? (yield* strYield as Gen<StringVariable>);
                    const { ptr, size } = strConcat(rt, l, r.members._ptr, r.members._size.value);
                    str.members._ptr = ptr;
                    str.members._size.value = size;
                    return str;
                }
            },
            {
                op: "o(_+_)",
                type: "FUNCTION CLASS string < > ( CLREF CLASS string < > I8 )",
                *default(rt: CRuntime, _templateTypes, ...args: Variable[]): Gen<StringVariable> {
                    const [l, r] = args as [StringVariable, ArithmeticNumVariable];
                    const strYield = rt.defaultValue2(thisType, "SELF") as ResultOrGen<StringVariable>;
                    const str = asResult(strYield) ?? (yield* strYield as Gen<StringVariable>);
                    const memory = variables.arrayMemory<ArithmeticNumVariable>(variables.arithmeticNumType("I8"), []);
                    memory.values.push(variables.arithmeticNum("I8", rt.arithmeticNumValue(r), { array: memory, index: 0 }));
                    memory.values.push(variables.arithmeticNum("I8", 0, { array: memory, index: 0 }));
                    const { ptr, size } = strConcat(rt, l, variables.indexPointer(memory, 0, true, null), 1);
                    str.members._ptr = ptr;
                    str.members._size.value = size;
                    return str;
                }
            },
            {
                op: "o(_+=_)",
                type: "FUNCTION LREF CLASS string < > ( LREF CLASS string < > CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): StringVariable {
                    const [l, r] = args as [StringVariable, StringVariable];
                    const { ptr, size } = strConcat(rt, l, r.members._ptr, r.members._size.value);
                    l.members._ptr = ptr;
                    l.members._size.value = size;
                    return l;
                }
            },
            {
                op: "o(_+=_)",
                type: "FUNCTION LREF CLASS string < > ( LREF CLASS string < > I8 )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): StringVariable {
                    const [l, r] = args as [StringVariable, ArithmeticNumVariable];
                    const lptr = variables.asTrueIndexPointerOfElem(l.members._ptr, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    lptr.pointee.values[lptr.pointee.values.length - 1].state = "INIT";
                    (lptr.pointee.values[lptr.pointee.values.length - 1] as InitArithmeticNumValue).value = rt.arithmeticNumValue(r);
                    lptr.pointee.values.push(variables.arithmeticNum("I8", 0, { array: lptr.pointee, index: lptr.pointee.values.length }));
                    l.members._size.value++;
                    return l;
                }
            },
        ]);
        function strConcat(rt: CRuntime, l: StringVariable, _r: PointerVariable<ArithmeticNumVariable>, rsz: number): { size: number, ptr: InitIndexPointerVariable<ArithmeticNumVariable> } {
            const lptr = variables.asTrueIndexPointerOfElem(l.members._ptr, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Unexpected null-string " + (rt.getVariableNames(l)[0] ?? "<internal>"));
            const lsz = l.members._size.value;
            const rptr = variables.asTrueIndexPointerOfElem(_r, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Unexpected null- or invalid pointer " + (rt.getVariableNames(_r)[0] ?? "<internal>"));
            const memory = variables.arrayMemory<ArithmeticNumVariable>(variables.arithmeticNumType("I8"), []);
            for (let i = 0; i < lsz; i++) {
                const chr = rt.arithmeticNumValue2(variables.arrayMember(lptr.pointee, lptr.index + i));
                memory.values.push(variables.arithmeticNum("I8", chr, { array: memory, index: memory.values.length }));
            }
            for (let i = 0; i < rsz; i++) {
                const chr = rt.arithmeticNumValue2(variables.arrayMember(rptr.pointee, rptr.index + i));
                memory.values.push(variables.arithmeticNum("I8", chr, { array: memory, index: memory.values.length }));
            }
            memory.values.push(variables.arithmeticNum("I8", 0, { array: memory, index: memory.values.length }));
            return { size: memory.values.length - 1, ptr: variables.indexPointer(memory, 0, false, "SELF") };

        }
        const thisType = (rt.simpleType(["string"]) as MaybeLeft<StringType>).t;
        const ctorHandlers: common.OpHandler[] = [
            {
                op: "o(_ctor)",
                type: "FUNCTION CLASS string < > ( PTR I8 )",
                *default(rt: CRuntime, _templateTypes, ...args: Variable[]): Gen<StringVariable> {
                    const [_r] = args as [PointerVariable<ArithmeticNumVariable>];
                    const lYield = rt.defaultValue2(thisType, "SELF") as ResultOrGen<StringVariable>;
                    const l = asResult(lYield) ?? (yield* lYield as Gen<StringVariable>);
                    const r = variables.asTrueIndexPointerOfElem(_r, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Unexpected null- or invalid pointer " + (rt.getVariableNames(_r)[0] ?? "<internal>"));
                    let i: number = 0;
                    while (rt.arithmeticValue(variables.arrayMember(r.pointee, r.index + i)) !== 0) {
                        i++;
                    }
                    l.members._size.value = i;
                    variables.indexPointerAssign(rt, l.members._ptr, r.pointee, r.index);

                    return l;
                }
            },
            {
                op: "o(_ctor)",
                type: "FUNCTION CLASS string < > ( I32 I8 )",
                *default(rt: CRuntime, _templateTypes, ...args: Variable[]): Gen<StringVariable> {
                    const [_count, _ch] = args as [InitArithmeticNumVariable, InitArithmeticNumVariable];
                    const count = _count.value;
                    if (count < 0) {
                        rt.raiseException("string::string(): invalid size");
                    }
                    const ch = _ch.value;
                    const lYield = rt.defaultValue2(thisType, "SELF") as ResultOrGen<StringVariable>;
                    const l = asResult(lYield) ?? (yield* lYield as Gen<StringVariable>);
                    let memoryObject = variables.arrayMemory<ArithmeticNumVariable>({ sig: "I8" }, new Array<ArithmeticNumVariable>());
                    for (let i = 0; i < count; i++) {
                        const lvHolder: LValueIndexHolder<ArithmeticNumVariable> = { array: memoryObject, index: i };
                        memoryObject.values.push(variables.arithmeticNum("I8", ch, lvHolder, false));
                    }
                    l.members._size.value = count;
                    l.members._ptr = variables.indexPointer(memoryObject, 0, true, null, false);

                    return l;
                }
            }
        ];
        for (const ctorHandler of ctorHandlers) {
            rt.regFunc(ctorHandler.default, thisType, ctorHandler.op, rt.typeSignature(ctorHandler.type), [-1], null);
        }

        // Search byte sequences, including embedded NULs in string/count overloads.
        function findText(rt: CRuntime, text: StringVariable, needle: number[], pos: number): InitArithmeticNumVariable {
            const size = text.members._size.value;
            if (pos < 0 || pos > size) return variables.arithmeticNum("I32", -1, null);
            if (needle.length === 0) return variables.arithmeticNum("I32", pos, null);
            const ptr = variables.asTrueIndexPointerOfElem(text.members._ptr, variables.uninitArithmeticNum("I8", null));
            if (ptr !== null) {
                for (let i = pos; i + needle.length <= size; i++) {
                    let matched = true;
                    for (let j = 0; j < needle.length; j++) {
                        if (rt.arithmeticNumValue2(variables.arrayMember(ptr.pointee, ptr.index + i + j)) !== needle[j]) {
                            matched = false;
                            break;
                        }
                    }
                    if (matched) return variables.arithmeticNum("I32", i, null);
                }
            }
            return variables.arithmeticNum("I32", -1, null);
        }
        function needleBytes(rt: CRuntime, value: Variable, count?: number): number[] {
            if (value.t.sig === "I8") return [rt.arithmeticNumValue2(value as ArithmeticNumVariable)];
            if (value.t.sig === "CLASS") {
                const text = value as StringVariable;
                return needleBytes(rt, text.members._ptr, text.members._size.value);
            }
            if (count !== undefined && count < 0) rt.raiseException("string::find(): invalid character count");
            if (count === 0) return [];
            const ptr = variables.asTrueIndexPointerOfElem(value, variables.uninitArithmeticNum("I8", null))
                ?? rt.raiseException("string::find(): expected a valid character pointer");
            const bytes: number[] = [];
            for (let i = 0; count === undefined || i < count; i++) {
                const byte = rt.arithmeticNumValue2(variables.arrayMember(ptr.pointee, ptr.index + i));
                if (count === undefined && byte === 0) break;
                bytes.push(byte);
            }
            return bytes;
        }
        const findHandlers: common.FunHandler[] = [];
        for (const needleType of ["I8", "PTR I8", "CLREF CLASS string < >"]) {
            for (const withPosition of [false, true]) {
                findHandlers.push({
                    op: "find",
                    type: "FUNCTION I32 ( CLREF CLASS string < > " + needleType + (withPosition ? " I32" : "") + " )",
                    default(rt: CRuntime, _types, ...args: Variable[]): InitArithmeticNumVariable {
                        return findText(rt, args[0] as StringVariable, needleBytes(rt, args[1]),
                            withPosition ? rt.arithmeticNumValue2(args[2] as ArithmeticNumVariable) : 0);
                    }
                });
            }
        }
        findHandlers.push({
            op: "find",
            type: "FUNCTION I32 ( CLREF CLASS string < > PTR I8 I32 I32 )",
            default(rt: CRuntime, _types, ...args: Variable[]): InitArithmeticNumVariable {
                return findText(rt, args[0] as StringVariable, needleBytes(rt, args[1], rt.arithmeticNumValue2(args[3] as ArithmeticNumVariable)), rt.arithmeticNumValue2(args[2] as ArithmeticNumVariable));
            }
        });

        common.regMemberFuncs(rt, "string", [
            {
                op: "empty",
                type: "FUNCTION BOOL ( CLREF CLASS string < > )",
                default(_rt: CRuntime, _templateTypes, ...args: Variable[]): InitArithmeticNumVariable {
                    const [l] = args as [StringVariable];
                    return variables.arithmeticNum("BOOL", l.members._size.value === 0 ? 1 : 0, null);
                }
            },
            {
                op: "begin",
                type: "FUNCTION PTR I8 ( CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): InitIndexPointerVariable<ArithmeticNumVariable> {
                    const [l] = args as [StringVariable];
                    const lptr = variables.asTrueIndexPointerOfElem(l.members._ptr, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Unexpected null-string " + (rt.getVariableNames(l)[0] ?? "<internal>"));
                    return variables.indexPointer(lptr.pointee, lptr.index, false, null);
                }
            },
            {
                op: "substr",
                type: "FUNCTION CLASS string < > ( CLREF CLASS string < > I32 I32 )",
                *default(rt: CRuntime, _templateTypes, ...args: Variable[]): Gen<StringVariable> {
                    const [l, pos, count] = args as [StringVariable, InitArithmeticNumVariable, InitArithmeticNumVariable];
                    const lptr = variables.asTrueIndexPointerOfElem(l.members._ptr, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Unexpected null-string " + (rt.getVariableNames(l)[0] ?? "<internal>"));
                    const strYield = rt.defaultValue2(thisType, "SELF") as ResultOrGen<StringVariable>;
                    const str = asResult(strYield) ?? (yield* strYield as Gen<StringVariable>);
                    if (l.members._size.value < pos.value) {
                        rt.raiseException(`string::substr(): start position (${pos.value}) is greater than the size of string (${l.members._size.value})`);
                    }
                    str.members._ptr = variables.indexPointer(lptr.pointee, lptr.index + pos.value, false, "SELF");
                    str.members._size.value = count.value === -1 ? l.members._size.value - pos.value : Math.min(l.members._size.value - pos.value, count.value);
                    return str;
                }
            },
            {
                op: "substr",
                type: "FUNCTION CLASS string < > ( CLREF CLASS string < > I32 )",
                *default(rt: CRuntime, _templateTypes, ...args: Variable[]): Gen<StringVariable> {
                    const [l, pos] = args as [StringVariable, InitArithmeticNumVariable];
                    const lptr = variables.asTrueIndexPointerOfElem(l.members._ptr, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Unexpected null-string " + (rt.getVariableNames(l)[0] ?? "<internal>"));
                    const strYield = rt.defaultValue2(thisType, "SELF") as ResultOrGen<StringVariable>;
                    const str = asResult(strYield) ?? (yield* strYield as Gen<StringVariable>);
                    if (l.members._size.value < pos.value) {
                        rt.raiseException(`string::substr(): start position (${pos.value}) is greater than the size of string (${l.members._size.value})`);
                    }
                    str.members._ptr = variables.indexPointer(lptr.pointee, lptr.index + pos.value, false, "SELF");
                    str.members._size.value = l.members._size.value - pos.value;
                    return str;
                }
            },
            {
                op: "substr",
                type: "FUNCTION CLASS string < > ( CLREF CLASS string < > )",
                *default(rt: CRuntime, _templateTypes, ...args: Variable[]): Gen<StringVariable> {
                    const [l] = args as [StringVariable];
                    const lptr = variables.asTrueIndexPointerOfElem(l.members._ptr, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Unexpected null-string " + (rt.getVariableNames(l)[0] ?? "<internal>"));
                    const strYield = rt.defaultValue2(thisType, "SELF") as ResultOrGen<StringVariable>;
                    const str = asResult(strYield) ?? (yield* strYield as Gen<StringVariable>);
                    str.members._ptr = variables.indexPointer(lptr.pointee, lptr.index, false, "SELF");
                    str.members._size.value = l.members._size.value;
                    return str;
                }
            },
            ...findHandlers,
            {
                op: "replace",
                type: "FUNCTION LREF CLASS string < > ( LREF CLASS string < > I32 I32 CLREF CLASS string < > )",
                *default(rt: CRuntime, _templateTypes, ...args: Variable[]): Gen<StringVariable> {
                    const [l, pos, count, r] = args as [StringVariable, InitArithmeticNumVariable, InitArithmeticNumVariable, StringVariable];
                    const lptr = variables.asTrueIndexPointerOfElem(l.members._ptr, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Unexpected null-string " + (rt.getVariableNames(l)[0] ?? "<internal>"));
                    const rptr = variables.asTrueIndexPointerOfElem(r.members._ptr, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Unexpected null-string " + (rt.getVariableNames(r)[0] ?? "<internal>"));
                    const lsz = l.members._size.value;
                    const rsz = r.members._size.value;
                    l.members._ptr = variables.indexPointer(variables.arrayMemory<ArithmeticNumVariable>(variables.arithmeticNumType("I8"), []), 0, false, "SELF");
                    l.members._size.value = 0;
                    {
                        const { size, ptr } = strConcat(rt, l, lptr, pos.value)
                        l.members._ptr = ptr;
                        l.members._size.value = size;
                    }
                    {
                        const { size, ptr } = strConcat(rt, l, rptr, rsz)
                        l.members._ptr = ptr;
                        l.members._size.value = size;
                    }
                    {
                        const start = pos.value + count.value;
                        const { size, ptr } = strConcat(rt, l, variables.indexPointer(lptr.pointee, lptr.index + start, false, null), lsz - start);
                        l.members._ptr = ptr;
                        l.members._size.value = size;
                    }
                    return l;
                }
            },
            {
                op: "end",
                type: "FUNCTION PTR I8 ( CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): InitIndexPointerVariable<ArithmeticNumVariable> {
                    const [l] = args as [StringVariable];
                    const lptr = variables.asTrueIndexPointerOfElem(l.members._ptr, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Unexpected null-string " + (rt.getVariableNames(l)[0] ?? "<internal>"));
                    return variables.indexPointer(lptr.pointee, lptr.index + l.members._size.value, false, null);
                }
            },
            {
                op: "front",
                type: "FUNCTION LREF I8 ( CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): ArithmeticNumVariable {
                    const [l] = args as [StringVariable];
                    if (l.members._size.value === 0) {
                        return variables.uninitArithmeticNum("I8", "SELF"); // C++11 behaviour
                    }
                    const lptr = variables.asTrueIndexPointerOfElem(l.members._ptr, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Unexpected null-string " + (rt.getVariableNames(l)[0] ?? "<internal>"));
                    return variables.arrayMember(lptr.pointee, lptr.index) as ArithmeticNumVariable;
                }
            },
            {
                op: "pop_back",
                type: "FUNCTION VOID ( LREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): "VOID" {
                    const [l] = args as [StringVariable];
                    const size = l.members._size.value;
                    if (size === 0) {
                        rt.raiseException("string::pop_back(): string is empty");
                    }
                    const lptr = variables.asTrueIndexPointerOfElem(l.members._ptr, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Unexpected null-string " + (rt.getVariableNames(l)[0] ?? "<internal>"));
                    const newSize = size - 1;
                    l.members._size.value = newSize;
                    const nullChar = variables.arithmeticNum("I8", 0, { array: lptr.pointee, index: lptr.index + newSize });
                    lptr.pointee.values[lptr.index + newSize] = nullChar;
                    return "VOID";
                }
            },
            {
                op: "back",
                type: "FUNCTION LREF I8 ( CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): ArithmeticNumVariable {
                    const [l] = args as [StringVariable];
                    const size = l.members._size.value;
                    if (size === 0) {
                        return variables.uninitArithmeticNum("I8", "SELF"); // C++11 behaviour
                    }
                    const lptr = variables.asTrueIndexPointerOfElem(l.members._ptr, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Unexpected null-string " + (rt.getVariableNames(l)[0] ?? "<internal>"));
                    return variables.arrayMember(lptr.pointee, lptr.index + size - 1) as ArithmeticNumVariable;
                }
            },
            {
                op: "data",
                type: "FUNCTION PTR I8 ( CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): InitPointerVariable<ArithmeticNumVariable> {
                    const [l] = args as [StringVariable];
                    const size = l.members._size.value;
                    if (size === 0) {
                        return variables.directPointer(variables.uninitArithmeticNum("I8", "SELF"), null); // C++11 behaviour
                    }
                    return variables.asInitIndexPointerOfElem(l.members._ptr, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                }
            },
            {
                op: "c_str",
                type: "FUNCTION PTR I8 ( CLREF CLASS string < > )",
                default(_rt: CRuntime, _templateTypes, ...args: Variable[]): PointerVariable<ArithmeticNumVariable> {
                    const [l] = args as [StringVariable];
                    return l.members._ptr;
                }
            },
            {
                op: "length",
                type: "FUNCTION I32 ( CLREF CLASS string < > )",
                default(_rt: CRuntime, _templateTypes, ...args: Variable[]): InitArithmeticNumVariable {
                    const [l] = args as [StringVariable];
                    return variables.arithmeticNum("I32", l.members._size.value, null);
                }
            },
            {
                op: "size",
                type: "FUNCTION I32 ( CLREF CLASS string < > )",
                default(_rt: CRuntime, _templateTypes, ...args: Variable[]): InitArithmeticNumVariable {
                    const [l] = args as [StringVariable];
                    return variables.arithmeticNum("I32", l.members._size.value, null);
                }
            },
        ]);

        const whitespaceChars = [9, 10, 32];
        const ascii_plusSign: number = 0x2B;
        const ascii_minusSign: number = 0x2D;
        const ascii_0: number = 0x30;
        const ascii_9: number = 0x39;
        const ascii_fullStop: number = 0x2E;
        const ascii_e: number = 0x65;

        function stox(rt: CRuntime, l: StringVariable, mode: "I32" | "U32" | "F32" | "F64"): InitArithmeticNumVariable | null {
            const lptr = variables.asTrueIndexPointerOfElem(l.members._ptr, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Unexpected null-string " + (rt.getVariableNames(l)[0] ?? "<internal>"));
            const limits = variables.arithmeticProperties[mode];
            let chr: number;
            let ci: number = -1;
            while ((chr = rt.arithmeticNumValue2(variables.arrayMember(lptr.pointee, lptr.index + ++ci))) !== 0) {
                if (!whitespaceChars.includes(chr)) {
                    break;
                }
            }
            if (chr === 0) {
                return null;
            }
            let mult: number = 1;
            switch (chr) {
                case ascii_plusSign:
                    chr = rt.arithmeticNumValue2(variables.arrayMember(lptr.pointee, lptr.index + ++ci));
                    mult = 1;
                    break;
                case ascii_minusSign:
                    if (!limits.isSigned) {
                        return null;
                    }
                    chr = rt.arithmeticNumValue2(variables.arrayMember(lptr.pointee, lptr.index + ++ci));
                    mult = -1;
                    break;
                case 0:
                    return null;
            }
            let x: number = 0;
            while (chr >= ascii_0 && chr <= ascii_9) {
                x *= 10;
                x += chr - ascii_0;
                chr = rt.arithmeticNumValue2(variables.arrayMember(lptr.pointee, lptr.index + ++ci));
            }
            if (limits.isFloat && chr === ascii_fullStop) {
                chr = rt.arithmeticNumValue2(variables.arrayMember(lptr.pointee, lptr.index + ++ci));
                let q = 0.1;
                while (chr >= ascii_0 && chr <= ascii_9) {
                    x += q * (chr - ascii_0);
                    q *= 0.1;
                    chr = rt.arithmeticNumValue2(variables.arrayMember(lptr.pointee, lptr.index + ++ci));
                }
            }
            if (limits.isFloat && chr === ascii_e) {
                let emul = 1;
                chr = rt.arithmeticNumValue2(variables.arrayMember(lptr.pointee, lptr.index + ++ci));
                switch (chr) {
                    case ascii_plusSign:
                        chr = rt.arithmeticNumValue2(variables.arrayMember(lptr.pointee, lptr.index + ++ci));
                        emul = 1;
                        break;
                    case ascii_minusSign:
                        chr = rt.arithmeticNumValue2(variables.arrayMember(lptr.pointee, lptr.index + ++ci));
                        emul = -1;
                        break;
                    case 0:
                        return null;
                }
                let ex = 0;
                while (chr >= ascii_0 && chr <= ascii_9) {
                    ex *= 10;
                    ex += chr - ascii_0;
                    chr = rt.arithmeticNumValue2(variables.arrayMember(lptr.pointee, lptr.index + ++ci));
                }
                if (ex === 0) {
                    return null;
                }
                x *= Math.pow(10, ex * emul);
            }
            x *= mult;
            if (x >= limits.minv && x <= limits.maxv) {
                return variables.arithmeticNum(mode, x, null);
            } else {
                rt.raiseException("stoi/stol/stoul/stof/stod: The number is out of range.")
            }
        }

        function stox_big(rt: CRuntime, l: StringVariable, mode: "I64" | "U64"): InitArithmeticBigVariable | null {
            const lptr = variables.asTrueIndexPointerOfElem(l.members._ptr, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Unexpected null-string " + (rt.getVariableNames(l)[0] ?? "<internal>"));
            const limits = variables.arithmeticProperties[mode];
            let chr: number;
            let ci: number = -1;
            while ((chr = rt.arithmeticNumValue2(variables.arrayMember(lptr.pointee, lptr.index + ++ci))) !== 0) {
                if (!whitespaceChars.includes(chr)) {
                    break;
                }
            }
            if (chr === 0) {
                return null;
            }
            let mult: number = 1;
            switch (chr) {
                case ascii_plusSign:
                    chr = rt.arithmeticNumValue2(variables.arrayMember(lptr.pointee, lptr.index + ++ci));
                    mult = 1;
                    break;
                case ascii_minusSign:
                    if (!limits.isSigned) {
                        return null;
                    }
                    chr = rt.arithmeticNumValue2(variables.arrayMember(lptr.pointee, lptr.index + ++ci));
                    mult = -1;
                    break;
                case 0:
                    return null;
            }
            let x: bigint = BigInt(0);
            while (chr >= ascii_0 && chr <= ascii_9) {
                x *= BigInt(10);
                x += BigInt(chr - ascii_0);
                chr = rt.arithmeticNumValue2(variables.arrayMember(lptr.pointee, lptr.index + ++ci));
            }
            if (limits.isFloat && chr === ascii_fullStop) {
                chr = rt.arithmeticNumValue2(variables.arrayMember(lptr.pointee, lptr.index + ++ci));
                let q = 0.1;
                while (chr >= ascii_0 && chr <= ascii_9) {
                    x += BigInt(q * (chr - ascii_0));
                    q *= 0.1;
                    chr = rt.arithmeticNumValue2(variables.arrayMember(lptr.pointee, lptr.index + ++ci));
                }
            }
            if (limits.isFloat && chr === ascii_e) {
                let emul = 1;
                chr = rt.arithmeticNumValue2(variables.arrayMember(lptr.pointee, lptr.index + ++ci));
                switch (chr) {
                    case ascii_plusSign:
                        chr = rt.arithmeticNumValue2(variables.arrayMember(lptr.pointee, lptr.index + ++ci));
                        emul = 1;
                        break;
                    case ascii_minusSign:
                        chr = rt.arithmeticNumValue2(variables.arrayMember(lptr.pointee, lptr.index + ++ci));
                        emul = -1;
                        break;
                    case 0:
                        return null;
                }
                let ex = 0;
                while (chr >= ascii_0 && chr <= ascii_9) {
                    ex *= 10;
                    ex += chr - ascii_0;
                    chr = rt.arithmeticNumValue2(variables.arrayMember(lptr.pointee, lptr.index + ++ci));
                }
                if (ex === 0) {
                    return null;
                }
                x *= BigInt(10) ** BigInt(ex * emul);
            }
            x *= BigInt(mult);
            if (x >= limits.minv && x <= limits.maxv) {
                return variables.arithmeticBig(mode, x, null);
            } else {
                rt.raiseException("stoll/stoull: The number is out of range.")
            }
        }

        function* integer_to_string(rt: CRuntime, l: ArithmeticNumVariable): Gen<StringVariable> {
            const memory = variables.arrayMemory<ArithmeticNumVariable>(variables.arithmeticNumType("I8"), []);
            let x = rt.arithmeticNumValue(l);
            if (x < 0) {
                memory.values.push(variables.arithmeticNum("I8", ascii_minusSign, { array: memory, index: memory.values.length }));
                x = -x;
            }
            if (x === 0) {
                memory.values.push(variables.arithmeticNum("I8", ascii_0, { array: memory, index: memory.values.length }));
            } else {
                let digits = new Array<number>();
                while (x > 0) {
                    digits.push(x % 10);
                    x = Math.floor(x / 10);
                }
                for (const d of digits.reverse()) {
                    memory.values.push(variables.arithmeticNum("I8", ascii_0 + d, { array: memory, index: memory.values.length }));
                }
            }
            memory.values.push(variables.arithmeticNum("I8", 0, { array: memory, index: memory.values.length }));
            const strYield = rt.defaultValue2(thisType, "SELF") as ResultOrGen<StringVariable>;
            const str = asResult(strYield) ?? (yield* strYield as Gen<StringVariable>);
            str.members._ptr = variables.indexPointer(memory, 0, false, "SELF");
            str.members._size.value = memory.values.length - 1;
            return str;
        }
        function* integer_to_string_big(rt: CRuntime, l: ArithmeticBigVariable): Gen<StringVariable> {
            const memory = variables.arrayMemory<ArithmeticNumVariable>(variables.arithmeticNumType("I8"), []);
            let x: bigint = rt.arithmeticValue(l) as bigint;
            if (x < 0) {
                memory.values.push(variables.arithmeticNum("I8", ascii_minusSign, { array: memory, index: memory.values.length }));
                x = -x;
            }
            if (x === BigInt(0)) {
                memory.values.push(variables.arithmeticNum("I8", ascii_0, { array: memory, index: memory.values.length }));
            } else {
                let digits = new Array<number>();
                while (x > 0) {
                    digits.push(Number(x % BigInt(10)));
                    x /= BigInt(10);
                }
                for (const d of digits.reverse()) {
                    memory.values.push(variables.arithmeticNum("I8", ascii_0 + d, { array: memory, index: memory.values.length }));
                }
            }
            memory.values.push(variables.arithmeticNum("I8", 0, { array: memory, index: memory.values.length }));
            const strYield = rt.defaultValue2(thisType, "SELF") as ResultOrGen<StringVariable>;
            const str = asResult(strYield) ?? (yield* strYield as Gen<StringVariable>);
            str.members._ptr = variables.indexPointer(memory, 0, false, "SELF");
            str.members._size.value = memory.values.length - 1;
            return str;
        }

        common.regGlobalFuncs(rt, [
            {
                op: "stoi",
                type: "FUNCTION I32 ( CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): InitArithmeticNumVariable {
                    const [l] = args as [StringVariable];
                    return stox(rt, l, "I32") ?? rt.raiseException("stoi: Invalid argument (expected a string containing a number)");

                }
            },
            {
                op: "stol",
                type: "FUNCTION I32 ( CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): InitArithmeticNumVariable {
                    const [l] = args as [StringVariable];
                    return stox(rt, l, "I32") ?? rt.raiseException("stol: Invalid argument (expected a string containing a number)");

                }
            },
            {
                op: "stoul",
                type: "FUNCTION U32 ( CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): InitArithmeticNumVariable {
                    const [l] = args as [StringVariable];
                    return stox(rt, l, "U32") ?? rt.raiseException("stol: Invalid argument (expected a string containing a number)");

                }
            },
            {
                op: "stoll",
                type: "FUNCTION I64 ( CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): InitArithmeticBigVariable {
                    const [l] = args as [StringVariable];
                    return stox_big(rt, l, "I64") ?? rt.raiseException("stoll: Invalid argument (expected a string containing a number)");

                }
            },
            {
                op: "stoull",
                type: "FUNCTION U64 ( CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): InitArithmeticBigVariable {
                    const [l] = args as [StringVariable];
                    return stox_big(rt, l, "U64") ?? rt.raiseException("stoull: Invalid argument (expected a string containing a number)");

                }
            },
            {
                op: "stof",
                type: "FUNCTION F32 ( CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): InitArithmeticNumVariable {
                    const [l] = args as [StringVariable];
                    return stox(rt, l, "F32") ?? rt.raiseException("stoll: Invalid argument (expected a string containing a number)");

                }
            },
            {
                op: "stod",
                type: "FUNCTION F64 ( CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): InitArithmeticNumVariable {
                    const [l] = args as [StringVariable];
                    return stox(rt, l, "F64") ?? rt.raiseException("stoll: Invalid argument (expected a string containing a number)");

                }
            },
            {
                op: "to_string",
                type: "FUNCTION CLASS string < > ( I32 )",
                *default(rt: CRuntime, _templateTypes, ...args: Variable[]): Gen<StringVariable> {
                    const [l] = args as [ArithmeticNumVariable];
                    return yield* integer_to_string(rt, l);
                }
            },
            {
                op: "to_string",
                type: "FUNCTION CLASS string < > ( U32 )",
                *default(rt: CRuntime, _templateTypes, ...args: Variable[]): Gen<StringVariable> {
                    const [l] = args as [ArithmeticNumVariable];
                    return yield* integer_to_string(rt, l);
                }
            },
            {
                op: "to_string",
                type: "FUNCTION CLASS string < > ( I64 )",
                *default(rt: CRuntime, _templateTypes, ...args: Variable[]): Gen<StringVariable> {
                    const [l] = args as [ArithmeticBigVariable];
                    return yield* integer_to_string_big(rt, l);
                }
            },
            {
                op: "to_string",
                type: "FUNCTION CLASS string < > ( U64 )",
                *default(rt: CRuntime, _templateTypes, ...args: Variable[]): Gen<StringVariable> {
                    const [l] = args as [ArithmeticBigVariable];
                    return yield* integer_to_string_big(rt, l);
                }
            },
        ])

    }
}



