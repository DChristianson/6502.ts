interface RGBASurfaceInterface {
    getWidth(): number;

    getHeight(): number;

    getBuffer(): RGBASurfaceInterface.BufferInterface;

    getByteOrder(): RGBASurfaceInterface.ByteOrder;
}

module RGBASurfaceInterface {
    export const enum ByteOrder {rgba};

    export interface BufferInterface {
        [index: number]: number;
    }
}

export default RGBASurfaceInterface;