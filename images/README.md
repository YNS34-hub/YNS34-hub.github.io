# Photo files

The current story uses 4K masters named `photo-01.jpg` through `photo-15.jpg`.

You can use JPG, PNG, WebP, or AVIF. If filenames differ, update the `image` fields in `src/data/galleryData.ts`. Missing files are intentionally replaced by a styled neutral artwork, so the experience remains usable while you change photos.

Responsive WebP files live in `responsive/` and are selected automatically with `srcSet`, so gallery cards do not decode all 15 full-resolution masters on mobile. The untouched inputs and Image 2 restorations are archived outside `public/` in `source-images/`.

Run `python scripts/build_photo_assets.py` after changing the source images to rebuild the 4K masters and responsive variants.
