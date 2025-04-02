/* eslint-disable no-shadow */
import { CRuntime, ClassType, ArrayVariable, Variable, ObjectVariable, VariableValue, IntVariable, ObjectValue, VariableType } from "../rt";
import { ios_base, getBit } from "./shared/ios_base"
import { Iterator } from "./shared/iterator";

export = {
    load(rt: CRuntime) {
        interface ifStreamObject extends ObjectVariable {
            v: ObjectValue
        };

        const newStringType: ClassType = rt.newClass("string", []);
        rt.addToNamespace("std", "string", newStringType);

        const npos = rt.val(rt.intTypeLiteral, -1, true);
        rt.addToNamespace("std::string", "npos", npos);

        const typeSig = rt.getTypeSignature(newStringType);

        const stringHandlers = {
            "o(())": {
                default(rt: CRuntime, _this: Variable, ...args: Variable[]) {
                    const [ init_string ] = args;

                    _this.v = init_string?.v || rt.makeCharArrayFromString("").v as VariableValue;
                }
            },
            "o(=)": {
                default(rt: CRuntime, left: any, right: any) {
                    if (!left.left) {
                        rt.raiseException(rt.makeValString(left) + " is not a left value");
                    } else if (left.readonly) {
                        rt.raiseException(`assignment of read-only variable ${rt.makeValString(left)}`);
                    }

                    left.v = _convertSingleCharIntoStringArray(right).v;
                    return left;
                },
            },
            "o(+)": {
                default(rt: CRuntime, left: Variable, right: ArrayVariable) {
                    if (left.v.constructor.name === Iterator.name) {
                        (left as any).index += right.v;
                        return left;
                    }

                    const r = rt.getStringFromCharArray(left as ArrayVariable) + rt.getStringFromCharArray(_convertSingleCharIntoStringArray(right));
                    left.v = rt.makeCharArrayFromString(r).v;
                    return left;
                }
            },
            "o(-)": {
                default(rt: CRuntime, left: Variable, right: any) {
                    if (left.v.constructor.name !== Iterator.name) {
                       rt.raiseException("no match for operator o(-)"); 
                    }

                    (left as any).index -= right.v;
                    return left;
                }
            },
            "o(==)": {
                default(rt: CRuntime, left: ArrayVariable, right: ArrayVariable) {
                    const l = rt.getStringFromCharArray(left);
                    const r = rt.getStringFromCharArray(right);
                    return rt.val(rt.boolTypeLiteral, l === r);
                }
            },
            "o(!=)": {
                default(rt: CRuntime, left: ArrayVariable, right: ArrayVariable) {
                    const l = rt.getStringFromCharArray(left);
                    const r = rt.getStringFromCharArray(right);
                    return rt.val(rt.boolTypeLiteral, l !== r);
                }
            },
            "o(+=)": {
                default(rt: CRuntime, left: Variable, right: ArrayVariable) {
                    const r = stringHandlers["o(+)"].default(rt, left, right);
                    return stringHandlers["o(=)"].default(rt, left, r);
                }
            },
            "o([])": {
                default(rt: CRuntime, left: ArrayVariable, right: any) {
                    return left.v.target[right.v];
                }
            },
            "o(<)": {
                default(rt: CRuntime, left: ArrayVariable, right: any) {
                    const l = rt.getStringFromCharArray(left);
                    const r = rt.getStringFromCharArray(right);
                    return rt.val(rt.boolTypeLiteral, _compareStrings(l, r) === -1);
                }
            },
            "o(>)": {
                default(rt: CRuntime, left: ArrayVariable, right: any) {
                    const l = rt.getStringFromCharArray(left);
                    const r = rt.getStringFromCharArray(right);
                    return rt.val(rt.boolTypeLiteral, _compareStrings(l, r) === 1);
                }
            },
        };

        rt.types[typeSig].handlers = stringHandlers;

        const _compareStrings = function(str1: string, str2: string) {
            let i = 0;
            const len1 = str1.length;

            // Compare characters
            while (i < len1) {
                if (str1.charCodeAt(i) < str2.charCodeAt(i)) {
                    return -1;
                } else if (str1.charCodeAt(i) > str2.charCodeAt(i)) {
                    return 1;
                }
                i++;
            }

            // Strings are equal
            return 0;
        };

        const _convertSingleCharIntoStringArray = function(charArray: any) {
            if (charArray.v.target)
                return charArray;

            return rt.makeCharArrayFromString(String.fromCharCode(charArray.v as number));
        };

        const _getSubstring = function(rt: CRuntime, left: Variable, pos: IntVariable, npos: IntVariable) {
            const r = rt.getStringFromCharArray(left as ArrayVariable).substring(pos.v, npos != null ? pos.v + npos.v : undefined);
            return rt.makeCharArrayFromString(r);
        };

        const _getStringLength = function(rt: CRuntime, _this: Variable) {
            const len = rt.getStringFromCharArray(_this as ArrayVariable).length;
            _this = rt.val(rt.intTypeLiteral, len);
            return _this;
        };

        rt.regFunc(function(rt: CRuntime, _this: Variable) {
            const limits = rt.config.limits["int"];

            return {
                t: rt.intTypeLiteral,
                v: limits.max,
                left: false
            };
        }, newStringType, "max_size", [], rt.intTypeLiteral);

        rt.regFunc((function() {
            const replaceOverloads = {
                // replaceWithChar: (str: string, pos: number, n: number, m: number, c: string): string => str.slice(0, pos) + c.repeat(m) + str.slice(pos + n),
                replaceWithString: (str: string, pos: number, n: number, str2: string): string => str.slice(0, pos) + str2 + str.slice(pos + n),
                // replaceWithSubstring: (str: string, pos1: number, n: number, str2: string, pos2: number, m: number): string => str.slice(0, pos1) + str2.slice(pos2, pos2 + m) + str.slice(pos1 + n),
                // replaceCharRange: (str: string, first: number, last: number, n: number, c: string): string => str.slice(0, first) + c.repeat(last - first) + str.slice(last),
                // replaceStringRange: (str: string, first: number, last: number, str2: string): string => str.slice(0, first) + str2 + str.slice(last),
                // replaceSubstringRange: (str: string, first: number, last: number, str2: string, str2_first: number, str2_last: number): string => str.slice(0, first) + str2.slice(str2_first, str2_last) + str.slice(last)
            };

            return function(rt: CRuntime, _this: ArrayVariable, first: Variable, last: Variable, str: ArrayVariable) {
                let result: string = rt.getStringFromCharArray(str);
                if (rt.isIntegerType(first) && rt.isIntegerType(last) && rt.isStringType(str)) {
                    result = replaceOverloads.replaceWithString(rt.getStringFromCharArray(_this), first.v as number, last.v as number, result);
                } else if (first.v.constructor.name === Iterator.name && last.v.constructor.name === Iterator.name) {
                    result = replaceOverloads.replaceWithString(rt.getStringFromCharArray(_this), (first as any).index as number, (last as any).index as number, result);
                } else {
                    rt.raiseException("no matching function call");
                }

                const finalString = rt.makeCharArrayFromString(result);
                _this.v = finalString.v;

                return finalString;
            };
        })(), newStringType, "replace", ["?"], newStringType);

        rt.regFunc(function(rt: CRuntime, _this: ArrayVariable) {
            const iterator: Iterator = new Iterator(rt.charTypeLiteral, _this, _this.v.target);
            return iterator.begin();
        }, newStringType, "begin", [], "?" as unknown as VariableType);

        rt.regFunc(function(rt: CRuntime, _this: ArrayVariable) {
            const iterator: Iterator = new Iterator(rt.charTypeLiteral, _this, _this.v.target);
            let end = iterator.end();
            end.index--;
            return end;
        }, newStringType, "end", [], "?" as unknown as VariableType);

        rt.regFunc(_getStringLength, newStringType, "length", [], rt.intTypeLiteral);
        rt.regFunc(_getStringLength, newStringType, "size", [], rt.intTypeLiteral);
        rt.regFunc(_getSubstring, newStringType, "substr", [rt.intTypeLiteral], newStringType, [{
            name: "npos",
            type: rt.intTypeLiteral,
            expression: ""
        }]);

        rt.regFunc(function(rt: CRuntime, left: Variable, str: Variable, pos: IntVariable, n: IntVariable) {
            const index = rt.getStringFromCharArray(_convertSingleCharIntoStringArray(left)).indexOf(rt.getStringFromCharArray(_convertSingleCharIntoStringArray(str)).substring(0, n?.v), pos?.v);
            left = rt.val(rt.intTypeLiteral, index);
            return left;
        }, newStringType, "find", ["?"], newStringType, [{
            name: "pos",
            type: rt.intTypeLiteral,
            expression: ""
        }, {
            name: "n",
            type: rt.intTypeLiteral,
            expression: ""
        }]);

        rt.regFunc(function(rt: CRuntime, _this: Variable, append_str: Variable, subpos: IntVariable, sublen: IntVariable) {
            let r = rt.getStringFromCharArray(_this as ArrayVariable);
            r += rt.getStringFromCharArray((!subpos ? append_str : _getSubstring(rt, append_str, subpos, sublen)) as ArrayVariable);

            _this.v = rt.makeCharArrayFromString(r).v;
            return _this;
        }, newStringType, "append", ["?"], newStringType, [
            {
                name: "subpos",
                type: rt.intTypeLiteral,
                expression: ""
            }, {
                name: "sublen",
                type: rt.intTypeLiteral,
                expression: ""
            }
        ]);

        rt.regFunc(function(rt: CRuntime, _this: Variable) {
            _this.v = rt.makeCharArrayFromString("").v;
        }, newStringType, "clear", [], rt.voidTypeLiteral);

        const _isEmpty = function(rt: CRuntime, _this: Variable) {
            if (_this === null || typeof _this === 'undefined') {
                return rt.val(rt.boolTypeLiteral, true);
            }
            const str = rt.getStringFromCharArray(_this as ArrayVariable);
            return rt.val(rt.boolTypeLiteral, str.length === 0);
        };

        rt.regFunc(_isEmpty, newStringType, "empty", [], rt.boolTypeLiteral);

        const _to_string = function(rt: CRuntime, _this: Variable, value: IntVariable) {
            const str = value.v.toString();
            const newString = rt.makeCharArrayFromString(str);
            return newString;
        };

        rt.regFunc(_to_string, "global", "to_string", [rt.intTypeLiteral], newStringType);
        rt.addToNamespace("std", "to_string", rt.readVar("to_string"));

        rt.regFunc(function(rt: CRuntime, _this: Variable, readStream: ifStreamObject, str: Variable, delim: Variable) {

            function setBitTrue(_this: ifStreamObject, bit: number) {
                _this.v.members["state"].v = (_this.v.members["state"].v as number) | bit;
            }

            const fileObject: any = readStream.v.members["fileObject"];
            const delimiter: number = delim != null ? delim.v as number : ("\n").charCodeAt(0);
            const delimChar: string = String.fromCharCode(delimiter);

            if (!fileObject && readStream.t.name === "istream") {
                const iStream: any = (readStream.v as any).istream;

                iStream.cinStop();
                iStream.getInput().then((input: string) => {
                    iStream.write(`${input}\n`);
                    str.v = rt.makeCharArrayFromString(input).v;
                    iStream.cinProceed();
                });

                return rt.val(rt.boolTypeLiteral, true);
            }

            if (getBit(readStream.v.members['state'].v as number, ios_base.iostate.eofbit)) {
                return rt.val(rt.charTypeLiteral, 0);
            }

            const internal_buffer: any = (rt.getStringFromCharArray(readStream.v.members["buffer"] as ArrayVariable)).split(delimChar);

            const line = internal_buffer.shift();
            if (line != null) {
                str.v = rt.makeCharArrayFromString(line).v;
                readStream.v.members["buffer"].v = rt.makeCharArrayFromString(internal_buffer.join(delimChar)).v;
                if (internal_buffer.length === 0) {
                    // The stream approached the file end while reading.
                    // Successful if the stream has read any text.
                    setBitTrue(readStream, ios_base.iostate.eofbit);
                    if (line.length === 0) {
                        // The stream did not find a separator nor
                        // read any text.
                        setBitTrue(readStream, ios_base.iostate.failbit);
                    }
                }
            } else {
                // Empty string -- no data nor separator has been read (thus failbit).
                // Immediately approached file end (thus eofbit).
                setBitTrue(readStream, ios_base.iostate.eofbit);
                setBitTrue(readStream, ios_base.iostate.failbit);
            }

            // pass a [readStream::operator bool()] as a return value.
            const readStreamTypeSig = rt.getTypeSignature(readStream.t);
            const val = rt.types[readStreamTypeSig].handlers["o(bool)"].functions[''](rt, readStream);
            return rt.val(rt.boolTypeLiteral, val !== false);
        }, "global", "getline", ["?"], rt.boolTypeLiteral, [
            {
                name: "delim",
                type: rt.charTypeLiteral,
                expression: ""
            }
        ]);

        rt.addToNamespace("std", "getline", rt.readVar("getline"));

        rt.regFunc(function(rt: CRuntime, _this: Variable, concatCount: Variable, charToRepeat: Variable) {
            if (rt.isPrimitiveType(charToRepeat)) {
                return rt.val(newStringType, rt.makeCharArrayFromString(String.fromCharCode(charToRepeat.v as number).repeat(concatCount.v as number)).v);
            }
            // rt.raiseException("no matching function for call");
        }, "global", "string", [rt.intTypeLiteral, rt.charTypeLiteral], newStringType);

        rt.regFunc(function(rt: CRuntime, left: Variable, pos: IntVariable, length: IntVariable) {
            const str = rt.getStringFromCharArray(left as ArrayVariable);
            const r = str.slice(0, pos.v) + str.slice(pos.v + (length?.v ?? str.length));
            left.v = rt.makeCharArrayFromString(r).v;
        }, newStringType, "erase", [rt.intTypeLiteral], newStringType, [{
            name: "length",
            type: rt.intTypeLiteral,
            expression: ""
        }]);

        // conversion functions, as defined in: https://en.cppreference.com/w/cpp/string/basic_string/stof

        const _addConversion = function(_rt: CRuntime, fnName: string, outType: any, parseFn: any) {
            rt.regFunc(function(rt: CRuntime, _fn: Variable, str: Variable) {
                const carr = rt.getStringFromCharArray(str as ArrayVariable);
                return rt.val(outType, parseFn(carr));
            }, "global", fnName, [newStringType], outType);
        }

        // TODO: read 'pos' and 'base' parameters
        _addConversion(rt, "stod", rt.doubleTypeLiteral, parseFloat);
        _addConversion(rt, "stof", rt.floatTypeLiteral, parseFloat);
        _addConversion(rt, "stoi", rt.intTypeLiteral, parseInt);
        _addConversion(rt, "stol", rt.longTypeLiteral, parseInt);
        // (stold) the engine does not support 'long double' types
        // (stoll) the engine does not support 'long long' types
        // (stoul, stoull) the engine does not support 'unsigned long' and 'unsigned long long' types

    }
};
