import EmulationServiceInterface from '../EmulationServiceInterface';
import EmulationContext from './EmulationContext';
import Board from '../../../../machine/stella/Board';
import BoardInterface from '../../../../machine/board/BoardInterface';
import StellaConfig from '../../../../machine/stella/Config';
import CartridgeFactory from '../../../../machine/stella/cartridge/CartridgeFactory';
import CartridgeInfo from '../../../../machine/stella/cartridge/CartridgeInfo';
import LimitingScheduler from '../../../../tools/scheduler/LimitingImmediateScheduler';
import SchedulerInterface from '../../../../tools/scheduler/SchedulerInterface';
import ClockProbe from '../../../../tools/ClockProbe';
import PeriodicScheduler from '../../../../tools/scheduler/PeriodicScheduler';
import Mutex from '../../../../tools/Mutex';
import Event from '../../../../tools/event/Event';
import EventInterface from '../../../../tools/event/Event';

const CLOCK_UPDATE_INTERVAL = 2000;

export default class EmulationService implements EmulationServiceInterface {

    constructor() {
        this.frequencyUpdate = this._clockProbe.frequencyUpdate;
    }

    start(
        buffer: {[i: number]: number, length: number},
        config: StellaConfig,
        cartridgeType?: CartridgeInfo.CartridgeType
    ): Promise<EmulationServiceInterface.State>
    {
        const factory = new CartridgeFactory();

        return this._mutex.runExclusive(() => {
            try {
                this._stop();

                if (this._state === EmulationServiceInterface.State.error) {
                    return this._state;
                }

                const cartridge = factory.createCartridge(buffer, cartridgeType),
                    board = new Board(config, cartridge);

                this._board = board;
                this._board.trap.addHandler(EmulationService._trapHandler, this);
                this._context = new EmulationContext(board);
                this._board.getTimer().start(this._scheduler);
                this._board.resume();

                this._clockProbe
                    .attach(this._board.clock)
                    .start();

                this._setState(EmulationServiceInterface.State.running);
            } catch (e) {
                this._setError(e);
            }

            return this._state;
        });
    }

    stop(): Promise<EmulationServiceInterface.State> {
        return this._mutex.runExclusive(() => this._stop());
    }

    pause(): Promise<EmulationServiceInterface.State> {
        return this._mutex.runExclusive(() => {
            try {
                if (this._state === EmulationServiceInterface.State.running) {
                    this._board.getTimer().stop();
                    this._board.suspend();
                    this._setState(EmulationServiceInterface.State.paused);

                    this._clockProbe.stop();
                }
            } catch (e) {
                this._setError(e);
            }

            return this._state;
        });
    }

    resume(): Promise<EmulationServiceInterface.State> {
        return this._mutex.runExclusive(() => {
            try {
                if (this._state === EmulationServiceInterface.State.paused) {
                    this._board.getTimer().start(this._scheduler);
                    this._board.resume();
                    this._setState(EmulationServiceInterface.State.running);

                    this._clockProbe.start();
                }
            } catch (e) {
                this._setError(e);
            }

            return this._state;
        });
    }

    reset(): Promise<EmulationServiceInterface.State> {
        return this._mutex.runExclusive(() => {
            try {
                switch (this._state) {
                    case EmulationServiceInterface.State.running:
                    case EmulationServiceInterface.State.paused:
                        this._board.reset();
                        break;
                }
            } catch (e) {
                this._setError(e);
            }

            return this._state;
        });
    }

    getState(): EmulationServiceInterface.State {
        return this._state;
    }

    getEmulationContext(): EmulationContext {
        switch (this._state) {
            case EmulationServiceInterface.State.running:
            case EmulationServiceInterface.State.paused:
                return this._context;

            default:
                return null;
        }
    }

    getLastError(): Error {
        return this._lastError;
    }

    getFrequency(): number {
        return this._clockProbe.getFrequency();
    }

    private _stop(): EmulationServiceInterface.State {
        try {
            if (this._state === EmulationServiceInterface.State.running) {
                this._board.getTimer().stop();
                this._board.suspend();
                this._board.trap.removeHandler(EmulationService._trapHandler, this);

                this._clockProbe
                    .stop()
                    .detach();
            }
            this._board = null;

            this._context = null;
            this._setState(EmulationServiceInterface.State.stopped);
        } catch (e) {
            this._setError(e);
        }

        return this._state;
    }

    private _setError(e: Error): void {
        this._lastError = e;
        this._setState(EmulationServiceInterface.State.error);
    }

    private _setState(state: EmulationServiceInterface.State): EmulationServiceInterface.State {
        if (state !== this._state) {
            this._state = state;
            this.stateChanged.dispatch(state);
        }

        return this._state;
    }

    private static _trapHandler(trap: BoardInterface.TrapPayload, self: EmulationService) {
        self._setError(new Error(`TRAP: ${trap.message}`));
    }

    stateChanged = new Event<EmulationServiceInterface.State>();
    frequencyUpdate: EventInterface<number>;

    private _state = EmulationServiceInterface.State.stopped;
    private _lastError: Error = null;
    private _board: Board;
    private _context: EmulationContext;
    private _scheduler: SchedulerInterface = new LimitingScheduler();
    private _clockProbe = new ClockProbe(new PeriodicScheduler(CLOCK_UPDATE_INTERVAL));
    private _mutex = new Mutex();

}