var cpuRunner = require('./runner/cpu'),
    Cpu = require('../src/Cpu');

function branchSuite(mnemonic, opcode, jumpCondition, noJumpCondition) {
    suite(mnemonic, function() {
        test('immediate, no branch', function() {
            cpuRunner
                .create([opcode, 0x0F], 0xE000)
                .setState({
                    flags: noJumpCondition
                })
                .run()
                .assertCycles(2)
                .assertState({
                    p: 0xE000 + 2
                });
        });

        test('immediate, forward branch', function() {
            cpuRunner
                .create([opcode, 0x0F], 0xE000)
                .setState({
                    flags: jumpCondition
                })
                .run()
                .assertCycles(3)
                .assertState({
                    p: 0xE000 + 2 + 0x0F
                });
        });

        test('immediate, backward branch, page crossing', function() {
            cpuRunner
                .create([opcode, (~0x0A & 0xFF) + 1], 0xE000)
                .setState({
                    flags: jumpCondition
                })
                .run()
                .assertCycles(4)
                .assertState({
                    p: 0xE000 + 2 - 0x0A
                });
        });

    });

}

function clearFlagSuite(mnemonic, opcode, flag) {
    suite(mnemonic, function() {
        test('vanilla', function() {
            cpuRunner
                .create([opcode])
                .setState({
                    flags: Cpu.Flags.e | flag
                })
                .run()
                .assertCycles(2)
                .assertState({
                    flags: Cpu.Flags.e
                });
        });
    });
}

function setFlagSuite(mnemonic, opcode, flag) {
    suite(mnemonic, function() {
        test('vanilla', function() {
            cpuRunner
                .create([opcode])
                .setState({
                    flags: Cpu.Flags.e
                })
                .run()
                .assertCycles(2)
                .assertState({
                    flags: Cpu.Flags.e | flag
                });
        });
    });
}

