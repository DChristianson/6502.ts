import EmulationService from '../vanilla/EmulationService';
import EmulationServiceInterface from '../EmulationServiceInterface';
import RpcProviderInterface from '../../../../tools/worker/RpcProviderInterface';

import {
    RPC_TYPE,
    SIGNAL_TYPE,
    EmulationStartMessage
} from './messages';

class EmulationBackend {

    constructor(
        private _rpc: RpcProviderInterface
    ) {
        this._service = new EmulationService();
    }

    startup(): void {
        this._rpc
            .registerRpcHandler(RPC_TYPE.emulationFetchLastError, this._onFetchLastError.bind(this))
            .registerRpcHandler(RPC_TYPE.emulationPause, this._onEmulationPause.bind(this))
            .registerRpcHandler(RPC_TYPE.emulationReset, this._onEmulationReset.bind(this))
            .registerRpcHandler(RPC_TYPE.emulationResume, this._onEmulationResume.bind(this))
            .registerRpcHandler(RPC_TYPE.emulationSetRateLimit, this._onEmulationSetRateLimit.bind(this))
            .registerRpcHandler(RPC_TYPE.emulationStart, this._onEmulationStart.bind(this))
            .registerRpcHandler(RPC_TYPE.emulationStop, this._onEmulationStop.bind(this));

        this._service.frequencyUpdate.addHandler(EmulationBackend._onFrequencyUpdate, this);
        this._service.emulationError.addHandler(EmulationBackend._onEmulationError, this);
    }

    private _onFetchLastError(): string {
        const lastError = this._service.getLastError();

        return lastError ? lastError.message : null;
    }

    private _onEmulationPause(): Promise<EmulationServiceInterface.State> {
        return this._service.pause();
    }

    private _onEmulationReset(): Promise<EmulationServiceInterface.State> {
        return this._service.reset();
    }

    private _onEmulationResume(): Promise<EmulationServiceInterface.State> {
        return this._service.resume();
    }

    private _onEmulationStart(message: EmulationStartMessage): Promise<EmulationServiceInterface.State> {
        return this._service.start(message.buffer, message.config, message.cartridgeType);
    }

    private _onEmulationStop(): Promise<EmulationServiceInterface.State> {
        return this._service.stop();
    }

    private _onEmulationSetRateLimit(message: boolean): Promise<void> {
        return this._service.setRateLimit(message);
    }

    private static _onFrequencyUpdate(frequency: number, self: EmulationBackend): void {
        self._rpc.signal<number>(SIGNAL_TYPE.emulationFrequencyUpdate, frequency);
    }

    private static _onEmulationError(error: Error, self: EmulationBackend): void {
        self._rpc.signal<string>(SIGNAL_TYPE.emulationError, error ? error.message : null);
    }

    private _service: EmulationService;

}

export default EmulationBackend;
