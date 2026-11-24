# Supabase: product library

The app reads the `products` table (`id`, `name`, `category`, `image_url`, and optionally `pinout`).
The anon key ships in the web bundle, so the app only ever **reads**; it never writes to Supabase.
Products and pinouts are authored in the Supabase dashboard.

## Enabling ready-made pinouts

Run `migrations/20260101000000_add_product_pinout.sql` once (SQL editor, or `supabase db push`).
It adds a nullable `pinout jsonb` column. Until it exists the app keeps working: products simply
have no pinout and the library shows only "Add to Canvas".

## Filling in a pinout for a product

1. In PinoutMaker, add the product image (library or upload) and label it as you want users to get it.
2. Select the image on the canvas, then in the sidebar's *Image Properties* click
   **Export as library pinout**. This downloads `<name>-pinout.json`.
3. In the Supabase dashboard open `products`, edit the product row and paste the whole file contents
   into the `pinout` column (JSON editor).

Products with a valid pinout get a "Pinout" badge and offer **Image + pinout** or **Image only**.
A template that fails validation is ignored: no badge, the image is imported on its own.

## Template format (version 1)

```json
{
  "version": 1,
  "imageWidth": 1200,
  "imageHeight": 600,
  "labelScale": 0.8,
  "pins": [ { "id": "...", "x": -300, "y": -150, "targetX": -350, "targetY": -120, "text": "PA0", "color": "#1d4ed8", "isPwm": false } ],
  "lines": [ { "id": "...", "points": [0, 0, 0, 50, 40, 50], "color": "#1f2937", "thickness": 2 } ],
  "legendItems": [ { "id": "...", "text": "ADC", "color": "#16a34a" } ]
}
```

- Coordinates are relative to the **image centre**, with the image unrotated at `imageWidth` x `imageHeight`.
  On import they are scaled to the size the image is placed at and rotated with it.
- `labelScale` is the world size of one label unit in that pixel space. A project that has no label
  size yet adopts it; otherwise the project's label size wins and the imported label offsets are
  rescaled to match.
- `lines` and `legendItems` are optional. Legend rows are added to the project only if no row with the
  same text exists. Ids are regenerated on every import.
