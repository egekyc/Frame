# Frame — Photo intelligence

A static, privacy-first photography explorer built with HTML, CSS and JavaScript. Open a photograph, inspect embedded metadata, explore composition guides and download an illustrated PDF. No backend, API key, build step, analytics or image upload service.

## Features

- JPEG, PNG and WebP input, drag/drop, sample illustration; maximum 30 MB and 40 megapixels.
- EXIF, IPTC, XMP, ICC and supported file metadata through exifr, plus PNG text chunks (including compressed generation parameters where browser decompression is available).
- Camera, lens, ISO, aperture, exposure time, focal length, author and embedded capture dates.
- Evidence-based origin summary: generator mentions, declared synthetic source type, diffusion parameters, camera tags or undetermined origin.
- Seven computed composition heuristics: thirds, golden ratio grid, central composition, bilateral brightness symmetry, diagonals, horizontal transitions and low-texture space.
- Automatically selects the strongest geometric candidate using rule-specific thresholds; abstains when contrast is too low.
- Expandable gallery with the uploaded photo, overlay and explanation for each guide. Hidden until requested.
- Minimalist interface with a matching favicon and author credit. Metadata and report controls appear only after loading an image.
- Five manual guides: leading lines, golden spiral, framing, repetition and triangles.
- Original photograph, annotated composition image(s), explanations and metadata in a paginated PDF. Click Download PDF to reveal location and guide options, then Save PDF. Choose the current guide or all twelve.
- Recognised location fields are hidden by default. No images or metadata leave the browser.
- Responsive layout, keyboard controls, accessible labels and live status messages.

## Honest limitations

**This is not a validated AI-image detector.** It cannot reliably classify arbitrary image pixels as human or AI, identify the exact model/version, verify generation time, recover missing metadata, establish copyright, or determine a photographer's intent. AI-related metadata is an unverified claim and can refer to editing. Camera tags can be copied. Absence of evidence does not prove human origin. Signed C2PA/Content Credentials are not verified. There are no fabricated confidence percentages.

Composition uses downsampled luminance gradients and simple geometric comparisons, not a trained subject-recognition model. Suggested alignments are exploratory heuristics, not calibrated probabilities. Contrast-weighted centres can fall between subjects; matching brightness can look symmetric without matching objects. Leading lines, spiral placement, natural frames, repetition and triangle anchors require manual interpretation. This is a practical selection of popular guides, not an exhaustive catalogue of artistic rules.

Supported tags vary by format and library support. WebP can be displayed even when embedded metadata cannot be read. HEIC, RAW, TIFF, SVG and animated formats are not supported. Maker notes, binary payloads, sidecars and proprietary fields are not comprehensively decoded. PNG text extraction is bounded to 200 chunks, 2 MB per source chunk and 1 MB per decompressed chunk. Dates are displayed as stored where possible; timezone is not inferred. The file modification timestamp is explicitly separate from capture time.

PDF reports use embedded Noto Sans fonts with selectable text, an original-photo cover, annotated composition pages, an evidence and equipment section, and a grouped metadata index. Scripts outside the embedded font coverage use a high-resolution local-font fallback; those individual lines are not selectable, and rare scripts depend on installed system fonts. A single metadata value is limited to 12,000 characters in PDF output and marked when truncated; the app retains the extracted value. The location toggle filters recognised field names; free text, file names and the photograph itself may still reveal location or identity. Review reports before sharing.

## Implementation

`index.html` contains the interface, `styles.css` the responsive layout, `analysis.js` pure metadata/evidence/geometry functions, and `app.js` upload, PNG text parsing and rendering, and `report.js` the typeset PDF layout. The origin panel includes separate author, copyright, capture-time and camera fields.

Third-party JavaScript is vendored so ordinary use makes no external requests:

- exifr **7.1.3**, MIT — https://github.com/MikeKovarik/exifr
- jsPDF **4.2.1**, MIT — https://github.com/parallax/jsPDF
- Noto Sans Regular and Bold, SIL Open Font License — https://github.com/notofonts/noto-fonts


## License

MIT. See `LICENSE` and the third-party notices in `vendor/`.
