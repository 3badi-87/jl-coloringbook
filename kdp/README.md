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
