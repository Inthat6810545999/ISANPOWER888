# Landing illustrations

## Artwork credit

Original artwork: [@zenex.arts on Instagram](https://www.instagram.com/zenex.arts?g=5), as credited by the user who supplied the references. The website backgrounds are AI-adapted versions of these references; they are not unmodified originals. A visible linked credit appears in the landing page footer on desktop and mobile.

Prepared with the built-in ImageGen tool from the two user-provided laboratory sketches. PNG files are editable source exports; the page serves compressed WebP versions (1536 × 1024).

## Hero prompt

Edit image 1 (front-on hand-drawn laboratory workbench) into a polished website background. Image 2 is only a supporting style reference; produce ONLY the edited front-on image 1. Preserve its charming imperfect thin hand drawn linework, shelves, glassware, wood desk and hanging lamps. Wide landscape 1536x1024. Palette flat warm ivory #f6f3ea background, muted taupe brown #91816b lines, subtle pale sage liquids. No black harsh lines. Remove all smoke completely from the flask on right: animation will be added in code. Keep the open mouth of that flask clearly visible at approximately x=76%, y=48% of image. Remove all text, poster writing, slider dots. Critical: very large completely blank ivory central negative space from x=20% to 72%, y=15% to 65% for website title and login. Relocate central poles and posters to outer edges, keep laboratory objects concentrated at left/right edges and bottom 25%. Retain composition as a real illustrated laboratory, not a UI mockup. No text, no lettering, no characters, no smoke anywhere. Refined airy editorial scientific sketch, quiet background, clean flat ivory.

## Overview prompt

Produce ONE edited version of the user's SECOND reference image: the low-angle perspective hand-drawn laboratory workbench with wall corner, hanging lamps and shelf. First image is palette/style support only. This is the second static website background, no animation. Preserve the second reference's distinctive low camera perspective and hand-drawn wooden table, beakers and shelf. Refine to thin muted taupe brown #91816b sketch lines on flat warm ivory #f6f3ea, tiny pale sage liquid accents, no harsh black. Wide landscape 1536x1024. Keep upper left 60% airy and almost empty ivory for website text, shift strong diagonal wall seams away from this text area or erase them. Concentrate tabletop/glassware in right half and lower 40%. Remove all text, logos, dots, watermarks. No smoke, no character, no website UI. Match a quiet warm scientific editorial line illustration with generous clean negative space. Do not produce the front-facing view; use the user's second low-angle view.

## Integration

`LabScene.tsx` uses a shared SVG viewBox for the hero image and steam paths, anchored to the generated flask mouth at (1200, 601). CSS animates only the steam with staggered seven-second loops and respects reduced-motion preferences. When replacing artwork, check this anchor against the new image. The overview illustration is static; CSS ivory overlays protect the text areas at desktop and mobile sizes.
