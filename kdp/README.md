# Hammy & Friends: Amazon KDP files

- `art/`: coloring pages as vector line art (SVG). They were generated in Canva and traced so they print sharp at any size.
- `build-interior.js`: builds `hammy-and-friends-interior.pdf`.
- `hammy-and-friends-interior.pdf`: the interior file you upload to KDP.

## Build

```
BOOK_AUTHOR="Your Name" node kdp/build-interior.js
```

To add a picture, drop its SVG into `art/`. Files are ordered by name, so number them (`06-duck-pond.svg`, ...). Each picture adds 2 pages: the picture and a blank back.

## KDP settings for this interior

| Setting | Value |
| --- | --- |
| Trim size | 8.5 x 11 in |
| Bleed | No bleed |
| Interior & paper | Black & white interior, white paper |
| Page count | At least 24 (the build script warns when below) |
| Manuscript | `hammy-and-friends-interior.pdf` |

The cover is a separate file. Make it after the page count is final, because the spine width depends on it.

## Cover

```
PAGES=44 BOOK_AUTHOR="Your Name" node kdp/build-cover.js
```

- Builds `hammy-and-friends-cover.pdf`: back, spine and front on one sheet, with 0.125 in bleed. The spine width is page count x 0.002252 in (white paper). Set `PAGES` to the interior's final page count.
- Front art: `cover-art/front.png` (1760 x 2336 px from Canva). `front-preview.png` is only a fallback.
- The back cover shows four interior pages as samples and leaves a white 2 x 1.2 in box at the bottom right, where KDP prints the barcode.

## One-file version

```
python3 kdp/build-combined.py
```

Builds `hammy-and-friends-complete.pdf`: front cover, all interior pages, back cover, each 8.5 x 11 in. Use it for previewing, sharing or selling as a printable download. For the KDP paperback, upload the separate interior and cover files instead.
