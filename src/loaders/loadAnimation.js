console.log('[MODULE] loadAnimation.js загружен');

import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

console.log('[MODULE] FBXLoader импортирован для анимаций');

const loader = new FBXLoader();

console.log('[MODULE] loadAnimation.js готов');


export function loadAnimation(path) {

    console.log(
        `[LOAD ANIMATION] Начинаем загрузку: ${path}`
    );

    return new Promise((resolve, reject) => {

        loader.load(

            encodeURI(path),

            (fbx) => {

                console.log(
                    `[LOAD ANIMATION] FBX загружен: ${path}`
                );


                if (
                    !fbx.animations ||
                    fbx.animations.length === 0
                ) {

                    console.error(
                        `[LOAD ANIMATION] В файле нет анимации: ${path}`
                    );

                    reject(
                        new Error(
                            `В файле ${path} не найдена анимация`
                        )
                    );

                    return;
                }


                console.log(
                    `[LOAD ANIMATION] Найдено анимаций: ${fbx.animations.length}`
                );


                console.log(
                    `[LOAD ANIMATION] Используем clip: ${fbx.animations[0].name}`
                );


                resolve(
                    fbx.animations[0]
                );

            },

            (progress) => {

                if (progress.total > 0) {

                    const percent =
                        (progress.loaded / progress.total) * 100;

                    console.log(
                        `[LOAD ANIMATION] ${percent.toFixed(1)}%`
                    );
                }

            },

            (error) => {

                console.error(
                    `[LOAD ANIMATION] ОШИБКА: ${path}`,
                    error
                );

                reject(error);
            }

        );

    });

}

export function loadAnimationFromBuffer(buffer, fileName = 'upload.fbx') {
    console.log(`[LOAD ANIMATION] Разбираем FBX из памяти: ${fileName}`);

    const data =
      buffer instanceof ArrayBuffer
        ? buffer
        : ArrayBuffer.isView(buffer)
          ? buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
          : buffer;

    const fbx = loader.parse(data, '');

    if (!fbx.animations || fbx.animations.length === 0) {
        throw new Error(`В файле ${fileName} не найдена анимация`);
    }

    console.log(
        `[LOAD ANIMATION] Найдено анимаций: ${fbx.animations.length}, clip: ${fbx.animations[0].name}`
    );

    return fbx.animations[0];
}