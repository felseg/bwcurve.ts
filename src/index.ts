// utils
const fromHexString = (hexString: string) => {
    const noSpaces = hexString.replace(/\s/g, '');
    return Uint8Array.from(noSpaces.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
};

const stringToHex = (str: string) => {
    return str
        .split('')
        .map((c) => c.charCodeAt(0).toString(16))
        .join('');
};

type BWCurvePoint = {
    x: number;
    y: number;
    slope: number;
};

type BWCurveCategories = 'Envelope' | 'Lookup' | 'Periodic' | 'Sequence';

type BWCurveMetadata = {
    creator: string;
    description: string;
    name: string;
    tags: string[];
    category: BWCurveCategories;
};

type InternalData = {
    length: number;
};

class BWCurve {
    private internal: InternalData;
    private metadata: BWCurveMetadata;
    private points: BWCurvePoint[];

    constructor() {
        this.points = [];
        this.internal = {
            length: 1.0,
        };
        this.metadata = {
            name: 'default',
            creator: 'default',
            category: 'Envelope',
            description: 'default',
            tags: ['default'],
        };
        return this;
    }

    public setPoints<T>(
        points: T[],
        converter: (
            x: T,
            idx?: number,
            array?: T[]
        ) => Pick<Partial<BWCurvePoint>, 'slope'> & Pick<BWCurvePoint, 'x' | 'y'>
    ) {
        this.points = points.map((p, idx, array) => {
            const { x, y, slope } = converter(p, idx, array);
            return {
                x,
                y,
                slope: slope ?? 0.0,
            };
        });
        return this;
    }

    public spliceCurve(curve: BWCurve) {}

    get category() {
        return this.metadata.category;
    }

    public setCategory(category: BWCurveCategories) {
        this.metadata.category = category;
        return this;
    }

    get creator() {
        return this.metadata.creator;
    }

    setCreator(creator: string) {
        this.metadata.creator = creator;
        return this;
    }

    get name() {
        return this.metadata.name;
    }

    setName(name: string) {
        this.metadata.name = name;
        return this;
    }

    get tags() {
        return this.metadata.tags;
    }

    public setTags(tags: string[]) {
        this.metadata.tags = tags;
        return this;
    }

    public addTag(tag: string) {
        this.metadata.tags.push(tag);
        return this;
    }

    public removeTag(tag: string) {
        this.metadata.tags = this.metadata.tags.filter((t) => t !== tag);
        return this;
    }

    get pointCount() {
        return this.points.length;
    }

    get(index: number) {
        return this.points[index];
    }

    public addPoint(point: BWCurvePoint) {
        this.points.push(point);
        return this;
    }

    public removePoint(index: number) {
        this.points.splice(index, 1);
        return this;
    }

    public static readBuffer(buffer: Uint8Array) {
        return new BWCurve();
    }

    public writeBuffer() {
        const spacer = fromHexString('00 00 00');
        const stop = fromHexString('00');

        let points: Uint8Array[] = this.points.map(({ x, y, slope }) => {
            let structure = new Uint8Array([
                ...fromHexString('00 12 7E 00 00 35 FD 07'),
                // 8
                // fill with big endian double y
                ...new Uint8Array(8),
                // 16
                ...fromHexString('00 00 35 FE 07'),
                // 21
                // fill with big endian double x
                ...new Uint8Array(8),
                // 29
                ...fromHexString('00 00 35 FF 07'),
                // 34
                // fill with big endian double slope
                ...new Uint8Array(8),
                // 42
                ...fromHexString('00 00 00 00 00'),
            ]);

            const dataView = new DataView(structure.buffer);
            dataView.setFloat64(8, y, false);
            dataView.setFloat64(21, x, false);
            dataView.setFloat64(34, slope, false);
            return structure;
        });

        let pointsLength = 0;
        points.forEach((p) => (pointsLength += p.length));

        const mergedPoints = new Uint8Array(pointsLength);
        let offset = 0;
        points.forEach((p) => {
            mergedPoints.set(p, offset);
            offset += p.length;
        });

        return Uint8Array.from([
            /// header
            ...fromHexString(
                '42 74 57 67 30 30 30 33 30 30 30 32 30 30 30 30 30 30 30 30 31 35 30 65 30 30 30 30 30 30 30 30 30 30 30 30 30 30 30 30 30 30'
            ),
            ...spacer,
            ...fromHexString('04'),
            ...spacer,
            // meta
            ...fromHexString('04 6D 65 74 61'),
            ...spacer,
            ...fromHexString('01'),
            ...spacer,
            // application_version_name
            ...fromHexString('18 61 70 70 6C 69 63 61 74 69 6F 6E 5F 76 65 72 73 69 6F 6E 5F 6E 61 6D 65 08'),
            ...spacer,
            // currently 5.2.2
            ...fromHexString('05 35 2E 32 2E 32'),
            ...spacer,
            ...fromHexString('01'),
            ...spacer,
            // branch
            ...fromHexString('06 62 72 61 6E 63 68 08'),
            ...spacer,
            // releases
            ...fromHexString('08 72 65 6C 65 61 73 65 73'),
            ...spacer,
            ...fromHexString('01'),
            ...spacer,
            // comment
            ...fromHexString('07 63 6F 6D 6D 65 6E 74'),
            ...fromHexString('08'),
            ...spacer,
            ...fromHexString(this.metadata.description.length.toString(16)),
            ...fromHexString(stringToHex(this.metadata.description)),
            ...spacer,
            ...fromHexString('01'),
            ...spacer,
            // creator
            ...fromHexString('07 63 72 65 61 74 6F 72 08'),
            ...spacer,
            ...fromHexString(this.metadata.creator.length.toString(16)),
            ...fromHexString(stringToHex(this.metadata.creator)),
            ...spacer,
            ...fromHexString('01'),
            ...spacer,
            ...fromHexString('0E'),
            // curve category
            ...fromHexString('63 75 72 76 65 5F 63 61 74 65 67 6F 72 79 08'),
            ...spacer,
            ...fromHexString(this.metadata.category.length.toString(16)),
            ...fromHexString(stringToHex(this.metadata.category)),
            ...spacer,
            ...fromHexString('01'),
            ...spacer,
            ...fromHexString('0A'),
            // curve_kind
            ...fromHexString('63 75 72 76 65 5F 6B 69 6E 64 01 02'),
            ...spacer,
            ...fromHexString('01'),
            ...spacer,
            // revision_id
            ...fromHexString('0B 72 65 76 69 73 69 6F 6E 5F 69 64 08'),
            ...spacer,
            // long string of numbers
            ...fromHexString(
                '28 31 64 39 35 34 37 37 33 36 65 34 32 35 37 64 36 61 61 37 64 33 34 66 39 66 64 64 39 62 38 63 34 66 39 39 38 34 61 36 30'
            ),
            ...spacer,
            ...fromHexString('01'),
            ...spacer,
            // revision_no
            ...fromHexString('0B 72 65 76 69 73 69 6F 6E 5F 6E 6F 03 00 02 45 A0'),
            ...spacer,
            ...fromHexString('01'),
            ...spacer,
            // tags
            ...fromHexString('04 74 61 67 73 08'),
            ...spacer,
            ...fromHexString(
                this.tags.length === 0
                    ? '00'
                    : this.tags
                          //stop byte, count only as one character
                          .join('0')
                          .length.toString(16)
            ),
            ...fromHexString(this.tags.map((t) => stringToHex(t)).join('20')),
            ...spacer,
            ...fromHexString('01'),
            ...spacer,
            // type (MIME)
            ...fromHexString('04 74 79 70 65 08'),
            ...spacer,
            // application/bitwig-curve
            ...fromHexString('18 61 70 70 6C 69 63 61 74 69 6F 6E 2F 62 69 74 77 69 67 2D 63 75 72 76 65'),
            ...spacer,
            ...fromHexString('00'),
            ...fromHexString('20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 0A'),
            ...fromHexString('00'),
            // points list declaration and deserilization information
            ...fromHexString(
                '00 12 7F 00 00 36 2D 01 02 00 00 36 46 05 01 00 00 36 01 01 20 00 00 36 02 01 01 00 00 36 35 01 00 00 00 36 03 12 00'
            ),
            ...mergedPoints,
            // points list end
            ...fromHexString('00 00 03 00 00 37 88 01 FF 00 00 36 65 01 FF 00 00 36 66 01 FF 00'),
            // creator
            ...fromHexString('00 36 0B 08'),
            ...spacer,
            // curve name
            ...fromHexString(this.metadata.name.length.toString(16)),
            ...fromHexString(stringToHex(this.metadata.name)),
            ...stop,
            ...fromHexString('00 36 21 08'),
            ...spacer,
            // creator
            ...fromHexString(this.metadata.creator.length.toString(16)),
            ...fromHexString(stringToHex(this.metadata.creator)),
            ...stop,
            ...fromHexString('00 36 23 08'),
            ...spacer,
            ...fromHexString(this.metadata.description.length.toString(16)),
            ...fromHexString(stringToHex(this.metadata.description)),
            ...stop,
            ...fromHexString('00 36 22 08'),
            ...spacer,
            ...fromHexString(this.metadata.category.length.toString(16)),
            ...fromHexString(stringToHex(this.metadata.category)),
            ...stop,
            ...fromHexString('00 36 A6 08'),
            ...spacer,
            ...fromHexString(
                this.tags.length === 0
                    ? '00'
                    : this.tags
                          //stop byte, count only as one character
                          .join('0')
                          .length.toString(16)
            ),
            ...fromHexString(this.tags.map((t) => stringToHex(t)).join('20')),
            ...stop,
            ...spacer,
        ]);
    }
}

export default BWCurve;
