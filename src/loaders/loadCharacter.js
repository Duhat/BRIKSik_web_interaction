console.log('[MODULE] loadCharacter.js загружен');

import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

console.log('[MODULE] FBXLoader импортирован');

const loader = new FBXLoader();

console.log('[MODULE] loadCharacter.js готов');


export function loadCharacter(path) {

    console.log(
        `[LOAD CHARACTER] Начинаем загрузку: ${path}`
    );

    return new Promise((resolve, reject) => {

        loader.load(

            encodeURI(path),

            (model) => {

                console.log(
                    `[LOAD CHARACTER] Успешно загружен: ${path}`
                );

                resolve(model);
            },

            (progress) => {

                if (progress.total > 0) {

                    const percent =
                        (progress.loaded / progress.total) * 100;

                    console.log(
                        `[LOAD CHARACTER] ${percent.toFixed(1)}%`
                    );
                }

            },

            (error) => {

                console.error(
                    `[LOAD CHARACTER] ОШИБКА: ${path}`,
                    error
                );

                reject(error);
            }

        );

    });

}