suite('CPU', function() {

    clearFlagSuite('CLC', 0x18, Cpu.Flags.c);

    clearFlagSuite('CLD', 0xD8, Cpu.Flags.d);

    branchSuite('BCC', 0x90, 0, Cpu.Flags.c);

    branchSuite('BNE', 0xD0, 0, Cpu.Flags.z);

    branchSuite('BEQ', 0xF0, Cpu.Flags.z, 0);

    suite('DEY', function() {
        test('starting with 0x01, flags', function() {
            cpuRunner
                .create([0x88])
                .setState({
                    y: 0x01,
                    flags: 0xFF & ~Cpu.Flags.z
                })
                .run()
                .assertCycles(2)
                .assertState({
                    flags: 0xFF & ~Cpu.Flags.n,
                    y: 0
                });
        });

        test('starting with 0x00, flags', function() {
            cpuRunner
                .create([0x88])
                .setState({
                    y: 0,
                    flags: 0xFF & ~Cpu.Flags.n
                })
                .run()
                .assertCycles(2)
                .assertState({
                    flags: 0xFF & ~Cpu.Flags.z,
                    y: 0xFF
                });
        });
    });

    suite('INY', function() {
        test('starting with 0xFF, flags', function() {
            cpuRunner
                .create([0xC8])
                .setState({
                    y: 0xFF,
                    flags: 0xFF & ~Cpu.Flags.z
                })
                .run()
                .assertCycles(2)
                .assertState({
                    flags: 0xFF & ~Cpu.Flags.n,
                    y: 0
                });
        });

        test('starting with 0x7E, flags', function() {
            cpuRunner
                .create([0xC8])
                .setState({
                    y: 0x7F,
                    flags: 0xFF & ~Cpu.Flags.n
                })
                .run()
                .assertCycles(2)
                .assertState({
                    flags: 0xFF & ~Cpu.Flags.z,
                    y: 0x80
                });
        });
    });

    suite('JMP', function() {
        test('absolute', function() {
            cpuRunner
                .create([0x4C, 0x67, 0xA1])
                .run()
                .assertCycles(3)
                .assertState({
                    p: 0xA167
                });
        });

        test('indirect', function() {
            cpuRunner
                .create([0x6C, 0x67, 0xA1])
                .poke({
                    '0xA167': 0x34,
                    '0xA168': 0x56
                })
                .run()
                .assertCycles(5)
                .assertState({
                    p: 0x5634
                });
        });

        test('indirect, wraparound', function() {
            cpuRunner
                .create([0x6C, 0xFF, 0xA1])
                .poke({
                    '0xA1FF': 0x34,
                    '0xA100': 0x56
                })
                .run()
                .assertCycles(5)
                .assertState({
                    p: 0x5634
                });
        });

    });

    suite('JSR', function() {
        test('vanilla', function() {
            cpuRunner
                .create([0x20, 0x67, 0xA1], 0xE000)
                .setState({
                    s: 0xFF
                })
                .run()
                .assertCycles(6)
                .assertState({
                    p: 0xA167,
                    s: 0xFD
                })
                .assertMemory({
                    '0x01FE': 0x02,
                    '0x01FF': 0xE0
                });
        });

        test('stack overflow', function() {
            cpuRunner
                .create([0x20, 0x67, 0xA1], 0xE000)
                .setState({
                    s: 0x00
                })
                .run()
                .assertCycles(6)
                .assertState({
                    p: 0xA167,
                    s: 0xFE
                })
                .assertMemory({
                    '0x01FF': 0x02,
                    '0x0100': 0xE0
                });
        });
    });

    suite('LDA', function() {
        test('immediate, 0x00, flags', function() {
            cpuRunner
                .create([0xA9, 0])
                .setState({
                    a: 0x10,
                    flags: 0xFF & ~Cpu.Flags.z
                })
                .run()
                .assertCycles(2)
                .assertState({
                    a: 0,
                    flags: 0xFF & ~Cpu.Flags.n
                });
        });

        test('zeroPage, 0xFF, flags', function() {
            cpuRunner
                .create([0xA5, 0x12])
                .poke({
                    '0x12': 0xFF
                })
                .setState({
                    flags: 0xFF & ~Cpu.Flags.n
                })
                .run()
                .assertCycles(3)
                .assertState({
                    a: 0xFF,
                    flags: 0xFF & ~Cpu.Flags.z
                });
        });

        test('zeroPage,X , wraparound, 0x34, flags', function() {
            cpuRunner
                .create([0xB5, 0x12])
                .setState({
                    x: 0xFE,
                    flags: 0xFF
                })
                .poke({
                    '0x10': 0x34
                })
                .run()
                .assertCycles(4)
                .assertState({
                    a: 0x34,
                    flags: 0xFF & ~Cpu.Flags.z & ~Cpu.Flags.n
                });
        });

        test('absolute', function() {
            cpuRunner
                .create([0xAD, 0x12, 0x44])
                .poke({
                    '0x4412': 0x34
                })
                .run()
                .assertCycles(4)
                .assertState({
                    a: 0x34
                });
        });

        test('absolute,X', function() {
            cpuRunner
                .create([0xBD, 0x12, 0x44])
                .setState({
                    x: 0x01
                })
                .poke({
                    '0x4413': 0x34
                })
                .run()
                .assertCycles(4)
                .assertState({
                    a: 0x34
                });
        });

        test('absolute,X , page crossing', function() {
            cpuRunner
                .create([0xBD, 0xFF, 0xFF])
                .setState({
                    x: 0x02
                })
                .poke({
                    '0x0001': 0x34
                })
                .run()
                .assertCycles(5)
                .assertState({
                    a: 0x34
                });
        });

        test('absolute,Y', function() {
            cpuRunner
                .create([0xB9, 0x12, 0x44])
                .setState({
                    y: 0x01
                })
                .poke({
                    '0x4413': 0x34
                })
                .run()
                .assertCycles(4)
                .assertState({
                    a: 0x34
                });
        });

        test('absolute,Y , page crossing', function() {
            cpuRunner
                .create([0xB9, 0xFF, 0xFF])
                .setState({
                    y: 0x02
                })
                .poke({
                    '0x0001': 0x34
                })
                .run()
                .assertCycles(5)
                .assertState({
                    a: 0x34
                });
        });

        test('indirect,X , wraparound during sum', function() {
            cpuRunner
                .create([0xA1, 0x32])
                .setState({
                    x: 0xFE
                })
                .poke({
                    '0x0030': 0x20,
                    '0x0031': 0x30,
                    '0x3020': 0x35
                })
                .run()
                .assertCycles(6)
                .assertState({
                    a: 0x35
                });
        });

        test('indirect,Y , wraparound during address read', function() {
            cpuRunner
                .create([0xB1, 0xFF])
                .setState({
                    y: 0x01
                })
                .poke({
                    '0x00FF': 0x20,
                    '0x0000': 0x30,
                    '0x3021': 0x36
                })
                .run()
                .assertCycles(5)
                .assertState({
                    a: 0x36
                });
        });

        test('indirect,Y , page crossing', function() {
            cpuRunner
                .create([0xB1, 0xFE])
                .setState({
                    y: 0xFF
                })
                .poke({
                    '0x00FE': 0x01,
                    '0x00FF': 0x30,
                    '0x3100': 0x36
                })
                .run()
                .assertCycles(6)
                .assertState({
                    a: 0x36
                });
        });
    });

    suite('LDX', function() {
        test('immediate, 0x00, flags', function() {
            cpuRunner
                .create([0xA2, 0x00])
                .setState({
                    x: 0x10,
                    flags: 0xFF & ~Cpu.Flags.z
                })
                .run()
                .assertCycles(2)
                .assertState({
                    x: 0,
                    flags: 0xFF & ~Cpu.Flags.n
                });
        });

        test('zeroPage, 0xFF, flags', function() {
            cpuRunner
                .create([0xA6, 0x10])
                .poke({
                    '0x0010': 0xFF
                })
                .setState({
                    flags: 0xFF & ~Cpu.Flags.n
                })
                .run()
                .assertCycles(3)
                .assertState({
                    x: 0xFF,
                    flags: 0xFF & ~Cpu.Flags.z
                });
        });

        test('zeroPage,Y , wraparound, 0x23, flags', function() {
            cpuRunner
                .create([0xB6, 0x12])
                .poke({
                    '0x0011': 0x23
                })
                .setState({
                    y: 0xFF,
                    flags: 0xFF
                })
                .run()
                .assertCycles(4)
                .assertState({
                    x: 0x23,
                    flags: 0xFF & ~Cpu.Flags.n & ~Cpu.Flags.z
                });
        });

        test('absolute', function() {
            cpuRunner
                .create([0xAE, 0x11, 0xAE])
                .poke({
                    '0xAE11': 0x23
                })
                .run()
                .assertCycles(4)
                .assertState({
                    x: 0x23
                });
        });

        test('absolute,Y', function() {
            cpuRunner
                .create([0xBE, 0x10, 0xAE])
                .poke({
                    '0xAE11': 0x23
                })
                .setState({
                    y: 0x01
                })
                .run()
                .assertCycles(4)
                .assertState({
                    x: 0x23
                });
        });

        test('absolute,Y , page crossing', function() {
            cpuRunner
                .create([0xBE, 0x02, 0xAE])
                .poke({
                    '0xAF01': 0x23
                })
                .setState({
                    y: 0xFF
                })
                .run()
                .assertCycles(5)
                .assertState({
                    x: 0x23
                });
        });
    });

    suite('LDY', function() {
        test('immediate, 0x00, flags', function() {
            cpuRunner
                .create([0xA0, 0x00])
                .setState({
                    y: 0x10,
                    flags: 0xFF & ~Cpu.Flags.z
                })
                .run()
                .assertCycles(2)
                .assertState({
                    y: 0,
                    flags: 0xFF & ~Cpu.Flags.n
                });
        });

        test('zeroPage, 0xFF, flags', function() {
            cpuRunner
                .create([0xA4, 0x10])
                .poke({
                    '0x0010': 0xFF
                })
                .setState({
                    flags: 0xFF & ~Cpu.Flags.n
                })
                .run()
                .assertCycles(3)
                .assertState({
                    y: 0xFF,
                    flags: 0xFF & ~Cpu.Flags.z
                });
        });

        test('zeroPage,X , 0x23, flags', function() {
            cpuRunner
                .create([0xB4, 0x10])
                .poke({
                    '0x0011': 0x23
                })
                .setState({
                    x: 0x01,
                    flags: 0xFF
                })
                .run()
                .assertCycles(4)
                .assertState({
                    y: 0x23,
                    flags: 0xFF & ~Cpu.Flags.n & ~Cpu.Flags.z
                });
        });

        test('absolute', function() {
            cpuRunner
                .create([0xAC, 0x11, 0xAE])
                .poke({
                    '0xAE11': 0x23
                })
                .run()
                .assertCycles(4)
                .assertState({
                    y: 0x23
                });
        });

        test('absolute,X', function() {
            cpuRunner
                .create([0xBC, 0x10, 0xAE])
                .poke({
                    '0xAE11': 0x23
                })
                .setState({
                    x: 0x01
                })
                .run()
                .assertCycles(4)
                .assertState({
                    y: 0x23
                });
        });

        test('absolute,X , page crossing', function() {
            cpuRunner
                .create([0xBC, 0x02, 0xAE])
                .poke({
                    '0xAF01': 0x23
                })
                .setState({
                    x: 0xFF
                })
                .run()
                .assertCycles(5)
                .assertState({
                    y: 0x23
                });
        });
    });

    suite('NOP', function() {
        test('vanilla', function() {
            cpuRunner
                .create([0xEA])
                .run()
                .assertCycles(2)
                .assertState();
        });
    });

    setFlagSuite('SEC', 0x38, Cpu.Flags.c);

    suite('RTS', function() {
        test('vanilla', function() {
            cpuRunner
                .create([0x60])
                .setState({
                    s: 0xFD
                })
                .poke({
                    '0x01FE': 0xCC,
                    '0x01FF': 0xAB
                })
                .run()
                .assertCycles(6)
                .assertState({
                    s: 0xFF,
                    p: 0xABCD
                });
        });

        test('stack underflow', function() {
            cpuRunner
                .create([0x60])
                .setState({
                    s: 0xFE
                })
                .poke({
                    '0x01FF': 0xCC,
                    '0x0100': 0xAB
                })
                .run()
                .assertCycles(6)
                .assertState({
                    s: 0x00,
                    p: 0xABCD
                });
        });
    });

    suite('STA', function() {
        test('zeroPage , flags', function() {
            cpuRunner
                .create([0x85, 0x10])
                .setState({
                    a: 0x45,
                    flags: 0xFF
                })
                .run()
                .assertCycles(3)
                .assertState()
                .assertMemory({
                    '0x0010': 0x45
                });
        });

        test('zeroPage,X', function() {
            cpuRunner
                .create([0x95, 0x10])
                .setState({
                    a: 0x45,
                    x: 0x04
                })
                .run()
                .assertCycles(4)
                .assertState()
                .assertMemory({
                    '0x0014': 0x45
                });
        });

        test('absolute', function() {
            cpuRunner
                .create([0x8D, 0x10, 0x11])
                .setState({
                    a: 0x45
                })
                .run()
                .assertCycles(4)
                .assertState()
                .assertMemory({
                    '0x1110': 0x45
                });
        });

        test('absolute,X', function() {
            cpuRunner
                .create([0x9D, 0x10, 0x11])
                .setState({
                    a: 0x45,
                    x: 0x10
                })
                .run()
                .assertCycles(5)
                .assertState()
                .assertMemory({
                    '0x1120': 0x45
                });
        });

        test('absolute,X , page crossing', function() {
            cpuRunner
                .create([0x9D, 0x10, 0x11])
                .setState({
                    a: 0x45,
                    x: 0xFF
                })
                .run()
                .assertCycles(5)
                .assertState()
                .assertMemory({
                    '0x120F': 0x45
                });
        });

        test('absolute,Y', function() {
            cpuRunner
                .create([0x99, 0x10, 0x11])
                .setState({
                    a: 0x45,
                    y: 0x10
                })
                .run()
                .assertCycles(5)
                .assertState()
                .assertMemory({
                    '0x1120': 0x45
                });
        });

        test('absolute,Y , page crossing', function() {
            cpuRunner
                .create([0x99, 0x10, 0x11])
                .setState({
                    a: 0x45,
                    y: 0xFF
                })
                .run()
                .assertCycles(5)
                .assertState()
                .assertMemory({
                    '0x120F': 0x45
                });
        });

        test('indirect,X , wraparound during address read', function() {
            cpuRunner
                .create([0x81, 0xFE])
                .setState({
                    a: 0x45,
                    x: 0x01
                })
                .poke({
                    '0x00FF': 0x0F,
                    '0x0000': 0x12
                })
                .run()
                .assertCycles(6)
                .assertState()
                .assertMemory({
                    '0x120F': 0x45
                });
        });

        test('indirect,Y', function() {
            cpuRunner
                .create([0x91, 0x50])
                .setState({
                    a: 0x45,
                    y: 0x05
                })
                .poke({
                    '0x0050': 0x01,
                    '0x0051': 0x12
                })
                .run()
                .assertCycles(6)
                .assertState()
                .assertMemory({
                    '0x1206': 0x45
                });
        });

        test('indirect,Y , page crossing', function() {
            cpuRunner
                .create([0x91, 0x50])
                .setState({
                    a: 0x45,
                    y: 0xFE
                })
                .poke({
                    '0x0050': 0x03,
                    '0x0051': 0x12
                })
                .run()
                .assertCycles(6)
                .assertState()
                .assertMemory({
                    '0x1301': 0x45
                });
        });
    });

    suite('TXS', function() {
        test('vanilla, flags', function() {
            cpuRunner
                .create([0x9A])
                .setState({
                    x: 0xDE,
                    s: 0x00,
                    flags: 0xFF
                })
                .run()
                .assertCycles(2)
                .assertState({
                    s: 0xDE
                });
        });
    });

});
