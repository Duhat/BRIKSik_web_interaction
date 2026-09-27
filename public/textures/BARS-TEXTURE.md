# Окраска Барсика

`bars-snow-leopard-fur.png` — текстура меха, созданная встроенным ImageGen.
Материал: `src/characters/applyBarsAppearance.js`.

Мех накладывается по трём осям исходной геометрии, чтобы не зависеть от швов UV.
Маски морды, груди, глаз, носа и ушей вычисляются в исходных координатах модели
`Defoult.fbx` и движутся вместе со скелетом. Это материал приложения, а не
запечённый универсальный атлас: для экспорта в другой редактор потребуется запекание.
При замене геометрии координаты масок нужно проверить заново.

## Final generation prompt (built-in ImageGen)

Asset type: seamless tileable base-color fur texture for a cute stylized snow leopard 3D mascot. Generate a square seamless texture swatch filling the entire image edge to edge, NOT an animal, NOT a UV atlas, NOT islands. Warm silver-gray and ivory short fur with spaced irregular charcoal-gray broken-ring rosettes, small muted taupe-gray interiors. About 5 rosettes across the width, medium to small variation, distributed evenly, clear distinct rings with lots of ivory negative space, subtle short fur brushwork. Flat unlit albedo only, no shading, no shadows, no highlights, no depth, no background, no borders, no text. Both horizontal and vertical edges must tile seamlessly. Soft friendly hand-painted game character style. Avoid high-contrast pure black, yellow tiger color, long hairs, illustration composition.
