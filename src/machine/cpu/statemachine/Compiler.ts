/*
 *   This file is part of 6502.ts, an emulator for 6502 based systems built
 *   in Typescript.
 *
 *   Copyright (C) 2014 - 2018 Christian Speckner & contributors
 *
 *   This program is free software; you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation; either version 2 of the License, or
 *   (at your option) any later version.
 *
 *   This program is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License along
 *   with this program; if not, write to the Free Software Foundation, Inc.,
 *   51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
 */

import CpuInterface from '../CpuInterface';
import StateMachineInterface from './StateMachineInterface';
import Instruction from '../Instruction';
import {
    Immediate,
    ZeroPage,
    Dereference,
    Absolute,
    ZeroPageIndexed,
    AbsoluteIndexed,
    IndexedIndirectX,
    Indirect
} from './addressing';
import { UnaryOneCycle, ReadModifyWrite } from './instruction';
import IndexedIndirectY from './addressing/IndirectIndexedY';
import * as ops from './ops';

export function opAslRMW(state: CpuInterface.State, operand: number): number {
    const result = (operand << 1) & 0xff;

    state.flags =
        (state.flags & ~(CpuInterface.Flags.n | CpuInterface.Flags.z | CpuInterface.Flags.c)) |
        (result & 0x80) |
        (result ? 0 : CpuInterface.Flags.z) |
        (operand >>> 7);

    return result;
}

class Compiler {
    constructor(private readonly _state: CpuInterface.State) {}

    compile(op: number): StateMachineInterface | null {
        const instruction = Instruction.opcodes[op];

        switch (instruction.operation) {
            case Instruction.Operation.adc:
                return this._createAddressing(
                    instruction.addressingMode,
                    operand => (ops.adc(this._state, operand), null),
                    { dereference: true }
                );

            case Instruction.Operation.and:
                return this._createAddressing(
                    instruction.addressingMode,
                    operand => (ops.and(this._state, operand), null),
                    { dereference: true }
                );

            case Instruction.Operation.asl:
                return instruction.addressingMode === Instruction.AddressingMode.implied
                    ? new UnaryOneCycle(this._state, ops.aslImmediate)
                    : this._createAddressing(
                          instruction.addressingMode,
                          new ReadModifyWrite(this._state, ops.aslRMW).reset,
                          { writeOp: true }
                      );

            default:
                return null;
        }
    }

    private _createAddressing(
        addressingMode: Instruction.AddressingMode,
        next: (operand: number) => StateMachineInterface.Result,
        { dereference = false, writeOp = false } = {}
    ): StateMachineInterface {
        if (dereference && addressingMode !== Instruction.AddressingMode.immediate) {
            next = new Dereference(next).reset;
        }

        switch (addressingMode) {
            case Instruction.AddressingMode.immediate:
                return new Immediate(this._state, next);

            case Instruction.AddressingMode.zeroPage:
                return new ZeroPage(this._state, next);

            case Instruction.AddressingMode.absolute:
                return new Absolute(this._state, next);

            case Instruction.AddressingMode.zeroPageX:
                return ZeroPageIndexed.zeroPageX(this._state, next);

            case Instruction.AddressingMode.zeroPageY:
                return ZeroPageIndexed.zeroPageY(this._state, next);

            case Instruction.AddressingMode.absoluteX:
                return AbsoluteIndexed.absoluteX(this._state, next, writeOp);

            case Instruction.AddressingMode.absoluteY:
                return AbsoluteIndexed.absoluteY(this._state, next, writeOp);

            case Instruction.AddressingMode.indexedIndirectX:
                return new IndexedIndirectX(this._state, next);

            case Instruction.AddressingMode.indirectIndexedY:
                return new IndexedIndirectY(this._state, next, writeOp);

            case Instruction.AddressingMode.indirect:
                return new Indirect(this._state, next);

            default:
                throw new Error(`invalid addressing mode ${addressingMode}`);
        }
    }
}

export default Compiler;