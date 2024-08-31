# BWCurve.ts

NOTE: Until this package gets to 1.0.0 it will not follow SemVer, the API _will_ change suddenly without any warning. Only use this package if you are fine with that.

BWCurve.ts is a Browser and Node.js compatible TypeScript library to read, write and modify Bitwig Studios .bwcurve format. Reading .bwcurve is not yet supported, but will be added as soon as possible.

## Usage

Basic Usage:

```ts
import { BWCurve } from 'bwcurve.ts';

const curve = new BWCurve()
    .setCreator('Alice')
    .setCategory('Envelope')
    .setName('My Curve')
    .setTags(['tag1', 'tag2'])
    .setPoints(
        [
            { x: 0, y: 0, slope: 0 },
            { x: 1, y: 1, slope: 0 },
        ],
        (p) => p
    )
    .toBuffer();

// save the file if you're in node, download the file if you're in the browser
```

Converting wav files:

```ts
import { BWCurve } from 'bwcurve.ts';

// ensure that the file is mono, or select a specific channel
const { channelData } = wavReader('path/to/file');

const curve = new BWCurve()
    .setCreator('Alice')
    .setCategory('Envelope')
    .setName('My Curve')
    .setTags(['tag1', 'tag2'])
    .setPoints(channel_data, (sample, idx, array) => {
        return {
            x: idx / array.length,
            y: Math.max(0.0, Math.min(1.0, y * 0.5 + 0.5)),
            slope: 0,
        };
    })
    .clamp()
    .fitInXRange(0, 1)
    .toBuffer();

// save curve to file
```
