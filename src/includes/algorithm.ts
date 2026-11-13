import { asResult } from "../interpreter";
import { CRuntime, FunctionCallInstance, OpSignature } from "../rt";
import * as common from "../shared/common";
import { PairVariable } from "../shared/utility";
import { InitIndexPointerVariable, PointeeVariable, PointerVariable, Function, Variable, variables, InitArithmeticVariable, Gen, MaybeUnboundVariable, ResultOrGen, MaybeLeftCV, ObjectType, ArithmeticVariable, PointerType, ClassVariable, InitArithmeticNumVariable, TrueIndexPointerVariable, TrueDirectPointerVariable, LValueIndexHolder } from "../variables";

export = {
    load(rt: CRuntime) {
        rt.include("utility");

        function yieldBlocking(x: ResultOrGen<MaybeUnboundVariable | "VOID">): InitArithmeticNumVariable {
            if (asResult(x)) {
                if (x === "VOID") {
                    rt.raiseException("sort: expected arithmetic result, got VOID");
                }
                return variables.asInitArithmeticNum(rt.unbound(x as MaybeUnboundVariable)) ?? rt.raiseException("sort: expected arithmetic result");
            } else {
                const call = x as Gen<MaybeUnboundVariable | "VOID">;
                for (let i: number = 0; i < 100_000; i++) {
                    const _retv = call.next();
                    if (_retv.done === true) {
                        if (_retv.value === "VOID") {
                            rt.raiseException("sort: expected arithmetic result, got VOID");
                        }
                        return variables.asInitArithmeticNum(rt.unbound(_retv.value)) ?? rt.raiseException("sort: expected arithmetic result");
                    }
                }
            }
            rt.raiseException("<internal>: failed to invoke a given function (runtime limit exceeded)");
        }


        function sort_inner(rt: CRuntime, _l: PointerVariable<PointeeVariable>, _r: PointerVariable<PointeeVariable>, _cmp: PointerVariable<Function> | ClassVariable | null = null): "VOID" {
            if (_l.t.pointee.sig === "FUNCTION" || _r.t.pointee.sig === "FUNCTION") {
                rt.raiseException("sort: invalid argument")
            }
            const l: TrueIndexPointerVariable<Variable> = variables.asTrueIndexPointer(_l) ?? rt.raiseException("sort: expected a pointer to a memory region for the parameter 'first'");
            const r: TrueIndexPointerVariable<Variable> = variables.asTrueIndexPointer(_r) ?? rt.raiseException("sort: expected a pointer to a memory region for the parameter 'last'");
            if (l.pointee !== r.pointee) {
                rt.raiseException("sort: expected parameters 'first' and 'last' to point to a same memory region");
            }
            // alt. variant: variables.arrayMember(...)
            const region = l.pointee.values.slice(l.index, r.index - l.index);
            if (region.length === 0) {
                return "VOID";
            }
            let indexRegion: number[] = [];
            for (let i = 0; i < region.length; i++) {
                indexRegion.push(i);
            }
            const clref_t: MaybeLeftCV<ObjectType> = { t: l.pointee.objectType, isConst: true, lvHolder: "SELF" };
            const cmpObj = _cmp !== null ? variables.asClass(_cmp) : null;
            const cmpFun = (_cmp !== null) ? (variables.asTrueDirectPointer(_cmp) as TrueDirectPointerVariable<Function> ?? null) : null;
            const ltFun = (cmpFun === null) ? (cmpObj ? rt.getOpByParams("{global}", "o(_call)", [cmpObj, clref_t, clref_t], []) : rt.getFuncByParams("{global}", "o(_<_)", [clref_t, clref_t], [])) : null;
            function sortCmp(li: number, ri: number): number {
                // JavaScript specifically wants a symmetrical comparator, so we compare both sides
                // these return 0.0 or 1.0
                const lhs = region[li];
                const rhs = region[ri];
                const params_ab = (cmpObj !== null) ? [cmpObj, lhs, rhs] : [lhs, rhs];
                const params_ba = (cmpObj !== null) ? [cmpObj, rhs, lhs] : [rhs, lhs];
                const a_lt_b = yieldBlocking(cmpFun !== null ? rt.invokeCallFromVariable(cmpFun.pointee, lhs, rhs) : rt.invokeCall(ltFun as FunctionCallInstance, [], ...params_ab)).value;
                const b_lt_a = yieldBlocking(cmpFun !== null ? rt.invokeCallFromVariable(cmpFun.pointee, rhs, lhs) : rt.invokeCall(ltFun as FunctionCallInstance, [], ...params_ba)).value;
                // return -2.0, 0.0, or 2.0
                return b_lt_a - a_lt_b;

            }
            indexRegion.sort(sortCmp);
            indexRegion.forEach((ri, ci) => {
                const lvHolder = l.pointee.values[l.index + ci].lvHolder as LValueIndexHolder<Variable>;
                (lvHolder as any).index = l.index + ci;
                l.pointee.values[l.index + ci] = {
                    ...region[ri],
                    lvHolder
                } as Variable;
            });
            return "VOID";
        }
        function* extreme_element(rt: CRuntime, _first: PointerVariable<PointeeVariable>, _last: PointerVariable<PointeeVariable>, fnname: string, op: OpSignature): Gen<TrueIndexPointerVariable<Variable>> {
            const first = variables.asTrueIndexPointer(_first) ?? rt.raiseException(fnname + "(): Expected 'first' to point to an element");
            const last = variables.asTrueIndexPointer(_last) ?? rt.raiseException(fnname + "(): Expected 'last' to point to an element");
            if (first.pointee !== last.pointee) {
                rt.raiseException(fnname + "(): Expected 'first' and 'last' to point to an element of the same memory region");
            }
            const mini = variables.indexPointer(first.pointee, first.index++, false, null);
            const cmpInst = rt.getOpByParams("{global}", op, [rt.unbound(variables.deref(first) as MaybeUnboundVariable), rt.unbound(variables.deref(mini) as MaybeUnboundVariable)], []);
            for (; first.index < last.index; first.index++) {
                const cmpYield = rt.invokeCall(cmpInst, [], rt.unbound(variables.deref(first) as MaybeUnboundVariable), rt.unbound(variables.deref(mini) as MaybeUnboundVariable)) as ResultOrGen<ArithmeticVariable>;
                const cmpResult = rt.arithmeticValue(asResult(cmpYield) ?? (yield* cmpYield as Gen<ArithmeticVariable>))
                if (cmpResult !== 0) {
                    mini.index = first.index;
                }
            }
            return mini;
        }
        // Unary and binary transform share iterator operations with the other algorithms.
        // Yield through callbacks so interactive input, stepping and cancellation still work.
        function* transform_inner(rt: CRuntime, first: Variable, last: Variable,
            second: Variable | null, output: Variable, operation: Variable): Gen<Variable> {
            // Array arguments must decay to independent iterator values. Advancing
            // them must never move the caller's array/pointer or clone its elements.
            function copyIterator(value: Variable): Variable {
                const ptr = variables.asInitIndexPointer(value);
                if (ptr !== null) return ptr.pointee === null
                    ? variables.indexNullPointer(ptr.t.pointee, ptr.index, "SELF")
                    : variables.indexPointer(ptr.pointee, ptr.index, false, "SELF");
                return variables.clone(rt, value, "SELF");
            }
            first = copyIterator(first);
            last = copyIterator(last);
            output = copyIterator(output);
            if (second !== null) second = copyIterator(second);
            const inputOps = getIterSymbols(first, last);
            const outputOps = getIterSymbols(output, output);
            const secondOps = second === null ? null : getIterSymbols(second, second);
            const direct = variables.asTrueDirectPointer(operation);
            const fn = variables.asFunction(operation) ?? (direct === null ? null : variables.asFunction(direct.pointee));
            const object = variables.asClass(operation);
            if (fn === null && object === null) rt.raiseException("transform(): expected a callable operation");
            while (yield* common.invokeCmp(rt, inputOps.neq, first, last)) {
                const values = [yield* common.invokeDeref(rt, "transform", inputOps.deref, first)];
                if (second !== null && secondOps !== null) {
                    values.push(yield* common.invokeDeref(rt, "transform", secondOps.deref, second));
                }
                const call = fn !== null ? rt.invokeCallFromVariable(fn, ...values)
                    : rt.invokeCall(rt.getOpByParams("{global}", "o(_call)", [object!, ...values], []), [], object!, ...values);
                const value = asResult(call) ?? (yield* call as Gen<MaybeUnboundVariable | "VOID">);
                if (value === "VOID") rt.raiseException("transform(): operation must return a value");
                const target = yield* common.invokeDeref(rt, "transform", outputOps.deref, output);
                const result = rt.unbound(value);
                yield* common.invokeSet(rt, "transform", rt.getOpByParams("{global}", "o(_=_)", [target, result], []), target, result);
                yield* common.invokePp(rt, "transform", inputOps.pp, first);
                yield* common.invokePp(rt, "transform", outputOps.pp, output);
                if (second !== null && secondOps !== null) yield* common.invokePp(rt, "transform", secondOps.pp, second);
            }
            return output;
        }

        type IterSymbols = {
            neq: FunctionCallInstance,
            pp: FunctionCallInstance,
            deref: FunctionCallInstance,
        };
        function getIterSymbols(first: Variable, last: Variable): IterSymbols {
            // there is a reason behind postfix increment
            return {
                neq: rt.getOpByParams("{global}", "o(_!=_)", [first, last], []),
                pp: rt.getOpByParams("{global}", "o(_++)", [first], []),
                deref: rt.getOpByParams("{global}", "o(*_)", [first], []),
            };
        }
        function* set_operation(rt: CRuntime,
            first1: Variable, last1: Variable,
            first2: Variable, last2: Variable,
            d_first: Variable, _ltFun: PointerVariable<Function> | null, behaviour: { a: boolean, b: boolean, ab: boolean }): Gen<Variable> {
            const iter1 = getIterSymbols(first1, last1);
            const iter2 = getIterSymbols(first2, last2);
            const d_pp = rt.getOpByParams("{global}", "o(++_)", [d_first], []);

            let ltFun: TrueDirectPointerVariable<Function> | FunctionCallInstance | null = (_ltFun !== null)
                ? variables.asTrueDirectPointer(_ltFun) as TrueDirectPointerVariable<Function>
                ?? rt.raiseException("set_intersection: expected a pointer to a function")
                : null;

            const fname = "set_intersection";

            let d_derefInst: FunctionCallInstance | null = null;
            let setInst: FunctionCallInstance | null = null;

            function* advanceOutput(iter: Variable, iterSym: IterSymbols) {
                const ppResult = yield* common.invokePp(rt, fname, d_pp, d_first);
                if (d_derefInst === null) {
                    d_derefInst = rt.getOpByParams("{global}", "o(*_)", [ppResult], []);
                }
                const d_derefYield = rt.invokeCall(d_derefInst, [], ppResult);
                const d_derefResultOrVoid = asResult(d_derefYield) ?? (yield* d_derefYield as Gen<MaybeUnboundVariable | "VOID">);
                if (d_derefResultOrVoid === "VOID") {
                    const typeOfPpResult = rt.makeTypeStringOfVar(ppResult);
                    rt.raiseException(`set_intersection(): expected '${typeOfPpResult}::operator*' to return an object, got void`);
                }
                const d_derefResult: Variable = rt.unbound(d_derefResultOrVoid);
                const iter_derefResult: Variable = yield* common.invokeDeref(rt, fname, iterSym.deref, iter);

                if (setInst === null) {
                    setInst = rt.getOpByParams("{global}", "o(_=_)", [d_derefResult, iter_derefResult], []);
                }
                yield* common.invokeSet(rt, fname, setInst, d_derefResult, iter_derefResult);
            }

            while ((yield* common.invokeCmp(rt, iter1.neq, first1, last1)) && (yield* common.invokeCmp(rt, iter2.neq, first2, last2))) {

                const elem1 = yield* common.invokeDeref(rt, fname, iter1.deref, first1);
                const elem2 = yield* common.invokeDeref(rt, fname, iter2.deref, first2);

                if (ltFun === null) {
                    ltFun = rt.getOpByParams("{global}", "o(_<_)", [elem1, elem2], []);
                }

                const cmp1Yield = ("t" in ltFun)
                    ? rt.invokeCallFromVariable(ltFun.pointee, elem1, elem2) as ResultOrGen<ArithmeticVariable>
                    : rt.invokeCall(ltFun, [], elem1, elem2) as ResultOrGen<ArithmeticVariable>;
                const cmp1Result = rt.arithmeticValue(asResult(cmp1Yield) ?? (yield* cmp1Yield as Gen<ArithmeticVariable>));

                if (cmp1Result !== 0) {
                    if (behaviour.a) {
                        yield* advanceOutput(first1, iter1)
                    }
                    yield* common.invokePp(rt, fname, iter1.pp, first1);
                } else {
                    const cmp2Yield = ("t" in ltFun)
                        ? rt.invokeCallFromVariable(ltFun.pointee, elem2, elem1) as ResultOrGen<ArithmeticVariable>
                        : rt.invokeCall(ltFun, [], elem2, elem1) as ResultOrGen<ArithmeticVariable>;
                    const cmp2Result = rt.arithmeticValue(asResult(cmp2Yield) ?? (yield* cmp2Yield as Gen<ArithmeticVariable>));

                    if (cmp2Result === 0) {
                        // A & B
                        if (behaviour.ab) {
                            yield* advanceOutput(first1, iter1);
                        }
                        yield* common.invokePp(rt, fname, iter1.pp, first1);
                    } else {
                        // B
                        if (behaviour.b) {
                            yield* advanceOutput(first2, iter1);
                        }
                    }
                    yield* common.invokePp(rt, fname, iter2.pp, first2);
                }
            }
            while (yield* common.invokeCmp(rt, iter1.neq, first1, last1)) {
                // A
                if (behaviour.a) {
                    yield* advanceOutput(first1, iter1);
                }
                yield* common.invokePp(rt, fname, iter1.pp, first1);
            }
            while (yield* common.invokeCmp(rt, iter2.neq, first2, last2)) {
                // B
                if (behaviour.b) {
                    yield* advanceOutput(first2, iter2);
                }
                yield* common.invokePp(rt, fname, iter2.pp, first2);
            }

            return d_first;
        }
        function* set_includes(rt: CRuntime,
            first1: Variable, last1: Variable,
            first2: Variable, last2: Variable,
            _ltFun: PointerVariable<Function> | null): Gen<InitArithmeticVariable> {

            const iter1 = getIterSymbols(first1, last1);
            const iter2 = getIterSymbols(first2, last2);

            const fname = "set_includes";

            let ltFun: FunctionCallInstance | TrueDirectPointerVariable<Function> | null = (_ltFun !== null)
                ? variables.asTrueDirectPointer(_ltFun) as TrueDirectPointerVariable<Function>
                ?? rt.raiseException("set_intersection: expected a pointer to a function")
                : null;
            let retv: boolean = true;

            while ((yield* common.invokeCmp(rt, iter1.neq, first1, last1)) && (yield* common.invokeCmp(rt, iter2.neq, first2, last2))) {
                const elem1 = yield* common.invokeDeref(rt, fname, iter1.deref, first1);
                const elem2 = yield* common.invokeDeref(rt, fname, iter2.deref, first2);

                if (ltFun === null) {
                    ltFun = rt.getOpByParams("{global}", "o(_<_)", [elem1, elem2], []);
                }

                const cmp1Yield = ("t" in ltFun)
                    ? rt.invokeCallFromVariable(ltFun.pointee, elem1, elem2) as ResultOrGen<ArithmeticVariable>
                    : rt.invokeCall(ltFun, [], elem1, elem2) as ResultOrGen<ArithmeticVariable>;
                const cmp1Result = rt.arithmeticValue(asResult(cmp1Yield) ?? (yield* cmp1Yield as Gen<ArithmeticVariable>));

                if (cmp1Result !== 0) {
                    // A
                    yield* common.invokePp(rt, fname, iter1.pp, first1);
                } else {
                    const cmp2Yield = ("t" in ltFun)
                        ? rt.invokeCallFromVariable(ltFun.pointee, elem2, elem1) as ResultOrGen<ArithmeticVariable>
                        : rt.invokeCall(ltFun, [], elem2, elem1) as ResultOrGen<ArithmeticVariable>;
                    const cmp2Result = rt.arithmeticValue(asResult(cmp2Yield) ?? (yield* cmp2Yield as Gen<ArithmeticVariable>));

                    if (cmp2Result === 0) {
                        // A & B
                        yield* common.invokePp(rt, fname, iter1.pp, first1);
                    } else {
                        // B
                        retv = false;
                        break;
                    }
                    yield* common.invokePp(rt, fname, iter2.pp, first2);
                }
            }
            if (yield* common.invokeCmp(rt, iter2.neq, first2, last2)) {
                // B
                retv = false;
            }

            return variables.arithmeticNum("BOOL", retv ? 1 : 0, null);
        }

        // template<typename RandomIt> void sort(RandomIt first, RandomIt last)
        // C++ Reference does not define RandomIt.
        // It can be any value (here: 'val') that satisfies these conditions:
        // 1) RandomIt is MoveConstructible (can be constructed from computed value)
        // 2) RandomIt is CopyConstructible (exists a copy constructor)
        // 3) RandomIt is CopyAssignable (copy-assignment through operator=())
        // 4) RandomIt is Destructible.
        // 5) RandomIt is Swappable (std::swap(a, b) is possible)
        // 6) RandomIt is ValueSwappable ((*RandomIt) is Swappable).
        // 7) (*RandomIt) is MoveConstructible
        // 8) (*RandomIt) is MoveAssignable
        // 9 unwritten) Exists (*val1 < *val2).
        // 10 unwritten) Exists (val1 - val2).
        //rt.regFunc(sort_inner, "global", "sort", ["?"], rt.voidTypeLiteral);
        // JavaScript Array.sort() is always stable
        //rt.regFunc(sort_inner, "global", "stable_sort", ["?"], rt.voidTypeLiteral);
        common.regGlobalFuncs(rt, [
            {
                op: "transform",
                type: "!ParamObject !ParamObject !Parametric !Parametric FUNCTION ?1 ( ?0 ?0 ?1 PTR FUNCTION ?2 ( ?3 ) )",
                *default(rt: CRuntime, _types, ...args: Variable[]): Gen<Variable> {
                    return yield* transform_inner(rt, args[0], args[1], null, args[2], args[3]);
                }
            },
            {
                op: "transform",
                type: "!ParamObject !ParamObject FUNCTION ?1 ( ?0 ?0 ?1 CLREF Class )",
                *default(rt: CRuntime, _types, ...args: Variable[]): Gen<Variable> {
                    return yield* transform_inner(rt, args[0], args[1], null, args[2], args[3]);
                }
            },
            {
                op: "transform",
                type: "!ParamObject !ParamObject !ParamObject !Parametric !Parametric !Parametric FUNCTION ?2 ( ?0 ?0 ?1 ?2 PTR FUNCTION ?3 ( ?4 ?5 ) )",
                *default(rt: CRuntime, _types, ...args: Variable[]): Gen<Variable> {
                    return yield* transform_inner(rt, args[0], args[1], args[2], args[3], args[4]);
                }
            },
            {
                op: "transform",
                type: "!ParamObject !ParamObject !ParamObject FUNCTION ?2 ( ?0 ?0 ?1 ?2 CLREF Class )",
                *default(rt: CRuntime, _types, ...args: Variable[]): Gen<Variable> {
                    return yield* transform_inner(rt, args[0], args[1], args[2], args[3], args[4]);
                }
            },
            {
                op: "sort",
                type: "!ParamObject FUNCTION VOID ( PTR ?0 PTR ?0 )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): "VOID" { const [lhs, rhs] = args as [PointerVariable<PointeeVariable>, PointerVariable<PointeeVariable>]; return sort_inner(rt, lhs, rhs); }
            },
            {
                op: "sort",
                type: "!ParamObject FUNCTION VOID ( PTR ?0 PTR ?0 PTR FUNCTION BOOL ( CLREF ?0 CLREF ?0 ) )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): "VOID" { const [lhs, rhs, cmp] = args as [PointerVariable<PointeeVariable>, PointerVariable<PointeeVariable>, PointerVariable<Function>]; return sort_inner(rt, lhs, rhs, cmp); }
            },
            {
                op: "sort",
                type: "!ParamObject FUNCTION VOID ( PTR ?0 PTR ?0 CLREF Class )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): "VOID" { const [lhs, rhs, cmp] = args as [PointerVariable<PointeeVariable>, PointerVariable<PointeeVariable>, ClassVariable]; return sort_inner(rt, lhs, rhs, cmp); }
            },
            {
                op: "stable_sort",
                type: "!ParamObject FUNCTION VOID ( PTR ?0 PTR ?0 )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): "VOID" { const [lhs, rhs] = args as [PointerVariable<PointeeVariable>, PointerVariable<PointeeVariable>]; return sort_inner(rt, lhs, rhs); }
            },
            {
                op: "stable_sort",
                type: "!ParamObject FUNCTION VOID ( PTR ?0 PTR ?0 PTR FUNCTION BOOL ( CLREF ?0 CLREF ?0 ) )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): "VOID" { const [lhs, rhs, cmp] = args as [PointerVariable<PointeeVariable>, PointerVariable<PointeeVariable>, ClassVariable]; return sort_inner(rt, lhs, rhs, cmp); }
            },
            {
                op: "reverse",
                type: "!ParamObject FUNCTION VOID ( PTR ?0 PTR ?0 )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): "VOID" {
                    const [lhs, rhs] = args as [PointerVariable<PointeeVariable>, PointerVariable<PointeeVariable>];
                    const l: TrueIndexPointerVariable<Variable> = variables.asTrueIndexPointer(lhs) ?? rt.raiseException("sort: expected a pointer to a memory region for the parameter 'first'");
                    const r: TrueIndexPointerVariable<Variable> = variables.asTrueIndexPointer(rhs) ?? rt.raiseException("sort: expected a pointer to a memory region for the parameter 'last'");
                    if (l.pointee !== r.pointee) {
                        rt.raiseException("sort: expected parameters 'first' and 'last' to point to a same memory region");
                    }
                    const region = l.pointee.values.slice(l.index, r.index - l.index);
                    if (region.length === 0) {
                        return "VOID";
                    }
                    for (let i = 0; i < region.length; i++) {
                        const lvHolder = l.pointee.values[l.index + i].lvHolder as LValueIndexHolder<Variable>;
                        (lvHolder as any).index = l.index + i;
                        l.pointee.values[l.index + i] = {
                            ...region[(region.length - 1) - i],
                            lvHolder
                        } as Variable;

                    }
                    return "VOID";
                }
            },
            {
                op: "min_element",
                type: "!ParamObject FUNCTION PTR ?0 ( PTR ?0 PTR ?0 )",
                *default(rt: CRuntime, _templateTypes, ...args: Variable[]): Gen<InitIndexPointerVariable<Variable>> {
                    const [_first, _last] = args as [PointerVariable<PointeeVariable>, PointerVariable<PointeeVariable>];
                    return yield* extreme_element(rt, _first, _last, "min_element", "o(_<_)");
                }
            },
            {
                op: "max_element",
                type: "!ParamObject FUNCTION PTR ?0 ( PTR ?0 PTR ?0 )",
                *default(rt: CRuntime, _templateTypes, ...args: Variable[]): Gen<InitIndexPointerVariable<Variable>> {
                    const [_first, _last] = args as [PointerVariable<PointeeVariable>, PointerVariable<PointeeVariable>];
                    return yield* extreme_element(rt, _first, _last, "max_element", "o(_>_)");
                }
            },
            {
                op: "minmax_element",
                type: "!ParamObject FUNCTION CLASS pair < PTR ?0 PTR ?0 > ( PTR ?0 PTR ?0 )",
                *default(rt: CRuntime, _templateTypes, ...args: Variable[]): Gen<PairVariable<InitIndexPointerVariable<Variable>, InitIndexPointerVariable<Variable>>> {
                    const [_first, _last] = args as [PointerVariable<PointeeVariable>, PointerVariable<PointeeVariable>];
                    const first = variables.asTrueIndexPointer(_first) ?? rt.raiseException("minmax_element(): Expected 'first' to point to an element");
                    const mini = yield* extreme_element(rt, variables.indexPointer(first.pointee, first.index, false, null), _last, "minmax_element", "o(_<_)");
                    const maxi = yield* extreme_element(rt, variables.indexPointer(first.pointee, first.index, false, null), _last, "minmax_element", "o(_>_)");
                    return {
                        t: {
                            sig: "CLASS",
                            identifier: "pair",
                            memberOf: null,
                            templateSpec: [_first.t as PointerType<ObjectType>, _first.t as PointerType<ObjectType>]
                        },
                        isConst: false,
                        lvHolder: null,
                        state: "INIT",
                        members: {
                            first: variables.indexPointer(mini.pointee, mini.index, false, "SELF"),
                            second: variables.indexPointer(maxi.pointee, maxi.index, false, "SELF"),
                        }
                    };
                }
            },
            {
                op: "find",
                type: "!ParamObject FUNCTION PTR ?0 ( PTR ?0 PTR ?0 CLREF ?0 )",
                *default(rt: CRuntime, _templateTypes, ...args: Variable[]): Gen<InitIndexPointerVariable<Variable>> {
                    const [_first, _last, value] = args as [PointerVariable<PointeeVariable>, PointerVariable<PointeeVariable>, Variable];
                    if (_first.t.pointee.sig === "FUNCTION" || _last.t.pointee.sig === "FUNCTION") {
                        rt.raiseException("find(): Expected a pointer to an object variable");
                    }
                    const first = variables.asInitIndexPointer(_first) ?? rt.raiseException("find(): Expected 'first' to point to an element");
                    const last = variables.asInitIndexPointer(_last) ?? rt.raiseException("find(): Expected 'last' to point to an element");
                    if (first.pointee !== last.pointee) {
                        rt.raiseException("find(): Expected 'first' and 'last' to point to an element of the same memory region");
                    }
                    const eqInst = rt.getOpByParams("{global}", "o(_==_)", [rt.unbound(variables.deref(first) as MaybeUnboundVariable), value], []);
                    for (; first.index < last.index; first.index++) {
                        const eqYield = rt.invokeCall(eqInst, [], rt.unbound(variables.deref(first) as MaybeUnboundVariable), value) as ResultOrGen<ArithmeticVariable>;
                        const eqResult = rt.arithmeticValue(asResult(eqYield) ?? (yield* eqYield as Gen<ArithmeticVariable>))
                        if (eqResult !== 0) {
                            return first;
                        }
                    }
                    return first;
                }
            },
            {
                op: "distance",
                type: "!ParamObject FUNCTION I32 ( PTR ?0 PTR ?0 )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): InitArithmeticVariable {
                    const [_first, _last] = args as [PointerVariable<PointeeVariable>, PointerVariable<PointeeVariable>];
                    if (_first.t.pointee.sig === "FUNCTION" || _last.t.pointee.sig === "FUNCTION") {
                        rt.raiseException("find(): Expected a pointer to an object variable");
                    }
                    const first = variables.asInitIndexPointer(_first) ?? rt.raiseException("find(): Expected 'first' to point to an element");
                    const last = variables.asInitIndexPointer(_last) ?? rt.raiseException("find(): Expected 'last' to point to an element");
                    if (first.pointee !== last.pointee) {
                        rt.raiseException("find(): Expected 'first' and 'last' to point to an element of the same memory region");
                    }
                    return variables.arithmeticNum("I32", last.index - first.index, null);
                }
            },
            {
                op: "fill_n",
                type: "!ParamObject !Arithmetic !ParamObject FUNCTION ?0 ( ?0 ?1 CLREF ?2 )",
                *default(rt: CRuntime, _templateTypes, ...args: Variable[]): Gen<Variable> {
                    const [first, count, value] = args as [Variable, ArithmeticVariable, Variable];
                    //let first = variables.asInitIndexPointer(_first) ?? rt.raiseException("fill_n(): Expected 'first' to point to an element");
                    const c = rt.arithmeticValue(count);
                    const ppInst = rt.getOpByParams("{global}", "o(_++)", [first], []);
                    for (let i = 0; i !== c; i++) {
                        const ppYield = rt.invokeCall(ppInst, [], first);
                        const ppResultOrVoid = asResult(ppYield) ?? (yield* ppYield as Gen<MaybeUnboundVariable | "VOID">);
                        if (ppResultOrVoid === "VOID") {
                            const typeOfFirst = rt.makeTypeStringOfVar(first);
                            rt.raiseException(`fill_n(): expected '${typeOfFirst}::operator++' to return an object, got void`);
                        }
                        const ppResult: Variable = rt.unbound(ppResultOrVoid);
                        const derefInst = rt.getOpByParams("{global}", "o(*_)", [ppResult], []);
                        const derefYield = rt.invokeCall(derefInst, [], ppResult);
                        const derefResultOrVoid = asResult(derefYield) ?? (yield* derefYield as Gen<MaybeUnboundVariable | "VOID">);
                        if (derefResultOrVoid === "VOID") {
                            const typeOfPpResult = rt.makeTypeStringOfVar(ppResult);
                            rt.raiseException(`fill_n(): expected '${typeOfPpResult}::operator*' to return an object, got void`);
                        }
                        const derefResult: Variable = rt.unbound(derefResultOrVoid);
                        const setInst = rt.getOpByParams("{global}", "o(_=_)", [derefResult, value], []);
                        const setYield = rt.invokeCall(setInst, [], derefResult, value);
                        const setResultOrVoid = asResult(setYield) ?? (yield* setYield as Gen<MaybeUnboundVariable | "VOID">);
                        if (setResultOrVoid === "VOID") {
                            const typeOfDerefResult = rt.makeTypeStringOfVar(derefResult);
                            rt.raiseException(`fill_n(): expected '${typeOfDerefResult}::operator*' to return an object, got void`);
                        }
                    }
                    return first;
                }
            },
            {
                op: "set_intersection",
                type: "!ParamObject !ParamObject !ParamObject FUNCTION ?2 ( ?0 ?0 ?1 ?1 ?2 )",
                *default(rt: CRuntime, _templateTypes, ...args: Variable[]): Gen<Variable> {
                    const [first1, last1, first2, last2, d_first] = args as [Variable, Variable, Variable, Variable, Variable];
                    return yield* set_operation(rt, first1, last1, first2, last2, d_first, null, { a: false, b: false, ab: true });
                }
            },
            {
                op: "set_intersection",
                type: "!ParamObject !ParamObject !ParamObject !ParamObject FUNCTION ?2 ( ?0 ?0 ?1 ?1 ?2 PTR FUNCTION BOOL ( ?3 ?3 ) )",
                *default(rt: CRuntime, _templateTypes, ...args: Variable[]): Gen<Variable> {
                    const [first1, last1, first2, last2, d_first, comp] = args as [Variable, Variable, Variable, Variable, Variable, PointerVariable<Function>];
                    return yield* set_operation(rt, first1, last1, first2, last2, d_first, comp, { a: false, b: false, ab: true });
                }
            },
            {
                op: "set_union",
                type: "!ParamObject !ParamObject !ParamObject FUNCTION ?2 ( ?0 ?0 ?1 ?1 ?2 )",
                *default(rt: CRuntime, _templateTypes, ...args: Variable[]): Gen<Variable> {
                    const [first1, last1, first2, last2, d_first] = args as [Variable, Variable, Variable, Variable, Variable];
                    return yield* set_operation(rt, first1, last1, first2, last2, d_first, null, { a: true, b: true, ab: true });
                }
            },
            {
                op: "set_union",
                type: "!ParamObject !ParamObject !ParamObject !ParamObject FUNCTION ?2 ( ?0 ?0 ?1 ?1 ?2 PTR FUNCTION BOOL ( ?3 ?3 ) )",
                *default(rt: CRuntime, _templateTypes, ...args: Variable[]): Gen<Variable> {
                    const [first1, last1, first2, last2, d_first, comp] = args as [Variable, Variable, Variable, Variable, Variable, PointerVariable<Function>];
                    return yield* set_operation(rt, first1, last1, first2, last2, d_first, comp, { a: true, b: true, ab: true });
                }
            },
            {
                op: "set_difference",
                type: "!ParamObject !ParamObject !ParamObject FUNCTION ?2 ( ?0 ?0 ?1 ?1 ?2 )",
                *default(rt: CRuntime, _templateTypes, ...args: Variable[]): Gen<Variable> {
                    const [first1, last1, first2, last2, d_first] = args as [Variable, Variable, Variable, Variable, Variable];
                    return yield* set_operation(rt, first1, last1, first2, last2, d_first, null, { a: true, b: false, ab: false });
                }
            },
            {
                op: "set_difference",
                type: "!ParamObject !ParamObject !ParamObject !ParamObject FUNCTION ?2 ( ?0 ?0 ?1 ?1 ?2 PTR FUNCTION BOOL ( ?3 ?3 ) )",
                *default(rt: CRuntime, _templateTypes, ...args: Variable[]): Gen<Variable> {
                    const [first1, last1, first2, last2, d_first, comp] = args as [Variable, Variable, Variable, Variable, Variable, PointerVariable<Function>];
                    return yield* set_operation(rt, first1, last1, first2, last2, d_first, comp, { a: true, b: false, ab: false });
                }
            },
            {
                op: "set_symmetric_difference",
                type: "!ParamObject !ParamObject !ParamObject FUNCTION ?2 ( ?0 ?0 ?1 ?1 ?2 )",
                *default(rt: CRuntime, _templateTypes, ...args: Variable[]): Gen<Variable> {
                    const [first1, last1, first2, last2, d_first] = args as [Variable, Variable, Variable, Variable, Variable];
                    return yield* set_operation(rt, first1, last1, first2, last2, d_first, null, { a: true, b: true, ab: false });
                }
            },
            {
                op: "set_symmetric_difference",
                type: "!ParamObject !ParamObject !ParamObject !ParamObject FUNCTION ?2 ( ?0 ?0 ?1 ?1 ?2 PTR FUNCTION BOOL ( ?3 ?3 ) )",
                *default(rt: CRuntime, _templateTypes, ...args: Variable[]): Gen<Variable> {
                    const [first1, last1, first2, last2, d_first, comp] = args as [Variable, Variable, Variable, Variable, Variable, PointerVariable<Function>];
                    return yield* set_operation(rt, first1, last1, first2, last2, d_first, comp, { a: true, b: true, ab: false });
                }
            },
            {
                op: "includes",
                type: "!ParamObject FUNCTION ?0 ( ?0 ?0 ?0 ?0 )",
                *default(rt: CRuntime, _templateTypes, ...args: Variable[]): Gen<InitArithmeticVariable> {
                    const [first1, last1, first2, last2] = args as [Variable, Variable, Variable, Variable];
                    return yield* set_includes(rt, first1, last1, first2, last2, null);
                }
            },
            {
                op: "includes",
                type: "!ParamObject !ParamObject FUNCTION ?0 ( ?0 ?0 ?0 ?0 PTR FUNCTION BOOL ( ?1 ?1 ) )",
                *default(rt: CRuntime, _templateTypes, ...args: Variable[]): Gen<InitArithmeticVariable> {
                    const [first1, last1, first2, last2, comp] = args as [Variable, Variable, Variable, Variable, PointerVariable<Function>];
                    return yield* set_includes(rt, first1, last1, first2, last2, comp);
                }
            },
            {
                op: "remove",
                type: "!ParamObject FUNCTION PTR ?0 ( PTR ?0 PTR ?0 CLREF ?0 )",
                *default(rt: CRuntime, _templateTypes, ...args: Variable[]): Gen<InitIndexPointerVariable<Variable>> {

                    const [_first, _last, value] = args as [PointerVariable<PointeeVariable>, PointerVariable<PointeeVariable>, Variable];

                    const FNAME = 'remove';
                    const first = variables.asInitIndexPointer(_first) ?? rt.raiseException("remove(): Expected 'first' to point to an element");
                    const last = variables.asInitIndexPointer(_last) ?? rt.raiseException("remove(): Expected 'last' to point to an element");
                    if (first.pointee !== last.pointee) {
                        rt.raiseException("remove(): Expected 'first' and 'last' to point to an element of the same memory region");
                    }
                    const i = variables.clone(rt, first, "SELF");
                    const j = variables.clone(rt, first, "SELF");

                    const ppInst = rt.getOpByParams("{global}", "o(_++)", [i], []);
                    const eqInst_ref = rt.getOpByParams("{global}", "o(_==_)", [i, i], []);
                    const derefInst = rt.getOpByParams("{global}", "o(*_)", [i], []);
                    const derefResult0 = yield* common.invokeDeref(rt, FNAME, derefInst, i);
                    const eqInst_deref = rt.getOpByParams("{global}", "o(_==_)", [derefResult0, derefResult0], []);
                    const setInst_deref = rt.getOpByParams("{global}", "o(_=_)", [derefResult0, derefResult0], []);

                    for (; ;) {
                        const derefResult1 = yield* common.invokeDeref(rt, FNAME, derefInst, i);
                        if (yield* common.invokeCmp(rt, eqInst_deref, derefResult1, value)) {
                            yield* common.invokePp(rt, FNAME, ppInst, i);
                            if (yield* common.invokeCmp(rt, eqInst_ref, i, last)) {
                                return j;
                            }
                        }
                        const derefResult_i = yield* common.invokeDeref(rt, FNAME, derefInst, i);
                        const derefResult_j = yield* common.invokeDeref(rt, FNAME, derefInst, j);
                        yield* common.invokeSet(rt, FNAME, setInst_deref, derefResult_j, derefResult_i);
                        yield* common.invokePp(rt, FNAME, ppInst, i);
                        yield* common.invokePp(rt, FNAME, ppInst, j);
                        if (yield* common.invokeCmp(rt, eqInst_ref, i, last)) {
                            return j;
                        }
                    }
                }
            },
            {
                op: "remove_if",
                type: "!ParamObject FUNCTION PTR ?0 ( PTR ?0 PTR ?0 PTR FUNCTION BOOL ( CLREF ?0 ) )",
                *default(rt: CRuntime, _templateTypes, ...args: Variable[]): Gen<InitIndexPointerVariable<Variable>> {

                    const [_first, _last, _predicate] = args as [PointerVariable<PointeeVariable>, PointerVariable<PointeeVariable>, PointerVariable<Function>];

                    const FNAME = 'remove_if';
                    const first = variables.asInitIndexPointer(_first) ?? rt.raiseException("remove_if(): Expected 'first' to point to an element");
                    const last = variables.asInitIndexPointer(_last) ?? rt.raiseException("remove_if(): Expected 'last' to point to an element");
                    if (first.pointee !== last.pointee) {
                        rt.raiseException("remove_if(): Expected 'first' and 'last' to point to an element of the same memory region");
                    }

                    const predicate = variables.asTrueDirectPointer(_predicate) as TrueDirectPointerVariable<Function>
                        ?? rt.raiseException("remove(): expected a pointer to a function");

                    const predicateDeref: Function = predicate.pointee;

                    const i = variables.clone(rt, first, "SELF");
                    const j = variables.clone(rt, first, "SELF");

                    const ppInst = rt.getOpByParams("{global}", "o(_++)", [i], []);
                    const eqInst_ref = rt.getOpByParams("{global}", "o(_==_)", [i, i], []);
                    const derefInst = rt.getOpByParams("{global}", "o(*_)", [i], []);
                    const derefResult0 = yield* common.invokeDeref(rt, FNAME, derefInst, i);
                    const setInst_deref = rt.getOpByParams("{global}", "o(_=_)", [derefResult0, derefResult0], []);

                    for (; ;) {
                        const derefResult1 = yield* common.invokeDeref(rt, FNAME, derefInst, i);
                        const predYield = rt.invokeCallFromVariable(predicateDeref, derefResult1) as ResultOrGen<ArithmeticVariable>;
                        const predResultOrVoid = asResult(predYield) ?? (yield* predYield as Gen<MaybeUnboundVariable | "VOID">);
                        if (predResultOrVoid === "VOID") {
                            rt.raiseException("remove_if(): expected predicate function return value of type bool, got void.");
                        }
                        const predResult = rt.arithmeticValue(predResultOrVoid);

                        if (predResult !== 0) {
                            yield* common.invokePp(rt, FNAME, ppInst, i);
                            if (yield* common.invokeCmp(rt, eqInst_ref, i, last)) {
                                return j;
                            }
                        }
                        const derefResult_i = yield* common.invokeDeref(rt, FNAME, derefInst, i);
                        const derefResult_j = yield* common.invokeDeref(rt, FNAME, derefInst, j);
                        yield* common.invokeSet(rt, FNAME, setInst_deref, derefResult_j, derefResult_i);
                        yield* common.invokePp(rt, FNAME, ppInst, i);
                        yield* common.invokePp(rt, FNAME, ppInst, j);
                        if (yield* common.invokeCmp(rt, eqInst_ref, i, last)) {
                            return j;
                        }
                    }
                }
            },
            {
                op: "min",
                type: "!ParamObject FUNCTION ?0 ( CLREF ?0 CLREF ?0 )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], lhs: Variable, rhs: Variable) {
                    const ltInst = rt.getOpByParams("{global}", "o(_<_)", [lhs, rhs], []);
                    const ltResult = yield* common.invokeCmp(rt, ltInst, lhs, rhs);
                    return (ltResult) ? lhs : rhs;
                }
            },
            {
                op: "max",
                type: "!ParamObject FUNCTION ?0 ( CLREF ?0 CLREF ?0 )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], lhs: Variable, rhs: Variable) {
                    const ltInst = rt.getOpByParams("{global}", "o(_<_)", [lhs, rhs], []);
                    const ltResult = yield* common.invokeCmp(rt, ltInst, lhs, rhs);
                    return (ltResult) ? rhs : lhs;
                }
            },
        ]);
    }
};

